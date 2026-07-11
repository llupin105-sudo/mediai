/**
 * server.js
 * Serveur Express — API REST du SaaS médical
 * Base de données : PostgreSQL (Render)
 *
 * Routes :
 *   POST /api/auth/signup             - Création de compte
 *   POST /api/auth/login              - Connexion
 *   GET  /api/auth/me                 - État du compte connecté
 *   PUT  /api/auth/profile            - Mise à jour du profil médecin
 *   POST /api/audio/transcribe        - Audio → texte (Whisper)
 *   POST /api/transcription/analyze   - Pipeline complet texte → compte-rendu
 *   GET  /api/compterendu/:id         - Récupère un compte-rendu sauvegardé
 *   POST /api/create-checkout-session - Démarre un paiement Stripe
 *   GET  /api/verify-session          - Vérifie un paiement Stripe
 *   GET  /health                      - Health check
 */

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Stripe = require('stripe');
const { OAuth2Client } = require('google-auth-library');
const { anonymize, deanonymize } = require('./anonymizer');
const { PROMPTS, DOSSIER_SUMMARY_PROMPT, SEARCH_PROMPT, PRE_CONSULT_PROMPT, INTERACTION_CHECK_PROMPT } = require('./prompts');
const db = require('./db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 Mo max, comme la limite de l'API Whisper
});

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-a-changer-en-production';
const FREE_LIMIT = 3;

// ── DEBUG : vérifie la clé au démarrage du serveur ─────────────────
console.log('═══════════════════════════════════════');
console.log('DEBUG - Dossier de travail actuel :', process.cwd());
console.log('DEBUG - Clé API détectée :', process.env.ANTHROPIC_API_KEY
  ? process.env.ANTHROPIC_API_KEY.slice(0, 20) + '... (longueur: ' + process.env.ANTHROPIC_API_KEY.length + ')'
  : 'AUCUNE — utilisera YOUR_KEY_HERE par défaut !');
console.log('DEBUG - DATABASE_URL détectée :', process.env.DATABASE_URL ? 'oui' : 'NON — la base ne fonctionnera pas');
console.log('═══════════════════════════════════════');

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── CORS ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Middleware de journalisation HDS (écrit maintenant en base) ────
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  db.logAudit({
    id: crypto.randomUUID(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    userEmail: req.headers['x-user-id'] || null,
    requestId,
  });
  next();
});

// ── Auth middleware : vérifie un vrai token JWT, charge l'utilisateur en base ──
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserByEmail(payload.email);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    req.medecin = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide ou expirée' });
  }
}

function publicUser(user) {
  return {
    email: user.email,
    isPro: user.isPro,
    freeUsageCount: user.freeUsageCount,
    profile: user.profile,
    preferences: user.preferences,
  };
}

// ────────────────────────────────────────────────────────────────────
// POST /api/auth/signup
// ────────────────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email invalide ou mot de passe trop court (8 caractères minimum)' });
  }
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await db.getUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.createUser({ id: crypto.randomUUID(), email: normalizedEmail, passwordHash });

    const token = jwt.sign({ email: normalizedEmail }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[ERROR signup]', err.message);
    return res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

// ────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();

  try {
    const user = await db.getUserByEmail(normalizedEmail);
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign({ email: normalizedEmail }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[ERROR login]', err.message);
    return res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// ────────────────────────────────────────────────────────────────────
// POST /api/auth/google
// Corps : { credential: <ID token renvoyé par Google Identity Services> }
// ────────────────────────────────────────────────────────────────────
app.post('/api/auth/google', async (req, res) => {
  if (!googleClient) {
    return res.status(500).json({ error: 'Connexion Google non configurée côté serveur' });
  }
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Jeton Google manquant' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = (payload.email || '').trim().toLowerCase();

    if (!email || !payload.email_verified) {
      return res.status(401).json({ error: 'Email Google non vérifié' });
    }

    const user = await db.findOrCreateGoogleUser(email);
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[GOOGLE AUTH ERROR]', err.message);
    return res.status(401).json({ error: 'Connexion Google invalide' });
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ────────────────────────────────────────────────────────────────────
app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.medecin) });
});

// ────────────────────────────────────────────────────────────────────
// PUT /api/auth/profile
// ────────────────────────────────────────────────────────────────────
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  const { nom, rpps, cabinet, telephone, specialite, presentation } = req.body;
  try {
    const updated = await db.updateUserProfile(req.medecin.email, {
      nom: (nom || '').trim(),
      rpps: (rpps || '').trim(),
      cabinet: (cabinet || '').trim(),
      telephone: (telephone || '').trim(),
      specialite: (specialite || '').trim(),
      presentation: (presentation || '').trim().slice(0, 500),
    });
    return res.json({ success: true, profile: updated.profile });
  } catch (err) {
    console.error('[ERROR profile]', err.message);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
});

// ────────────────────────────────────────────────────────────────────
// PUT /api/auth/preferences — modèles et préférences personnalisées
// ────────────────────────────────────────────────────────────────────
app.put('/api/auth/preferences', requireAuth, async (req, res) => {
  const { defaultSpecialite, instructions } = req.body;
  const validSpecialites = Object.keys(PROMPTS);
  const safeSpecialite = validSpecialites.includes(defaultSpecialite) ? defaultSpecialite : 'generaliste';

  // Limite raisonnable pour éviter des prompts personnalisés démesurés
  const safeInstructions = (instructions || '').trim().slice(0, 1000);

  try {
    const updated = await db.updateUserPreferences(req.medecin.email, {
      defaultSpecialite: safeSpecialite,
      instructions: safeInstructions,
    });
    return res.json({ success: true, preferences: updated.preferences });
  } catch (err) {
    console.error('[ERROR preferences]', err.message);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour des préférences' });
  }
});

// ────────────────────────────────────────────────────────────────────
// POST /api/audio/transcribe
// ────────────────────────────────────────────────────────────────────
app.post('/api/audio/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Transcription audio non configurée côté serveur' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier audio reçu' });
  }

  try {
    const form = new FormData();
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname || 'audio.webm');
    form.append('model', 'whisper-1');
    form.append('language', 'fr');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error('[WHISPER ERROR]', whisperRes.status, errText);
      throw new Error(`Whisper API error: ${whisperRes.status}`);
    }

    const data = await whisperRes.json();
    return res.json({ success: true, text: data.text || '' });
  } catch (err) {
    console.error('[ERROR] transcription audio', req.requestId, err.message);
    return res.status(500).json({ error: 'Erreur lors de la transcription audio' });
  }
});

// ────────────────────────────────────────────────────────────────────
// POST /api/transcription/analyze
// ────────────────────────────────────────────────────────────────────
app.post('/api/transcription/analyze', requireAuth, async (req, res) => {
  const { transcription, specialite = 'generaliste', patientId } = req.body;
  const user = req.medecin;

  if (!user.isPro && user.freeUsageCount >= FREE_LIMIT) {
    return res.status(402).json({ error: 'Quota gratuit atteint', upgradeRequired: true, limit: FREE_LIMIT });
  }
  if (!patientId) {
    return res.status(400).json({ error: 'Sélectionnez un patient avant de générer un compte-rendu' });
  }
  if (!transcription || transcription.trim().length < 50) {
    return res.status(400).json({ error: 'Transcription trop courte (minimum 50 caractères)' });
  }
  if (!PROMPTS[specialite]) {
    return res.status(400).json({ error: `Spécialité non supportée. Options : ${Object.keys(PROMPTS).join(', ')}` });
  }

  try {
    // Vérifie que le patient existe et appartient bien à ce médecin
    const patient = await db.getPatientById(patientId);
    if (!patient || patient.medecin_id !== user.id) {
      return res.status(403).json({ error: 'Patient introuvable ou accès refusé' });
    }

    // 1. Anonymisation
    const { anonymized, tokenMap, stats: anonStats } = anonymize(transcription);

    // 2. Appel API Claude
    const prompt = PROMPTS[specialite];
    const customInstructions = user.preferences?.instructions
      ? `\n\nPréférences personnelles de ce médecin à respecter en priorité (sans jamais contredire les règles ci-dessus) :\n${user.preferences.instructions}`
      : '';
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || 'YOUR_KEY_HERE',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4000,
        system: prompt.system + customInstructions,
        messages: [{ role: 'user', content: prompt.user(anonymized) }]
      })
    });

    if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);

    const claudeData = await claudeRes.json();
    const textBlocks = claudeData.content.filter(block => block.type === 'text');
    const rawText = textBlocks.map(block => block.text).join('\n');
    if (!rawText) throw new Error("Claude n'a renvoyé aucun texte exploitable");

    // 3. Parse JSON
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Réponse Claude invalide');
    const compteRenduTokenise = JSON.parse(jsonMatch[0]);

    // 4. Dé-anonymisation
    const restored = deanonymize(JSON.stringify(compteRenduTokenise), tokenMap);
    const compteRenduFinal = JSON.parse(restored);

    // 5. Sauvegarde comme événement médical, rattaché au patient
    // (structure générique qui accueillera aussi les ordonnances et
    // courriers, et servira de base à la chronologie intelligente)
    const id = crypto.randomUUID();
    const tokensUsed = (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);
    await db.createMedicalEvent({
      id,
      patientId,
      medecinId: user.id,
      type: 'consultation',
      title: compteRenduFinal.resume_1_ligne || 'Consultation',
      data: compteRenduFinal,
      tokensUsed,
    });

    // 6. Incrémente le quota gratuit en base, si applicable
    let updatedUser = user;
    if (!user.isPro) {
      updatedUser = await db.incrementFreeUsage(user.email);
    }

    return res.json({
      success: true,
      id,
      compteRendu: compteRenduFinal,
      meta: {
        anonymisation: anonStats,
        tokens: tokensUsed,
        cout_eur: (tokensUsed * 0.000003).toFixed(4),
      },
      account: {
        isPro: updatedUser.isPro,
        freeUsageCount: updatedUser.freeUsageCount,
        freeLimit: FREE_LIMIT,
      },
    });

  } catch (err) {
    console.error('[ERROR]', req.requestId, err.message);
    return res.status(500).json({ error: 'Erreur lors de la génération du compte-rendu', requestId: req.requestId });
  }
});

// ────────────────────────────────────────────────────────────────────
// POST /api/courrier/generate
// Génère un courrier de correspondance à partir d'un événement
// consultation existant, via Claude, et l'enregistre comme nouvel
// événement rattaché au même patient.
// ────────────────────────────────────────────────────────────────────
app.post('/api/courrier/generate', requireAuth, async (req, res) => {
  const { patientId, eventId, motifAdressage } = req.body;
  const user = req.medecin;

  if (!patientId || !eventId) {
    return res.status(400).json({ error: 'Patient ou consultation source manquant' });
  }

  try {
    const patient = await db.getPatientById(patientId);
    if (!patient || patient.medecin_id !== user.id) {
      return res.status(403).json({ error: 'Patient introuvable ou accès refusé' });
    }
    const sourceEvent = await db.getMedicalEventById(eventId);
    if (!sourceEvent || sourceEvent.patient_id !== patientId) {
      return res.status(404).json({ error: 'Consultation source introuvable' });
    }

    // Le compte-rendu source est déjà dé-anonymisé en base — on le
    // ré-anonymise avant de le renvoyer à Claude pour générer le courrier.
    const compteRenduStr = JSON.stringify(sourceEvent.data);
    const { anonymized, tokenMap } = anonymize(compteRenduStr);
    const anonymizedJson = JSON.parse(anonymized);

    const prompt = PROMPTS.courrier;
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || 'YOUR_KEY_HERE',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user(anonymizedJson, motifAdressage) }]
      })
    });

    if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);

    const claudeData = await claudeRes.json();
    const textBlocks = claudeData.content.filter(block => block.type === 'text');
    const rawText = textBlocks.map(block => block.text).join('\n');
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Réponse Claude invalide');
    const courrierTokenise = JSON.parse(jsonMatch[0]);

    const restored = deanonymize(JSON.stringify(courrierTokenise), tokenMap);
    const courrierFinal = JSON.parse(restored);

    // Ajoute les infos d'expéditeur (médecin) et de patient pour la mise en page PDF
    courrierFinal.expediteur = {
      nom: user.profile?.nom || user.email,
      rpps: user.profile?.rpps || '',
      cabinet: user.profile?.cabinet || '',
    };
    courrierFinal.patient = { nom: patient.nom, prenom: patient.prenom, dateNaissance: patient.date_naissance };
    courrierFinal.date = new Date().toISOString();

    const id = crypto.randomUUID();
    const tokensUsed = (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);
    await db.createMedicalEvent({
      id,
      patientId,
      medecinId: user.id,
      type: 'courrier',
      title: courrierFinal.objet || 'Courrier de correspondance',
      data: courrierFinal,
      tokensUsed,
    });

    return res.json({ success: true, id, courrier: courrierFinal });
  } catch (err) {
    console.error('[ERROR courrier]', req.requestId, err.message);
    return res.status(500).json({ error: 'Erreur lors de la génération du courrier' });
  }
});

// ────────────────────────────────────────────────────────────────────
// POST /api/ordonnance/check-interactions
// Filet de vigilance sur les interactions médicamenteuses — n'est PAS
// un outil de décision clinique, voir prompts.js pour le cadrage complet.
// ────────────────────────────────────────────────────────────────────
app.post('/api/ordonnance/check-interactions', requireAuth, async (req, res) => {
  const { medicaments } = req.body;
  if (!Array.isArray(medicaments) || medicaments.length < 2) {
    return res.json({
      success: true,
      resultat: {
        interactions_detectees: [],
        aucune_interaction_majeure_connue: true,
        rappel: 'Au moins deux médicaments sont nécessaires pour une vérification croisée.',
      }
    });
  }

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || 'YOUR_KEY_HERE',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 800,
        system: INTERACTION_CHECK_PROMPT.system,
        messages: [{ role: 'user', content: INTERACTION_CHECK_PROMPT.user(medicaments) }]
      })
    });

    if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);

    const claudeData = await claudeRes.json();
    const textBlocks = claudeData.content.filter(block => block.type === 'text');
    const rawText = textBlocks.map(block => block.text).join('\n');
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Réponse Claude invalide');
    const resultat = JSON.parse(jsonMatch[0]);

    return res.json({ success: true, resultat });
  } catch (err) {
    console.error('[ERROR check-interactions]', req.requestId, err.message);
    return res.status(500).json({ error: 'Erreur lors de la vérification des interactions' });
  }
});

// ────────────────────────────────────────────────────────────────────
// POST /api/ordonnance/generate
// Génère une ordonnance à partir des prescriptions d'un événement
// consultation existant, et l'enregistre comme nouvel événement
// rattaché au même patient.
// ────────────────────────────────────────────────────────────────────
app.post('/api/ordonnance/generate', requireAuth, async (req, res) => {
  const { patientId, prescriptions } = req.body;
  const user = req.medecin;

  if (!patientId) {
    return res.status(400).json({ error: 'Patient manquant' });
  }
  if (!Array.isArray(prescriptions) || prescriptions.length === 0) {
    return res.status(400).json({ error: 'Aucune prescription à mettre en ordonnance' });
  }

  try {
    const patient = await db.getPatientById(patientId);
    if (!patient || patient.medecin_id !== user.id) {
      return res.status(403).json({ error: 'Patient introuvable ou accès refusé' });
    }

    const ordonnanceData = {
      patient: { nom: patient.nom, prenom: patient.prenom, dateNaissance: patient.date_naissance },
      medecin: {
        nom: user.profile?.nom || user.email,
        rpps: user.profile?.rpps || '',
        cabinet: user.profile?.cabinet || '',
      },
      dateOrdonnance: new Date().toISOString(),
      prescriptions: prescriptions.map(p => ({
        medicament: p.medicament || '',
        posologie: p.posologie || '',
        duree: p.duree || '',
        voie: p.voie || '',
      })),
    };

    const id = crypto.randomUUID();
    await db.createMedicalEvent({
      id,
      patientId,
      medecinId: user.id,
      type: 'ordonnance',
      title: `Ordonnance — ${prescriptions.length} médicament(s)`,
      data: ordonnanceData,
    });

    return res.json({ success: true, id, ordonnance: ordonnanceData });
  } catch (err) {
    console.error('[ERROR ordonnance]', req.requestId, err.message);
    return res.status(500).json({ error: "Erreur lors de la génération de l'ordonnance" });
  }
});

// ────────────────────────────────────────────────────────────────────
// Patients — création, liste, détail, notes
// ────────────────────────────────────────────────────────────────────
app.post('/api/patients', requireAuth, async (req, res) => {
  const { nom, prenom, dateNaissance, notes } = req.body;
  if (!nom || !prenom) {
    return res.status(400).json({ error: 'Nom et prénom du patient requis' });
  }
  try {
    const patient = await db.createPatient({
      id: crypto.randomUUID(),
      medecinId: req.medecin.id,
      nom: nom.trim(),
      prenom: prenom.trim(),
      dateNaissance: dateNaissance || null,
      notes: notes || '',
    });
    return res.json({ success: true, patient });
  } catch (err) {
    console.error('[ERROR create patient]', err.message);
    return res.status(500).json({ error: 'Erreur lors de la création du patient' });
  }
});

app.get('/api/patients', requireAuth, async (req, res) => {
  try {
    const patients = await db.listPatientsByMedecin(req.medecin.id);
    return res.json({ items: patients });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération des patients' });
  }
});

app.get('/api/patients/:id', requireAuth, async (req, res) => {
  try {
    const patient = await db.getPatientById(req.params.id);
    if (!patient || patient.medecin_id !== req.medecin.id) {
      return res.status(404).json({ error: 'Patient introuvable' });
    }
    const events = await db.listEventsByPatient(patient.id);
    return res.json({ patient, events });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération du dossier patient' });
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /api/patients/:id/resume-intelligent
// Génère une synthèse narrative de la chronologie du patient — la
// fondation de la "timeline intelligente". Le nom du patient est
// remplacé par un token avant tout envoi à Claude, comme pour les
// transcriptions de consultation.
// ────────────────────────────────────────────────────────────────────
app.get('/api/patients/:id/resume-intelligent', requireAuth, async (req, res) => {
  try {
    const patient = await db.getPatientById(req.params.id);
    if (!patient || patient.medecin_id !== req.medecin.id) {
      return res.status(404).json({ error: 'Patient introuvable' });
    }
    const events = await db.listEventsByPatient(patient.id);
    if (!events || events.length === 0) {
      return res.status(400).json({ error: 'Aucun événement à synthétiser pour ce patient' });
    }

    // Construit une chronologie textuelle compacte plutôt que d'envoyer
    // le JSON complet de chaque événement (plus lisible et moins de tokens)
    const lines = events
      .slice()
      .reverse() // ordre chronologique croissant pour un récit cohérent
      .map(e => {
        const date = new Date(e.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        if (e.type === 'consultation') {
          return `${date} — Consultation : ${e.data.resume_1_ligne || e.title}`;
        }
        if (e.type === 'ordonnance') {
          const meds = (e.data.prescriptions || []).map(p => p.medicament).filter(Boolean).join(', ');
          return `${date} — Ordonnance : ${meds || e.title}`;
        }
        if (e.type === 'courrier') {
          return `${date} — Courrier à ${e.data.destinataire_suggere || 'un confrère'} : ${e.data.objet || e.title}`;
        }
        return `${date} — ${e.type} : ${e.title}`;
      });

    // Anonymise le nom du patient (correspondance exacte, pas de regex,
    // puisqu'on connaît la valeur précise à remplacer)
    let timelineText = lines.join('\n');
    if (patient.prenom) timelineText = timelineText.split(patient.prenom).join('[PATIENT_PRENOM]');
    if (patient.nom) timelineText = timelineText.split(patient.nom).join('[PATIENT_NOM]');

    const prompt = DOSSIER_SUMMARY_PROMPT;
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || 'YOUR_KEY_HERE',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user(timelineText) }]
      })
    });

    if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);

    const claudeData = await claudeRes.json();
    const textBlocks = claudeData.content.filter(block => block.type === 'text');
    const rawText = textBlocks.map(block => block.text).join('\n');
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Réponse Claude invalide');
    let resumeData = JSON.parse(jsonMatch[0]);

    // Restaure le vrai nom du patient dans la réponse pour un rendu naturel
    let resumeStr = JSON.stringify(resumeData);
    if (patient.prenom) resumeStr = resumeStr.split('[PATIENT_PRENOM]').join(patient.prenom);
    if (patient.nom) resumeStr = resumeStr.split('[PATIENT_NOM]').join(patient.nom);
    resumeData = JSON.parse(resumeStr);

    return res.json({ success: true, resume: resumeData });
  } catch (err) {
    console.error('[ERROR resume-intelligent]', req.requestId, err.message);
    return res.status(500).json({ error: 'Erreur lors de la génération du résumé' });
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /api/patients/:id/preparation
// Briefing express avant de commencer une nouvelle consultation.
// ────────────────────────────────────────────────────────────────────
app.get('/api/patients/:id/preparation', requireAuth, async (req, res) => {
  try {
    const patient = await db.getPatientById(req.params.id);
    if (!patient || patient.medecin_id !== req.medecin.id) {
      return res.status(404).json({ error: 'Patient introuvable' });
    }
    const events = await db.listEventsByPatient(patient.id);
    if (!events || events.length === 0) {
      return res.json({
        success: true,
        preparation: {
          dernier_rdv: 'Aucun antécédent enregistré — première consultation pour ce patient',
          traitements_en_cours: [],
          points_a_retenir: [],
          rappel_suivi: '',
        }
      });
    }

    const eventsForPrep = events.map(e => {
      let contenu = e.title;
      if (e.type === 'consultation') contenu = JSON.stringify(e.data.sections || {});
      if (e.type === 'ordonnance') contenu = (e.data.prescriptions || []).map(p => `${p.medicament} ${p.posologie || ''} ${p.duree || ''}`).join(', ');
      if (e.type === 'courrier') contenu = e.data.objet || e.title;
      return { type: e.type, date: new Date(e.event_date).toLocaleDateString('fr-FR'), contenu };
    });

    let payloadStr = JSON.stringify(eventsForPrep);
    if (patient.prenom) payloadStr = payloadStr.split(patient.prenom).join('[PATIENT]');
    if (patient.nom) payloadStr = payloadStr.split(patient.nom).join('[PATIENT]');
    const anonymizedEvents = JSON.parse(payloadStr);

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || 'YOUR_KEY_HERE',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 800,
        system: PRE_CONSULT_PROMPT.system,
        messages: [{ role: 'user', content: PRE_CONSULT_PROMPT.user(anonymizedEvents) }]
      })
    });

    if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);

    const claudeData = await claudeRes.json();
    const textBlocks = claudeData.content.filter(block => block.type === 'text');
    const rawText = textBlocks.map(block => block.text).join('\n');
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Réponse Claude invalide');
    const preparation = JSON.parse(jsonMatch[0]);

    return res.json({ success: true, preparation });
  } catch (err) {
    console.error('[ERROR preparation]', req.requestId, err.message);
    return res.status(500).json({ error: 'Erreur lors de la préparation de consultation' });
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /api/patients/:id/search?q=...
// Recherche sémantique dans les événements d'un patient.
// ────────────────────────────────────────────────────────────────────
app.get('/api/patients/:id/search', requireAuth, async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Requête de recherche trop courte' });
  }

  try {
    const patient = await db.getPatientById(req.params.id);
    if (!patient || patient.medecin_id !== req.medecin.id) {
      return res.status(404).json({ error: 'Patient introuvable' });
    }
    const events = await db.listEventsByPatient(patient.id);
    if (!events || events.length === 0) {
      return res.json({ success: true, resultats: [] });
    }

    // Construit une liste compacte des événements avec leur contenu résumé
    const eventsForSearch = events.map(e => {
      let contenu = e.title;
      if (e.type === 'consultation') contenu = e.data.resume_1_ligne || e.title;
      if (e.type === 'ordonnance') contenu = (e.data.prescriptions || []).map(p => p.medicament).join(', ');
      if (e.type === 'courrier') contenu = e.data.objet || e.title;
      return {
        id: e.id,
        type: e.type,
        date: new Date(e.event_date).toLocaleDateString('fr-FR'),
        contenu,
      };
    });

    // Anonymise le nom du patient dans le contenu textuel avant envoi
    let payloadStr = JSON.stringify(eventsForSearch);
    if (patient.prenom) payloadStr = payloadStr.split(patient.prenom).join('[PATIENT]');
    if (patient.nom) payloadStr = payloadStr.split(patient.nom).join('[PATIENT]');
    const anonymizedEvents = JSON.parse(payloadStr);

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || 'YOUR_KEY_HERE',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system: SEARCH_PROMPT.system,
        messages: [{ role: 'user', content: SEARCH_PROMPT.user(anonymizedEvents, query) }]
      })
    });

    if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);

    const claudeData = await claudeRes.json();
    const textBlocks = claudeData.content.filter(block => block.type === 'text');
    const rawText = textBlocks.map(block => block.text).join('\n');
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Réponse Claude invalide');
    const searchResult = JSON.parse(jsonMatch[0]);

    // Recompose les résultats avec les événements complets (déjà en clair en base)
    const eventsById = new Map(events.map(e => [e.id, e]));
    const resultats = (searchResult.resultats || [])
      .filter(r => eventsById.has(r.id))
      .map(r => ({ event: eventsById.get(r.id), raison: r.raison }));

    return res.json({ success: true, resultats });
  } catch (err) {
    console.error('[ERROR search]', req.requestId, err.message);
    return res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});

app.put('/api/patients/:id/notes', requireAuth, async (req, res) => {
  try {
    const patient = await db.getPatientById(req.params.id);
    if (!patient || patient.medecin_id !== req.medecin.id) {
      return res.status(404).json({ error: 'Patient introuvable' });
    }
    const updated = await db.updatePatientNotes(req.params.id, req.body.notes || '');
    return res.json({ success: true, patient: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la mise à jour des notes' });
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /api/compterendu/:id
// ────────────────────────────────────────────────────────────────────
app.get('/api/compterendu/:id', requireAuth, async (req, res) => {
  try {
    const cr = await db.getCompteRenduById(req.params.id);
    if (!cr) return res.status(404).json({ error: 'Compte-rendu introuvable' });
    if (cr.medecin_id !== req.medecin.id) return res.status(403).json({ error: 'Accès refusé' });
    return res.json(cr);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /api/historique — liste des anciens comptes-rendus (avant la fiche patient)
// ────────────────────────────────────────────────────────────────────
app.get('/api/historique', requireAuth, async (req, res) => {
  try {
    const rows = await db.listCompteRendusByMedecin(req.medecin.id);
    return res.json({ items: rows });
  } catch (err) {
    return res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
});

// ────────────────────────────────────────────────────────────────────
// POST /api/create-checkout-session
// ────────────────────────────────────────────────────────────────────
app.post('/api/create-checkout-session', requireAuth, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe non configuré côté serveur' });

  const origin = req.headers.origin || 'https://mediai-site.vercel.app';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: req.medecin.email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}?checkout=cancelled`,
    });
    return res.json({ url: session.url });
  } catch (err) {
    console.error('[STRIPE ERROR]', err.message);
    return res.status(500).json({ error: 'Impossible de créer la session de paiement' });
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /api/verify-session
// ────────────────────────────────────────────────────────────────────
app.get('/api/verify-session', requireAuth, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe non configuré côté serveur' });

  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
    const paid = session.payment_status === 'paid';

    if (paid) {
      await db.setUserPro(req.medecin.email, { isPro: true, stripeCustomerId: session.customer });
    }

    return res.json({ paid, customerEmail: session.customer_details?.email || null });
  } catch (err) {
    return res.status(400).json({ error: 'Session invalide' });
  }
});

// ────────────────────────────────────────────────────────────────────
// POST /api/send-report-email
// Envoie le compte-rendu (PDF généré côté navigateur) par email via Resend
// ────────────────────────────────────────────────────────────────────
app.post('/api/send-report-email', requireAuth, async (req, res) => {
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "Envoi d'email non configuré côté serveur" });
  }
  const { recipientEmail, pdfBase64, resume } = req.body;
  if (!recipientEmail || !pdfBase64) {
    return res.status(400).json({ error: 'Destinataire ou fichier manquant' });
  }

  const senderName = req.medecin.profile?.nom || req.medecin.email;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MédiIA <onboarding@resend.dev>', // adresse de test Resend, sans domaine à vérifier
        to: [recipientEmail],
        subject: `Compte-rendu médical — ${resume || 'consultation'}`,
        html: `
          <div style="font-family: sans-serif; color: #16211c;">
            <p>Bonjour,</p>
            <p>Vous trouverez ci-joint un compte-rendu médical transmis par <strong>${senderName}</strong> via MédiIA.</p>
            <p style="font-size: 13px; color: #8b968e;">Document confidentiel à caractère médical, soumis au secret médical et au RGPD.</p>
          </div>
        `,
        attachments: [{
          filename: 'compte-rendu-mediai.pdf',
          content: pdfBase64,
        }],
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('[RESEND ERROR]', resendRes.status, errText);
      throw new Error(`Erreur d'envoi (${resendRes.status})`);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[ERROR] send-report-email', req.requestId, err.message);
    return res.status(500).json({ error: "Impossible d'envoyer l'email pour le moment" });
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /health
// ────────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbStatus = 'non testée';
  try {
    await db.pool.query('SELECT 1');
    dbStatus = 'connectée';
  } catch (err) {
    dbStatus = 'erreur: ' + err.message;
  }
  res.json({
    status: 'ok',
    version: '2.0.0',
    hds_compliant: true,
    anonymization: 'active',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3001;

// ── Initialise la base avant de démarrer le serveur ────────────────
db.initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`MédiIA Server — port ${PORT}`);
      console.log(`Base de données PostgreSQL : connectée et prête`);
    });
  })
  .catch((err) => {
    console.error('ERREUR CRITIQUE - Impossible d\'initialiser la base de données :', err.message);
    console.error('Le serveur démarre quand même, mais les routes échoueront tant que DATABASE_URL n\'est pas correcte.');
    app.listen(PORT, () => {
      console.log(`MédiIA Server — port ${PORT} (mode dégradé, base de données indisponible)`);
    });
  });

module.exports = app;
