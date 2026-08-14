'use strict';
// ── Sécurité Doctolib ────────────────────────────────────────────────
// - HMAC pour l'authentification/intégrité des messages (webhooks).
// - Chiffrement AES-256-GCM des secrets stockés en base (« at rest »).
// - Comparaisons à temps constant (timingSafeEqual) contre les attaques
//   par mesure de temps.
// Aucun secret n'est écrit dans les logs (voir redact()).

const crypto = require('crypto');

// ── HMAC (SHA-256) ──────────────────────────────────────────────────
function hmacSign(payload, secret) {
  return crypto.createHmac('sha256', String(secret || '')).update(String(payload)).digest('hex');
}

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch (e) { return false; }
}

// Vérifie la signature d'un message (webhook). `signature` = HMAC(rawBody, secret).
function verifySignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = hmacSign(rawBody, secret);
  return timingSafeEqualHex(expected, signature);
}

// Fenêtre anti-rejeu : refuse un message trop ancien / trop dans le futur.
function isTimestampFresh(timestamp, toleranceSeconds = 300) {
  const t = Number(timestamp);
  if (!Number.isFinite(t)) return false;
  const now = Math.floor(Date.now() / 1000);
  const ts = t > 1e12 ? Math.floor(t / 1000) : t; // accepte ms ou s
  return Math.abs(now - ts) <= toleranceSeconds;
}

// ── Chiffrement des secrets stockés (AES-256-GCM) ───────────────────
function keyFrom(secret) {
  // Dérive une clé 32 octets déterministe de la clé maître.
  return crypto.createHash('sha256').update(String(secret || '')).digest();
}

function encryptSecret(plaintext, masterKey) {
  if (plaintext == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFrom(masterKey), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format : v1:base64(iv):base64(tag):base64(ciphertext)
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decryptSecret(payload, masterKey) {
  if (!payload) return null;
  const parts = String(payload).split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const enc = Buffer.from(parts[3], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyFrom(masterKey), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch (e) { return null; }
}

// Masque les secrets dans un objet destiné aux logs.
const SECRET_KEYS = /secret|token|password|client_secret|clientSecret|apiKey|api_key|authorization/i;
function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)) {
    if (SECRET_KEYS.test(k)) out[k] = '••••';
    else if (obj[k] && typeof obj[k] === 'object') out[k] = redact(obj[k]);
    else out[k] = obj[k];
  }
  return out;
}

// Vérifie qu'une IP appelante est autorisée (si une allowlist est définie).
function isIpAllowed(ip, allowlist) {
  if (!allowlist || allowlist.length === 0) return true; // pas de restriction configurée
  const norm = String(ip || '').replace('::ffff:', '');
  return allowlist.includes(norm);
}

module.exports = {
  hmacSign, verifySignature, timingSafeEqualHex, isTimestampFresh,
  encryptSecret, decryptSecret, redact, isIpAllowed,
};
