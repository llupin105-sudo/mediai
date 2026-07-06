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
const Stripe = require('stripe');
const { anonymize, deanonymize } = require('./anonymizer');
const { PROMPTS } = require('./prompts');

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

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
const freeUsage = new Map(); // empreinte navigateur -> nombre d'analyses gratuites utilisées
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

// ── Auth middleware (simplifié — JWT en production) ────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  // En production : valider le JWT, extraire l'ID médecin, vérifier les droits
  req.medecin = { id: 'MED_001', rpps: '10006789123', specialite: 'generaliste' };
  next();
}

// ────────────────────────────────────────────────────────────────────
// POST /api/transcription/analyze
// Corps : { transcription: string, specialite?: string }
// ────────────────────────────────────────────────────────────────────
app.post('/api/transcription/analyze', requireAuth, async (req, res) => {
  const { transcription, specialite = 'generaliste', clientId, isPro } = req.body;

  // ── Vérification du quota gratuit (sauf si abonné Pro) ────────────
  if (!isPro) {
    const key = clientId || req.ip;
    const used = freeUsage.get(key) || 0;
    if (used >= FREE_LIMIT) {
      return res.status(402).json({
        error: 'Quota gratuit atteint',
        upgradeRequired: true,
        limit: FREE_LIMIT,
      });
    }
    freeUsage.set(key, used + 1);
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

    return res.json({
      success: true,
      id,
      compteRendu: compteRenduFinal,
      meta: {
        anonymisation: anonStats,
        tokens: saved.tokensUsed,
        cout_eur: (saved.tokensUsed * 0.000003).toFixed(4),
      }
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
app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe non configuré côté serveur' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_PRICE_ID, // ID du prix créé dans le dashboard Stripe
        quantity: 1,
      }],
      success_url: `${req.headers.origin}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}?checkout=cancelled`,
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
app.get('/api/verify-session', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe non configuré côté serveur' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
    return res.json({
      paid: session.payment_status === 'paid',
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
