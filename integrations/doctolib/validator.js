'use strict';
// ── Validation des enregistrements entrants ──────────────────────────
// Refuse proprement (DOCTOLIB_MAPPING_ERROR) tout enregistrement malformé,
// AVANT toute écriture en base. Ne fait aucune supposition médicale.

const { DoctolibError } = require('./errors');

function requireFields(obj, fields, kind) {
  if (!obj || typeof obj !== 'object') {
    throw new DoctolibError('DOCTOLIB_MAPPING_ERROR', `${kind}: enregistrement vide`);
  }
  for (const f of fields) {
    if (obj[f] == null || obj[f] === '') {
      throw new DoctolibError('DOCTOLIB_MAPPING_ERROR', `${kind}: champ requis manquant « ${f} »`);
    }
  }
}

function validatePatient(raw) {
  requireFields(raw, ['externalId', 'lastName'], 'patient');
  return true;
}
function validateAppointment(raw) {
  requireFields(raw, ['externalId', 'patientExternalId', 'startAt'], 'rendez-vous');
  if (Number.isNaN(Date.parse(raw.startAt))) {
    throw new DoctolibError('DOCTOLIB_MAPPING_ERROR', 'rendez-vous: startAt invalide');
  }
  return true;
}
function validateDocument(raw) {
  requireFields(raw, ['externalId', 'patientExternalId', 'type'], 'document');
  return true;
}

module.exports = { validatePatient, validateAppointment, validateDocument };
