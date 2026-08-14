'use strict';
// ── MockDoctolibConnector ────────────────────────────────────────────
// Simulation RÉALISTE, hors-ligne, du connecteur Doctolib. Aucune API réelle
// n'est appelée. Le dataset est DÉTERMINISTE (mêmes données à chaque run) pour
// que la déduplication soit testable : synchroniser deux fois ne doit créer
// aucun doublon.
//
// ⚠️  Ce n'est PAS une intégration réelle. Le format des `records` imite un
//     modèle plausible (proche des standards HL7/FHIR côté patient) mais ne
//     préjuge d'aucun champ officiel Doctolib.
//
// Dataset : 3 praticiens · 10 patients · 15 rendez-vous · 8 documents.

const { DoctolibConnector } = require('./connector');

// Date de référence figée → `externalUpdatedAt` stables (tests reproductibles).
const BASE = Date.parse('2026-08-01T08:00:00.000Z');
const iso = (dayOffset, hour = 9, min = 0) =>
  new Date(BASE + dayOffset * 86400000 + (hour - 8) * 3600000 + min * 60000).toISOString();

const PRACTITIONERS = [
  { externalId: 'prac_1', firstName: 'Camille', lastName: 'Rousseau', speciality: 'Médecine générale' },
  { externalId: 'prac_2', firstName: 'Julien', lastName: 'Bernard', speciality: 'Cardiologie' },
  { externalId: 'prac_3', firstName: 'Sophie', lastName: 'Lemoine', speciality: 'Dermatologie' },
];

const PATIENTS = [
  { externalId: 'dl_pat_001', firstName: 'Léa', lastName: 'Moreau', birthDate: '1988-03-14', sex: 'F', phone: '0600000001', externalUpdatedAt: iso(0) },
  { externalId: 'dl_pat_002', firstName: 'Thomas', lastName: 'Girard', birthDate: '1975-11-02', sex: 'M', phone: '0600000002', externalUpdatedAt: iso(0) },
  { externalId: 'dl_pat_003', firstName: 'Inès', lastName: 'Fontaine', birthDate: '1993-06-21', sex: 'F', phone: '0600000003', externalUpdatedAt: iso(0) },
  { externalId: 'dl_pat_004', firstName: 'Hugo', lastName: 'Lefevre', birthDate: '2001-01-09', sex: 'M', phone: '0600000004', externalUpdatedAt: iso(0) },
  { externalId: 'dl_pat_005', firstName: 'Camille', lastName: 'Dumont', birthDate: '1969-09-30', sex: 'F', phone: '0600000005', externalUpdatedAt: iso(1) },
  { externalId: 'dl_pat_006', firstName: 'Nathan', lastName: 'Roux', birthDate: '1982-12-12', sex: 'M', phone: '0600000006', externalUpdatedAt: iso(1) },
  { externalId: 'dl_pat_007', firstName: 'Chloé', lastName: 'Garnier', birthDate: '1996-04-18', sex: 'F', phone: '0600000007', externalUpdatedAt: iso(2) },
  { externalId: 'dl_pat_008', firstName: 'Lucas', lastName: 'Faure', birthDate: '1958-07-25', sex: 'M', phone: '0600000008', externalUpdatedAt: iso(2) },
  { externalId: 'dl_pat_009', firstName: 'Manon', lastName: 'Blanc', birthDate: '2010-02-03', sex: 'F', phone: '0600000009', externalUpdatedAt: iso(3) },
  { externalId: 'dl_pat_010', firstName: 'Adam', lastName: 'Perez', birthDate: '1990-08-08', sex: 'M', phone: '0600000010', externalUpdatedAt: iso(3) },
];

const APPOINTMENTS = [
  { externalId: 'dl_apt_001', patientExternalId: 'dl_pat_001', practitionerExternalId: 'prac_1', startAt: iso(0, 9, 0), endAt: iso(0, 9, 20), status: 'confirmed', type: 'Consultation', externalUpdatedAt: iso(0) },
  { externalId: 'dl_apt_002', patientExternalId: 'dl_pat_002', practitionerExternalId: 'prac_1', startAt: iso(0, 9, 30), endAt: iso(0, 9, 50), status: 'confirmed', type: 'Suivi', externalUpdatedAt: iso(0) },
  { externalId: 'dl_apt_003', patientExternalId: 'dl_pat_003', practitionerExternalId: 'prac_2', startAt: iso(0, 10, 0), endAt: iso(0, 10, 30), status: 'confirmed', type: 'Cardiologie', externalUpdatedAt: iso(0) },
  { externalId: 'dl_apt_004', patientExternalId: 'dl_pat_004', practitionerExternalId: 'prac_1', startAt: iso(0, 11, 0), endAt: iso(0, 11, 20), status: 'confirmed', type: 'Consultation', externalUpdatedAt: iso(0) },
  { externalId: 'dl_apt_005', patientExternalId: 'dl_pat_005', practitionerExternalId: 'prac_3', startAt: iso(0, 14, 0), endAt: iso(0, 14, 20), status: 'confirmed', type: 'Dermatologie', externalUpdatedAt: iso(1) },
  { externalId: 'dl_apt_006', patientExternalId: 'dl_pat_006', practitionerExternalId: 'prac_1', startAt: iso(1, 9, 0), endAt: iso(1, 9, 20), status: 'confirmed', type: 'Consultation', externalUpdatedAt: iso(1) },
  { externalId: 'dl_apt_007', patientExternalId: 'dl_pat_007', practitionerExternalId: 'prac_2', startAt: iso(1, 10, 0), endAt: iso(1, 10, 30), status: 'confirmed', type: 'Cardiologie', externalUpdatedAt: iso(1) },
  { externalId: 'dl_apt_008', patientExternalId: 'dl_pat_008', practitionerExternalId: 'prac_1', startAt: iso(1, 11, 30), endAt: iso(1, 11, 50), status: 'cancelled', type: 'Consultation', externalUpdatedAt: iso(1) },
  { externalId: 'dl_apt_009', patientExternalId: 'dl_pat_009', practitionerExternalId: 'prac_3', startAt: iso(2, 9, 0), endAt: iso(2, 9, 20), status: 'confirmed', type: 'Dermatologie', externalUpdatedAt: iso(2) },
  { externalId: 'dl_apt_010', patientExternalId: 'dl_pat_010', practitionerExternalId: 'prac_1', startAt: iso(2, 9, 30), endAt: iso(2, 9, 50), status: 'confirmed', type: 'Suivi', externalUpdatedAt: iso(2) },
  { externalId: 'dl_apt_011', patientExternalId: 'dl_pat_001', practitionerExternalId: 'prac_2', startAt: iso(2, 10, 30), endAt: iso(2, 11, 0), status: 'confirmed', type: 'Cardiologie', externalUpdatedAt: iso(2) },
  { externalId: 'dl_apt_012', patientExternalId: 'dl_pat_003', practitionerExternalId: 'prac_1', startAt: iso(3, 9, 0), endAt: iso(3, 9, 20), status: 'confirmed', type: 'Consultation', externalUpdatedAt: iso(3) },
  { externalId: 'dl_apt_013', patientExternalId: 'dl_pat_005', practitionerExternalId: 'prac_1', startAt: iso(3, 9, 30), endAt: iso(3, 9, 50), status: 'confirmed', type: 'Suivi', externalUpdatedAt: iso(3) },
  { externalId: 'dl_apt_014', patientExternalId: 'dl_pat_007', practitionerExternalId: 'prac_3', startAt: iso(3, 14, 0), endAt: iso(3, 14, 20), status: 'confirmed', type: 'Dermatologie', externalUpdatedAt: iso(3) },
  { externalId: 'dl_apt_015', patientExternalId: 'dl_pat_010', practitionerExternalId: 'prac_2', startAt: iso(4, 10, 0), endAt: iso(4, 10, 30), status: 'confirmed', type: 'Cardiologie', externalUpdatedAt: iso(4) },
];

const DOCUMENTS = [
  { externalId: 'dl_doc_001', patientExternalId: 'dl_pat_001', type: 'consultation', title: 'Compte-rendu de consultation', createdAt: iso(0), externalUpdatedAt: iso(0), externalUrl: null },
  { externalId: 'dl_doc_002', patientExternalId: 'dl_pat_002', type: 'ordonnance', title: 'Ordonnance', createdAt: iso(0), externalUpdatedAt: iso(0), externalUrl: null },
  { externalId: 'dl_doc_003', patientExternalId: 'dl_pat_003', type: 'analyse_labo', title: 'Résultats de laboratoire', createdAt: iso(0), externalUpdatedAt: iso(0), externalUrl: null },
  { externalId: 'dl_doc_004', patientExternalId: 'dl_pat_005', type: 'courrier', title: 'Courrier de correspondance', createdAt: iso(1), externalUpdatedAt: iso(1), externalUrl: null },
  { externalId: 'dl_doc_005', patientExternalId: 'dl_pat_006', type: 'imagerie', title: 'Compte-rendu d’imagerie', createdAt: iso(1), externalUpdatedAt: iso(1), externalUrl: null },
  { externalId: 'dl_doc_006', patientExternalId: 'dl_pat_008', type: 'consultation', title: 'Compte-rendu de consultation', createdAt: iso(2), externalUpdatedAt: iso(2), externalUrl: null },
  { externalId: 'dl_doc_007', patientExternalId: 'dl_pat_009', type: 'vaccination', title: 'Certificat de vaccination', createdAt: iso(3), externalUpdatedAt: iso(3), externalUrl: null },
  { externalId: 'dl_doc_008', patientExternalId: 'dl_pat_010', type: 'ordonnance', title: 'Ordonnance', createdAt: iso(3), externalUpdatedAt: iso(3), externalUrl: null },
];

function paginate(all, { since, cursor } = {}) {
  let rows = all.slice();
  if (since) {
    const s = Date.parse(since);
    rows = rows.filter((r) => Date.parse(r.externalUpdatedAt) > s); // incrémental : uniquement les changements
  }
  // Pas de vraie pagination dans le mock (petit dataset) : une seule page.
  return { records: rows, nextCursor: null };
}

class MockDoctolibConnector extends DoctolibConnector {
  constructor(opts = {}) {
    super();
    this._latency = opts.latencyMs || 40;
  }
  get kind() { return 'mock'; }

  async connect() {
    return { ok: true, accountLabel: 'Cabinet Doctolib (démonstration)' };
  }
  async disconnect() { return { ok: true }; }
  async ping() { return { ok: true, latencyMs: this._latency }; }

  async listPractitioners() { return { records: PRACTITIONERS.slice(), nextCursor: null }; }
  async listPatients(opts) { return paginate(PATIENTS, opts); }
  async listAppointments(opts) { return paginate(APPOINTMENTS, opts); }
  async listDocuments(opts) { return paginate(DOCUMENTS, opts); }

  // Aide aux tests / au webhook mock : fabrique un événement signable.
  static sampleWebhookEvent(type = 'AppointmentUpdated') {
    return {
      id: 'evt_' + type + '_001',
      type,
      timestamp: Math.floor(Date.now() / 1000),
      data: type.startsWith('Appointment') ? APPOINTMENTS[0]
        : type.startsWith('Patient') ? PATIENTS[0] : DOCUMENTS[0],
    };
  }

  static get dataset() { return { PRACTITIONERS, PATIENTS, APPOINTMENTS, DOCUMENTS }; }
}

module.exports = { MockDoctolibConnector };
