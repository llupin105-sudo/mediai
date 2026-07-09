/**
 * db.js
 * Connexion PostgreSQL + requêtes pour utilisateurs et comptes-rendus.
 * Remplace le stockage en mémoire (Map) utilisé jusqu'ici.
 */

const { Pool } = require('pg');
const crypto = require('crypto');

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL non définie — le serveur ne pourra pas se connecter à la base.');
}

// Render : les adresses internes ont un nom d'hôte court sans domaine
// (ex: dpg-xxxxx-a), les adresses externes ont un domaine complet
// (ex: dpg-xxxxx-a.frankfurt-postgres.render.com) et nécessitent SSL.
function detectNeedsSSL(connectionString) {
  if (!connectionString) return false;
  try {
    const url = new URL(connectionString);
    return url.hostname.includes('.'); // domaine complet = externe = SSL requis
  } catch {
    return false;
  }
}
const needsSSL = detectNeedsSSL(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[DB ERROR] Erreur inattendue sur une connexion inactive du pool', err);
});

/**
 * Crée les tables si elles n'existent pas encore.
 * Appelée une fois au démarrage du serveur.
 */
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_pro BOOLEAN NOT NULL DEFAULT FALSE,
      free_usage_count INTEGER NOT NULL DEFAULT 0,
      stripe_customer_id TEXT,
      profile_nom TEXT DEFAULT '',
      profile_rpps TEXT DEFAULT '',
      profile_cabinet TEXT DEFAULT '',
      profile_telephone TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Ajout des colonnes de préférences — ALTER sûr même si la table existe déjà
  // (ne casse pas les comptes créés avant l'ajout de cette fonctionnalité)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pref_default_specialite TEXT DEFAULT 'generaliste';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pref_instructions TEXT DEFAULT '';`);

  // Comptes via Google : pas de mot de passe, donc la colonne doit devenir optionnelle
  await pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'password';`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS compte_rendus (
      id UUID PRIMARY KEY,
      medecin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      specialite TEXT NOT NULL,
      compte_rendu JSONB NOT NULL,
      tokens_used INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
      method TEXT,
      path TEXT,
      ip TEXT,
      user_email TEXT,
      request_id TEXT
    );
  `);

  console.log('DEBUG - Base de données : tables vérifiées/créées avec succès');
}

// ── Conversion ligne SQL -> objet utilisateur utilisé dans le code ────
function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    authProvider: row.auth_provider || 'password',
    isPro: row.is_pro,
    freeUsageCount: row.free_usage_count,
    stripeCustomerId: row.stripe_customer_id,
    profile: {
      nom: row.profile_nom || '',
      rpps: row.profile_rpps || '',
      cabinet: row.profile_cabinet || '',
      telephone: row.profile_telephone || '',
    },
    preferences: {
      defaultSpecialite: row.pref_default_specialite || 'generaliste',
      instructions: row.pref_instructions || '',
    },
  };
}

// ── Utilisateurs ──────────────────────────────────────────────────

async function createUser({ id, email, passwordHash }) {
  const result = await pool.query(
    `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING *`,
    [id, email, passwordHash]
  );
  return rowToUser(result.rows[0]);
}

async function getUserByEmail(email) {
  const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
  return rowToUser(result.rows[0]);
}

// Connexion via Google : si le compte existe déjà (créé par mot de passe ou
// Google précédemment), on le connecte. Sinon, on en crée un sans mot de passe.
async function findOrCreateGoogleUser(email) {
  const existing = await getUserByEmail(email);
  if (existing) return existing;

  const result = await pool.query(
    `INSERT INTO users (id, email, password_hash, auth_provider) VALUES ($1, $2, NULL, 'google') RETURNING *`,
    [crypto.randomUUID(), email]
  );
  return rowToUser(result.rows[0]);
}

async function updateUserProfile(email, { nom, rpps, cabinet, telephone }) {
  const result = await pool.query(
    `UPDATE users SET profile_nom = $1, profile_rpps = $2, profile_cabinet = $3, profile_telephone = $4
     WHERE email = $5 RETURNING *`,
    [nom, rpps, cabinet, telephone, email]
  );
  return rowToUser(result.rows[0]);
}

async function updateUserPreferences(email, { defaultSpecialite, instructions }) {
  const result = await pool.query(
    `UPDATE users SET pref_default_specialite = $1, pref_instructions = $2 WHERE email = $3 RETURNING *`,
    [defaultSpecialite, instructions, email]
  );
  return rowToUser(result.rows[0]);
}

async function incrementFreeUsage(email) {
  const result = await pool.query(
    `UPDATE users SET free_usage_count = free_usage_count + 1 WHERE email = $1 RETURNING *`,
    [email]
  );
  return rowToUser(result.rows[0]);
}

async function setUserPro(email, { isPro, stripeCustomerId }) {
  const result = await pool.query(
    `UPDATE users SET is_pro = $1, stripe_customer_id = $2 WHERE email = $3 RETURNING *`,
    [isPro, stripeCustomerId, email]
  );
  return rowToUser(result.rows[0]);
}

// ── Comptes-rendus ────────────────────────────────────────────────

async function saveCompteRendu({ id, medecinId, specialite, compteRendu, tokensUsed }) {
  const result = await pool.query(
    `INSERT INTO compte_rendus (id, medecin_id, specialite, compte_rendu, tokens_used)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, medecinId, specialite, JSON.stringify(compteRendu), tokensUsed]
  );
  return result.rows[0];
}

async function getCompteRenduById(id) {
  const result = await pool.query(`SELECT * FROM compte_rendus WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function listCompteRendusByMedecin(medecinId, limit = 50) {
  const result = await pool.query(
    `SELECT id, specialite, compte_rendu, tokens_used, created_at
     FROM compte_rendus WHERE medecin_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [medecinId, limit]
  );
  return result.rows;
}

// ── Audit HDS ─────────────────────────────────────────────────────

async function logAudit({ id, method, path, ip, userEmail, requestId }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (id, method, path, ip, user_email, request_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, method, path, ip, userEmail, requestId]
    );
  } catch (err) {
    // On ne bloque jamais une requête à cause d'un souci de journalisation,
    // mais on le signale dans les logs serveur.
    console.error('[DB AUDIT ERROR]', err.message);
  }
}

module.exports = {
  pool,
  initDb,
  createUser,
  getUserByEmail,
  findOrCreateGoogleUser,
  updateUserProfile,
  updateUserPreferences,
  incrementFreeUsage,
  setUserPro,
  saveCompteRendu,
  getCompteRenduById,
  listCompteRendusByMedecin,
  logAudit,
};
