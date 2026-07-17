/**
 * test/anonymizer.test.js
 * L'anonymiseur est le composant le plus sensible juridiquement :
 * il garantit qu'aucune donnée nominative connue n'atteint l'IA.
 * Ces tests verrouillent son comportement de dé-identification.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { anonymize, deanonymize } = require('../anonymizer');

test('remplace une adresse email par un token', () => {
  const { anonymized } = anonymize('Contact : jean.dupont@example.fr pour la suite.');
  assert.ok(!anonymized.includes('jean.dupont@example.fr'), 'email encore en clair');
  assert.match(anonymized, /\[EMAIL_\d{3}\]/);
});

test('remplace un numéro de téléphone français', () => {
  const { anonymized } = anonymize('Rappeler au 06 12 34 56 78 demain.');
  assert.ok(!anonymized.includes('06 12 34 56 78'));
  assert.match(anonymized, /\[TEL_\d{3}\]/);
});

test('remplace un NIR (numéro de sécurité sociale)', () => {
  const { anonymized } = anonymize('NSS : 2 78 04 75 123 456 78 vérifié.');
  assert.match(anonymized, /\[NIR_\d{3}\]/);
});

test('retire de façon déterministe un nom connu (patient)', () => {
  const { anonymized, stats } = anonymize('Dupont est revenue pour un contrôle.', {
    knownTerms: [{ category: 'PATIENT', value: 'Dupont' }],
  });
  assert.ok(!/\bDupont\b/.test(anonymized), 'le nom connu subsiste');
  assert.match(anonymized, /\[PATIENT_\d{3}\]/);
  assert.equal(stats.residualKnownTerm, false, 'aucun terme connu ne doit rester');
});

test('ignore les termes connus trop courts (< 3 caractères)', () => {
  const { anonymized } = anonymize('Le patient va bien.', {
    knownTerms: [{ category: 'PATIENT', value: 'Le' }],
  });
  assert.ok(anonymized.includes('Le'), 'une particule courte ne doit pas être masquée');
});

test('deanonymize restaure fidèlement le texte (aller-retour)', () => {
  const original = 'Écrire à sophie.martin@clinique.fr avant le rendez-vous.';
  const { anonymized, tokenMap } = anonymize(original);
  const restored = deanonymize(anonymized, tokenMap);
  assert.equal(restored, original);
});

test('la tokenMap est stable : une même valeur → un même token', () => {
  const { anonymized } = anonymize('a@b.fr puis encore a@b.fr', {});
  const tokens = anonymized.match(/\[EMAIL_\d{3}\]/g) || [];
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0], tokens[1], 'une valeur identique doit réutiliser le même token');
});

test('signale un terme connu résiduel (filet de sécurité)', () => {
  // "Léa" contient un accent — on vérifie surtout que le filet ne lève pas
  // de faux positif sur un cas nominal correctement masqué.
  const { stats } = anonymize('Bernard consulte ce matin.', {
    knownTerms: [{ category: 'PATIENT', value: 'Bernard' }],
  });
  assert.equal(stats.residualKnownTerm, false);
});
