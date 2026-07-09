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
const { PROMPTS } = require('./prompts');
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
  const { nom, rpps, cabinet, telephone } = req.body;
  try {
    const updated = await db.updateUserProfile(req.medecin.email, {
      nom: (nom || '').trim(),
      rpps: (rpps || '').trim(),
      cabinet: (cabinet || '').trim(),
      telephone: (telephone || '').trim(),
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
  const { transcription, specialite = 'generaliste' } = req.body;
  const user = req.medecin;

  if (!user.isPro && user.freeUsageCount >= FREE_LIMIT) {
    return res.status(402).json({ error: 'Quota gratuit atteint', upgradeRequired: true, limit: FREE_LIMIT });
  }
  if (!transcription || transcription.trim().length < 50) {
    return res.status(400).json({ error: 'Transcription trop courte (minimum 50 caractères)' });
  }
  if (!PROMPTS[specialite]) {
    return res.status(400).json({ error: `Spécialité non supportée. Options : ${Object.keys(PROMPTS).join(', ')}` });
  }

  try {
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

    // 5. Sauvegarde en base (chiffrée au repos par Render/PostgreSQL)
    const id = crypto.randomUUID();
    const tokensUsed = (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);
    await db.saveCompteRendu({ id, medecinId: user.id, specialite, compteRendu: compteRenduFinal, tokensUsed });

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
// GET /api/historique — liste des comptes-rendus du médecin connecté
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
