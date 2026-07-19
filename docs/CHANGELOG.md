# CHANGELOG

Historique des changements notables de MediAI. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Dates au format AAAA-MM-JJ.

---

## [Non publié] — Site vitrine officiel (landing) — 2026-07-17

Frontend uniquement (`mediai-site/landing.html`, nouveau fichier autonome — **n'affecte pas l'app** `index.html`).

### Ajouté
- **Landing page premium** (13 sections) : navigation fixe (blur au scroll), hero (titre + double CTA + mockups MacBook/iPhone avec l'**interface fidèle** du produit), trusted-by + badges de conformité honnêtes (« HDS — en cours »), statistiques à compteurs animés, bloc vidéo, **démo interactive** à onglets (Home / Snapshot / Cockpit), grille de fonctionnalités, comparaison « logiciels classiques vs MediAI » (sans citer de concurrent), 4 écosystèmes, slider d'avis, FAQ animée, CTA final dégradé, footer complet.
- **Vrai logo MediAI** (base64 extrait du produit) inline ; palette + typographie (Inter) officielles ; reveal au scroll (IntersectionObserver), micro-interactions, responsive desktop/tablette/mobile.

### v2 — design officiel + vrais assets, DÉPLOYÉE
- Refonte alignée sur le **design officiel** fourni (`visuel du site`) : **hero sombre premium**, 13 sections. **Vrai logo officiel** + **vrais visuels produit** (espaces patient / pharmacie / hôpital, écosystème) intégrés (dans `mediai-site/assets/`) dans la démo à onglets et les écosystèmes (lightbox). Déployée sur Vercel (`mediai-site` main).
- **Intégrité maintenue (pré-lancement)** : « HDS — en cours » (jamais présenté comme acquis) ; pas de logos de vrais établissements comme clients ; statistiques = faits produit vérifiables ; **témoignages illustratifs à remplacer** par de vrais avis avant toute campagne publique.
- Reste à l'utilisateur : décider du routage (landing = page d'accueil vs `/landing.html`, l'app restant sur `index.html`) ; fournir vrais logos partenaires / avis / captures HD s'il veut substituer les rendus.

---

## [Non publié] — Patient Intelligence Workspace (4) : Smart Timeline narrative — 2026-07-17

Backend + frontend. La chronologie du dossier devient un **récit par périodes**.

### Ajouté
- **Backend** : `GET /api/patients/:id/timeline-narrative` — récit du dossier regroupé en périodes (« Février – Avril : suivi régulier… »), généré par Claude sur une chronologie **anonymisée**, purement descriptif/temporel (aucun diagnostic). Prompt `TIMELINE_NARRATIVE_PROMPT`, table de cache `timeline_narratives` (régénérée au changement d'événements), non décompté du quota. `/health` → `2.7.0`.
- **Frontend** : carte « ✨ Le récit du dossier » en tête de la chronologie du patient — narration verticale (période = point + titre + prose), mention IA. `fetchTimelineNarrative`/`renderTimelineNarrative`, `#timelineNarrative`. La frise détaillée filtrable existante est conservée sous le récit.

### Déploiement
- Déployer le **backend d'abord** (nouvel endpoint) ; le frontend masque proprement la carte si l'endpoint est absent.

---

## [Non publié] — Intelligence Workspace (4) : Mode Focus — 2026-07-17

Frontend uniquement (`mediai-site`).

### Ajouté
- **Mode Focus consultation** : bascule sans distraction — la sidebar, la topbar et la cloche s'effacent (`body.focus-mode`), une barre minimale affiche le patient + « Quitter · Échap ». Entrée depuis un bouton dédié de la vue consultation, depuis ⌘K (« Mode Focus »), sortie par le bouton ou **Échap**. `enterFocusMode`/`exitFocusMode`/`toggleFocusMode`, `#focusBar`, `ensureFocusStyles`. Aucune fonctionnalité déplacée (bascule CSS pure) → zéro risque de casse du flux consultation.

---

## [Non publié] — Intelligence Workspace (3) : Centre de notifications — 2026-07-17

Frontend uniquement (`mediai-site`).

### Ajouté
- **Centre de notifications** iOS-like : cloche dans l'en-tête de la sidebar avec **pastille de nouveautés**, panneau latéral droit (`renderNotifCenter`) groupant les événements par **« Depuis votre dernière visite »** (non-lus mis en avant) puis par jour (Aujourd'hui / Hier / date). Chaque notification a une **icône + couleur par type**, le patient, l'heure, et ouvre le dossier au clic. `#notifBell`/`#notifBadge`/`#notifOverlay`, `NOTIF_META`, `updateNotifBadge`, `toggleNotifCenter`, `ensureNotifStyles`.
- « Nouveauté » détectée via `created_at` vs dernière visite (localStorage `mediai_notif_seen`) ; ouvrir le centre marque tout comme vu. 100 % déterministe. Le **fil d'activité** du dashboard (existant) reste le flux principal ; le centre ajoute la couche « depuis la dernière connexion ».

---

## [Non publié] — Passe qualité & cohérence design — 2026-07-17

Frontend uniquement (`mediai-site`). Audit de cohérence après les nombreux ajouts de l'Intelligence Workspace. Aucune régression fonctionnelle.

### Corrigé (incohérences réelles)
- **Palette PDF** : les 3 générateurs PDF (compte-rendu, courrier, ordonnance) utilisaient encore l'**ancienne palette verte/marine** (`[47,107,79]`…) alors que l'app est passée au bleu. Alignés sur la charte bleue officielle (bleu `[20,96,255]`, navy `[10,17,40]`, etc.) → les documents générés sont désormais cohérents avec l'app.
- **Marque** : `index.html` mélangeait « MédiAI » (ancienne orthographe accentuée, 20×) et « MediAI ». Standardisé partout en **« MediAI »** (aligné doc + portail patient + logo). Titre de page corrigé.

### Vérifié (conforme)
- Aucune couleur de l'ancienne palette restante. Aucune police hors charte (Inter partout). Aucun `console.log` de debug côté frontend. Nouveaux composants responsive (grilles `auto-fit`/`minmax`, rail Insights en 1 colonne < 1000 px).

### Dette tracée (non bloquante, [14_BACKLOG.md](14_BACKLOG.md))
- Tokens `--sage*` (nom hérité, pointent vers le bleu) ; échelle d'espacement non tokenisée ; frontend monofichier ; agrégation des signaux côté client (envisager côté serveur à grande échelle). Typo mineure `patient.html` (« espace sante »).

---

## [Non publié] — Patient Intelligence Workspace (3) : Colonne « Insights » — 2026-07-17

Frontend uniquement (`mediai-site`). Le dossier patient devient un vrai **workspace deux colonnes**.

### Ajouté / Modifié
- **Colonne « Insights » latérale sticky** à droite du dossier (`.piw-layout` : contenu à gauche `.piw-main`, rail à droite `.piw-rail`). Reste visible pendant qu'on parcourt le dossier. Consolide : **badge de vigilance**, **signaux**, **documents clés** (accès rapide en un clic), **à préparer** (suivi du snapshot), **dernières constantes**. `renderPatientInsights`, `piwInsCard`, `#patientInsights`, `ensurePiwStyles`.
- 100 % déterministe (+ suivi issu du snapshot quand chargé). Responsive : passe en une colonne sous 1000 px.

---

## [Non publié] — Patient Intelligence Workspace (2) : Graphiques de constantes — 2026-07-17

Frontend uniquement (`mediai-site`).

### Modifié
- La carte « Évolution des constantes » du Cockpit passe des sparklines à de **vrais graphiques premium** (façon Apple Health / Stripe) : courbe + **aire dégradée** + dernier point + tendance, une carte par constante (poids, pouls, température, SpO₂) ; la **tension** trace deux courbes (systolique en aire + diastolique) sur une échelle partagée. Dates de début/fin en pied. `renderVitalsEvolutionHtml` réécrit ; helpers `vitalsMultiSvg`, `vitCard`, `vitDateShort`, `ensureVitalsStyles`.
- **100 % déterministe** : les points sont les valeurs brutes des comptes-rendus, aucune interpolation trompeuse, aucune interprétation.

---

## [Non publié] — Patient Intelligence Workspace (1) : Hero premium — 2026-07-17

Frontend uniquement (`mediai-site`). Début de la refonte du dossier patient en « espace de compréhension ».

### Ajouté / Modifié
- **Hero d'intelligence patient premium** en tête du dossier (élève le hero du Cockpit) : grand avatar, nom, âge, **médecin référent**, dernière consultation, **badge de vigilance** (Élevée / À surveiller / Rien à signaler — dérivé des signaux, **pas un score de risque clinique**), et un **« coup d'œil »** de chiffres clés (traitements en cours, dernière TA, dernier poids, nombre d'événements). Carte premium (dégradé subtil, ombre légère, coins harmonieux). Helper `lastVital`.
- Le badge de vigilance et le coup d'œil sont 100 % déterministes ; réutilisent `computePatientSignals` / `deriveTreatments` / `latestTension`.

### Déjà présents dans le dossier (sprints précédents, à réorganiser dans la suite)
- « Ce que MediAI comprend » = Patient Snapshot ; signaux ; évolution des constantes (sparklines) ; documents importants ; recherche clinique ; timeline. Prochains increments : graphiques de constantes premium, timeline narrative (IA), colonne « Insights », comparaison d'examens.

---

## [Non publié] — Intelligence Workspace (2) : ⌘K premium + Quick Actions — 2026-07-17

Frontend uniquement (`mediai-site`).

### Ajouté / Modifié
- **Command palette ⌘K premium** (Spotlight/Raycast) : **registre de commandes** complet — création (Nouvelle consultation, Nouveau patient) + navigation vers toutes les vues — avec **alias de recherche** (« ordo », « labo », « bio », « irm », « cr », « réglages »…). Recherche unifiée patients + documents + commandes.
- **Premier résultat présélectionné** (Entrée agit immédiatement), survol = sélection, **badges de type** par résultat (Action/Patient/Document), **pied avec indices clavier** (↑↓ naviguer · ↵ ouvrir · esc fermer). `cmdkCommands`, `cmdkMatch`, `ensureCmdkStyles`.
- Les actions rapides visibles restent sur le dashboard (bouton primaire + raccourcis) ; la palette est la couche clavier universelle.

---

## [Non publié] — Intelligence Workspace (1) : Home intelligente — 2026-07-17

Frontend uniquement (`mediai-site`). Début du programme « MediAI Intelligence Workspace ».

### Ajouté
- **Home intelligente** : le dashboard raconte la journée en quelques phrases, chacune **cliquable** vers la bonne page (consultations du jour, nouveaux résultats, patients à suivre, ordonnances qui expirent). Ton calme et premium, jamais agressif. `renderIntelligentHome` / `computeDayFacts` / `#dashIntelligentHome`.
- 100 % déterministe (compose les événements + signaux déjà calculés), skeleton de chargement, animation d'entrée douce, `prefers-reduced-motion`.

### Programme à venir (increments)
- Fil d'activité médical, ⌘K premium, panneau « Aujourd'hui » latéral, quick actions, smart timeline narrative, vue patient premium, assistant contextuel, centre de notifications, micro-interactions, mode focus, passe de cohérence design.

---

## [Non publié] — Phase 5, Sprint 4 (4.1) : Signaux & alertes proactifs — 2026-07-17

Frontend uniquement (`mediai-site`). Le pilier « détecter » : MediAI passe d'assistant qui prépare à assistant qui alerte. **100 % déterministe** — aucune IA sur les signaux (règles factuelles, jamais un diagnostic ni une conduite à tenir).

### Ajouté
- **Moteur de détection** `computePatientSignals(events)` : suivi recommandé dépassé, traitement à renouveler (durée d'ordonnance écoulée), résultat récent non revu, tension élevée au dernier relevé (≥140/90 → attention, ≥160/100 → important), absence de consultation > 1 an sous traitement. Conservateur (évite les fausses alertes). Helpers `parseDelayToDays`, `latestTension`.
- **Carte « Signaux détectés »** en tête du Cockpit (colorée par sévérité 🔴🟠🔵), au-dessus du briefing.
- **Panneau « Signaux cliniques »** transversal sur le dashboard (`renderDashboardSignals`, `#dashSignalsSection`) : quels patients méritent un regard, cliquables vers le dossier. Réutilise `fetchAllEvents`.

### Principe
- Signaux = observations factuelles « à vérifier », neutres, jamais une décision. Conforme à « l'IA assiste, ne décide jamais » (ici même sans IA).

### À venir
- Sprint 4.2 : interactions médicamenteuses sur tout le dossier, tendances de constantes qui dérivent (pente), réglages de seuils.

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
