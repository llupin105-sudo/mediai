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

  // Profil professionnel enrichi — fondation pour la recherche de praticien (Phase 4)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_specialite TEXT DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_presentation TEXT DEFAULT '';`);

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

  // ── Fiche patient ────────────────────────────────────────────────
  // Note : en Phase 1, le patient est géré par le médecin (pas de compte
  // patient autonome). La colonne medecin_id représente le praticien
  // "propriétaire" de la fiche. La Phase 4 introduira un vrai compte
  // patient indépendant, relié à cette même table.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id UUID PRIMARY KEY,
      medecin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      date_naissance TEXT,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // ── Événements médicaux ──────────────────────────────────────────
  // Table générique : un événement peut être une consultation, une
  // ordonnance, un courrier, un examen, etc. C'est cette structure qui
  // permettra plus tard la chronologie intelligente (Phase 2) sans
  // avoir à réunir plusieurs tables différentes entre elles.
  // `data` contient le contenu spécifique au type (ex: le compte-rendu
  // SOAP complet pour une consultation).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS medical_events (
      id UUID PRIMARY KEY,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      medecin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      data JSONB NOT NULL,
      tokens_used INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_medical_events_patient ON medical_events(patient_id, event_date DESC);`);

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
      specialite: row.profile_specialite || '',
      presentation: row.profile_presentation || '',
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

async function updateUserProfile(email, { nom, rpps, cabinet, telephone, specialite, presentation }) {
  const result = await pool.query(
    `UPDATE users SET profile_nom = $1, profile_rpps = $2, profile_cabinet = $3, profile_telephone = $4,
       profile_specialite = $5, profile_presentation = $6
     WHERE email = $7 RETURNING *`,
    [nom, rpps, cabinet, telephone, specialite, presentation, email]
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

// ── Patients ──────────────────────────────────────────────────────

async function createPatient({ id, medecinId, nom, prenom, dateNaissance, notes }) {
  const result = await pool.query(
    `INSERT INTO patients (id, medecin_id, nom, prenom, date_naissance, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, medecinId, nom, prenom, dateNaissance || null, notes || '']
  );
  return result.rows[0];
}

async function listPatientsByMedecin(medecinId) {
  const result = await pool.query(
    `SELECT p.*,
       (SELECT COUNT(*) FROM medical_events e WHERE e.patient_id = p.id) AS events_count,
       (SELECT MAX(e.event_date) FROM medical_events e WHERE e.patient_id = p.id) AS last_event_date
     FROM patients p WHERE p.medecin_id = $1 ORDER BY p.nom, p.prenom`,
    [medecinId]
  );
  return result.rows;
}

async function getPatientById(id) {
  const result = await pool.query(`SELECT * FROM patients WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function updatePatientNotes(id, notes) {
  const result = await pool.query(
    `UPDATE patients SET notes = $1 WHERE id = $2 RETURNING *`,
    [notes, id]
  );
  return result.rows[0];
}

// ── Événements médicaux (consultations, ordonnances, courriers...) ─

async function createMedicalEvent({ id, patientId, medecinId, type, title, data, tokensUsed }) {
  const result = await pool.query(
    `INSERT INTO medical_events (id, patient_id, medecin_id, type, title, data, tokens_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [id, patientId, medecinId, type, title, JSON.stringify(data), tokensUsed || null]
  );
  return result.rows[0];
}

async function listEventsByPatient(patientId) {
  const result = await pool.query(
    `SELECT * FROM medical_events WHERE patient_id = $1 ORDER BY event_date DESC`,
    [patientId]
  );
  return result.rows;
}

async function getMedicalEventById(id) {
  const result = await pool.query(`SELECT * FROM medical_events WHERE id = $1`, [id]);
  return result.rows[0] || null;
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
  createPatient,
  listPatientsByMedecin,
  getPatientById,
  updatePatientNotes,
  createMedicalEvent,
  listEventsByPatient,
  getMedicalEventById,
  logAudit,
};
