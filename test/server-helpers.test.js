/**
 * test/server-helpers.test.js
 * Vérifie la logique pure de server.js (quota, anonymisation connue, CORS,
 * exposition publique du compte). server.js est requis SANS démarrer le
 * serveur (garde require.main === module) ni ouvrir de connexion à la base.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  effectiveFreeUsage,
  currentMonth,
  buildKnownTerms,
  publicUser,
  isOriginAllowed,
} = require('../server');

test('currentMonth renvoie le mois courant au format YYYY-MM', () => {
  assert.match(currentMonth(), /^\d{4}-\d{2}$/);
  assert.equal(currentMonth(), new Date().toISOString().slice(0, 7));
});

test('effectiveFreeUsage : compteur pris en compte pour le mois courant', () => {
  const user = { freeUsageMonth: currentMonth(), freeUsageCount: 2 };
  assert.equal(effectiveFreeUsage(user), 2);
});

test('effectiveFreeUsage : remise à zéro paresseuse si le mois a changé', () => {
  const user = { freeUsageMonth: '2000-01', freeUsageCount: 9 };
  assert.equal(effectiveFreeUsage(user), 0);
});

test('buildKnownTerms éclate nom et prénom, ignore les parties < 3 caractères', () => {
  const terms = buildKnownTerms(
    { prenom: 'Jean Li', nom: 'Dupont' },
    { profile: { nom: 'Rousseau' } },
  );
  const values = terms.map((t) => t.value);
  assert.ok(values.includes('Jean'));
  assert.ok(values.includes('Dupont'));
  assert.ok(values.includes('Rousseau'));
  assert.ok(!values.includes('Li'), 'les parties trop courtes sont exclues');
  assert.ok(terms.some((t) => t.category === 'MEDECIN' && t.value === 'Rousseau'));
});

test('publicUser n\'expose jamais le hash du mot de passe', () => {
  const pub = publicUser({
    email: 'doc@example.fr',
    passwordHash: 'SECRET_HASH',
    isPro: true,
    freeUsageMonth: currentMonth(),
    freeUsageCount: 1,
    profile: { nom: 'Doc' },
    preferences: { defaultSpecialite: 'generaliste' },
  });
  assert.equal(pub.email, 'doc@example.fr');
  assert.equal(pub.isPro, true);
  assert.ok(!('passwordHash' in pub), 'le hash ne doit jamais sortir');
});

test('isOriginAllowed : accepte les domaines MediAI, Vercel et le localhost, refuse le reste', () => {
  assert.equal(isOriginAllowed('https://app.mediai.fr'), true);
  assert.equal(isOriginAllowed('https://mediai.fr'), true);
  assert.equal(isOriginAllowed('https://mediai-site.vercel.app'), true);
  assert.equal(isOriginAllowed('https://mediai-preview-abc.vercel.app'), true);
  assert.equal(isOriginAllowed('http://localhost:3000'), true);
  assert.equal(isOriginAllowed('https://evil.example.com'), false);
  assert.equal(isOriginAllowed(undefined), false);
  assert.equal(isOriginAllowed('pas-une-url'), false);
});
