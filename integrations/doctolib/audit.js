'use strict';
// ── Audit d'intégration ──────────────────────────────────────────────
// Journalise les actions structurantes. Ne consigne JAMAIS de secret, de
// token, de mot de passe ni de contenu médical inutile (redact()).

const { redact } = require('./security');

const ACTIONS = {
  CONNECT: 'CONNECT',
  DISCONNECT: 'DISCONNECT',
  SYNC_STARTED: 'SYNC_STARTED',
  SYNC_COMPLETED: 'SYNC_COMPLETED',
  SYNC_FAILED: 'SYNC_FAILED',
  TOKEN_ROTATED: 'TOKEN_ROTATED',
  WEBHOOK_RECEIVED: 'WEBHOOK_RECEIVED',
  WEBHOOK_REJECTED: 'WEBHOOK_REJECTED',
};

// Enveloppe le store.logAudit en masquant toute donnée sensible du meta.
function makeAuditor(store, provider) {
  return async (medecinId, action, meta) => {
    try { await store.logAudit(medecinId, provider, action, redact(meta || {})); } catch (e) { /* audit best-effort */ }
  };
}

module.exports = { ACTIONS, makeAuditor };
