/**
 * test/snapshot.test.js
 * Patient Snapshot (Phase 5) — verrouille la partie DÉTERMINISTE de la
 * synthèse patient : traitements issus des vraies ordonnances (jamais du
 * modèle), dernière consultation, décompte, et logique de cache.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildSnapshotFacts, isSnapshotStale, emptySnapshot } = require('../server');

// Événements factices, triés du plus récent au plus ancien (comme la base).
const events = [
  { type: 'ordonnance', event_date: '2026-03-10T10:00:00Z', title: 'Ordonnance',
    data: { prescriptions: [
      { medicament: 'Amlodipine 5mg', posologie: '1/j', duree: '3 mois' },
      { medicament: 'Paracétamol 1g', posologie: 'si douleur', duree: '' },
      { posologie: 'ignoré car sans nom' },
    ] } },
  { type: 'consultation', event_date: '2026-03-10T09:30:00Z', title: 'Consultation',
    data: { resume_1_ligne: 'Contrôle tensionnel, TA stable' } },
  { type: 'ordonnance', event_date: '2025-11-02T09:00:00Z', title: 'Ancienne ordonnance',
    data: { prescriptions: [{ medicament: 'Vieux médicament', posologie: '2/j' }] } },
];

test('buildSnapshotFacts extrait les traitements de la DERNIÈRE ordonnance', () => {
  const facts = buildSnapshotFacts(events);
  const meds = facts.traitements_en_cours.map((t) => t.medicament);
  assert.deepEqual(meds, ['Amlodipine 5mg', 'Paracétamol 1g']);
  assert.ok(!meds.includes('Vieux médicament'), 'ne doit pas remonter une ancienne ordonnance');
});

test('buildSnapshotFacts ignore les prescriptions sans nom de médicament', () => {
  const facts = buildSnapshotFacts(events);
  assert.equal(facts.traitements_en_cours.length, 2);
});

test('buildSnapshotFacts remonte la dernière consultation et les compteurs', () => {
  const facts = buildSnapshotFacts(events);
  assert.equal(facts.derniere_consultation.resume, 'Contrôle tensionnel, TA stable');
  assert.equal(facts.nb_evenements, 3);
  assert.equal(facts.nb_consultations, 1);
});

test('buildSnapshotFacts gère un dossier vide sans planter', () => {
  const facts = buildSnapshotFacts([]);
  assert.deepEqual(facts.traitements_en_cours, []);
  assert.equal(facts.derniere_consultation, null);
  assert.equal(facts.nb_evenements, 0);
});

test('isSnapshotStale : périmé si absent ou si le nombre d\'événements a changé', () => {
  assert.equal(isSnapshotStale(null, 3), true);
  assert.equal(isSnapshotStale({ source_events_count: 2 }, 3), true);
  assert.equal(isSnapshotStale({ source_events_count: 3 }, 3), false);
});

test('emptySnapshot renvoie une structure complète avec les faits fusionnés', () => {
  const snap = emptySnapshot(buildSnapshotFacts([]));
  assert.deepEqual(snap.problemes_actifs, []);
  assert.deepEqual(snap.points_de_vigilance, []);
  assert.equal(snap.synthese_narrative, '');
  assert.equal(snap.nb_evenements, 0);
});
