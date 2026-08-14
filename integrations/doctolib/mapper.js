'use strict';
// ── Mapping Doctolib → MediAI ────────────────────────────────────────
// Transforme un enregistrement « brut » en une forme neutre consommable par
// la couche de synchronisation (qui appelle ensuite db.createPatient / …).
// Chaque mapping porte :
//   - externalId  : identifiant stable côté Doctolib (clé de déduplication)
//   - source      : 'doctolib'
//   - externalUpdatedAt : pour la synchro incrémentale
//   - checksum    : empreinte des champs signifiants → détection « inchangé »

const crypto = require('crypto');
const { validatePatient, validateAppointment, validateDocument } = require('./validator');

const SOURCE = 'doctolib';

function checksum(parts) {
  return crypto.createHash('sha1').update(parts.map((p) => String(p == null ? '' : p)).join('|')).digest('hex');
}

// Sexe MediAI attendu : 'F' | 'M' | 'Autre'.
function mapSex(s) {
  const v = String(s || '').trim().toUpperCase();
  if (v === 'F' || v === 'FEMALE') return 'F';
  if (v === 'M' || v === 'MALE') return 'M';
  return v ? 'Autre' : null;
}

function mapPatient(raw) {
  validatePatient(raw);
  return {
    externalId: String(raw.externalId),
    source: SOURCE,
    prenom: raw.firstName || '',
    nom: raw.lastName || '',
    dateNaissance: raw.birthDate || null,
    sexe: mapSex(raw.sex),
    // Identifiants externes conservés dans les notes structurées (jamais de secret).
    identifiers: { doctolib: String(raw.externalId), phone: raw.phone || null },
    externalUpdatedAt: raw.externalUpdatedAt || null,
    checksum: checksum([raw.firstName, raw.lastName, raw.birthDate, raw.sex, raw.phone]),
  };
}

// `patientInternalId` = l'UUID MediAI du patient déjà résolu par la synchro.
function mapAppointment(raw, patientInternalId) {
  validateAppointment(raw);
  return {
    externalId: String(raw.externalId),
    source: SOURCE,
    patientId: patientInternalId || null,
    patientExternalId: String(raw.patientExternalId),
    practitionerId: raw.practitionerExternalId || null,
    startAt: raw.startAt,
    endAt: raw.endAt || null,
    status: raw.status || 'planifie',
    type: raw.type || 'Consultation',
    motif: raw.type || '',
    externalUpdatedAt: raw.externalUpdatedAt || null,
    checksum: checksum([raw.patientExternalId, raw.startAt, raw.endAt, raw.status, raw.type]),
  };
}

function mapDocument(raw, patientInternalId) {
  validateDocument(raw);
  return {
    externalId: String(raw.externalId),
    source: SOURCE,
    patientId: patientInternalId || null,
    patientExternalId: String(raw.patientExternalId),
    type: raw.type || 'document',
    title: raw.title || 'Document Doctolib',
    createdAt: raw.createdAt || raw.externalUpdatedAt || null,
    metadata: raw.metadata || {},
    // On ne télécharge PAS le contenu : on conserve seulement l'URL/metadata
    // si le connecteur réel l'autorise. Architecture prête, pas de récupération.
    externalUrl: raw.externalUrl || null,
    externalUpdatedAt: raw.externalUpdatedAt || null,
    checksum: checksum([raw.type, raw.title, raw.createdAt, raw.externalUrl]),
  };
}

module.exports = { SOURCE, mapPatient, mapAppointment, mapDocument, mapSex, checksum };
