'use strict';
// ── Store d'intégration (PostgreSQL/Supabase) ────────────────────────
// Couche d'accès aux tables integration_* (créées par db.js initDb).
// Le moteur de synchro reçoit un « store » en dépendance : en test on peut
// injecter une implémentation mémoire, ici c'est la vraie base.
// Toutes les écritures sont en UPSERT (idempotence) ; index sur les clés de
// déduplication (voir db.js).

const crypto = require('crypto');
const uuid = () => crypto.randomUUID();

function createStore(pool) {
  return {
    // ── Connexions ────────────────────────────────────────────────
    async getConnection(medecinId, provider) {
      const r = await pool.query(
        `SELECT * FROM integration_connections WHERE medecin_id=$1 AND provider=$2`, [medecinId, provider]);
      return r.rows[0] || null;
    },
    async upsertConnection(medecinId, provider, { status, accountLabel, config, encryptedSecret }) {
      const r = await pool.query(
        `INSERT INTO integration_connections (id, medecin_id, provider, status, account_label, config, encrypted_secret, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
         ON CONFLICT (medecin_id, provider) DO UPDATE SET
           status=EXCLUDED.status,
           account_label=COALESCE(EXCLUDED.account_label, integration_connections.account_label),
           config=COALESCE(EXCLUDED.config, integration_connections.config),
           encrypted_secret=COALESCE(EXCLUDED.encrypted_secret, integration_connections.encrypted_secret),
           updated_at=now()
         RETURNING *`,
        [uuid(), medecinId, provider, status, accountLabel || null, config || {}, encryptedSecret || null]);
      return r.rows[0];
    },
    async patchConnection(medecinId, provider, patch) {
      const sets = [], vals = [medecinId, provider]; let i = 3;
      for (const [k, v] of Object.entries(patch)) { sets.push(`${k}=$${i++}`); vals.push(v); }
      if (!sets.length) return;
      sets.push('updated_at=now()');
      await pool.query(`UPDATE integration_connections SET ${sets.join(', ')} WHERE medecin_id=$1 AND provider=$2`, vals);
    },
    // Déconnexion : on efface les secrets stockés (révocation locale).
    async clearSecret(medecinId, provider) {
      await pool.query(
        `UPDATE integration_connections SET encrypted_secret=NULL, status='disconnected', updated_at=now()
         WHERE medecin_id=$1 AND provider=$2`, [medecinId, provider]);
    },

    // ── Registre externe (déduplication) ──────────────────────────
    async getExternalRecord(medecinId, provider, resourceType, externalId) {
      const r = await pool.query(
        `SELECT * FROM integration_external_records
         WHERE medecin_id=$1 AND provider=$2 AND resource_type=$3 AND external_id=$4`,
        [medecinId, provider, resourceType, externalId]);
      return r.rows[0] || null;
    },
    async upsertExternalRecord({ medecinId, provider, resourceType, externalId, internalId, checksum, externalUpdatedAt }) {
      await pool.query(
        `INSERT INTO integration_external_records
           (id, medecin_id, provider, resource_type, external_id, internal_id, checksum, external_updated_at, last_synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
         ON CONFLICT (medecin_id, provider, resource_type, external_id) DO UPDATE SET
           internal_id=EXCLUDED.internal_id,
           checksum=EXCLUDED.checksum,
           external_updated_at=EXCLUDED.external_updated_at,
           last_synced_at=now()`,
        [uuid(), medecinId, provider, resourceType, externalId, internalId, checksum, externalUpdatedAt || null]);
    },
    async countExternalRecords(medecinId, provider, resourceType) {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS n FROM integration_external_records
         WHERE medecin_id=$1 AND provider=$2 AND resource_type=$3`, [medecinId, provider, resourceType]);
      return r.rows[0].n;
    },

    // ── Runs de synchronisation (observabilité) ───────────────────
    async createSyncRun({ medecinId, provider, kind }) {
      const r = await pool.query(
        `INSERT INTO integration_sync_runs (id, medecin_id, provider, kind, status, started_at)
         VALUES ($1,$2,$3,$4,'running', now()) RETURNING id`,
        [uuid(), medecinId, provider, kind]);
      return r.rows[0].id;
    },
    async finishSyncRun(id, { status, stats, error }) {
      await pool.query(
        `UPDATE integration_sync_runs SET status=$2, finished_at=now(),
           duration_ms=EXTRACT(EPOCH FROM (now()-started_at))*1000, stats=$3, error=$4
         WHERE id=$1`, [id, status, stats || {}, error || null]);
    },
    async lastSuccessfulRun(medecinId, provider) {
      const r = await pool.query(
        `SELECT * FROM integration_sync_runs WHERE medecin_id=$1 AND provider=$2 AND status='success'
         ORDER BY finished_at DESC LIMIT 1`, [medecinId, provider]);
      return r.rows[0] || null;
    },

    // ── Idempotence des webhooks ──────────────────────────────────
    async wasWebhookSeen(eventId) {
      const r = await pool.query(`SELECT 1 FROM integration_webhook_events WHERE event_id=$1`, [eventId]);
      return r.rowCount > 0;
    },
    async markWebhookSeen(eventId, provider) {
      // ON CONFLICT DO NOTHING → un doublon exact ne fait rien (idempotent).
      const r = await pool.query(
        `INSERT INTO integration_webhook_events (event_id, provider, received_at)
         VALUES ($1,$2, now()) ON CONFLICT (event_id) DO NOTHING`, [eventId, provider]);
      return r.rowCount > 0; // true = première fois
    },

    // ── Audit ─────────────────────────────────────────────────────
    async logAudit(medecinId, provider, action, meta) {
      await pool.query(
        `INSERT INTO integration_audit_logs (id, medecin_id, provider, action, meta, created_at)
         VALUES ($1,$2,$3,$4,$5, now())`, [uuid(), medecinId || null, provider, action, meta || {}]);
    },
    async listAudit(medecinId, provider, limit = 50) {
      const r = await pool.query(
        `SELECT action, meta, created_at FROM integration_audit_logs
         WHERE medecin_id=$1 AND provider=$2 ORDER BY created_at DESC LIMIT $3`,
        [medecinId, provider, limit]);
      return r.rows;
    },
  };
}

module.exports = { createStore };
