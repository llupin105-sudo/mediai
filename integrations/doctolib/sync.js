'use strict';
// ── Moteur de synchronisation ────────────────────────────────────────
// Flux : Doctolib → Fetch → Validation → Mapping → Déduplication → MediAI → Audit
//
// Dépendances injectées (testable sans base) :
//   connector : DoctolibConnector (mock ou réel)
//   store     : registre d'intégration (external_records, sync_runs, audit…)
//   sink      : adaptateur d'écriture MediAI (create/update patient/appt/doc)
//
// Garanties :
//   - Idempotence : re-synchroniser ne crée aucun doublon (clé externalId).
//   - Incrémental : `incrementalSync` ne lit que les changements depuis le
//     dernier run réussi (paramètre `since`).
//   - Observabilité : chaque run renvoie created / updated / unchanged / failed.

const mapper = require('./mapper');
const { DoctolibError, wrap } = require('./errors');

const PROVIDER = 'doctolib';

function emptyStats() { return { created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] }; }

// Résout un enregistrement mappé face au registre externe → décide create/update/unchanged.
async function reconcile({ store, medecinId, resourceType, mapped, createFn, updateFn, stats }) {
  const existing = await store.getExternalRecord(medecinId, PROVIDER, resourceType, mapped.externalId);
  if (existing) {
    if (existing.checksum === mapped.checksum) { stats.unchanged++; return existing.internal_id; }
    await updateFn(existing.internal_id, mapped);
    await store.upsertExternalRecord({ medecinId, provider: PROVIDER, resourceType, externalId: mapped.externalId,
      internalId: existing.internal_id, checksum: mapped.checksum, externalUpdatedAt: mapped.externalUpdatedAt });
    stats.updated++; return existing.internal_id;
  }
  const internalId = await createFn(mapped);
  await store.upsertExternalRecord({ medecinId, provider: PROVIDER, resourceType, externalId: mapped.externalId,
    internalId, checksum: mapped.checksum, externalUpdatedAt: mapped.externalUpdatedAt });
  stats.created++; return internalId;
}

async function syncPatients({ connector, store, sink, medecinId, since }) {
  const stats = emptyStats();
  const { records } = await connector.listPatients({ since });
  for (const raw of records) {
    try {
      const mapped = mapper.mapPatient(raw);
      await reconcile({ store, medecinId, resourceType: 'patient', mapped, stats,
        createFn: (m) => sink.createPatient(m), updateFn: (id, m) => sink.updatePatient(id, m) });
    } catch (e) { stats.failed++; stats.errors.push(safeErr(e, raw.externalId)); }
  }
  return stats;
}

async function syncAppointments({ connector, store, sink, medecinId, since }) {
  const stats = emptyStats();
  const { records } = await connector.listAppointments({ since });
  for (const raw of records) {
    try {
      // Rattachement au patient déjà synchronisé (sinon patientId=null + label).
      const patientRec = await store.getExternalRecord(medecinId, PROVIDER, 'patient', String(raw.patientExternalId));
      const mapped = mapper.mapAppointment(raw, patientRec ? patientRec.internal_id : null);
      await reconcile({ store, medecinId, resourceType: 'appointment', mapped, stats,
        createFn: (m) => sink.createAppointment(m), updateFn: (id, m) => sink.updateAppointment(id, m) });
    } catch (e) { stats.failed++; stats.errors.push(safeErr(e, raw.externalId)); }
  }
  return stats;
}

async function syncDocuments({ connector, store, sink, medecinId, since }) {
  const stats = emptyStats();
  const { records } = await connector.listDocuments({ since });
  for (const raw of records) {
    try {
      const patientRec = await store.getExternalRecord(medecinId, PROVIDER, 'patient', String(raw.patientExternalId));
      if (!patientRec) { stats.failed++; stats.errors.push({ externalId: raw.externalId, reason: 'patient non synchronisé' }); continue; }
      const mapped = mapper.mapDocument(raw, patientRec.internal_id);
      await reconcile({ store, medecinId, resourceType: 'document', mapped, stats,
        createFn: (m) => sink.createDocument(m), updateFn: (id, m) => sink.updateDocument(id, m) });
    } catch (e) { stats.failed++; stats.errors.push(safeErr(e, raw.externalId)); }
  }
  return stats;
}

function safeErr(e, externalId) {
  const de = wrap(e, 'DOCTOLIB_MAPPING_ERROR');
  return { externalId: externalId || null, code: de.code, reason: de.userMessage };
}

// Orchestration d'un run complet ou incrémental. Ordre : patients → RDV → documents
// (pour que les rattachements patient soient résolus).
async function runSync({ connector, store, sink, medecinId, kind }) {
  const runId = await store.createSyncRun({ medecinId, provider: PROVIDER, kind });
  await store.logAudit(medecinId, PROVIDER, 'SYNC_STARTED', { kind, runId });
  let since = null;
  if (kind === 'incremental') {
    const last = await store.lastSuccessfulRun(medecinId, PROVIDER);
    since = last && last.finished_at ? new Date(last.finished_at).toISOString() : null;
  }
  try {
    const patients = await syncPatients({ connector, store, sink, medecinId, since });
    const appointments = await syncAppointments({ connector, store, sink, medecinId, since });
    const documents = await syncDocuments({ connector, store, sink, medecinId, since });
    const totals = totalOf([patients, appointments, documents]);
    const stats = { kind, patients, appointments, documents, totals };
    await store.finishSyncRun(runId, { status: 'success', stats });
    await store.patchConnection(medecinId, PROVIDER, { last_synced_at: new Date().toISOString() });
    await store.logAudit(medecinId, PROVIDER, 'SYNC_COMPLETED', { kind, totals });
    return { ok: true, runId, ...stats };
  } catch (e) {
    const de = wrap(e, 'DOCTOLIB_SYNC_ERROR');
    await store.finishSyncRun(runId, { status: 'failed', error: de.userMessage });
    await store.logAudit(medecinId, PROVIDER, 'SYNC_FAILED', { kind, code: de.code });
    throw de;
  }
}

function totalOf(list) {
  return list.reduce((a, s) => ({
    created: a.created + s.created, updated: a.updated + s.updated,
    unchanged: a.unchanged + s.unchanged, failed: a.failed + s.failed,
  }), { created: 0, updated: 0, unchanged: 0, failed: 0 });
}

const fullSync = (deps) => runSync({ ...deps, kind: 'full' });
const incrementalSync = (deps) => runSync({ ...deps, kind: 'incremental' });

module.exports = { PROVIDER, syncPatients, syncAppointments, syncDocuments, runSync, fullSync, incrementalSync, reconcile, totalOf };
