'use strict';
// ── Routes API Doctolib ──────────────────────────────────────────────
// Fabrique un routeur Express. Toutes les routes « médecin » sont derrière
// requireAuth ; /diagnostic est réservé aux admins ; /webhook est public mais
// protégé par signature HMAC. Les secrets ne transitent jamais vers le client.

const express = require('express');
const crypto = require('crypto');
const uuid = () => crypto.randomUUID();

const config = require('./config');
const { createStore } = require('./store');
const { getConnector } = require('./index');
const sync = require('./sync');
const webhook = require('./webhook');
const { makeAuditor } = require('./audit');
const { DoctolibError } = require('./errors');

const PROVIDER = 'doctolib';

// Statut RDV Doctolib → statut MediAI.
function mapApptStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'cancelled' || v === 'canceled') return 'annule';
  if (v === 'confirmed' || v === 'booked') return 'planifie';
  return 'planifie';
}

// Adaptateur d'écriture MediAI, borné à un médecin. Le moteur de synchro
// n'écrit QUE via ces méthodes (bulk-friendly, source étiquetée).
function makeSink(db, medecinId) {
  const pool = db.pool;
  return {
    async createPatient(m) {
      const id = uuid();
      await pool.query(
        `INSERT INTO patients (id, medecin_id, nom, prenom, date_naissance, sexe, notes, source, external_id, external_synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,'', $7,$8, now())`,
        [id, medecinId, m.nom, m.prenom, m.dateNaissance, m.sexe, PROVIDER, m.externalId]);
      return id;
    },
    async updatePatient(id, m) {
      await pool.query(
        `UPDATE patients SET nom=$2, prenom=$3, date_naissance=$4, sexe=$5, external_synced_at=now() WHERE id=$1`,
        [id, m.nom, m.prenom, m.dateNaissance, m.sexe]);
    },
    async createAppointment(m) {
      const id = uuid();
      await pool.query(
        `INSERT INTO appointments (id, medecin_id, patient_id, patient_label, start_at, end_at, motif, mode, status, notes, source, external_id, external_synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'cabinet',$8,'', $9,$10, now())`,
        [id, medecinId, m.patientId, m.patientId ? '' : 'Patient Doctolib', m.startAt, m.endAt, m.motif, mapApptStatus(m.status), PROVIDER, m.externalId]);
      return id;
    },
    async updateAppointment(id, m) {
      await pool.query(
        `UPDATE appointments SET start_at=$2, end_at=$3, motif=$4, status=$5, patient_id=COALESCE($6, patient_id), external_synced_at=now() WHERE id=$1`,
        [id, m.startAt, m.endAt, m.motif, mapApptStatus(m.status), m.patientId]);
    },
    async createDocument(m) {
      const id = uuid();
      const data = { source: PROVIDER, externalId: m.externalId, externalUrl: m.externalUrl, metadata: m.metadata || {} };
      await pool.query(
        `INSERT INTO medical_events (id, patient_id, medecin_id, type, title, event_date, data, source, external_id, external_synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, $8,$9, now())`,
        [id, m.patientId, medecinId, m.type, m.title, m.createdAt || new Date().toISOString(), data, PROVIDER, m.externalId]);
      return id;
    },
    async updateDocument(id, m) {
      const data = { source: PROVIDER, externalId: m.externalId, externalUrl: m.externalUrl, metadata: m.metadata || {} };
      await pool.query(`UPDATE medical_events SET title=$2, data=$3, external_synced_at=now() WHERE id=$1`, [id, m.title, data]);
    },
  };
}

module.exports = function createRoutes({ db, requireAuth, requireAdmin }) {
  const router = express.Router();
  const store = createStore(db.pool);
  const audit = makeAuditor(store, PROVIDER);

  function clientError(res, e) {
    const err = (e instanceof DoctolibError) ? e : new DoctolibError('DOCTOLIB_SYNC_ERROR', String(e && e.message || e));
    return res.status(err.httpStatus).json(err.toClient());
  }

  async function buildStatus(medecinId) {
    const conn = await store.getConnection(medecinId, PROVIDER);
    const [patients, appointments, documents] = await Promise.all([
      store.countExternalRecords(medecinId, PROVIDER, 'patient'),
      store.countExternalRecords(medecinId, PROVIDER, 'appointment'),
      store.countExternalRecords(medecinId, PROVIDER, 'document'),
    ]);
    const last = await store.lastSuccessfulRun(medecinId, PROVIDER);
    return {
      provider: PROVIDER,
      mode: config.isRealConfigured() ? 'real' : 'mock',
      connected: !!conn && conn.status === 'connected',
      status: conn ? conn.status : 'disconnected',
      accountLabel: conn ? conn.account_label : null,
      lastSyncedAt: conn ? conn.last_synced_at : null,
      counts: { patients, appointments, documents },
      lastRun: last ? { finishedAt: last.finished_at, stats: last.stats } : null,
    };
  }

  // ── Statut (médecin) ──────────────────────────────────────────────
  router.get('/status', requireAuth, async (req, res) => {
    try { res.json(await buildStatus(req.medecin.id)); } catch (e) { clientError(res, e); }
  });

  // ── Connexion (mock) ──────────────────────────────────────────────
  router.post('/mock/connect', requireAuth, async (req, res) => {
    try {
      const connector = getConnector({ mode: 'mock' });
      const r = await connector.connect({});
      // Secret « fictif » chiffré au repos pour éprouver le chemin de sécurité.
      const security = require('./security');
      const encrypted = security.encryptSecret('mock-session-' + uuid(), config.encryptionKey());
      await store.upsertConnection(req.medecin.id, PROVIDER, {
        status: 'connected', accountLabel: r.accountLabel, config: { mode: 'mock' }, encryptedSecret: encrypted });
      await audit(req.medecin.id, 'CONNECT', { mode: 'mock', accountLabel: r.accountLabel });
      res.json({ ok: true, ...(await buildStatus(req.medecin.id)) });
    } catch (e) { clientError(res, e); }
  });

  // ── Synchronisation (mock) ────────────────────────────────────────
  router.post('/mock/sync', requireAuth, async (req, res) => {
    try {
      const conn = await store.getConnection(req.medecin.id, PROVIDER);
      if (!conn || conn.status !== 'connected') throw new DoctolibError('DOCTOLIB_NOT_CONFIGURED', 'non connecté');
      const kind = req.body && req.body.kind === 'incremental' ? 'incremental' : 'full';
      const connector = getConnector({ mode: 'mock' });
      const sink = makeSink(db, req.medecin.id);
      const result = await sync.runSync({ connector, store, sink, medecinId: req.medecin.id, kind });
      const status = await buildStatus(req.medecin.id);
      res.json({ ok: true, sync: result, status });
    } catch (e) { clientError(res, e); }
  });

  // ── Déconnexion — révoque/efface les secrets stockés ──────────────
  router.post('/mock/disconnect', requireAuth, async (req, res) => {
    try {
      const connector = getConnector({ mode: 'mock' });
      try { await connector.disconnect(); } catch (e) { /* best-effort */ }
      await store.clearSecret(req.medecin.id, PROVIDER); // efface encrypted_secret + status='disconnected'
      await audit(req.medecin.id, 'DISCONNECT', {});
      res.json({ ok: true, ...(await buildStatus(req.medecin.id)) });
    } catch (e) { clientError(res, e); }
  });

  // ── Webhook (public, signé) ───────────────────────────────────────
  // Abstraction : vérifie signature/fraîcheur/idempotence. En mock, aucune
  // réconciliation automatique n'est déclenchée (le connecteur réel la câblera).
  router.post('/webhook', async (req, res) => {
    const cfg = config.getConfig();
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
    try {
      const out = await webhook.handleWebhook({
        store, audit, medecinId: null, provider: PROVIDER,
        rawBody: raw,
        signature: req.headers['x-doctolib-signature'] || req.headers['x-signature'],
        timestamp: req.headers['x-doctolib-timestamp'] || req.headers['x-timestamp'],
        secret: cfg.webhookSecret,
        ipAllowlist: cfg.ipAllowlist, ip: req.ip,
      });
      res.json(out);
    } catch (e) { clientError(res, e); }
  });

  // ── Diagnostic (admin/dev uniquement) ─────────────────────────────
  router.get('/diagnostic', requireAuth, requireAdmin, async (req, res) => {
    const cfg = config.getConfig();
    const out = { connection: 'NONE', authentication: 'NONE', lastSync: 'NONE', webhook: 'NONE', database: 'NONE', latencyMs: null, lastError: 'None', mode: cfg.realConfigured ? 'real' : 'mock' };
    try {
      const conn = await store.getConnection(req.medecin.id, PROVIDER);
      out.connection = conn && conn.status === 'connected' ? 'OK' : 'NONE';
      out.authentication = conn && conn.encrypted_secret ? 'OK' : 'NONE';
      const last = await store.lastSuccessfulRun(req.medecin.id, PROVIDER);
      out.lastSync = last ? 'OK' : 'NONE';
      out.webhook = cfg.webhookSecret ? 'READY' : 'NONE';
      // ping connecteur (latence)
      try { const p = await getConnector({ mode: 'mock' }).ping(); out.latencyMs = p.latencyMs; } catch (e) { out.latencyMs = null; }
      // ping DB
      try { await db.pool.query('SELECT 1'); out.database = 'OK'; } catch (e) { out.database = 'ERROR'; out.lastError = 'DB'; }
      res.json(out);
    } catch (e) { out.lastError = (e instanceof DoctolibError ? e.code : 'ERROR'); res.json(out); }
  });

  return router;
};
