/**
 * cockpit.js
 * Moteur métier du Cockpit MediAI (Sprint 6) — fonctions PURES et
 * DÉTERMINISTES, isolées de server.js pour être testables (node:test) et
 * réutilisables. Aucune I/O, aucun appel IA ici : on ne calcule que des
 * faits à partir des vraies données (jamais de valeur inventée).
 *
 * La couche IA (récit de briefing) vit dans prompts.js + server.js ; elle
 * ne reçoit que les faits AGRÉGÉS et ANONYMISÉS produits ici.
 *
 * NB : la logique des signaux et de l'expiration reproduit fidèlement celle
 * du frontend (computePatientSignals / parseDelayToDays) pour que médecin et
 * cockpit voient exactement la même chose.
 */

// ── Helpers de durée / temps ────────────────────────────────────────

// « 3 mois », « 10 jours », « 2 semaines », « 1 an » → nombre de jours.
function parseDelayToDays(t) {
  if (!t) return null;
  const m = String(t).toLowerCase().match(/(\d+)\s*(jour|semaine|mois|an)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return ({ jour: n, semaine: n * 7, mois: n * 30, an: n * 365 })[m[2]] || null;
}

function humanizeElapsed(iso) {
  if (!iso) return '';
  const then = new Date(iso), now = new Date();
  const days = Math.floor((now - then) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  if (days < 31) { const w = Math.round(days / 7); return `il y a ${w} semaine${w > 1 ? 's' : ''}`; }
  if (days < 365) { const m = Math.round(days / 30); return `il y a ${m} mois`; }
  const y = Math.round(days / 365); return `il y a ${y} an${y > 1 ? 's' : ''}`;
}

// Dernière tension relevée dans les consultations (fait chiffré, jamais interprété).
function latestTension(consults) {
  for (const c of consults) {
    const raw = c.data && c.data.sections && c.data.sections.objectif && c.data.sections.objectif.constantes && c.data.sections.objectif.constantes.tension;
    const m = raw && String(raw).match(/(\d+)\s*\/\s*(\d+)/);
    if (m) return { sys: +m[1], dia: +m[2], raw: String(raw) };
  }
  return null;
}

const TYPE_LABELS = {
  consultation: 'Consultation', ordonnance: 'Ordonnance', courrier: 'Courrier',
  analyse_labo: 'Analyses', imagerie: 'Imagerie',
};

// ── Moteur d'expiration d'ordonnance ────────────────────────────────
// Utilise en priorité les champs structurés (duree_jours, renouvellements,
// date_debut) saisis à la création ; repli sur le texte libre `duree` pour
// l'historique. Renvoie l'échéance la plus lointaine de l'ordonnance.
function computePrescriptionStatus(ordonnanceEvent, now = Date.now()) {
  const prescriptions = (ordonnanceEvent && ordonnanceEvent.data && ordonnanceEvent.data.prescriptions) || [];
  let maxExpiry = null;
  let anyDuration = false;
  for (const p of prescriptions) {
    const jours = Number.isFinite(p.duree_jours) ? p.duree_jours : parseDelayToDays(p.duree);
    if (!jours) continue;
    anyDuration = true;
    const renouv = Number.isFinite(p.renouvellements) ? p.renouvellements : 0;
    const debut = p.date_debut ? new Date(p.date_debut).getTime() : new Date(ordonnanceEvent.event_date).getTime();
    const expiry = debut + jours * (1 + renouv) * 86400000;
    if (maxExpiry === null || expiry > maxExpiry) maxExpiry = expiry;
  }
  if (!anyDuration || maxExpiry === null) {
    return { active: null, expire_le: null, jours_restants: null, a_renouveler: false };
  }
  const joursRestants = Math.round((maxExpiry - now) / 86400000);
  return {
    active: maxExpiry > now,
    expire_le: new Date(maxExpiry).toISOString(),
    jours_restants: joursRestants,
    // À renouveler : échéance passée, ou dans les 14 prochains jours.
    a_renouveler: joursRestants <= 14,
  };
}

// ── Signaux cliniques par patient (déterministe, factuel) ───────────
// Reproduit computePatientSignals du frontend. `events` = lignes DB d'un
// même patient (champs type, data, event_date).
function computePatientSignals(events, now = Date.now()) {
  const list = (events || []).slice().sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
  const consults = list.filter((e) => e.type === 'consultation');
  const lastConsult = consults[0];
  const lastEvent = list[0];
  const out = [];

  // Suivi recommandé dépassé (le plan disait « revoir dans X », c'est passé).
  if (lastConsult) {
    const days = parseDelayToDays(lastConsult.data && lastConsult.data.sections && lastConsult.data.sections.plan && lastConsult.data.sections.plan.suivi);
    if (days) {
      const due = new Date(lastConsult.event_date).getTime() + days * 86400000;
      if (now > due + 3 * 86400000) out.push({ severite: 'attention', titre: 'Suivi recommandé dépassé', detail: `Prévu vers le ${new Date(due).toLocaleDateString('fr-FR')}`, cle: 'suivi_depasse' });
    }
  }
  // Traitement possiblement à renouveler (durée de la dernière ordonnance écoulée).
  const lastOrd = list.find((e) => e.type === 'ordonnance');
  if (lastOrd) {
    const durs = (lastOrd.data && lastOrd.data.prescriptions || []).map((p) => parseDelayToDays(p.duree)).filter(Boolean);
    if (durs.length) {
      const exp = new Date(lastOrd.event_date).getTime() + Math.max(...durs) * 86400000;
      if (now > exp) out.push({ severite: 'info', titre: 'Traitement possiblement à renouveler', detail: 'Dernière ordonnance arrivée à échéance', cle: 'renouvellement' });
    }
  }
  // Résultat récent non revu (dernier événement = analyse/imagerie, pas de consult depuis).
  if (lastEvent && (lastEvent.type === 'analyse_labo' || lastEvent.type === 'imagerie')) {
    const age = (now - new Date(lastEvent.event_date).getTime()) / 86400000;
    if (age >= 2) {
      const label = TYPE_LABELS[lastEvent.type] || 'Résultat';
      out.push({ severite: 'attention', titre: 'Résultat en attente de revue', detail: `${label} du ${new Date(lastEvent.event_date).toLocaleDateString('fr-FR')}, aucune consultation depuis`, cle: 'resultat_non_revu' });
    }
  }
  // Tension élevée au dernier relevé (fait chiffré, pas un diagnostic).
  const ta = latestTension(consults);
  if (ta) {
    if (ta.sys >= 160 || ta.dia >= 100) out.push({ severite: 'important', titre: 'Tension élevée au dernier relevé', detail: `${ta.raw} — à confirmer`, cle: 'tension' });
    else if (ta.sys >= 140 || ta.dia >= 90) out.push({ severite: 'attention', titre: 'Tension élevée au dernier relevé', detail: `${ta.raw} — à surveiller`, cle: 'tension' });
  }
  // Patient sous traitement sans consultation depuis > 1 an.
  if (lastConsult && list.some((e) => e.type === 'ordonnance')) {
    const months = (now - new Date(lastConsult.event_date).getTime()) / (86400000 * 30);
    if (months >= 12) out.push({ severite: 'attention', titre: "Aucune consultation depuis plus d'un an", detail: `Dernière ${humanizeElapsed(lastConsult.event_date)}`, cle: 'sans_suivi' });
  }

  const rank = { important: 0, attention: 1, info: 2 };
  return out.sort((a, b) => rank[a.severite] - rank[b.severite]);
}

// ── Signaux transversaux (tous les patients d'un médecin) ───────────
// patients : [{ id, nom, prenom, events:[...] }]. Renvoie les patients
// « à regarder » (au moins un signal ≠ info), triés par gravité.
function computeCrossPatientSignals(patients, now = Date.now()) {
  const flagged = [];
  for (const p of (patients || [])) {
    const signals = computePatientSignals(p.events, now).filter((s) => s.severite !== 'info');
    if (signals.length) {
      flagged.push({
        patient_id: p.id, nom: p.nom, prenom: p.prenom,
        signals,
        severite: signals.some((s) => s.severite === 'important') ? 'important' : 'attention',
      });
    }
  }
  const rank = { important: 0, attention: 1 };
  return flagged.sort((a, b) => rank[a.severite] - rank[b.severite] || b.signals.length - a.signals.length);
}

// ── Agenda du jour ──────────────────────────────────────────────────
// Trie les rendez-vous, ne garde pas les annulés, marque « à préparer »
// ceux rattachés à un dossier patient existant.
function buildAgenda(appointments, now = Date.now()) {
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  return (appointments || [])
    .filter((a) => a.status !== 'annule')
    .filter((a) => {
      const t = new Date(a.start_at).getTime();
      return t >= todayStart.getTime() && t <= todayEnd.getTime();
    })
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
    .map((a) => ({
      id: a.id,
      patient_id: a.patient_id || null,
      patient_label: a.patient_label || null,
      start_at: a.start_at,
      motif: a.motif || '',
      mode: a.mode || 'cabinet',
      status: a.status || 'planifie',
      a_preparer: !!a.patient_id,
    }));
}

// ── Ordonnances à renouveler (tous patients) ────────────────────────
// Ne garde que la DERNIÈRE ordonnance de chaque patient et la remonte si
// elle arrive à échéance (déterministe via computePrescriptionStatus).
function buildRenewals(patients, now = Date.now()) {
  const out = [];
  for (const p of (patients || [])) {
    const lastOrd = (p.events || [])
      .filter((e) => e.type === 'ordonnance')
      .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))[0];
    if (!lastOrd) continue;
    const status = computePrescriptionStatus(lastOrd, now);
    if (status.a_renouveler) {
      const meds = (lastOrd.data && lastOrd.data.prescriptions || []).map((x) => x.medicament).filter(Boolean);
      out.push({
        patient_id: p.id, nom: p.nom, prenom: p.prenom,
        event_id: lastOrd.id,
        medicaments: meds,
        expire_le: status.expire_le,
        jours_restants: status.jours_restants,
      });
    }
  }
  return out.sort((a, b) => (a.jours_restants ?? 0) - (b.jours_restants ?? 0));
}

// ── Résultats récents non intégrés dans une consultation ────────────
function buildRecentResults(patients, now = Date.now(), windowDays = 7) {
  const since = now - windowDays * 86400000;
  const out = [];
  for (const p of (patients || [])) {
    for (const e of (p.events || [])) {
      if ((e.type === 'analyse_labo' || e.type === 'imagerie') && new Date(e.event_date).getTime() > since) {
        out.push({ patient_id: p.id, nom: p.nom, prenom: p.prenom, event_id: e.id, type: e.type, title: e.title, event_date: e.event_date });
      }
    }
  }
  return out.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
}

// ── Matérialisation des tâches « système » depuis les signaux ───────
// Transforme chaque signal transversal en une tâche candidate, dédupliquée
// par source_ref pour ne jamais recréer une tâche déjà présente/traitée.
function materializeSystemTasks(flaggedPatients, existingTasks) {
  const existingRefs = new Set((existingTasks || []).map((t) => t.source_ref).filter(Boolean));
  const TYPE_BY_SIGNAL = {
    suivi_depasse: 'suivi', renouvellement: 'renouvellement',
    resultat_non_revu: 'resultat_a_revoir', tension: 'suivi', sans_suivi: 'suivi',
  };
  const candidates = [];
  for (const p of (flaggedPatients || [])) {
    for (const s of p.signals) {
      const ref = `${p.patient_id}:${s.cle}`;
      if (existingRefs.has(ref)) continue;
      candidates.push({
        patient_id: p.patient_id,
        title: `${s.titre} — ${p.prenom || ''} ${p.nom || ''}`.trim(),
        description: s.detail,
        type: TYPE_BY_SIGNAL[s.cle] || 'suivi',
        priority: s.severite === 'important' ? 'haute' : 'moyenne',
        source: 'systeme',
        source_ref: ref,
      });
    }
  }
  return candidates;
}

// ── Faits agrégés du cockpit (déterministe) ─────────────────────────
// Assemble tout ce que la Home affiche. Ne fabrique aucune donnée : chaque
// champ provient des vraies entrées (événements, RDV, tâches) ou d'un calcul.
function buildCockpitFacts({ patients, appointments, tasks, unreadMessages = 0, now = Date.now() }) {
  const priorites = computeCrossPatientSignals(patients, now);
  const agenda = buildAgenda(appointments, now);
  const renewals = buildRenewals(patients, now);
  const results = buildRecentResults(patients, now);
  const openTasks = (tasks || []).filter((t) => t.status === 'a_faire' || t.status === 'en_cours');

  return {
    agenda,
    priorites,
    resultats_recents: results,
    ordonnances_a_renouveler: renewals,
    taches: {
      a_faire: openTasks,
      compteurs: {
        total: openTasks.length,
        haute: openTasks.filter((t) => t.priority === 'haute').length,
        en_retard: openTasks.filter((t) => t.due_date && new Date(t.due_date).getTime() < now && t.status !== 'fait').length,
      },
    },
    messages_non_lus: unreadMessages,
    compteurs: {
      patients_a_regarder: priorites.length,
      urgents: priorites.filter((p) => p.severite === 'important').length,
      rdv_aujourdhui: agenda.length,
      resultats_recents: results.length,
      a_renouveler: renewals.length,
    },
    meta: { generated_at: new Date(now).toISOString(), deterministe: true },
  };
}

module.exports = {
  parseDelayToDays,
  humanizeElapsed,
  latestTension,
  computePrescriptionStatus,
  computePatientSignals,
  computeCrossPatientSignals,
  buildAgenda,
  buildRenewals,
  buildRecentResults,
  materializeSystemTasks,
  buildCockpitFacts,
  TYPE_LABELS,
};
