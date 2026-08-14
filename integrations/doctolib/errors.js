'use strict';
// ── Erreurs Doctolib ─────────────────────────────────────────────────
// Codes stables et messages « médecin-friendly ». Le professionnel ne voit
// jamais une stack technique (ECONNRESET…), seulement un message clair +
// la possibilité de réessayer. `httpStatus` guide la réponse API.

const CODES = {
  DOCTOLIB_NOT_CONFIGURED: { httpStatus: 400, userMessage: 'L’intégration Doctolib n’est pas configurée.' },
  DOCTOLIB_UNAUTHORIZED:   { httpStatus: 401, userMessage: 'La connexion à Doctolib a expiré. Reconnectez-vous.' },
  DOCTOLIB_FORBIDDEN:      { httpStatus: 403, userMessage: 'Accès Doctolib refusé pour cette action.' },
  DOCTOLIB_RATE_LIMITED:   { httpStatus: 429, userMessage: 'Trop de requêtes vers Doctolib. Réessayez dans un instant.' },
  DOCTOLIB_TIMEOUT:        { httpStatus: 504, userMessage: 'Doctolib n’a pas répondu à temps. Réessayez.' },
  DOCTOLIB_INVALID_SIGNATURE: { httpStatus: 401, userMessage: 'Message Doctolib rejeté (signature invalide).' },
  DOCTOLIB_SYNC_ERROR:     { httpStatus: 502, userMessage: 'Impossible de synchroniser Doctolib pour le moment.' },
  DOCTOLIB_MAPPING_ERROR:  { httpStatus: 422, userMessage: 'Certaines données Doctolib n’ont pas pu être interprétées.' },
};

class DoctolibError extends Error {
  constructor(code, detail) {
    const meta = CODES[code] || { httpStatus: 500, userMessage: 'Erreur Doctolib inattendue.' };
    super(meta.userMessage);
    this.name = 'DoctolibError';
    this.code = CODES[code] ? code : 'DOCTOLIB_SYNC_ERROR';
    this.httpStatus = meta.httpStatus;
    this.userMessage = meta.userMessage;
    this.detail = detail || null; // détail technique — pour les logs serveur uniquement
  }
  // Charge utile SÛRE pour le frontend : jamais de stack ni de secret.
  toClient() {
    return { error: this.userMessage, code: this.code, retryable: this.httpStatus >= 500 || this.httpStatus === 429 };
  }
}

// Traduit une erreur technique quelconque en DoctolibError propre.
function wrap(err, fallbackCode) {
  if (err instanceof DoctolibError) return err;
  const msg = String(err && err.message || err || '');
  let code = fallbackCode || 'DOCTOLIB_SYNC_ERROR';
  if (/ETIMEDOUT|timeout/i.test(msg)) code = 'DOCTOLIB_TIMEOUT';
  else if (/429|rate/i.test(msg)) code = 'DOCTOLIB_RATE_LIMITED';
  else if (/401|unauthor/i.test(msg)) code = 'DOCTOLIB_UNAUTHORIZED';
  else if (/403|forbidden/i.test(msg)) code = 'DOCTOLIB_FORBIDDEN';
  return new DoctolibError(code, msg);
}

module.exports = { DoctolibError, CODES, wrap };
