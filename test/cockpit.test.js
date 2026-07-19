/**
 * Tests du moteur métier du cockpit (cockpit.js).
 * 100% déterministe, sans I/O — on vérifie les faits calculés.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const c = require('../cockpit');

const DAY = 86400000;
const NOW = new Date('2026-07-19T09:00:00.000Z').getTime();
const iso = (offsetDays) => new Date(NOW + offsetDays * DAY).toISOString();

// ── computePrescriptionStatus ──────────────────────────────────────

test('computePrescriptionStatus : champs structurés (duree_jours + renouvellements)', () => {
  const ord = { event_date: iso(-20), data: { prescriptions: [{ medicament: 'X', duree_jours: 30, renouvellements: 0 }] } };
  const s = c.computePrescriptionStatus(ord, NOW);
  assert.equal(s.active, true);
  assert.equal(s.jours_restants, 10); // -20j + 30j = +10j
  assert.equal(s.a_renouveler, true); // ≤ 14 jours
});

test('computePrescriptionStatus : repli sur le texte libre `duree`', () => {
  const ord = { event_date: iso(-40), data: { prescriptions: [{ medicament: 'X', duree: '1 mois' }] } };
  const s = c.computePrescriptionStatus(ord, NOW);
  assert.equal(s.active, false); // -40j + 30j = -10j (expirée)
  assert.equal(s.a_renouveler, true);
});

test('computePrescriptionStatus : aucune durée exploitable → nulls', () => {
  const ord = { event_date: iso(-5), data: { prescriptions: [{ medicament: 'X', duree: 'à adapter' }] } };
  const s = c.computePrescriptionStatus(ord, NOW);
  assert.equal(s.active, null);
  assert.equal(s.a_renouveler, false);
});

// ── computePatientSignals ──────────────────────────────────────────

test('computePatientSignals : tension élevée = signal important', () => {
  const events = [{ type: 'consultation', event_date: iso(-1), data: { sections: { objectif: { constantes: { tension: '165/102' } } } } }];
  const sigs = c.computePatientSignals(events, NOW);
  assert.ok(sigs.some((s) => s.severite === 'important' && s.cle === 'tension'));
});

test('computePatientSignals : suivi recommandé dépassé', () => {
  const events = [{ type: 'consultation', event_date: iso(-40), data: { sections: { plan: { suivi: 'revoir dans 1 mois' } } } }];
  const sigs = c.computePatientSignals(events, NOW);
  assert.ok(sigs.some((s) => s.cle === 'suivi_depasse'));
});

// ── computeCrossPatientSignals ─────────────────────────────────────

test('computeCrossPatientSignals : trie les patients important en premier', () => {
  const patients = [
    { id: 'p1', nom: 'A', prenom: 'a', events: [{ type: 'consultation', event_date: iso(-40), data: { sections: { plan: { suivi: 'revoir dans 1 mois' } } } }] },
    { id: 'p2', nom: 'B', prenom: 'b', events: [{ type: 'consultation', event_date: iso(-1), data: { sections: { objectif: { constantes: { tension: '170/100' } } } } }] },
  ];
  const flagged = c.computeCrossPatientSignals(patients, NOW);
  assert.equal(flagged.length, 2);
  assert.equal(flagged[0].patient_id, 'p2'); // important avant attention
  assert.equal(flagged[0].severite, 'important');
});

// ── buildAgenda ────────────────────────────────────────────────────

test('buildAgenda : ne garde que le jour, exclut les annulés, marque à préparer', () => {
  const appts = [
    { id: 'a1', patient_id: 'p1', start_at: new Date(NOW + 2 * 3600000).toISOString(), status: 'planifie' },
    { id: 'a2', patient_id: null, patient_label: 'Nouveau', start_at: new Date(NOW + 3 * 3600000).toISOString(), status: 'annule' },
    { id: 'a3', patient_id: null, patient_label: 'X', start_at: iso(3), status: 'planifie' }, // autre jour
  ];
  const agenda = c.buildAgenda(appts, NOW);
  assert.equal(agenda.length, 1);
  assert.equal(agenda[0].id, 'a1');
  assert.equal(agenda[0].a_preparer, true);
});

// ── materializeSystemTasks (dédup) ─────────────────────────────────

test('materializeSystemTasks : déduplique par source_ref existant', () => {
  const flagged = [{ patient_id: 'p1', nom: 'A', prenom: 'a', signals: [{ cle: 'tension', titre: 'Tension élevée', detail: 'x', severite: 'important' }] }];
  const existing = [{ source_ref: 'p1:tension' }];
  assert.equal(c.materializeSystemTasks(flagged, existing).length, 0);
  assert.equal(c.materializeSystemTasks(flagged, []).length, 1);
  assert.equal(c.materializeSystemTasks(flagged, [])[0].priority, 'haute');
});

// ── buildCockpitFacts (agrégat + compteurs) ────────────────────────

test('buildCockpitFacts : agrège compteurs et sections', () => {
  const patients = [{ id: 'p1', nom: 'A', prenom: 'a', events: [{ id: 'e1', type: 'consultation', event_date: iso(-1), data: { sections: { objectif: { constantes: { tension: '170/100' } } } } }] }];
  const appts = [{ id: 'a1', patient_id: 'p1', start_at: new Date(NOW + 3600000).toISOString(), status: 'planifie' }];
  const tasks = [{ id: 't1', status: 'a_faire', priority: 'haute' }, { id: 't2', status: 'fait', priority: 'moyenne' }];
  const facts = c.buildCockpitFacts({ patients, appointments: appts, tasks, unreadMessages: 2, now: NOW });
  assert.equal(facts.compteurs.rdv_aujourdhui, 1);
  assert.equal(facts.compteurs.urgents, 1);
  assert.equal(facts.taches.compteurs.total, 1); // seules les tâches ouvertes
  assert.equal(facts.messages_non_lus, 2);
  assert.equal(facts.meta.deterministe, true);
});
