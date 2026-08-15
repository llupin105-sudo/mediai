'use strict';
// ══════════════════════════════════════════════════════════════════════
// MediAI Brain — moteur de contexte patient (100 % DÉTERMINISTE).
//
// Objectif : au lieu de disperser « des outils », assembler UNE vue de
// contexte pertinente du dossier — identité, dernière consultation, ce qui
// a changé depuis, traitements actifs, documents récents, et les points qui
// méritent l'attention du médecin.
//
// Règle d'or : ce module N'INVENTE RIEN. Il ne fait qu'observer, compter,
// dater et classer des faits présents dans le dossier. Toute interprétation
// (IA) reste séparée et explicitement étiquetée côté produit. L'IA attire
// l'attention ; le professionnel décide (jamais de décision automatique).
//
// Réutilise cockpit.js (signaux, labels, helpers) — pas de duplication.
// ══════════════════════════════════════════════════════════════════════

const cockpit = require('./cockpit');

const DOC_TYPES = new Set(['analyse_labo', 'imagerie', 'ordonnance', 'courrier', 'document', 'vaccination']);

function sortedDesc(events) {
  return (events || []).slice().sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
}
function ageFromBirth(dateNaissance) {
  if (!dateNaissance) return null;
  const d = new Date(dateNaissance); if (isNaN(d)) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}
function oneLine(e) {
  return (e.data && (e.data.resume_1_ligne || (e.data.sections && e.data.sections.subjectif && e.data.sections.subjectif.motif))) || e.title || (cockpit.TYPE_LABELS[e.type] || e.type);
}

// Traitements actifs = prescriptions de la DERNIÈRE ordonnance (mêmes règles
// que le snapshot : on ne garde que les lignes nommées).
function activeTreatments(list) {
  const lastOrd = list.find((e) => e.type === 'ordonnance');
  if (!lastOrd || !Array.isArray(lastOrd.data && lastOrd.data.prescriptions)) return { source_date: lastOrd ? lastOrd.event_date : null, items: [] };
  const items = lastOrd.data.prescriptions.filter((p) => p && p.medicament)
    .map((p) => ({ medicament: p.medicament, posologie: p.posologie || '', duree: p.duree || '' }));
  return { source_date: lastOrd.event_date, items };
}

// ── « Qu'est-ce qui a changé depuis la dernière consultation ? » ──────
// Référence = l'avant-dernière consultation (ce que le médecin a vu la
// dernière fois qu'il a reçu ce patient). On liste les événements SURVENUS
// depuis, groupés par type. 100 % factuel.
function changesSinceLastConsult(rawList, now = Date.now()) {
  const list = sortedDesc(rawList); // robuste : ne dépend pas de l'ordre d'entrée
  const consults = list.filter((e) => e.type === 'consultation');
  // Point de référence : la consultation précédente (index 1). À défaut
  // (0 ou 1 consultation), on prend la création implicite = tout l'historique.
  const ref = consults[1] || null;
  const refTime = ref ? new Date(ref.event_date).getTime() : 0;
  const sinceEvents = list.filter((e) => new Date(e.event_date).getTime() > refTime && e.type !== 'consultation');
  const groups = {};
  for (const e of sinceEvents) {
    const label = cockpit.TYPE_LABELS[e.type] || e.type;
    (groups[label] = groups[label] || []).push({ id: e.id, type: e.type, title: e.title || label, date: e.event_date });
  }
  const summary = Object.entries(groups).map(([label, items]) => ({ label, count: items.length, items }));
  return {
    reference: ref ? { date: ref.event_date, resume: oneLine(ref) } : null,
    hasReference: !!ref,
    total: sinceEvents.length,
    groups: summary,
  };
}

// ── Couche PROACTIVE : « N éléments à regarder » ─────────────────────
// Dérive des signaux déterministes existants (computePatientSignals).
function attention(list, now = Date.now()) {
  const signals = cockpit.computePatientSignals(list, now);
  return {
    count: signals.length,
    items: signals.map((s) => ({ severite: s.severite, titre: s.titre, detail: s.detail, cle: s.cle })),
  };
}

// ── Assemblage du contexte complet ───────────────────────────────────
function buildPatientContext({ patient, events, now = Date.now() }) {
  const list = sortedDesc(events);
  const consults = list.filter((e) => e.type === 'consultation');
  const lastConsult = consults[0] || null;
  const recentDocuments = list.filter((e) => DOC_TYPES.has(e.type)).slice(0, 5)
    .map((e) => ({ id: e.id, type: e.type, label: cockpit.TYPE_LABELS[e.type] || e.type, title: e.title, date: e.event_date }));
  const treat = activeTreatments(list);
  const changes = changesSinceLastConsult(list, now);
  const attn = attention(list, now);

  return {
    generatedAt: new Date(now).toISOString(),
    deterministic: true, // aucune IA : ces faits sont observés, pas interprétés
    identity: patient ? {
      id: patient.id,
      prenom: patient.prenom, nom: patient.nom,
      age: ageFromBirth(patient.date_naissance),
      sexe: patient.sexe || null,
    } : null,
    counts: {
      evenements: list.length,
      consultations: consults.length,
      documents: list.filter((e) => DOC_TYPES.has(e.type)).length,
    },
    lastConsultation: lastConsult ? { id: lastConsult.id, date: lastConsult.event_date, resume: oneLine(lastConsult) } : null,
    activeTreatments: treat,
    recentDocuments,
    changesSinceLastConsult: changes,
    attention: attn,
  };
}

module.exports = { buildPatientContext, changesSinceLastConsult, attention, activeTreatments, ageFromBirth };
