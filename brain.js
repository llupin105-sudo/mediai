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

// ── Brief de consultation (« 20 secondes ») — DÉTERMINISTE ───────────
// Réorganise le contexte en un brief prêt-à-lire AVANT d'ouvrir le dossier :
// motif · dernière consultation · antécédents · traitements · derniers examens
// · points à surveiller. Les « questions pertinentes » relèvent de l'IA
// (endpoint dédié) et sont explicitement laissées hors du brief factuel.
function pickUpcomingAppointment(appointments, now = Date.now()) {
  const list = (appointments || []).slice();
  const future = list.filter((a) => new Date(a.start_at).getTime() >= now - 3600000)
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  if (future[0]) return future[0];
  return list.sort((a, b) => new Date(b.start_at) - new Date(a.start_at))[0] || null;
}
function antecedentsFrom(events) {
  const consults = sortedDesc(events).filter((e) => e.type === 'consultation').slice(0, 2);
  const set = new Set();
  for (const c of consults) {
    const arr = c.data && c.data.sections && c.data.sections.subjectif && c.data.sections.subjectif.antecedents_pertinents;
    (Array.isArray(arr) ? arr : []).forEach((a) => { if (a && String(a).trim()) set.add(String(a).trim()); });
  }
  return [...set].slice(0, 6);
}
function buildConsultationBrief({ patient, events, appointments, now = Date.now() }) {
  const ctx = buildPatientContext({ patient, events, now });
  const appt = pickUpcomingAppointment(appointments, now);
  const list = sortedDesc(events);
  const derniersExamens = list.filter((e) => e.type === 'analyse_labo' || e.type === 'imagerie').slice(0, 3)
    .map((e) => ({ id: e.id, type: e.type, label: cockpit.TYPE_LABELS[e.type] || e.type, title: e.title, date: e.event_date }));
  return {
    deterministic: true,
    identity: ctx.identity,
    motif: appt ? (appt.motif || null) : null,
    appointment: appt ? { id: appt.id, start_at: appt.start_at, status: appt.status } : null,
    derniereConsultation: ctx.lastConsultation,
    changesSinceLastConsult: ctx.changesSinceLastConsult,
    antecedents: antecedentsFrom(events),
    traitements: ctx.activeTreatments.items,
    derniersExamens,
    pointsASurveiller: ctx.attention.items,
    // Les questions d'interrogatoire pertinentes sont produites par l'IA
    // (endpoint /preparation) et présentées séparément : jamais mélangées
    // aux faits observés du brief.
    aiPreparationAvailable: true,
  };
}

// ── Action Intelligence — propositions post-consultation (DÉTERMINISTE) ──
// À partir d'un compte-rendu, MediAI PROPOSE des actions (ordonnance, courrier,
// tâches de suivi). Chaque proposition porte sa TRAÇABILITÉ (« source ») et
// reste au statut « proposée » : l'IA propose, le professionnel valide.
// JAMAIS d'exécution automatique — c'est le principe Trust du produit.
function proposeActions(consultation) {
  if (!consultation) return [];
  const data = consultation.data || {};
  const plan = (data.sections && data.sections.plan) || {};
  const src = { type: 'consultation', id: consultation.id || null, date: consultation.event_date || null, section: 'plan' };
  const out = [];

  const prescriptions = (plan.prescriptions || []).filter((r) => r && r.medicament);
  if (prescriptions.length) {
    out.push({ kind: 'ordonnance', label: 'Préparer l’ordonnance', detail: prescriptions.map((r) => r.medicament).join(', '),
      count: prescriptions.length, executable: 'modal', status: 'proposed', source: src });
  }
  const orientations = (plan.orientations || []).filter(Boolean);
  orientations.forEach((o) => {
    out.push({ kind: 'courrier', label: 'Rédiger le courrier d’orientation', detail: String(o),
      executable: 'modal', status: 'proposed', source: src });
  });
  // Tâche de suivi : le plan dit « revoir dans X » → proposition datée, persistable.
  const suiviDays = cockpit.parseDelayToDays(plan.suivi);
  if (plan.suivi && plan.suivi !== '—') {
    out.push({ kind: 'followup', label: 'Programmer le suivi', detail: String(plan.suivi),
      dueInDays: suiviDays || null, executable: 'task', status: 'proposed', source: src });
  }
  const arret = plan.arret_travail || {};
  if (arret.prescrit) {
    out.push({ kind: 'arret', label: 'Établir l’arrêt de travail', detail: `${arret.duree_jours || '?'} jour(s)${arret.motif ? ' · ' + arret.motif : ''}`,
      dueInDays: 0, executable: 'task', status: 'proposed', source: src });
  }
  (plan.examens_demandes || []).filter(Boolean).forEach((ex) => {
    out.push({ kind: 'examen', label: 'Suivre l’examen demandé', detail: String(ex),
      dueInDays: null, executable: 'task', status: 'proposed', source: src });
  });
  return out;
}

module.exports = { buildPatientContext, changesSinceLastConsult, attention, activeTreatments, ageFromBirth, buildConsultationBrief, pickUpcomingAppointment, proposeActions };
