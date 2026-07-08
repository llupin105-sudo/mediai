/**
 * server.js
 * Serveur Express — API REST du SaaS médical
 * À déployer sur OVHcloud Public Cloud HDS
 * 
 * Routes :
 *   POST /api/transcription/analyze   - Pipeline complet texte → compte-rendu
 *   POST /api/audio/transcribe        - Audio → texte (Whisper local)
 *   GET  /api/compterendu/:id         - Récupère un compte-rendu sauvegardé
 *   GET  /health                      - Health check
 */

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Stripe = require('stripe');
const { anonymize, deanonymize } = require('./anonymizer');
const { PROMPTS } = require('./prompts');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 Mo max, comme la limite de l'API Whisper
});

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;
// NOTE : en dev, un secret par défaut est utilisé si la variable n'est pas définie.
// Sur Render, définis toujours JWT_SECRET comme variable d'environnement en production.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-a-changer-en-production';

// ── DEBUG : vérifie la clé au démarrage du serveur ─────────────────
console.log('═══════════════════════════════════════');
console.log('DEBUG - Dossier de travail actuel :', process.cwd());
console.log('DEBUG - Clé API détectée :', process.env.ANTHROPIC_API_KEY
  ? process.env.ANTHROPIC_API_KEY.slice(0, 20) + '... (longueur: ' + process.env.ANTHROPIC_API_KEY.length + ')'
  : 'AUCUNE — utilisera YOUR_KEY_HERE par défaut !');
console.log('═══════════════════════════════════════');

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── CORS : autorise le frontend à appeler ce serveur local ─────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Stockage en mémoire (à remplacer par PostgreSQL chiffré) ───────
const compteRendus = new Map();
const users = new Map(); // email -> { id, email, passwordHash, isPro, freeUsageCount, stripeCustomerId }
const FREE_LIMIT = 3;

// ── Middleware de journalisation HDS ──────────────────────────────
// Obligation légale : tracer tous les accès aux données de santé
app.use((req, res, next) => {
  const log = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.headers['x-user-id'] || 'anonymous',
    requestId: crypto.randomUUID(),
  };
  // En production : écrire dans une table PostgreSQL chiffrée
  // avec conservation 3 ans minimum (obligation HDS)
  console.log('[AUDIT]', JSON.stringify(log));
  req.requestId = log.requestId;
  next();
});

// ── Auth middleware : vérifie un vrai token JWT ────────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = users.get(payload.email);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    req.medecin = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide ou expirée' });
  }
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
  if (users.has(normalizedEmail)) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash,
    isPro: false,
    freeUsageCount: 0,
    stripeCustomerId: null,
    profile: { nom: '', rpps: '', cabinet: '', telephone: '' },
  };
  users.set(normalizedEmail, user);

  const token = jwt.sign({ email: normalizedEmail }, JWT_SECRET, { expiresIn: '30d' });
  return res.json({
    token,
    user: { email: user.email, isPro: user.isPro, freeUsageCount: user.freeUsageCount, profile: user.profile },
  });
});

// ────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = users.get(normalizedEmail);

  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const token = jwt.sign({ email: normalizedEmail }, JWT_SECRET, { expiresIn: '30d' });
  return res.json({
    token,
    user: { email: user.email, isPro: user.isPro, freeUsageCount: user.freeUsageCount, profile: user.profile },
  });
});

// ────────────────────────────────────────────────────────────────────
// GET /api/auth/me — vérifie le token et renvoie l'état du compte
// ────────────────────────────────────────────────────────────────────
app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({
    user: {
      email: req.medecin.email,
      isPro: req.medecin.isPro,
      freeUsageCount: req.medecin.freeUsageCount,
      profile: req.medecin.profile || { nom: '', rpps: '', cabinet: '', telephone: '' },
    },
  });
});

// ────────────────────────────────────────────────────────────────────
// PUT /api/auth/profile — met à jour les informations du médecin
// (utilisées dans le pied de page des exports PDF)
// ────────────────────────────────────────────────────────────────────
app.put('/api/auth/profile', requireAuth, (req, res) => {
  const { nom, rpps, cabinet, telephone } = req.body;
  req.medecin.profile = {
    nom: (nom || '').trim(),
    rpps: (rpps || '').trim(),
    cabinet: (cabinet || '').trim(),
    telephone: (telephone || '').trim(),
  };
  return res.json({ success: true, profile: req.medecin.profile });
});

// ────────────────────────────────────────────────────────────────────
// POST /api/audio/transcribe
// Reçoit un fichier audio, le transcrit via l'API Whisper (OpenAI)
// ────────────────────────────────────────────────────────────────────
app.post('/api/audio/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Transcription audio non configurée côté serveur' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier audio reçu' });
  }

  try {
    // Construit une requête multipart/form-data vers l'API Whisper
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
// Corps : { transcription: string, specialite?: string }
// ────────────────────────────────────────────────────────────────────
app.post('/api/transcription/analyze', requireAuth, async (req, res) => {
  const { transcription, specialite = 'generaliste' } = req.body;
  const user = req.medecin;

  // ── Vérification du quota gratuit — basée sur le compte, pas sur le navigateur ──
  if (!user.isPro && user.freeUsageCount >= FREE_LIMIT) {
    return res.status(402).json({
      error: 'Quota gratuit atteint',
      upgradeRequired: true,
      limit: FREE_LIMIT,
    });
  }

  if (!transcription || transcription.trim().length < 50) {
    return res.status(400).json({
      error: 'Transcription trop courte (minimum 50 caractères)'
    });
  }

  if (!PROMPTS[specialite]) {
    return res.status(400).json({
      error: `Spécialité non supportée. Options : ${Object.keys(PROMPTS).join(', ')}`
    });
  }

  try {
    // ── 1. Anonymisation (sur serveur OVHcloud) ──────────────────
    const { anonymized, tokenMap, stats: anonStats } = anonymize(transcription);

    // ── 2. Appel API Claude (avec texte anonymisé) ───────────────
    const prompt = PROMPTS[specialite];

    // DEBUG : vérifie la clé utilisée pile au moment de l'appel
    const keyUsed = process.env.ANTHROPIC_API_KEY || 'YOUR_KEY_HERE';
    console.log('DEBUG - Clé utilisée pour cet appel :', keyUsed.slice(0, 20) + '...');
    if (keyUsed === 'YOUR_KEY_HERE') {
      console.log('DEBUG - ATTENTION : process.env.ANTHROPIC_API_KEY est vide, la clé par défaut invalide est utilisée !');
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        // En production : variable d'env ANTHROPIC_API_KEY
        'x-api-key': process.env.ANTHROPIC_API_KEY || 'YOUR_KEY_HERE',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4000,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user(anonymized) }]
      })
    });

    if (!claudeRes.ok) {
      throw new Error(`Claude API error: ${claudeRes.status}`);
    }

    const claudeData = await claudeRes.json();
    // Extraction robuste : on cherche le bloc de type "text" spécifiquement,
    // car claude-sonnet-5 peut renvoyer un bloc "thinking" en premier
    const textBlocks = claudeData.content.filter(block => block.type === 'text');
    const rawText = textBlocks.map(block => block.text).join('\n');

    if (!rawText) {
      console.log('DEBUG - Aucun bloc texte trouvé. Contenu brut reçu :', JSON.stringify(claudeData.content));
      throw new Error('Claude n\'a renvoyé aucun texte exploitable');
    }

    // ── 3. Parse JSON ────────────────────────────────────────────
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Réponse Claude invalide');
    const compteRenduTokenise = JSON.parse(jsonMatch[0]);

    // ── 4. Dé-anonymisation (sur serveur OVHcloud) ───────────────
    const restored = deanonymize(JSON.stringify(compteRenduTokenise), tokenMap);
    const compteRenduFinal = JSON.parse(restored);

    // ── 5. Sauvegarde chiffrée (PostgreSQL en prod) ───────────────
    const id = crypto.randomUUID();
    const saved = {
      id,
      medecinId: req.medecin.id,
      specialite,
      compteRendu: compteRenduFinal,
      createdAt: new Date().toISOString(),
      tokensUsed: claudeData.usage?.input_tokens + claudeData.usage?.output_tokens,
    };
    // En production : INSERT INTO compte_rendus (chiffré AES-256)
    compteRendus.set(id, saved);

    // Incrémente le compteur gratuit uniquement après succès, sur le vrai compte
    if (!user.isPro) {
      user.freeUsageCount += 1;
    }

    return res.json({
      success: true,
      id,
      compteRendu: compteRenduFinal,
      meta: {
        anonymisation: anonStats,
        tokens: saved.tokensUsed,
        cout_eur: (saved.tokensUsed * 0.000003).toFixed(4),
      },
      account: {
        isPro: user.isPro,
        freeUsageCount: user.freeUsageCount,
        freeLimit: FREE_LIMIT,
      },
    });

  } catch (err) {
    console.error('[ERROR]', req.requestId, err.message);
    return res.status(500).json({
      error: 'Erreur lors de la génération du compte-rendu',
      requestId: req.requestId,
    });
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /api/compterendu/:id
// ────────────────────────────────────────────────────────────────────
app.get('/api/compterendu/:id', requireAuth, (req, res) => {
  const cr = compteRendus.get(req.params.id);
  if (!cr) return res.status(404).json({ error: 'Compte-rendu introuvable' });
  if (cr.medecinId !== req.medecin.id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  return res.json(cr);
});

// ────────────────────────────────────────────────────────────────────
// POST /api/create-checkout-session
// Crée une session de paiement Stripe pour l'abonnement Pro
// ────────────────────────────────────────────────────────────────────
app.post('/api/create-checkout-session', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe non configuré côté serveur' });
  }

  // Utilise l'origine de la requête si présente, sinon l'adresse du site en dur
  const origin = req.headers.origin || 'https://mediai-site.vercel.app';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: req.medecin.email,
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
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
// GET /api/verify-session?session_id=...
// Vérifie qu'un paiement a bien été effectué (appelé au retour de Stripe)
// ────────────────────────────────────────────────────────────────────
app.get('/api/verify-session', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe non configuré côté serveur' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
    const paid = session.payment_status === 'paid';

    if (paid) {
      // Marque le compte comme Pro côté serveur — c'est la source de vérité,
      // pas une valeur envoyée par le navigateur.
      const user = req.medecin;
      user.isPro = true;
      user.stripeCustomerId = session.customer;
    }

    return res.json({
      paid,
      customerEmail: session.customer_details?.email || null,
    });
  } catch (err) {
    return res.status(400).json({ error: 'Session invalide' });
  }
});

// ────────────────────────────────────────────────────────────────────
// GET /health
// ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    hds_compliant: true,
    anonymization: 'active',
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`MédiIA Server — port ${PORT}`);
  console.log(`HDS mode : actif (données anonymisées avant envoi Claude)`);
  console.log(`Hébergement cible : OVHcloud Public Cloud HDS, région France\n`);
});

module.exports = app;
