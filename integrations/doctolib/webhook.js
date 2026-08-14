'use strict';
// ── Webhooks Doctolib (abstraction + mock) ───────────────────────────
// ⚠️  Les types d'événements ci-dessous (AppointmentCreated, PatientUpdated…)
//     sont une ABSTRACTION. Ils ne sont PAS présumés exister tels quels chez
//     Doctolib tant que la documentation officielle du connecteur retenu ne
//     les confirme pas. Seuls le contrat et le mock sont fournis ici.
//
// Défenses en profondeur, dans l'ordre :
//   1. Vérification de signature HMAC (intégrité + authenticité).
//   2. Fraîcheur de l'horodatage (fenêtre anti-rejeu).
//   3. Idempotence par event_id (un même message traité une seule fois).

const security = require('./security');
const { DoctolibError } = require('./errors');

const EVENT_TYPES = ['AppointmentCreated', 'AppointmentUpdated', 'PatientUpdated', 'DocumentCreated'];

// Vérifie un webhook entrant. `rawBody` = corps brut (string) tel que reçu.
// `headers` doit contenir la signature et l'horodatage.
// Renvoie l'événement parsé si valide ; lève DOCTOLIB_INVALID_SIGNATURE sinon.
function verifyIncoming({ rawBody, signature, timestamp, secret, toleranceSeconds = 300 }) {
  if (!secret) throw new DoctolibError('DOCTOLIB_NOT_CONFIGURED', 'webhook secret absent');
  // 1) Signature — le message signé inclut l'horodatage pour lier les deux.
  const signedPayload = `${timestamp}.${rawBody}`;
  const okSig = security.verifySignature(signedPayload, signature, secret)
    // tolérance : certains émetteurs signent le corps seul
    || security.verifySignature(rawBody, signature, secret);
  if (!okSig) throw new DoctolibError('DOCTOLIB_INVALID_SIGNATURE', 'signature HMAC non conforme');
  // 2) Anti-rejeu temporel.
  if (!security.isTimestampFresh(timestamp, toleranceSeconds)) {
    throw new DoctolibError('DOCTOLIB_INVALID_SIGNATURE', 'horodatage hors fenêtre (rejeu ?)');
  }
  let event;
  try { event = JSON.parse(rawBody); } catch (e) {
    throw new DoctolibError('DOCTOLIB_MAPPING_ERROR', 'corps de webhook illisible');
  }
  if (!event || !event.id || !event.type) {
    throw new DoctolibError('DOCTOLIB_MAPPING_ERROR', 'événement webhook incomplet (id/type)');
  }
  return event;
}

// Traite un webhook de bout en bout : vérifie + déduplique (idempotence) +
// route. Renvoie { ok, deduped, type }.
async function handleWebhook({ store, audit, medecinId, provider, rawBody, signature, timestamp, secret, ipAllowlist, ip, router }) {
  if (ipAllowlist && ipAllowlist.length && !security.isIpAllowed(ip, ipAllowlist)) {
    await audit(medecinId, 'WEBHOOK_REJECTED', { reason: 'ip', ip });
    throw new DoctolibError('DOCTOLIB_FORBIDDEN', 'IP non autorisée');
  }
  let event;
  try {
    event = verifyIncoming({ rawBody, signature, timestamp, secret });
  } catch (e) {
    await audit(medecinId, 'WEBHOOK_REJECTED', { reason: e.code });
    throw e;
  }
  // 3) Idempotence — markWebhookSeen renvoie false si déjà vu.
  const firstTime = await store.markWebhookSeen(event.id, provider);
  await audit(medecinId, 'WEBHOOK_RECEIVED', { type: event.type, eventId: event.id, deduped: !firstTime });
  if (!firstTime) return { ok: true, deduped: true, type: event.type };
  if (typeof router === 'function') { try { await router(event); } catch (e) { /* routage best-effort */ } }
  return { ok: true, deduped: false, type: event.type };
}

module.exports = { EVENT_TYPES, verifyIncoming, handleWebhook };
