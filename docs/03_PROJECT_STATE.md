# 03 — PROJECT STATE

> **État vivant du projet.** À mettre à jour à la fin de chaque session de travail significative. C'est le fichier qu'on lit pour savoir « où on en est ».

**Version produit :** V1 (qualité commercialisable — Sprint 9 ; UX refondue — Sprints 10-11 ; copilote clinique — Sprint 12 ; app patient autonome — Sprint 15 ; maturité produit/plateforme — Sprint 16 ; clinique intelligente — Sprint 17 ; zero-click — Sprint 18)
**Dernière consolidation :** 2026-08-02 (Sprint 18 — Zero Click Medicine, complet)

> ⚙️ **Config à faire (Sprint 16)** : définir `ADMIN_EMAILS` dans l'environnement Render pour ouvrir l'accès au Command Center (`/admin`).

---

## Vue d'ensemble

- **Sprint 9 terminé** : qualité de niveau **V1 commercialisable** (auth complète, design system appliqué, états d'erreur/chargement, uniformisation, notifications + recherche universelle, portail patient structuré, accessibilité). Détail : [CHANGELOG.md](CHANGELOG.md).
- Le **backend est fonctionnel, stabilisé et sécurisé** ; le **frontend** (app médecin Aurora + portail patient) est poli et cohérent.
- **Bloqueur avant vrais patients : conformité HDS** (hébergement + transcription + socle RGPD). → [10_SECURITY.md](10_SECURITY.md).
- **Aucune vraie donnée patient** n'est autorisée tant que l'infra n'est pas HDS (données synthétiques uniquement).

---

## ✅ Terminé

**Backend & socle**
- Auth médecin (email + Google), auth patient cloisonnée (portail séparé).
- Dashboard, gestion patients + timeline d'événements (`medical_events`).
- Comptes-rendus IA (SOAP), ordonnances, courriers, structuration labo/imagerie.
- Outils IA : résumé dossier, préparation de consultation, recherche sémantique, interactions médicamenteuses, questions d'interrogatoire.
- Anonymisation renforcée (regex + retrait déterministe des noms connus).
- Stripe + webhook (cycle d'abonnement complet : activation + rétrogradation).
- Quota IA partagé sur tous les endpoints + remise à zéro mensuelle.
- Sécurité : `JWT_SECRET` fail-closed, rate limiting (global/auth/IA), CORS, audit logs.
- Portabilité : sous-traitants isolés dans `services/` + `Dockerfile` (prêt migration HDS).
- Déploiement Render (backend) + Vercel (frontend).

**Frontend — Phase 2 « Premium Experience » (lots livrés)**
- Design foundation : tokens de mouvement, `:focus-visible`, `prefers-reduced-motion`, skeletons, états vides guidés.
- Dashboard : panneau « Aujourd'hui », entrées animées.
- Fiche patient moderne : hero + synthèse dérivée du dossier.
- Refonte de la sidebar (signature MediAI).
- **Timeline médicale interactive** (frise filtrable, recherche client, ouverture en modal).
- Pivot d'identité visuelle vers la **palette bleue** (`--blue #1460FF` / `--navy #0A1128`) — voir [04_DESIGN_SYSTEM.md](04_DESIGN_SYSTEM.md).

**Consolidation (Phase 0, 2026-07-17)**
- Documentation `docs/` entièrement restructurée (source de vérité unique).
- Nettoyage de la dette : suppression du `index.html` racine mort, du sous-système legacy `compte_rendus` (endpoints + fonctions DB).
- Correctifs de transparence (`hds_compliant`), durcissement sécurité (CORS, logs), base de tests (`node:test`).

→ Historique détaillé : [CHANGELOG.md](CHANGELOG.md).

---

## 🔄 En cours / prochainement

**Phase 5 — MediAI OS (couche d'intelligence patient) — DÉMARRÉE**
- ✅ **Sprint 1 — Patient Snapshot** : synthèse de fond du dossier en tête de fiche patient. Hybride (traitements/dernière consult déterministes + IA pour narratif/problèmes/vigilance/suivi), cachée dans `patient_synthesis`, régénérée au changement d'événements. Backend (`GET /api/patients/:id/snapshot`) + UI + tests. → [08_AI_SYSTEM.md](08_AI_SYSTEM.md).
- 🔄 **Sprint 2 — Consultation Cockpit** : le dossier devient un briefing préparé. **2.1 livré** (Hero premium + « Préparer ma consultation » + « Ce qu'il ne faut pas oublier » + évolution + temps gagné). **2.2 livré** (documents importants auto-remontés, mode « Lecture 30 s », recherche clinique élevée, timeline premium animée — frontend pur). Restant : recherche à réponse directe, comparaison de constantes (poids/tension → évolution de schéma).
- 🎨 **Intelligence Workspace** (refonte premium de l'app médecin) : Home narrative, ⌘K Spotlight, centre de notifications, Mode Focus, et **Patient Intelligence Workspace** (hero premium, graphiques de constantes Apple-Health, colonne Insights, **Smart Timeline narrative** via `GET /api/patients/:id/timeline-narrative`). Passe de cohérence design faite. → [11_ROADMAP.md](11_ROADMAP.md).
- 🔄 **Sprint 3 — Ambient AI Consultation** : **3.1 livré** (panneau « Consultation prête » : ordonnance/courrier en un clic, suites, constantes). **3.2 livré** (carte « Évolution des constantes » dans le Cockpit : sparklines tension/poids/pouls/temp/SpO₂ lues sur les consultations, 100 % déterministe — clôt le point 4 du Cockpit). Restant : tâches de suivi persistantes, polish enregistrement vocal.
- 🔄 **Sprint 4 — Signaux & alertes proactifs** (pilier « détecter ») : **4.1 livré** — moteur de détection déterministe (`computePatientSignals`), carte « Signaux détectés » en tête du Cockpit + panneau « Signaux cliniques » transversal sur le dashboard. 100 % déterministe (aucune IA, observations factuelles « à vérifier »). Restant : interactions sur tout le dossier, tendances de constantes, seuils réglables.
- ⏭️ Différenciation patient · signaux avancés. → [11_ROADMAP.md](11_ROADMAP.md).

**⭐ En production (2026-08-02)** — **Sprint 18 · Zero Click Medicine** (complet, posture CPO+CTO) : « le meilleur clic est celui qui n'existe plus ». **A** — ⭐ **Le Journal Clinique** (récit prose exportable, `GET /api/patients/:id/journal-clinique`) + **AI Inbox** (boîte à vider). **B** — **Smart Queue** (file du jour colorée) + **Focus Mode « Terminer → suivant »** (enchaînement auto) + **Consultation Snapshot**. **C** — **Auto-save universel** (`MediaiAutosave`) + **Dossier 2.0 bandeau fixe** ; préchargement → backlog #30. **D** — langage couleur sémantique + **Early Access** (landing) + **ADR** (salle d'attente/multi-fenêtres/workspace/OCR). ~50 % existait déjà → élevé, pas reconstruit (règle #4). Transparence tenue. → [CHANGELOG.md](CHANGELOG.md).

**⭐ En production (2026-08-02)** — **Sprint 17 · The Intelligent Clinic** (complet, posture CPO+CTO) : MediAI travaille pour le médecin. **Vague A** — ⭐ **Copilote omniprésent** (FAB + ⌘J partout ; mode cockpit déterministe « prépare ma journée » + mode dossier IA ; unifie l'existant). **Vague B** — **Journal du cabinet** (`/api/journal`, activité réelle + temps gagné en estimation transparente) + **Quick Actions** patient. **Vague C** — **Health Graph** (carte mentale du dossier, déterministe) ; Smart Calendar/extraction servis par l'existant. **Vague D** — ⭐ **Mission Control** (stats IA réelles via `tokens_used`, `/api/admin/ai-stats`) + Patient Companion (digest) + workspace adaptatif. Audit préalable ([18_SPRINT17_INTELLIGENT_CLINIC](18_SPRINT17_INTELLIGENT_CLINIC.md)) : ~60 % existait déjà → élevé/unifié plutôt que reconstruit (règle #4). Transparence tenue (estimation étiquetée, jamais de faux chiffre). → [CHANGELOG.md](CHANGELOG.md).

**⭐ En production (2026-08-01)** — **Sprint 16 · Project Renaissance** (complet, posture CTO) : passage d'un excellent prototype à un **produit** pensé pour durer. **Vague 0** — Design System v2 (`tokens.css` source unique des 3 frontends, `--sage` supprimé, bug `--bg-secondary` corrigé, a11y AA de base). **Vague 1** — Trust Center honnête (`/trust`, FR/EN), mécanisme i18n, **feature flags sans redéploiement** (`/api/flags` + admin), shell du **Command Center** (`/admin`). **Vague 2** — **moteur de notifications** partagé (priorité/dédup/non-lus), cartographie de navigation (règle des 2 clics), **ADR** (plugins/observabilité/analytics restent au stade doc+hooks). **Vague 3** — Command Center complet : **métriques réelles** (`/api/admin/metrics`, agrégats sans donnée perso), entrée sidebar médecin gated `isAdmin`+flag. Transparence non négociable tenue partout (jamais « HDS conforme », jamais de chiffre inventé). Docs : [15_SPRINT16_RENAISSANCE](15_SPRINT16_RENAISSANCE.md), [16_NAVIGATION](16_NAVIGATION.md), [17_ADR](17_ADR.md). → [CHANGELOG.md](CHANGELOG.md).

**⭐ En production (2026-08-01)** — **Sprint 15 · Patient Experience Revolution** (complet) : l'espace patient (`patient.html` uniquement — **espace médecin jamais touché**) devient une **application santé du quotidien** (esprit Apple Santé) présentable seule. Nouvelle navigation **Accueil · Santé · Assistant · Documents · Profil** + hub Santé. 15 étapes : accueil compagnon santé, **Assistant IA patient** (`POST /api/patient/chat`), rendez-vous riches (+ .ics), traitements (matin/midi/soir), documents détaillés + **résultats reportés fidèlement** (normes/mentions du labo, jamais d'interprétation inventée), préparer sa consultation, notifications, historique, profil, santé connectée (« Bientôt » honnête), évolution (graphes déterministes), sécurité (**export JSON de ses données**), polish premium (haptics, a11y, bannière proactive). **⭐ Fonctionnalité signature « Mon Parcours Santé »** : le dossier raconté au patient en langage clair (`GET /api/patient/parcours`). 2 endpoints IA patient additifs réutilisant l'infra (anonymisation avant/après, cache), prompts dédiés, table `patient_parcours`. Données toujours réelles ; « seul votre médecin établit le diagnostic » affiché. → [CHANGELOG.md](CHANGELOG.md).

**⭐ En production (2026-07-30)** — **Sprint 14 · The First Impression** : refonte complète de la landing (`index.html`). → [CHANGELOG.md](CHANGELOG.md).

**⭐ En production (2026-07-29)** — **Sprint 13 · Platform Experience** (complet) : page publique avec **section Tarifs** (Student/Start/Pro/Enterprise) ; point d'entrée unique Professionnel/Patient (déjà en place) ; dashboard médecin en **deux colonnes** avec **Assistant MediAI** (réponses déterministes sur la journée) ; carte patient proactive au format cahier ; entrée Assistant dans le dossier ; **3 pages plateforme** (Centre d'actions, MediAI Labs, Marketplace + sidebar « Plateforme »). Données patient toujours réelles (jamais inventées) ; features plateforme en « Bientôt disponible ». → [CHANGELOG.md](CHANGELOG.md).

**⭐ En production (2026-07-28)** — **Sprint 12 · Intelligence First** (complet, 12/12) : MediAI devient un **copilote clinique**. Home briefing quotidien ; ⌘K enrichie (recherche + **Smart Search clinique inter-patients** + actions) ; **Copilote « Discuter avec le dossier »** (IA conversationnelle, réponses uniquement depuis le dossier, anonymisée, non persistée) ; **Histoire clinique** partageable dans un courrier ; centre de notifications = centre d'actions groupées ; dossier vivant (badges timeline « À revoir »/« À renouveler ») ; Mode Consultation plein écran (contexte permanent) ; timeline dépliable au clic ; portail patient proactif ; vue Traitements + interactions ; détails premium. Nouveaux endpoints IA : `POST /api/patients/:id/chat`, `POST /api/search/interpret`. → [CHANGELOG.md](CHANGELOG.md), [08_AI_SYSTEM.md](08_AI_SYSTEM.md).

**⭐ En production (2026-07-27)** — **Sprint 11 · The Apple Experience** (complet) : dashboard médecin premium (hero léger + 5 modules), cap IA strict (≤ 6 lignes), navigation réduite (sidebar 11→6, sous-docs en filtres du hub), écran de connexion unique (front door Professionnel/Patient) + bouton Apple honnête « bientôt », Design System v2 (échelle typo + `.badge`/`.input` canoniques), micro-interactions (entrée unifiée des modales), liaison patient ⇄ médecin quasi temps réel (polling portail), nettoyage du code mort (~110 lignes). Seule dépendance restante : activation réelle d'Apple (identifiants Apple Developer). → [CHANGELOG.md](CHANGELOG.md).

**⭐ En production (2026-07-27)** — **Sprint 10 · Patient Workspace Redesign** déployé (Vercel ; backend Render inchangé). Le dossier patient (app médecin) devient un workspace type Apple lisible en < 10 s : header premium + badge état santé, **3 blocs IA distincts** (Résumé / Points critiques / Actions — fin des doublons), **timeline premium** remontée en cœur de dossier avec aperçu au survol, **mini-dashboard santé** (tuiles Tension/Poids/FC/SpO₂/IMC façon Apple Health), et **sélecteur de connexion médecin/patient** sur la landing. 100 % réutilisation des données, aucune donnée inventée. → [CHANGELOG.md](CHANGELOG.md), [13_COMPONENTS.md](13_COMPONENTS.md).

**⭐ En production (2026-07-20)** — la série de sprints suivante est **déployée** (Render + Vercel) :
- **Porte d'entrée** : `index.html` = landing officielle (`/`) ; `app.html` = app médecin (`/app`, connexion directe, Google fiabilisé) ; `patient.html` (`/patient`). L'ancien marketing intégré à l'app est retiré ; déconnexion → `/`.
- **Dashboard « Aurora »** : Home refondue (bandeau navy + 4 cartes), **supersède** le cockpit à widgets du Sprint 6.
- **Sprint 7 — Dossier intelligent** : rail « À retenir » éditable, Chronologie/Évolution, 6 nouveaux types d'événements, ＋ Événement.
- **Sprint 8 — Clinical Workspace : COMPLET** (Lots 1-4). Lot 1 module Ordonnance (éditeur complet) ; Lot 2 Action Bar + Quick Create + raccourcis clavier ; Lot 3 Centre documentaire + Favoris (table `favorites`) ; Lot 4 micro-interactions & performance (pagination).
- Note dette : ⚠️ le frontend `app.html` dépasse ~5700 lignes (monofichier) — extraction à envisager. La collision `.ckpt-*` a été résolue via namespaces (`.aur-*`, `.ord-*`).

**Sprint 6 — MediAI Cockpit (la Home devient le cerveau) — Lots 1 & 2 livrés (2026-07-19)**
- ✅ **Lot 1 (backend)** : module métier `cockpit.js` (déterministe, testé — 29 tests au total), nouvelles tables (`appointments`, `tasks`, `workspace_layouts`, `message_threads`/`messages`, `cockpit_briefings`), API `GET /api/cockpit` + `/briefing` + CRUD RDV/Tâches/Workspace/Messagerie, prompt `COCKPIT_BRIEFING_PROMPT` (faits agrégés anonymisés, non-décisionnel).
- ✅ **Lot 2 (frontend `app.html`)** : la Home devient un **cockpit** — barre de briefing IA (« à vérifier »), modes (Cockpit/Consultation/Cabinet/Visite/Urgences), widgets actionnables (agenda + création RDV, patients à regarder, tâches, résultats, renouvellements, recommandations IA, messages, activité), personnalisation `localStorage`.
- ⏭️ Restant : **Lot 3** (workspace drag & drop + layouts serveur), **Lot 4** (inbox messagerie + portail patient + durées d'ordonnance structurées). ⚠️ **Déployer le backend AVANT le frontend** (le cockpit dégrade proprement sinon).

Ordre validé pour la suite de la Phase 2 (frontend, en parallèle) :
1. **Expérience patient différenciée** — donner à `patient.html` une identité visuelle propre, épurée, orientée « suivi de santé » (aujourd'hui il partage la palette médecin).
2. **⌘K / recherche universelle** raffinée (Spotlight).
3. **Centre de notifications**.
4. **Micro-interactions & finitions** globales.

→ [11_ROADMAP.md](11_ROADMAP.md) et [14_BACKLOG.md](14_BACKLOG.md).

---

## 🚧 Bloqueurs connus

- **Conformité HDS** : bloqueur absolu avant toute bêta avec de vrais patients. Migration hébergement + transcription auto-hébergée + socle RGPD. → [10_SECURITY.md](10_SECURITY.md).

---

## Priorité actuelle

**Professionnaliser puis élever l'expérience** — sans jamais casser l'existant (auth, Stripe, API, logique métier). La stabilisation est terminée ; on construit des fondations durables avant d'ajouter des fonctionnalités.
