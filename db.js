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

  // Mois de rattachement du quota gratuit (format 'YYYY-MM'), pour une
  // remise à zéro mensuelle paresseuse : quand le mois courant diffère de
  // celui stocké, le compteur repart de zéro au prochain usage.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS free_usage_month TEXT DEFAULT '';`);

  // ── Fiche patient ────────────────────────────────────────────────
  // La fiche reste créée et possédée par le médecin (medecin_id).
  // Phase 2.2 : le médecin peut "activer l'accès patient" pour une
  // fiche précise — le patient reçoit alors un identifiant/mot de
  // passe propre à CE dossier (pas encore un compte unique valable
  // chez plusieurs médecins, ce sera un chantier ultérieur).
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

  // Accès portail patient — ALTER sûr, n'affecte pas les fiches existantes
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS sexe TEXT;`); // Sprint 21 — F | M | Autre
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS login_email TEXT;`);
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS login_password_hash TEXT;`);
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS portal_activated_at TIMESTAMPTZ;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_login_email ON patients(login_email) WHERE login_email IS NOT NULL;`);

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

  // ── Synthèse patient (Phase 5 — couche d'intelligence) ───────────
  // Cache d'une ligne par patient : synthèse de fond du dossier
  // (problèmes actifs, vigilance, suivi, narratif...) régénérée quand le
  // nombre d'événements change (`source_events_count`). Évite de rappeler
  // le modèle à chaque ouverture de fiche.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_synthesis (
      patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      source_events_count INTEGER NOT NULL DEFAULT 0,
      tokens_used INTEGER,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // ── Récit de la chronologie (Smart Timeline, Patient Workspace) ──
  // Cache d'une ligne par patient : récit par périodes du dossier,
  // régénéré quand le nombre d'événements change.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS timeline_narratives (
      patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      source_events_count INTEGER NOT NULL DEFAULT 0,
      tokens_used INTEGER,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // ── Mon Parcours Santé (Sprint 15, espace PATIENT) ──
  // Cache d'une ligne par patient : récit du parcours de soin en langage
  // clair, régénéré quand le nombre d'événements du dossier change.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_parcours (
      patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      source_events_count INTEGER NOT NULL DEFAULT 0,
      tokens_used INTEGER,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // ── Le Journal Clinique (Sprint 18, espace MÉDECIN) ──
  // Cache d'une ligne par patient : récit clinique en prose, régénéré quand
  // le nombre d'événements du dossier change.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clinical_journals (
      patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      source_events_count INTEGER NOT NULL DEFAULT 0,
      tokens_used INTEGER,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

  // ── Rendez-vous (Sprint 6 — module agenda) ───────────────────────
  // patient_id NULL autorisé : créneau pour un patient pas encore créé
  // (on garde alors patient_label, un simple nom libre). Aucune donnée
  // médicale ici — uniquement de la planification saisie par le médecin.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY,
      medecin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
      patient_label TEXT DEFAULT '',
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ,
      motif TEXT DEFAULT '',
      mode TEXT NOT NULL DEFAULT 'cabinet',
      status TEXT NOT NULL DEFAULT 'planifie',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_medecin ON appointments(medecin_id, start_at);`);

  // ── Tâches (Sprint 6 — moteur de tâches) ─────────────────────────
  // source = 'manuel' | 'ia' | 'systeme'. Les tâches 'systeme' sont
  // matérialisées depuis les signaux déterministes, dédupliquées par
  // source_ref. L'IA ne fait que PROPOSER (source='ia'), jamais valider.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY,
      medecin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'personnalise',
      priority TEXT NOT NULL DEFAULT 'moyenne',
      status TEXT NOT NULL DEFAULT 'a_faire',
      due_date TIMESTAMPTZ,
      source TEXT NOT NULL DEFAULT 'manuel',
      source_ref TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_medecin ON tasks(medecin_id, status, due_date);`);
  // Anti-doublon des tâches système : une seule tâche ouverte par source_ref/médecin.
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_source_ref ON tasks(medecin_id, source_ref) WHERE source_ref IS NOT NULL;`);

  // ── Workspace personnalisable (Sprint 6) ─────────────────────────
  // Un médecin peut sauvegarder plusieurs layouts (modes). layout = JSONB
  // décrivant l'ordre/taille/visibilité de chaque widget du cockpit.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_layouts (
      id UUID PRIMARY KEY,
      medecin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Mon espace',
      mode TEXT NOT NULL DEFAULT 'cockpit',
      layout JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workspace_medecin ON workspace_layouts(medecin_id);`);

  // ── Messagerie sécurisée (Sprint 6 — fondations) ─────────────────
  // Contenu 100% rédigé par les utilisateurs (médecin/patient), jamais
  // généré. Un fil est rattaché à un dossier patient.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_threads (
      id UUID PRIMARY KEY,
      medecin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      subject TEXT DEFAULT '',
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY,
      thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL,
      body TEXT NOT NULL,
      read_by_medecin_at TIMESTAMPTZ,
      read_by_patient_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);`);
  // Sprint 20 · Vague D — deux types de conversation : 'medical' (médecin) / 'admin' (secrétariat).
  await pool.query(`ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'medical';`);

  // ── Cache du briefing IA du cockpit (Sprint 6) ───────────────────
  // Une ligne par médecin : récit + recommandations, régénérés quand la
  // signature des faits du jour change (facts_signature). Évite de
  // rappeler le modèle à chaque ouverture de la Home.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cockpit_briefings (
      medecin_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      facts_signature TEXT NOT NULL DEFAULT '',
      tokens_used INTEGER,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // ── « À retenir » — faits clés structurés du patient (Sprint 7) ──
  // Allergies, antécédents, maladies chroniques, notes… saisis/édités par
  // le médecin (l'IA peut proposer, il valide). Donnée structurée et fiable,
  // par opposition au texte libre des notes.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_key_facts (
      id UUID PRIMARY KEY,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      category TEXT NOT NULL DEFAULT 'note',
      label TEXT NOT NULL,
      detail TEXT DEFAULT '',
      severity TEXT NOT NULL DEFAULT 'info',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_key_facts_patient ON patient_key_facts(patient_id, category);`);

  // ── Vue Évolution (Sprint 7) — cache du récit descriptif de tendances ──
  // Une ligne par patient, régénérée quand le nombre d'événements change.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_evolution (
      patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      source_events_count INTEGER NOT NULL DEFAULT 0,
      tokens_used INTEGER,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // ── Favoris (Sprint 8 Lot 3) — épingles du médecin ──────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      id UUID PRIMARY KEY,
      medecin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL,
      item_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_uniq ON favorites(medecin_id, item_type, item_id);`);

  // ── Feature flags (Sprint 16) — activation/désactivation sans redéploiement.
  // Les valeurs par défaut vivent dans le code (server.js) ; cette table ne
  // stocke QUE les surcharges décidées par un admin.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_flags (
      key TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by TEXT
    );
  `);

  // ── Intégrations externes (Sprint Doctolib) ──────────────────────
  // Couche générique `integration_*` (provider = 'doctolib', extensible).
  // - integration_connections : 1 ligne par (médecin, provider). Secret chiffré.
  // - integration_external_records : registre de déduplication externalId→interne.
  // - integration_sync_runs : observabilité (created/updated/unchanged/failed).
  // - integration_audit_logs : traçabilité (jamais de secret ni de contenu médical).
  // - integration_webhook_events : idempotence des webhooks (event_id unique).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS integration_connections (
      id UUID PRIMARY KEY,
      medecin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'disconnected',
      account_label TEXT,
      config JSONB NOT NULL DEFAULT '{}',
      encrypted_secret TEXT,
      last_synced_at TIMESTAMPTZ,
      external_cursor TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (medecin_id, provider)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS integration_external_records (
      id UUID PRIMARY KEY,
      medecin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      external_id TEXT NOT NULL,
      internal_id UUID,
      checksum TEXT,
      external_updated_at TIMESTAMPTZ,
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (medecin_id, provider, resource_type, external_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ext_records_lookup ON integration_external_records(medecin_id, provider, resource_type, external_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ext_records_updated ON integration_external_records(external_updated_at);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS integration_sync_runs (
      id UUID PRIMARY KEY,
      medecin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at TIMESTAMPTZ,
      duration_ms DOUBLE PRECISION,
      stats JSONB NOT NULL DEFAULT '{}',
      error TEXT
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sync_runs_medecin ON integration_sync_runs(medecin_id, provider, finished_at DESC);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS integration_audit_logs (
      id UUID PRIMARY KEY,
      medecin_id UUID REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      action TEXT NOT NULL,
      meta JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_integ_audit_medecin ON integration_audit_logs(medecin_id, provider, created_at DESC);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS integration_webhook_events (
      event_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Étiquette de provenance sur les entités métier (affichage « Source : Doctolib »).
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS source TEXT;`);
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS external_id TEXT;`);
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source TEXT;`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS external_id TEXT;`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE medical_events ADD COLUMN IF NOT EXISTS source TEXT;`);
  await pool.query(`ALTER TABLE medical_events ADD COLUMN IF NOT EXISTS external_id TEXT;`);
  await pool.query(`ALTER TABLE medical_events ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ;`);

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
    freeUsageMonth: row.free_usage_month || '',
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

// Réinitialisation du mot de passe (Sprint 9). Passe aussi le compte en
// auth_provider='password' au cas où (compte créé via Google qui définit
// ensuite un mot de passe — cohérence).
async function updateUserPassword(email, passwordHash) {
  const result = await pool.query(
    `UPDATE users SET password_hash = $1, auth_provider = 'password' WHERE email = $2 RETURNING *`,
    [passwordHash, email]
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

// Incrémente le quota gratuit avec remise à zéro mensuelle paresseuse :
// si le mois stocké correspond au mois courant on incrémente, sinon on
// repart de 1 et on met à jour le mois. Aucune tâche planifiée nécessaire.
async function incrementFreeUsage(email) {
  const month = new Date().toISOString().slice(0, 7); // 'YYYY-MM' (UTC)
  const result = await pool.query(
    `UPDATE users SET
       free_usage_count = CASE WHEN free_usage_month = $2 THEN free_usage_count + 1 ELSE 1 END,
       free_usage_month = $2
     WHERE email = $1 RETURNING *`,
    [email, month]
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

// Retrouve un utilisateur par son identifiant client Stripe — indispensable
// pour traiter les événements webhook d'abonnement (updated/deleted), qui ne
// portent que le customer id, pas l'email.
async function getUserByStripeCustomerId(customerId) {
  if (!customerId) return null;
  const result = await pool.query(`SELECT * FROM users WHERE stripe_customer_id = $1`, [customerId]);
  return rowToUser(result.rows[0]);
}

// ── Patients ──────────────────────────────────────────────────────

async function createPatient({ id, medecinId, nom, prenom, dateNaissance, sexe, notes }) {
  const result = await pool.query(
    `INSERT INTO patients (id, medecin_id, nom, prenom, date_naissance, sexe, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [id, medecinId, nom, prenom, dateNaissance || null, sexe || null, notes || '']
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

// ── Portail patient (Phase 2.2) ─────────────────────────────────────

async function activatePatientPortal(patientId, loginEmail, passwordHash) {
  const result = await pool.query(
    `UPDATE patients SET login_email = $1, login_password_hash = $2, portal_activated_at = now()
     WHERE id = $3 RETURNING *`,
    [loginEmail, passwordHash, patientId]
  );
  return result.rows[0];
}

async function getPatientByLoginEmail(email) {
  const result = await pool.query(`SELECT * FROM patients WHERE login_email = $1`, [email]);
  return result.rows[0] || null;
}

// ── Événements médicaux (consultations, ordonnances, courriers...) ─

async function createMedicalEvent({ id, patientId, medecinId, type, title, data, tokensUsed, eventDate }) {
  // eventDate optionnel : un événement saisi manuellement (hospitalisation,
  // vaccin…) peut être daté dans le passé. Absent → now() (défaut).
  const result = await pool.query(
    `INSERT INTO medical_events (id, patient_id, medecin_id, type, title, event_date, data, tokens_used)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), $7, $8) RETURNING *`,
    [id, patientId, medecinId, type, title, eventDate || null, JSON.stringify(data), tokensUsed || null]
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

// Remplace le contenu (data JSONB) et éventuellement le titre d'un événement.
// Utilisé par le module Ordonnance (Sprint 8) : édition, statut, historique.
async function updateMedicalEventData(id, data, title) {
  const result = title !== undefined
    ? await pool.query(`UPDATE medical_events SET data = $1, title = $2 WHERE id = $3 RETURNING *`, [JSON.stringify(data), title, id])
    : await pool.query(`UPDATE medical_events SET data = $1 WHERE id = $2 RETURNING *`, [JSON.stringify(data), id]);
  return result.rows[0] || null;
}

async function deleteMedicalEvent(id) {
  await pool.query(`DELETE FROM medical_events WHERE id = $1`, [id]);
}

// ── Synthèse patient (Phase 5) ────────────────────────────────────

async function getPatientSynthesis(patientId) {
  const result = await pool.query(`SELECT * FROM patient_synthesis WHERE patient_id = $1`, [patientId]);
  return result.rows[0] || null;
}

// Upsert : une seule ligne par patient, remplacée à chaque régénération.
async function savePatientSynthesis({ patientId, data, sourceEventsCount, tokensUsed }) {
  const result = await pool.query(
    `INSERT INTO patient_synthesis (patient_id, data, source_events_count, tokens_used, generated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (patient_id) DO UPDATE
       SET data = EXCLUDED.data,
           source_events_count = EXCLUDED.source_events_count,
           tokens_used = EXCLUDED.tokens_used,
           generated_at = now()
     RETURNING *`,
    [patientId, JSON.stringify(data), sourceEventsCount, tokensUsed || null]
  );
  return result.rows[0];
}

// ── Récit de la chronologie (Smart Timeline) ──────────────────────

async function getTimelineNarrative(patientId) {
  const result = await pool.query(`SELECT * FROM timeline_narratives WHERE patient_id = $1`, [patientId]);
  return result.rows[0] || null;
}

async function saveTimelineNarrative({ patientId, data, sourceEventsCount, tokensUsed }) {
  const result = await pool.query(
    `INSERT INTO timeline_narratives (patient_id, data, source_events_count, tokens_used, generated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (patient_id) DO UPDATE
       SET data = EXCLUDED.data,
           source_events_count = EXCLUDED.source_events_count,
           tokens_used = EXCLUDED.tokens_used,
           generated_at = now()
     RETURNING *`,
    [patientId, JSON.stringify(data), sourceEventsCount, tokensUsed || null]
  );
  return result.rows[0];
}

// ── Mon Parcours Santé (espace patient, Sprint 15) ────────────────

async function getPatientParcours(patientId) {
  const result = await pool.query(`SELECT * FROM patient_parcours WHERE patient_id = $1`, [patientId]);
  return result.rows[0] || null;
}

async function savePatientParcours({ patientId, data, sourceEventsCount, tokensUsed }) {
  const result = await pool.query(
    `INSERT INTO patient_parcours (patient_id, data, source_events_count, tokens_used, generated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (patient_id) DO UPDATE
       SET data = EXCLUDED.data,
           source_events_count = EXCLUDED.source_events_count,
           tokens_used = EXCLUDED.tokens_used,
           generated_at = now()
     RETURNING *`,
    [patientId, JSON.stringify(data), sourceEventsCount, tokensUsed || null]
  );
  return result.rows[0];
}

// ── Le Journal Clinique (espace médecin, Sprint 18) ───────────────

async function getClinicalJournal(patientId) {
  const result = await pool.query(`SELECT * FROM clinical_journals WHERE patient_id = $1`, [patientId]);
  return result.rows[0] || null;
}
async function saveClinicalJournal({ patientId, data, sourceEventsCount, tokensUsed }) {
  const result = await pool.query(
    `INSERT INTO clinical_journals (patient_id, data, source_events_count, tokens_used, generated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (patient_id) DO UPDATE
       SET data = EXCLUDED.data, source_events_count = EXCLUDED.source_events_count,
           tokens_used = EXCLUDED.tokens_used, generated_at = now()
     RETURNING *`,
    [patientId, JSON.stringify(data), sourceEventsCount, tokensUsed || null]
  );
  return result.rows[0];
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

// ── Événements — vue transversale (tous les patients d'un médecin) ──
// Pour le cockpit : on récupère tous les événements avec le nom du patient,
// afin de calculer les signaux/priorités cross-dossier en une requête.
async function listEventsByMedecin(medecinId) {
  const result = await pool.query(
    `SELECT e.*, p.nom AS patient_nom, p.prenom AS patient_prenom
       FROM medical_events e JOIN patients p ON p.id = e.patient_id
      WHERE e.medecin_id = $1 ORDER BY e.event_date DESC`,
    [medecinId]
  );
  return result.rows;
}

// ── Rendez-vous ───────────────────────────────────────────────────

async function createAppointment({ id, medecinId, patientId, patientLabel, startAt, endAt, motif, mode, status, notes }) {
  const result = await pool.query(
    `INSERT INTO appointments (id, medecin_id, patient_id, patient_label, start_at, end_at, motif, mode, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, medecinId, patientId || null, patientLabel || '', startAt, endAt || null, motif || '', mode || 'cabinet', status || 'planifie', notes || '']
  );
  return result.rows[0];
}

async function listAppointments(medecinId, { from, to } = {}) {
  const clauses = ['medecin_id = $1'];
  const params = [medecinId];
  if (from) { params.push(from); clauses.push(`start_at >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`start_at <= $${params.length}`); }
  const result = await pool.query(
    `SELECT * FROM appointments WHERE ${clauses.join(' AND ')} ORDER BY start_at ASC`,
    params
  );
  return result.rows;
}

async function getAppointmentById(id) {
  const result = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

// Portail patient (Sprint 9) — le patient consulte SES rendez-vous.
async function listAppointmentsByPatient(patientId) {
  const result = await pool.query(
    `SELECT id, start_at, end_at, motif, mode, status FROM appointments WHERE patient_id = $1 ORDER BY start_at DESC`,
    [patientId]
  );
  return result.rows;
}

async function updateAppointment(id, fields) {
  const allowed = ['patient_id', 'patient_label', 'start_at', 'end_at', 'motif', 'mode', 'status', 'notes'];
  const sets = [], params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) { params.push(fields[key]); sets.push(`${key} = $${params.length}`); }
  }
  if (!sets.length) return getAppointmentById(id);
  params.push(id);
  const result = await pool.query(
    `UPDATE appointments SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

async function deleteAppointment(id) {
  await pool.query(`DELETE FROM appointments WHERE id = $1`, [id]);
}

// ── Tâches ────────────────────────────────────────────────────────

async function createTask({ id, medecinId, patientId, title, description, type, priority, status, dueDate, source, sourceRef }) {
  const result = await pool.query(
    `INSERT INTO tasks (id, medecin_id, patient_id, title, description, type, priority, status, due_date, source, source_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (medecin_id, source_ref) WHERE source_ref IS NOT NULL DO NOTHING
     RETURNING *`,
    [id, medecinId, patientId || null, title, description || '', type || 'personnalise', priority || 'moyenne', status || 'a_faire', dueDate || null, source || 'manuel', sourceRef || null]
  );
  return result.rows[0] || null;
}

async function listTasks(medecinId, status) {
  if (status) {
    const result = await pool.query(
      `SELECT * FROM tasks WHERE medecin_id = $1 AND status = $2 ORDER BY due_date NULLS LAST, created_at DESC`,
      [medecinId, status]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT * FROM tasks WHERE medecin_id = $1 ORDER BY due_date NULLS LAST, created_at DESC`,
    [medecinId]
  );
  return result.rows;
}

async function getTaskById(id) {
  const result = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function updateTask(id, fields) {
  const allowed = ['title', 'description', 'type', 'priority', 'status', 'due_date'];
  const sets = [], params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) { params.push(fields[key]); sets.push(`${key} = $${params.length}`); }
  }
  // Horodatage de complétion cohérent avec le statut.
  if (fields.status === 'fait') sets.push(`completed_at = now()`);
  else if (fields.status !== undefined) sets.push(`completed_at = NULL`);
  if (!sets.length) return getTaskById(id);
  params.push(id);
  const result = await pool.query(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

async function deleteTask(id) {
  await pool.query(`DELETE FROM tasks WHERE id = $1`, [id]);
}

// ── Workspace ─────────────────────────────────────────────────────

async function listWorkspaceLayouts(medecinId) {
  const result = await pool.query(
    `SELECT * FROM workspace_layouts WHERE medecin_id = $1 ORDER BY created_at ASC`,
    [medecinId]
  );
  return result.rows;
}

async function createWorkspaceLayout({ id, medecinId, name, mode, layout, isDefault }) {
  const result = await pool.query(
    `INSERT INTO workspace_layouts (id, medecin_id, name, mode, layout, is_default)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, medecinId, name || 'Mon espace', mode || 'cockpit', JSON.stringify(layout || []), !!isDefault]
  );
  return result.rows[0];
}

async function getWorkspaceLayoutById(id) {
  const result = await pool.query(`SELECT * FROM workspace_layouts WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function updateWorkspaceLayout(id, { name, mode, layout, isDefault }) {
  const sets = ['updated_at = now()'], params = [];
  if (name !== undefined) { params.push(name); sets.push(`name = $${params.length}`); }
  if (mode !== undefined) { params.push(mode); sets.push(`mode = $${params.length}`); }
  if (layout !== undefined) { params.push(JSON.stringify(layout)); sets.push(`layout = $${params.length}`); }
  if (isDefault !== undefined) { params.push(!!isDefault); sets.push(`is_default = $${params.length}`); }
  params.push(id);
  const result = await pool.query(
    `UPDATE workspace_layouts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

async function deleteWorkspaceLayout(id) {
  await pool.query(`DELETE FROM workspace_layouts WHERE id = $1`, [id]);
}

// ── Messagerie ────────────────────────────────────────────────────

async function countUnreadMessagesForMedecin(medecinId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM messages m
       JOIN message_threads t ON t.id = m.thread_id
      WHERE t.medecin_id = $1 AND m.sender_type = 'patient' AND m.read_by_medecin_at IS NULL`,
    [medecinId]
  );
  return result.rows[0]?.n || 0;
}

async function listThreadsByMedecin(medecinId) {
  const result = await pool.query(
    `SELECT t.*, p.nom AS patient_nom, p.prenom AS patient_prenom,
       (SELECT COUNT(*)::int FROM messages m WHERE m.thread_id = t.id AND m.sender_type='patient' AND m.read_by_medecin_at IS NULL) AS unread
       FROM message_threads t JOIN patients p ON p.id = t.patient_id
      WHERE t.medecin_id = $1 ORDER BY t.last_message_at DESC`,
    [medecinId]
  );
  return result.rows;
}

async function getThreadById(id) {
  const result = await pool.query(`SELECT * FROM message_threads WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

// Portail patient (Sprint 9) — le patient consulte SES conversations.
async function listThreadsByPatient(patientId) {
  const result = await pool.query(
    `SELECT t.*, (SELECT COUNT(*)::int FROM messages m WHERE m.thread_id = t.id AND m.sender_type='medecin' AND m.read_by_patient_at IS NULL) AS unread
       FROM message_threads t WHERE t.patient_id = $1 ORDER BY t.last_message_at DESC`,
    [patientId]
  );
  return result.rows;
}

async function createThread({ id, medecinId, patientId, subject, category }) {
  const result = await pool.query(
    `INSERT INTO message_threads (id, medecin_id, patient_id, subject, category) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [id, medecinId, patientId, subject || '', category || 'medical']
  );
  return result.rows[0];
}

// Sprint 20 · Vague D — dernière conversation d'une catégorie pour un patient
// (sert à regrouper les messages du patient plutôt que d'ouvrir un fil à chaque envoi).
async function latestThreadByPatientCategory(patientId, category) {
  const result = await pool.query(
    `SELECT * FROM message_threads WHERE patient_id = $1 AND category = $2 ORDER BY last_message_at DESC LIMIT 1`,
    [patientId, category]
  );
  return result.rows[0] || null;
}

async function listMessages(threadId) {
  const result = await pool.query(`SELECT * FROM messages WHERE thread_id = $1 ORDER BY created_at ASC`, [threadId]);
  return result.rows;
}

async function addMessage({ id, threadId, senderType, body }) {
  const result = await pool.query(
    `INSERT INTO messages (id, thread_id, sender_type, body) VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, threadId, senderType, body]
  );
  await pool.query(`UPDATE message_threads SET last_message_at = now() WHERE id = $1`, [threadId]);
  return result.rows[0];
}

async function markThreadReadByMedecin(threadId) {
  await pool.query(
    `UPDATE messages SET read_by_medecin_at = now() WHERE thread_id = $1 AND sender_type='patient' AND read_by_medecin_at IS NULL`,
    [threadId]
  );
}

// Sprint 20 · Vague D — le patient marque comme lus les messages du médecin.
async function markThreadReadByPatient(threadId) {
  await pool.query(
    `UPDATE messages SET read_by_patient_at = now() WHERE thread_id = $1 AND sender_type='medecin' AND read_by_patient_at IS NULL`,
    [threadId]
  );
}

// ── Cache du briefing IA du cockpit ───────────────────────────────

async function getCockpitBriefing(medecinId) {
  const result = await pool.query(`SELECT * FROM cockpit_briefings WHERE medecin_id = $1`, [medecinId]);
  return result.rows[0] || null;
}

async function saveCockpitBriefing({ medecinId, data, factsSignature, tokensUsed }) {
  const result = await pool.query(
    `INSERT INTO cockpit_briefings (medecin_id, data, facts_signature, tokens_used, generated_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (medecin_id) DO UPDATE
       SET data = EXCLUDED.data, facts_signature = EXCLUDED.facts_signature,
           tokens_used = EXCLUDED.tokens_used, generated_at = now()
     RETURNING *`,
    [medecinId, JSON.stringify(data), factsSignature || '', tokensUsed || null]
  );
  return result.rows[0];
}

// ── « À retenir » — faits clés (Sprint 7) ─────────────────────────

async function listKeyFacts(patientId) {
  const result = await pool.query(
    `SELECT * FROM patient_key_facts WHERE patient_id = $1 ORDER BY category, position, created_at`,
    [patientId]
  );
  return result.rows;
}

async function createKeyFact({ id, patientId, category, label, detail, severity, position }) {
  const result = await pool.query(
    `INSERT INTO patient_key_facts (id, patient_id, category, label, detail, severity, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, patientId, category || 'note', label, detail || '', severity || 'info', position || 0]
  );
  return result.rows[0];
}

async function getKeyFactById(id) {
  const result = await pool.query(`SELECT * FROM patient_key_facts WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function updateKeyFact(id, fields) {
  const allowed = ['category', 'label', 'detail', 'severity', 'position'];
  const sets = [], params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) { params.push(fields[key]); sets.push(`${key} = $${params.length}`); }
  }
  if (!sets.length) return getKeyFactById(id);
  params.push(id);
  const result = await pool.query(
    `UPDATE patient_key_facts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

async function deleteKeyFact(id) {
  await pool.query(`DELETE FROM patient_key_facts WHERE id = $1`, [id]);
}

// ── Vue Évolution — cache (Sprint 7) ──────────────────────────────

async function getPatientEvolution(patientId) {
  const result = await pool.query(`SELECT * FROM patient_evolution WHERE patient_id = $1`, [patientId]);
  return result.rows[0] || null;
}

async function savePatientEvolution({ patientId, data, sourceEventsCount, tokensUsed }) {
  const result = await pool.query(
    `INSERT INTO patient_evolution (patient_id, data, source_events_count, tokens_used, generated_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (patient_id) DO UPDATE
       SET data = EXCLUDED.data, source_events_count = EXCLUDED.source_events_count,
           tokens_used = EXCLUDED.tokens_used, generated_at = now()
     RETURNING *`,
    [patientId, JSON.stringify(data), sourceEventsCount, tokensUsed || null]
  );
  return result.rows[0];
}

// ── Favoris (Sprint 8 Lot 3) ──────────────────────────────────────

// Bascule : ajoute si absent (renvoie favorited=true), retire si présent.
async function toggleFavorite(medecinId, itemType, itemId) {
  const existing = await pool.query(
    `SELECT id FROM favorites WHERE medecin_id = $1 AND item_type = $2 AND item_id = $3`,
    [medecinId, itemType, itemId]
  );
  if (existing.rows[0]) {
    await pool.query(`DELETE FROM favorites WHERE id = $1`, [existing.rows[0].id]);
    return { favorited: false };
  }
  await pool.query(
    `INSERT INTO favorites (id, medecin_id, item_type, item_id) VALUES ($1, $2, $3, $4)`,
    [crypto.randomUUID(), medecinId, itemType, itemId]
  );
  return { favorited: true };
}

// Liste résolue : patients épinglés + événements (documents) épinglés.
async function listFavorites(medecinId) {
  const patients = await pool.query(
    `SELECT f.item_id AS id, p.nom, p.prenom, f.created_at
       FROM favorites f JOIN patients p ON p.id = f.item_id
      WHERE f.medecin_id = $1 AND f.item_type = 'patient' ORDER BY f.created_at DESC`,
    [medecinId]
  );
  const events = await pool.query(
    `SELECT f.item_id AS id, e.type, e.title, e.patient_id, e.event_date, p.nom AS patient_nom, p.prenom AS patient_prenom, f.created_at
       FROM favorites f JOIN medical_events e ON e.id = f.item_id JOIN patients p ON p.id = e.patient_id
      WHERE f.medecin_id = $1 AND f.item_type = 'event' ORDER BY f.created_at DESC`,
    [medecinId]
  );
  return { patients: patients.rows, events: events.rows, ids: [...patients.rows, ...events.rows].map((r) => r.id) };
}

// ── Métriques plateforme (Sprint 16 · Command Center) ─────────────
// Compteurs AGRÉGÉS uniquement — aucune donnée personnelle, aucun contenu
// clinique. Sert le cockpit admin avec des chiffres RÉELS (jamais inventés).
async function getAdminMetrics() {
  const one = async (sql) => (await pool.query(sql)).rows[0].c;
  const [users, patients, events, appointments] = await Promise.all([
    one(`SELECT COUNT(*)::int c FROM users`),
    one(`SELECT COUNT(*)::int c FROM patients`),
    one(`SELECT COUNT(*)::int c FROM medical_events`),
    one(`SELECT COUNT(*)::int c FROM appointments`),
  ]);
  const byType = (await pool.query(`SELECT type, COUNT(*)::int c FROM medical_events GROUP BY type`)).rows
    .reduce((acc, r) => { acc[r.type] = r.c; return acc; }, {});
  return { users, patients, events, appointments, eventsByType: byType };
}

// ── Journal du cabinet (Sprint 17) ────────────────────────────────
// Compteurs RÉELS d'activité du médecin par période (aujourd'hui / 7 j /
// 30 j / total), depuis medical_events (medecin_id direct). Basé sur
// created_at (moment où le document a été produit dans MediAI).
async function getJournalStats(medecinId) {
  const r = await pool.query(
    `SELECT e.type,
       COUNT(*) FILTER (WHERE e.created_at >= date_trunc('day', now()))::int AS today,
       COUNT(*) FILTER (WHERE e.created_at >= now() - interval '7 days')::int AS week,
       COUNT(*) FILTER (WHERE e.created_at >= now() - interval '30 days')::int AS month,
       COUNT(*)::int AS total
     FROM medical_events e
     WHERE e.medecin_id = $1
     GROUP BY e.type`,
    [medecinId]
  );
  const periods = { today: {}, week: {}, month: {}, total: {} };
  for (const row of r.rows) {
    periods.today[row.type] = row.today;
    periods.week[row.type] = row.week;
    periods.month[row.type] = row.month;
    periods.total[row.type] = row.total;
  }
  return periods;
}

// ── Statistiques IA (Sprint 17 · Mission Control) ─────────────────
// Agrège tokens_used RÉEL par source. Noms de tables constants (aucune
// entrée utilisateur → pas d'injection). Une source sans colonne
// tokens_used est simplement ignorée.
async function getAiStats() {
  const sources = [
    ['medical_events', 'Documents générés'],
    ['patient_synthesis', 'Synthèses de dossier'],
    ['timeline_narratives', 'Récits de chronologie'],
    ['patient_parcours', 'Parcours patient'],
    ['cockpit_briefings', 'Briefings du cockpit'],
  ];
  const bySource = [];
  let totalTokens = 0, totalCalls = 0;
  for (const [table, label] of sources) {
    try {
      const r = await pool.query(`SELECT COUNT(*) FILTER (WHERE tokens_used IS NOT NULL)::int AS calls, COALESCE(SUM(tokens_used),0)::bigint AS tokens FROM ${table}`);
      const calls = r.rows[0].calls, tokens = Number(r.rows[0].tokens);
      if (calls > 0 || tokens > 0) { bySource.push({ source: label, calls, tokens }); totalCalls += calls; totalTokens += tokens; }
    } catch (e) { /* table sans colonne tokens_used → ignorée */ }
  }
  return { totalTokens, totalCalls, bySource };
}

// ── Feature flags (Sprint 16) ─────────────────────────────────────
async function getFlagOverrides() {
  const r = await pool.query(`SELECT key, enabled FROM feature_flags`);
  const out = {};
  for (const row of r.rows) out[row.key] = row.enabled;
  return out;
}
async function setFlag(key, enabled, updatedBy) {
  const r = await pool.query(
    `INSERT INTO feature_flags (key, enabled, updated_by, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING *`,
    [key, !!enabled, updatedBy || null]
  );
  return r.rows[0];
}

module.exports = {
  pool,
  initDb,
  getAdminMetrics,
  getJournalStats,
  getAiStats,
  getFlagOverrides,
  setFlag,
  createUser,
  createUser,
  getUserByEmail,
  findOrCreateGoogleUser,
  updateUserProfile,
  updateUserPassword,
  updateUserPreferences,
  incrementFreeUsage,
  setUserPro,
  getUserByStripeCustomerId,
  createPatient,
  listPatientsByMedecin,
  getPatientById,
  updatePatientNotes,
  activatePatientPortal,
  getPatientByLoginEmail,
  createMedicalEvent,
  listEventsByPatient,
  getMedicalEventById,
  updateMedicalEventData,
  deleteMedicalEvent,
  getPatientSynthesis,
  savePatientSynthesis,
  getTimelineNarrative,
  saveTimelineNarrative,
  getPatientParcours,
  savePatientParcours,
  getClinicalJournal,
  saveClinicalJournal,
  logAudit,
  // Sprint 6 — Cockpit, RDV, tâches, workspace, messagerie
  listEventsByMedecin,
  createAppointment,
  listAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  deleteTask,
  listWorkspaceLayouts,
  createWorkspaceLayout,
  getWorkspaceLayoutById,
  updateWorkspaceLayout,
  deleteWorkspaceLayout,
  countUnreadMessagesForMedecin,
  listThreadsByMedecin,
  listThreadsByPatient,
  listAppointmentsByPatient,
  getThreadById,
  createThread,
  latestThreadByPatientCategory,
  markThreadReadByPatient,
  listMessages,
  addMessage,
  markThreadReadByMedecin,
  getCockpitBriefing,
  saveCockpitBriefing,
  // Sprint 7 — dossier médical intelligent
  listKeyFacts,
  createKeyFact,
  getKeyFactById,
  updateKeyFact,
  deleteKeyFact,
  getPatientEvolution,
  savePatientEvolution,
  toggleFavorite,
  listFavorites,
};
