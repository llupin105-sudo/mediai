# CHANGELOG

Historique des changements notables de MediAI. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Dates au format AAAA-MM-JJ.

---

## [Non publié] — Phase 5, Sprint 3 (3.2) : Évolution des constantes — 2026-07-17

Frontend uniquement (`mediai-site`). Aucun changement backend ni de schéma — exploite les constantes déjà capturées par consultation.

### Ajouté
- Carte **« Évolution des constantes »** dans le Consultation Cockpit : lit `data.sections.objectif.constantes` (tension, poids, pouls, température, saturation) à travers toutes les consultations du dossier et trace des **mini-sparklines** SVG + dernière valeur + tendance (↗︎/↘︎/stable). `renderVitalsEvolutionHtml`, `VITALS`, `firstNum`, `vitalsSparkline`, `vitalsTrend`.
- **100 % déterministe** : aucune IA, aucune valeur inventée, tendances neutres (pas de jugement « bon/mauvais »). Clôture le point 4 du Cockpit (comparaison de constantes) sans évolution de base de données.

### À venir (3.3)
- Tâches de suivi persistantes ; polish du flux d'enregistrement vocal.

---

## [Non publié] — Phase 5, Sprint 3 (3.1) : Ambient Consultation — orchestration — 2026-07-17

Frontend uniquement (`mediai-site`). Aucun changement backend (tous les endpoints existaient déjà).

### Ajouté
- **Panneau « Consultation prête »** en tête du compte-rendu généré : transforme la dictée en travail fini. Actions contextuelles **en un clic** (uniquement ce que le CR a réellement produit) : **Créer l'ordonnance** (pré-remplie depuis `plan.prescriptions`), **Rédiger le courrier** (si orientations). Plus une checklist **« Suites à donner »** (suivi + arrêt de travail + orientations) et les **constantes relevées** (`sections.objectif.constantes`). `renderConsultReadyPanel`, `#consultReadyPanel`, classes `.cr-*`.
- Principe : l'IA propose, le médecin valide (jamais d'auto-génération sans revue) — conforme à la règle « l'IA assiste, ne décide jamais ».

### Découverte utile
- Les **constantes** (tension, poids…) sont déjà capturées dans chaque consultation (`data.sections.objectif.constantes`) → l'évolution des constantes du Cockpit (point 4) est réalisable **sans changement de schéma** (prochain increment 3.2).

### À venir (3.2 / 3.3)
- Évolution des constantes dans le Cockpit (mini-graphes) ; tâches de suivi persistantes ; polish du flux d'enregistrement vocal.

---

## [Non publié] — Phase 5, Sprint 2 (2.2) : Timeline & recherche clinique — 2026-07-17

Frontend uniquement (`mediai-site`). Aucun changement backend.

### Ajouté
- **Documents importants** : le plus récent de chaque type (consultation, ordonnance, analyses, imagerie, courrier) remonte automatiquement en tête de la zone chronologie, en accès direct (`renderKeyDocuments`, `#keyDocuments`).
- **Mode « Lecture 30 s »** : bouton dans le hero du Cockpit ouvrant une vue distillée aux seuls éléments critiques (briefing, à ne pas manquer, traitements, résultats récents, dernière consultation) — `openQuickRead`.
- **Recherche clinique** élevée : placeholder en langage naturel, validation à `Entrée`, exemples cliquables (« dernière IRM », « prise de sang »…) déclenchant la recherche sémantique existante (`renderSearchExamples`, `runClinicalExample`).
- **Timeline premium** : animation d'entrée douce façon Linear (`tl-anim` + keyframe `tlItemIn`, respect de `prefers-reduced-motion`), sur la frise déjà colorée par type.

### À venir (2.3 / Sprint 3)
- Recherche à réponse directe (nécessiterait un endpoint dédié), comparaison de constantes structurées (poids/tension — évolution de schéma), puis Sprint 3 « Ambient AI Consultation ».

---

## [Non publié] — Phase 5, Sprint 2 (2.1) : Consultation Cockpit — 2026-07-17

Le dossier patient devient un **briefing préparé**. Increment 2.1 : le cœur du Cockpit.

### Ajouté
- **Consultation Cockpit** en tête de la fiche patient : Hero premium (identité + dernière consultation + temps écoulé + motif précédent + badge IA + temps de lecture), **« Préparer ma consultation »** (récit IA fluide), **« Ce qu'il ne faut pas oublier »** (rappels déterministes + suivis/vigilances IA), **« Depuis la dernière consultation »** (évolution déterministe), et une stat discrète **« ≈ N min économisées »**.
- Backend : champ `briefing_consultation` ajouté à `PATIENT_SNAPSHOT_PROMPT` (récit de préparation, généré et caché avec le Snapshot — **aucun appel LLM supplémentaire**). `/health` → `2.6.0`.
- Frontend : `renderCockpit` (déterministe, instantané), `fillCockpitBriefing` (récit + rappels depuis la synthèse cachée), helpers `humanizeElapsed` / `estimateTimeSaved`. Rendu par blocs, responsive (grille auto-fit), animation douce.

### Principe
- Performance perçue : tout le déterministe s'affiche **instantanément** depuis les événements déjà chargés ; seul le récit vient de l'IA (caché).
- IA responsable : le briefing prépare et attire l'attention, ne diagnostique jamais ; les données médicales restent déterministes.

### À venir (2.2 / 2.3)
- Timeline premium (façon Linear), recherche clinique élevée, mode « lecture 30 s », comparaison de constantes (poids/tension — nécessite d'enrichir le modèle de données).

---

## [Non publié] — Phase 5, Sprint 1 : Patient Snapshot — 2026-07-17

Première brique de la couche d'intelligence patient (« MediAI OS »).

### Ajouté
- **Patient Snapshot** : synthèse de fond du dossier affichée en tête de la fiche patient. Hybride — faits déterministes (traitements issus de la dernière ordonnance, dernière consultation) + couche IA (résumé narratif, problèmes actifs, antécédents, points de vigilance, suivi à prévoir).
- Backend : `GET /api/patients/:id/snapshot` (cache-ou-génère, `?refresh=1` force), prompt `PATIENT_SNAPSHOT_PROMPT`, table `patient_synthesis` (cache régénéré au changement d'événements), helpers `buildSnapshotFacts` / `isSnapshotStale` / `generateSnapshotIntelligence`.
- Frontend (`mediai-site`) : carte « Synthèse intelligente » sous le hero patient (`renderPatientSnapshot`), états chargement/vide/erreur, bouton actualiser.
- Tests : `test/snapshot.test.js` (logique déterministe + cache). Total 20 tests.

### Notes
- L'endpoint snapshot est **volontairement non décompté du quota gratuit** (fonction toujours active), protégé par `aiLimiter` et fortement caché. Coût à surveiller (backlog).
- Le médical sensible (médicaments) n'est **jamais** généré par l'IA — uniquement extrait des vraies ordonnances.

---

## [Non publié] — Phase 0 : Consolidation — 2026-07-17

Professionnalisation du projet avant reprise du développement. Aucune nouvelle fonctionnalité produit.

### Ajouté
- Documentation `docs/` entièrement restructurée en source de vérité unique (fichiers numérotés `00_START_HERE` → `14_BACKLOG` + `CHANGELOG`).
- Base de tests `test/` (`node:test`) : anonymisation, helpers de compte/quota, configuration.
- Variables d'environnement `ALLOWED_ORIGINS` (liste blanche CORS) et `EMAIL_FROM` (expéditeur email) documentées dans `.env.example`.
- `CLAUDE.md` racine pointant vers `docs/00_START_HERE.md`.

### Modifié
- `GET /health` : suppression de l'affirmation trompeuse `hds_compliant: true` → expose l'état réel (`hds_compliant: false`, `data_policy: "synthetic-only"`).
- CORS restreint à une liste blanche d'origines (fin du `Access-Control-Allow-Origin: *`).
- Logs de démarrage : ne divulguent plus de fragment de clé API (présence/absence uniquement).
- `services/email.js` : adresse d'expéditeur configurable via `EMAIL_FROM`.
- `server.js` : démarrage du serveur guardé par `require.main === module` (permet de tester les helpers sans effet de bord) + export des helpers testables.

### Supprimé
- `index.html` à la racine du backend (mort — jamais servi ni référencé).
- Sous-système legacy `compte_rendus` : endpoints `GET /api/historique` et `GET /api/compterendu/:id`, fonctions DB `saveCompteRendu` / `getCompteRenduById` / `listCompteRendusByMedecin`, et création de la table dans `initDb()`.
- Anciens dossiers de documentation vides (`architecture/`, `bugs/`, `company/`, `decisions/`, `design/`, `product/`, `roadmap/`, `vision/`) et le dossier `AI/` (contenu consolidé dans `docs/`).

### Migration base de données
- Script sûr fourni pour retirer la table legacy des bases existantes (vérifie qu'elle est vide avant suppression) : `DATABASE_URL='...' node scripts/drop-compte-rendus.js`.

### Configuration
- CORS : les domaines de production définitifs `https://app.mediai.fr` et `https://mediai.fr` sont ajoutés au défaut — ils fonctionneront dès que le DNS OVH pointera vers Vercel, sans modification de code. `ALLOWED_ORIGINS` permet de verrouiller strictement ensuite.

---

## Historique antérieur (résumé)

### 2026-07-14 — Stabilisation & sécurité (backend)
- Correctif modèle Claude (`claude-sonnet-4-6`) — l'IA fonctionne de nouveau.
- Sécurité : `JWT_SECRET` fail-closed en production, rate limiting (global/auth/IA), `trust proxy`.
- Quota IA partagé sur tous les endpoints + remise à zéro mensuelle paresseuse.
- Webhook Stripe : source de vérité de l'abonnement (activation + rétrogradation).
- Anonymisation renforcée : retrait déterministe des noms connus (patient/médecin).
- Portabilité : sous-traitants isolés dans `services/`, `.env.example`, `docker/Dockerfile`.

### 2026-07 — Phase 2 Premium (frontend `mediai-site`)
- Design foundation (tokens de mouvement, accessibilité, skeletons, états vides).
- Dashboard « Aujourd'hui », fiche patient moderne.
- Refonte de la sidebar (signature MediAI).
- Timeline médicale interactive.
- Pivot d'identité visuelle vers la palette bleue.

---

> Convention : à chaque changement notable, ajouter une entrée sous « Non publié », puis dater la section lors d'un jalon. Mettre aussi à jour [03_PROJECT_STATE.md](03_PROJECT_STATE.md).
