'use strict';
// Tests du moteur de contexte MediAI Brain — 100 % déterministe, hors-ligne.
// Vérifie : assemblage du contexte, « qu'est-ce qui a changé depuis la
// dernière consultation », couche d'attention, traitements actifs, âge.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const brain = require('../brain');

const DAY = 86400000;
function ev(type, daysAgo, extra = {}) {
  return { id: type + '_' + daysAgo, type, title: extra.title || type, event_date: new Date(Date.now() - daysAgo * DAY).toISOString(), data: extra.data || {} };
}

test('buildPatientContext : identité, compteurs, dernière consultation', () => {
  const patient = { id: 'p1', prenom: 'Léa', nom: 'Moreau', date_naissance: '1990-01-01', sexe: 'F' };
  const events = [ev('consultation', 2, { title: 'Angine', data: { resume_1_ligne: 'Angine aiguë' } }), ev('ordonnance', 2)];
  const ctx = brain.buildPatientContext({ patient, events });
  assert.equal(ctx.deterministic, true);
  assert.equal(ctx.identity.prenom, 'Léa');
  assert.ok(ctx.identity.age >= 30);
  assert.equal(ctx.counts.consultations, 1);
  assert.equal(ctx.lastConsultation.resume, 'Angine aiguë');
});

test('activeTreatments : extrait les prescriptions nommées de la dernière ordonnance', () => {
  const events = [ev('ordonnance', 1, { data: { prescriptions: [{ medicament: 'Amoxicilline', posologie: '1g x2', duree: '7 jours' }, { posologie: 'sans nom' }] } })];
  const t = brain.activeTreatments(events);
  assert.equal(t.items.length, 1);
  assert.equal(t.items[0].medicament, 'Amoxicilline');
});

test('changesSinceLastConsult : liste les événements depuis la consultation précédente', () => {
  // consultation il y a 30j (référence), puis analyse à 10j, ordonnance à 5j, consultation actuelle à 1j.
  const events = [
    ev('consultation', 30, { title: 'Consult initiale' }),
    ev('analyse_labo', 10, { title: 'NFS' }),
    ev('ordonnance', 5, { title: 'Ordonnance' }),
    ev('consultation', 1, { title: 'Consult actuelle' }),
  ];
  const ch = brain.changesSinceLastConsult(events);
  assert.equal(ch.hasReference, true);
  assert.equal(ch.total, 2); // analyse + ordonnance (les consultations sont exclues)
  const labels = ch.groups.map((g) => g.label).sort();
  assert.deepEqual(labels, ['Analyses', 'Ordonnance']);
});

test('changesSinceLastConsult : dossier avec une seule consultation → pas de référence', () => {
  const events = [ev('consultation', 2), ev('ordonnance', 2)];
  const ch = brain.changesSinceLastConsult(events);
  assert.equal(ch.hasReference, false);
});

test('attention : dérive des signaux déterministes (résultat non revu)', () => {
  // Dernier événement = imagerie il y a 5j, pas de consultation depuis → signal.
  const events = [ev('consultation', 40), ev('imagerie', 5, { title: 'IRM' })];
  const a = brain.attention(events);
  assert.ok(a.count >= 1);
  assert.ok(a.items.some((i) => i.cle === 'resultat_non_revu'));
});

test('buildPatientContext : dossier vide ne plante pas', () => {
  const ctx = brain.buildPatientContext({ patient: { id: 'p', prenom: 'X', nom: 'Y' }, events: [] });
  assert.equal(ctx.counts.evenements, 0);
  assert.equal(ctx.lastConsultation, null);
  assert.equal(ctx.attention.count, 0);
  assert.equal(ctx.changesSinceLastConsult.total, 0);
});

test('ageFromBirth : calcul robuste', () => {
  assert.equal(brain.ageFromBirth(null), null);
  const y = new Date().getFullYear() - 40;
  assert.equal(brain.ageFromBirth(y + '-01-01'), 40);
});

test('buildConsultationBrief : assemble motif, traitements, examens, points', () => {
  const D = 86400000, iso = (d) => new Date(Date.now() - d * D).toISOString();
  const patient = { id: 'p', prenom: 'Léa', nom: 'Moreau', date_naissance: '1980-01-01', sexe: 'F' };
  const events = [
    { id: 'c1', type: 'consultation', title: 'Suivi HTA', event_date: iso(40), data: { sections: { subjectif: { antecedents_pertinents: ['HTA', 'Diabète type 2'] } } } },
    { id: 'a1', type: 'analyse_labo', title: 'HbA1c', event_date: iso(10), data: {} },
    { id: 'o1', type: 'ordonnance', title: 'Ordo', event_date: iso(10), data: { prescriptions: [{ medicament: 'Metformine', posologie: '1000mg' }] } },
    { id: 'c2', type: 'consultation', title: 'Contrôle', event_date: iso(1), data: {} },
  ];
  const appointments = [{ id: 'apt1', start_at: iso(-1), motif: 'Contrôle diabète', status: 'confirmed' }];
  const b = brain.buildConsultationBrief({ patient, events, appointments });
  assert.equal(b.deterministic, true);
  assert.equal(b.motif, 'Contrôle diabète');
  assert.deepEqual(b.antecedents.sort(), ['Diabète type 2', 'HTA']);
  assert.equal(b.traitements[0].medicament, 'Metformine');
  assert.equal(b.derniersExamens.length, 1);
});

test('pickUpcomingAppointment : préfère le RDV à venir', () => {
  const D = 86400000, iso = (d) => new Date(Date.now() - d * D).toISOString();
  const appts = [{ id: 'past', start_at: iso(5) }, { id: 'future', start_at: iso(-2) }];
  assert.equal(brain.pickUpcomingAppointment(appts).id, 'future');
});

test('proposeActions : propose ordonnance, courrier, suivi avec traçabilité', () => {
  const cr = { id: 'ev1', event_date: '2026-08-15T09:00:00Z', data: { sections: { plan: {
    prescriptions: [{ medicament: 'Amoxicilline' }],
    orientations: ['Cardiologue'],
    suivi: 'revoir dans 3 mois',
    arret_travail: { prescrit: true, duree_jours: 3 },
    examens_demandes: ['ECG'],
  } } } };
  const a = brain.proposeActions(cr);
  const kinds = a.map((x) => x.kind);
  assert.ok(kinds.includes('ordonnance') && kinds.includes('courrier') && kinds.includes('followup') && kinds.includes('arret') && kinds.includes('examen'));
  // traçabilité : chaque proposition pointe vers sa consultation source
  assert.ok(a.every((x) => x.source && x.source.type === 'consultation' && x.source.id === 'ev1'));
  // statut « proposée » : jamais exécutée d'office
  assert.ok(a.every((x) => x.status === 'proposed'));
  const followup = a.find((x) => x.kind === 'followup');
  assert.equal(followup.dueInDays, 90); // « 3 mois »
});

test('proposeActions : CR sans plan → aucune proposition', () => {
  assert.deepEqual(brain.proposeActions({ id: 'e', data: {} }), []);
});
