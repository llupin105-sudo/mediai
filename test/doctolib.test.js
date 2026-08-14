'use strict';
// Tests de l'intégration Doctolib — 100 % hors-ligne (mock + store mémoire),
// aucun accès base requis. Couvre : mapping, déduplication, synchro incrémentale,
// signature/anti-rejeu/idempotence des webhooks, erreurs, gestion des secrets.

const { test } = require('node:test');
const assert = require('node:assert');

const dl = require('../integrations/doctolib');
const { MockDoctolibConnector } = require('../integrations/doctolib/mock-connector');
const { DoctolibError } = require('../integrations/doctolib/errors');

// ── Fakes réutilisables ──────────────────────────────────────────────
function memStore() {
  const ext = new Map(), seen = new Set(), audits = [];
  let lastRun = null;
  const key = (t, e) => t + '|' + e;
  return {
    _ext: ext, _audits: audits,
    async getExternalRecord(m, p, t, e) { return ext.get(key(t, e)) || null; },
    async upsertExternalRecord(r) { ext.set(key(r.resourceType, r.externalId), { internal_id: r.internalId, checksum: r.checksum, external_updated_at: r.externalUpdatedAt }); },
    async countExternalRecords(m, p, t) { let n = 0; for (const k of ext.keys()) if (k.startsWith(t + '|')) n++; return n; },
    async createSyncRun() { return 'run_' + Date.now(); },
    async finishSyncRun(id, r) { if (r.status === 'success') lastRun = { finished_at: new Date().toISOString(), stats: r.stats }; },
    async lastSuccessfulRun() { return lastRun; },
    async patchConnection() {},
    async logAudit(m, p, a, meta) { audits.push({ a, meta }); },
    async wasWebhookSeen(id) { return seen.has(id); },
    async markWebhookSeen(id) { if (seen.has(id)) return false; seen.add(id); return true; },
  };
}
function memSink() {
  const created = { patient: 0, appointment: 0, document: 0 }, updated = { patient: 0, appointment: 0, document: 0 };
  let c = 0;
  return {
    created, updated,
    async createPatient() { created.patient++; return 'ip' + (++c); },
    async updatePatient() { updated.patient++; },
    async createAppointment() { created.appointment++; return 'ia' + (++c); },
    async updateAppointment() { updated.appointment++; },
    async createDocument() { created.document++; return 'id' + (++c); },
    async updateDocument() { updated.document++; },
  };
}

// ── Mapping ───────────────────────────────────────────────────────────
test('mapper: patient Doctolib → MediAI (source, checksum, sexe)', () => {
  const raw = MockDoctolibConnector.dataset.PATIENTS[0];
  const m = dl.mapper.mapPatient(raw);
  assert.equal(m.source, 'doctolib');
  assert.equal(m.externalId, raw.externalId);
  assert.equal(m.sexe, 'F');
  assert.equal(m.checksum.length, 40); // sha1 hex
});

test('mapper: rendez-vous invalide (startAt manquant) → DOCTOLIB_MAPPING_ERROR', () => {
  assert.throws(() => dl.mapper.mapAppointment({ externalId: 'x', patientExternalId: 'p' }, null),
    (e) => e instanceof DoctolibError && e.code === 'DOCTOLIB_MAPPING_ERROR');
});

// ── Déduplication (même patient/RDV synchronisé deux fois) ────────────
test('sync: fullSync ×2 ne crée aucun doublon (dédup)', async () => {
  const connector = dl.getConnector({ mode: 'mock' });
  const store = memStore(), sink = memSink();
  const r1 = await dl.sync.fullSync({ connector, store, sink, medecinId: 'med1' });
  assert.deepEqual(r1.totals, { created: 33, updated: 0, unchanged: 0, failed: 0 });
  const r2 = await dl.sync.fullSync({ connector, store, sink, medecinId: 'med1' });
  assert.equal(r2.totals.created, 0);
  assert.equal(r2.totals.unchanged, 33);
  assert.deepEqual(sink.created, { patient: 10, appointment: 15, document: 8 }); // stable
});

// ── Synchro incrémentale (ne lit que les changements depuis le dernier run) ──
test('sync: incrementalSync après un full ne recrée rien', async () => {
  const connector = dl.getConnector({ mode: 'mock' });
  const store = memStore(), sink = memSink();
  await dl.sync.fullSync({ connector, store, sink, medecinId: 'med1' });
  const inc = await dl.sync.incrementalSync({ connector, store, sink, medecinId: 'med1' });
  // Le dataset mock est figé dans le passé → aucun changement depuis « maintenant ».
  assert.equal(inc.totals.created, 0);
  assert.equal(inc.totals.updated, 0);
});

test('connector mock: since filtre les enregistrements plus récents', async () => {
  const connector = dl.getConnector({ mode: 'mock' });
  const all = await connector.listPatients({});
  const future = await connector.listPatients({ since: '2030-01-01T00:00:00.000Z' });
  assert.equal(all.records.length, 10);
  assert.equal(future.records.length, 0);
});

// ── Webhooks : signature, anti-rejeu, idempotence ─────────────────────
test('webhook: signature valide acceptée, invalide rejetée', () => {
  const secret = 'whsec';
  const body = JSON.stringify({ id: 'evt1', type: 'AppointmentUpdated', timestamp: Math.floor(Date.now() / 1000) });
  const ts = Math.floor(Date.now() / 1000);
  const good = dl.security.hmacSign(`${ts}.${body}`, secret);
  const ev = dl.webhook.verifyIncoming({ rawBody: body, signature: good, timestamp: ts, secret });
  assert.equal(ev.id, 'evt1');
  assert.throws(() => dl.webhook.verifyIncoming({ rawBody: body, signature: 'deadbeef', timestamp: ts, secret }),
    (e) => e.code === 'DOCTOLIB_INVALID_SIGNATURE');
});

test('webhook: horodatage périmé rejeté (anti-rejeu)', () => {
  const secret = 'whsec';
  const body = JSON.stringify({ id: 'evt2', type: 'PatientUpdated' });
  const oldTs = Math.floor(Date.now() / 1000) - 100000;
  const sig = dl.security.hmacSign(`${oldTs}.${body}`, secret);
  assert.throws(() => dl.webhook.verifyIncoming({ rawBody: body, signature: sig, timestamp: oldTs, secret }),
    (e) => e.code === 'DOCTOLIB_INVALID_SIGNATURE');
});

test('webhook: même event_id traité une seule fois (idempotence)', async () => {
  const store = memStore();
  const audit = async () => {};
  const secret = 'whsec';
  const ts = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ id: 'evt_dup', type: 'DocumentCreated', timestamp: ts });
  const signature = dl.security.hmacSign(`${ts}.${body}`, secret);
  const args = { store, audit, provider: 'doctolib', rawBody: body, signature, timestamp: ts, secret };
  const first = await dl.webhook.handleWebhook(args);
  const second = await dl.webhook.handleWebhook(args);
  assert.equal(first.deduped, false);
  assert.equal(second.deduped, true); // rejoué → non retraité
});

// ── Secrets : chiffrement au repos + redaction ────────────────────────
test('security: chiffrement/déchiffrement AES-GCM round-trip', () => {
  const enc = dl.security.encryptSecret('super-secret', 'masterkey');
  assert.ok(enc.startsWith('v1:'));
  assert.equal(dl.security.decryptSecret(enc, 'masterkey'), 'super-secret');
  assert.equal(dl.security.decryptSecret(enc, 'wrongkey'), null); // mauvaise clé → null (pas d'exception)
});

test('security: redact masque les secrets pour les logs', () => {
  const r = dl.security.redact({ clientSecret: 'abc', token: 'xyz', nom: 'Léa' });
  assert.equal(r.clientSecret, '••••');
  assert.equal(r.token, '••••');
  assert.equal(r.nom, 'Léa');
});

// ── Erreurs : jamais de fuite technique vers le client ────────────────
test('errors: toClient() ne renvoie qu’un message médecin-friendly', () => {
  const e = new DoctolibError('DOCTOLIB_SYNC_ERROR', 'ECONNRESET at axios internal');
  const c = e.toClient();
  assert.equal(c.error, 'Impossible de synchroniser Doctolib pour le moment.');
  assert.ok(!/ECONNRESET/.test(JSON.stringify(c))); // le détail technique ne fuit pas
  assert.equal(c.retryable, true);
});

// ── Connecteur réel non branché → erreur propre (jamais d'API inventée) ──
test('index: mode real sans connecteur officiel → DOCTOLIB_NOT_CONFIGURED', () => {
  assert.throws(() => dl.getConnector({ mode: 'real' }),
    (e) => e.code === 'DOCTOLIB_NOT_CONFIGURED');
});
