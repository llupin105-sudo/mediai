'use strict';
// ── Point d'entrée de l'intégration Doctolib ─────────────────────────
// Résout le connecteur à utiliser. Aujourd'hui : MOCK uniquement.
// Le connecteur RÉEL (« official ») n'est pas fourni ici : il nécessite
// l'accès et les paramètres délivrés dans le cadre d'une intégration
// officielle avec Doctolib. Tant qu'il n'est pas branché, on reste en mock
// et l'on n'invente jamais d'appel réseau réel.

const config = require('./config');
const { MockDoctolibConnector } = require('./mock-connector');
const { DoctolibError } = require('./errors');

// mode : 'mock' (défaut) | 'real'
function getConnector(opts = {}) {
  const mode = opts.mode || (config.isRealConfigured() ? 'real' : 'mock');
  if (mode === 'real') {
    // Emplacement du futur connecteur officiel : require('./official-connector').
    throw new DoctolibError('DOCTOLIB_NOT_CONFIGURED',
      'Le connecteur Doctolib officiel n’est pas disponible dans cet environnement. Utilisez le mode mock.');
  }
  return new MockDoctolibConnector(opts);
}

module.exports = {
  getConnector,
  config,
  errors: require('./errors'),
  security: require('./security'),
  mapper: require('./mapper'),
  sync: require('./sync'),
  webhook: require('./webhook'),
  audit: require('./audit'),
  store: require('./store'),
  // Chargé en lazy : routes.js dépend de ./index (getConnector) — le lazy
  // évite la dépendance circulaire au chargement du module.
  createRoutes(deps) { return require('./routes')(deps); },
};
