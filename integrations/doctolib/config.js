'use strict';
// ── Configuration Doctolib ───────────────────────────────────────────
// Aucune vraie valeur ici : uniquement la lecture d'environnement.
// Les secrets ne sont jamais journalisés (voir audit.js / redact()).
// Le connecteur RÉEL nécessite les paramètres fournis dans le cadre d'une
// intégration officielle avec Doctolib ; sans eux on reste en mode MOCK.

const ENV_KEYS = [
  'DOCTOLIB_ENABLED',
  'DOCTOLIB_BASE_URL',
  'DOCTOLIB_CLIENT_ID',
  'DOCTOLIB_CLIENT_SECRET',
  'DOCTOLIB_SECRET_KEY',
  'DOCTOLIB_WEBHOOK_SECRET',
];

function bool(v) { return String(v || '').toLowerCase() === 'true' || v === '1'; }

// L'intégration est « activée » si DOCTOLIB_ENABLED=true. Sinon, seul le
// connecteur MOCK est utilisable (aucun appel réseau réel n'est tenté).
function isEnabled() {
  return bool(process.env.DOCTOLIB_ENABLED);
}

// Le connecteur RÉEL n'est considéré « configuré » que si toutes les
// variables sensibles sont présentes. Tant que ce n'est pas le cas, le
// système reste explicitement en mock (jamais d'invention d'API).
function isRealConfigured() {
  return isEnabled()
    && !!process.env.DOCTOLIB_BASE_URL
    && !!process.env.DOCTOLIB_CLIENT_ID
    && !!process.env.DOCTOLIB_CLIENT_SECRET;
}

function getConfig() {
  return {
    enabled: isEnabled(),
    baseUrl: process.env.DOCTOLIB_BASE_URL || null,
    clientId: process.env.DOCTOLIB_CLIENT_ID || null,
    // Les secrets ne sont exposés qu'aux modules serveur qui en ont besoin,
    // jamais renvoyés au frontend ni journalisés.
    clientSecret: process.env.DOCTOLIB_CLIENT_SECRET || null,
    secretKey: process.env.DOCTOLIB_SECRET_KEY || null,
    webhookSecret: process.env.DOCTOLIB_WEBHOOK_SECRET || null,
    realConfigured: isRealConfigured(),
    // Restriction IP optionnelle (Doctolib permet de restreindre par IP).
    ipAllowlist: String(process.env.DOCTOLIB_IP_ALLOWLIST || '')
      .split(',').map((s) => s.trim()).filter(Boolean),
  };
}

// Clé de chiffrement des secrets stockés en base (« encrypted at rest »).
// À défaut d'une clé dédiée, on retombe sur JWT_SECRET (déjà obligatoire).
function encryptionKey() {
  return process.env.DOCTOLIB_SECRET_KEY || process.env.JWT_SECRET || '';
}

module.exports = { ENV_KEYS, isEnabled, isRealConfigured, getConfig, encryptionKey };
