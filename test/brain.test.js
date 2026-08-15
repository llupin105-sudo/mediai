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
