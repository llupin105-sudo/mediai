'use strict';
// ── Contrat DoctolibConnector ────────────────────────────────────────
// Abstraction stable : le reste de MediAI ne dépend JAMAIS d'une
// implémentation concrète. On branche soit le MockDoctolibConnector
// (développement), soit — le jour où l'intégration officielle est
// disponible — un connecteur réel qui respecte exactement ce contrat.
//
// Toutes les méthodes de lecture renvoient une page :
//   { records: [...], nextCursor: string|null }
// et acceptent { since: ISOstring|null, cursor: string|null } pour la
// synchronisation incrémentale.
//
// Les `records` sont au format « brut Doctolib » (voir mapper.js pour la
// transformation vers le modèle MediAI). Le contrat ne présume AUCUN champ
// non confirmé par une documentation officielle.

const { DoctolibError } = require('./errors');

class DoctolibConnector {
  /** @returns {string} identifiant d'implémentation ('mock' | 'official') */
  get kind() { return 'abstract'; }

  /** Établit la connexion. Renvoie { ok, accountLabel }. */
  async connect(/* credentials */) { throw new DoctolibError('DOCTOLIB_NOT_CONFIGURED', 'connect() non implémenté'); }

  /** Révoque la connexion côté fournisseur si applicable. */
  async disconnect() { return { ok: true }; }

  /** Diagnostic léger : { ok, latencyMs }. */
  async ping() { throw new DoctolibError('DOCTOLIB_NOT_CONFIGURED', 'ping() non implémenté'); }

  /** Page de patients. */
  async listPatients(/* { since, cursor } */) { throw new DoctolibError('DOCTOLIB_NOT_CONFIGURED', 'listPatients() non implémenté'); }

  /** Page de rendez-vous. */
  async listAppointments(/* { since, cursor } */) { throw new DoctolibError('DOCTOLIB_NOT_CONFIGURED', 'listAppointments() non implémenté'); }

  /** Page de documents (métadonnées ; le téléchargement dépend des droits réels). */
  async listDocuments(/* { since, cursor } */) { throw new DoctolibError('DOCTOLIB_NOT_CONFIGURED', 'listDocuments() non implémenté'); }

  /** Praticiens connus (utile pour rattacher les RDV). */
  async listPractitioners() { return { records: [], nextCursor: null }; }
}

module.exports = { DoctolibConnector };
