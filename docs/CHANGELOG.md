# CHANGELOG

Historique des changements notables de MediAI. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Dates au format AAAA-MM-JJ.

---

## [Non publié] — Sprint 25 · « One Clear Action » — Consultation — 2026-08-09

Passe de **cohérence** (pas d'ajout) : chaque écran principal doit répondre à **une question** et converger vers **une action**. Premier écran : **Consultation** (`app.html`). **UI only** — cockpit/API/auth inchangés. Cf [docs/sprints/SPRINT-25.md](sprints/SPRINT-25.md).
- **Question / action de l'écran** : « De quoi ai-je besoin pendant la consultation ? » → *Générer le compte-rendu.*
- **Fin du cold-open sur la facturation** : le bandeau quota (« 3 actions IA / mois ») passe de l'entête à un **pied de carte discret**.
- **Sélecteur patient neutralisé** : plus de tint ambre (lu comme une alarme) — invitation calme, c'est l'étape 1.
- **« Mode Focus »** : gros bouton pleine largeur → **pastille discrète** en haut à droite. **« Suggestions de questions »** : gros bouton → **lien secondaire** discret.
- **En-tête** « Consultation » + sous-titre explicite ; flux vertical unique : titre → patient → dicter → coller → suggestion → spécialité → **Générer** → quota chuchoté.
- **Zéro suppression de logique** : tous les IDs/handlers conservés (`micBtn`, `transcriptBox`, `generateBtn`, `symptomQuestionsBtn`, `usageBar`, `toggleFocusMode`, autosave, export SOAP). Le résultat SOAP restait déjà masqué jusqu'à génération (progressive disclosure conservée).

## [Non publié] — Sprint · MediAI « Calm Dashboard » — 2026-08-09

Reshape de l'**accueil médecin** (`app.html`) vers un **espace de travail calme** (Apple) : ouvrir → comprendre sa journée → agir → l'app disparaît. Remplace le hero « prochain geste » + Magic Input du Sprint 23. **UI/UX only** — cockpit/API/auth/backend inchangés, aucune donnée inventée.
- **Header allégé** : « Bonjour Dr X 👋 » + date · 🔔 · ＋ Nouvelle. Plus de gros bloc coloré.
- **Recherche globale** (⌘K) branchée sur la palette de commandes existante (`openCommandPalette`).
- **« Aujourd'hui »** : timeline des RDV du jour (`cockpitState.data.agenda` filtré au jour) — heure · patient · type·âge · statut (En cours / À venir / Terminé) ; lignes cliquables → dossier (`renderDashToday`).
- **« À faire » | « À surveiller »** (2 colonnes) : dérivés du cockpit réel (`priorites` / `ordonnances_a_renouveler` / `resultats_recents`) ; **couleurs sémantiques uniquement** (🔴 action / 🟠 attention / 📄 document) ; « Voir les patients → » (`renderDashTodo` / `renderDashAttention`).
- **« Accès rapides »** : 4 actions (🎙 Dictée · 📄 Analyser un document · ✦ Compte rendu instantané · 📝 Nouvelle note).
- **Gros KPI repliés** : « 6 consultations / 92 % IA » descendent sous « Statistiques de la journée » (`dashBand`/`dashCards` conservés). Styles `ensureCalmDashStyles`/`#calmDashStyles`.

## [Non publié] — Sprint · MediAI Réseau (V1) — 2026-08-08

Espace de **coordination médicale** (app médecin) : la messagerie devient un workspace « AirDrop + Messages + Notion » du parcours de soins. Onglet **💬 Réseau** (sidebar, après Consultations). **UI/UX only** — aucune API/auth/backend touchés. Cf [ADR-012](17_ADR.md).
- **À traiter** (le cœur) : tri prioritaire des conversations (Répondre 🔴 / Confirmer·Vérifier 🟠 / Terminé 🟢) — MediAI montre ce qui nécessite l'attention.
- **Conversation 2 colonnes** : fil + **fiche de coordination** (patient · participants multi-parties · documents · actions · historique).
- **+ Demander** (avis / info / RDV / traitement / examen / orientation / patient / libre) → **Nouveau message avec contexte patient auto** + objet pré-rempli. **IA de préparation** (jamais d'envoi automatique).
- Onglet **Réseau** : correspondants vérifiés (pas de fil public / abonnés / followers).
- **Périmètre honnête** : canal médecin↔patient **réel** ; multi-parties/réseau externe **synthétique (démo)** clairement étiqueté. Backend multi-parties complet + **MSSanté** = différés post-HDS ([ADR-012](17_ADR.md)).

## [Non publié] — Sprint 24 · Patients « Calm Workspace » — 2026-08-08

Refonte UI/UX de la page **Patients** (app médecin) vers une vue **calme et premium** (Apple × Linear). Objectif « 5 secondes » : qui suivre, qui nécessite mon attention, quoi faire. **UI uniquement** — aucune API/auth/Supabase/Render/Vercel touchée. Cf [docs/sprints/SPRINT-24.md](sprints/SPRINT-24.md).
- **Cartes horizontales** (une par patient, triées par priorité) : pastille d'état · initiales · nom/âge·sexe/état · Prochain RDV · Suivi · action recommandée · ›. Toute la card cliquable → dossier (`openPatientDetail`).
- **4 états seulement** : 🟢 Stable · 🟠 À surveiller · 🔴 Action recommandée · ⚪ Nouveau patient (déjà dérivés du réel par `piwBuildModels`, réutilisés).
- **Header + filtres épurés** (Tous · À voir aujourd'hui · Suivi actif · Nouveaux · À surveiller) + **barre de statut** discrète (RDV / Actions / À surveiller / Patients).
- **Progressive disclosure** : le workspace riche du Sprint 21 n'est pas supprimé → accessible via « Voir le tableau complet ». Responsive (desktop 7 colonnes / mobile réduit). Accessibilité clavier + état textuel (pas que la couleur).

## [Non publié] — Sprint 21 · Patient Intelligence Workspace — 2026-08-03

La page **Patients** côté médecin (`mediai-site/app.html`) devient le centre nerveux du cabinet, façon Apple Contacts/Photos/Health. **15 innovations en 5 vagues — sprint complet.** Tous les signaux sont **dérivés du réel** (jamais inventés) ; décisions HDS : photos **UI-only** (upload différé) et métadonnées d'organisation **en local** ([ADR-011](17_ADR.md)).

- **Vague A · Cartes + vues + UX Apple (Innov 1, 4)** : `renderPatientsList` refait — toolbar (recherche instantanée, 5 vues Cartes/Liste/Aujourd'hui/Favoris/À suivre, + Patient) et cartes riches (avatar dégradé à initiales, âge·sexe, prochain RDV, pastille **Pulse** + badge d'état déterministe 🔴🟠🟢⚪). Favoris épinglables.
- **Vague B · Signaux (Innov 10, 11, 15)** : Patient Pulse ; **mini-timeline** (3 événements) ; **Relationship Timeline** « ❤️ Suivi depuis X · N consultations ».
- **Vague C · Aperçu & fiche (Innov 6, 7, 14)** : recherche instantanée ; **Quick Preview au survol** (0 clic, données en mémoire) ; **fiche latérale** qui glisse à droite (résumé, coordonnées réelles, traitement, actions rapides) — le dossier complet ne s'ouvre que si besoin.
- **Vague D · Organisation (Innov 8, 9, 12, 13)** : **Tags** colorés, **Smart Filters** dérivés (message non lu, analyse récente, RDV demain, pas vu depuis 12 mois, jamais consulté), **Collections** (albums), **sélection multiple** (export CSV réel, ajout à une collection ; rappel/document = « bientôt »). Métadonnées en localStorage.
- **Vague E · Création & perf (Innov 3, 2)** : chooser **« Ajouter un patient »** (Créer / Inviter / Importer / Scanner — 3 derniers « Bientôt ») ; champ **`sexe`** (F/M/Autre) de bout en bout (migration `patients.sexe`) ; **rendu progressif** (fenêtre + IntersectionObserver) pour les gros cabinets ; avatars photo-ready. Photos/import/scan/sync → **[ADR-011](17_ADR.md)**.

## [Non publié] — Sprint 20 · Apple Patient Experience — 2026-08-02

Refonte de l'espace patient (`mediai-site/patient.html`) façon Apple Health / Fitness / Journal : « ce n'est pas une app médicale, c'est une belle app ». **15 phases en 5 vagues — sprint complet.** Garde-fous transparence tenus (aucune donnée inventée, pas de fausse stat, données sensibles en démo locale jusqu'à HDS).

- **Vague A · Mission Design + Home (Phases 1, 9)** : langage visuel « Health OS » (rayons 26/32px, ombres douces, verre, respiration, révélation `hos-rise`). Home « une chose à la fois » : *Bonjour X. / Comment allez-vous aujourd'hui ?* → grande carte ❤️ (statut de suivi honnête, jamais un verdict médical) → cartes focus (RDV · traitement · document). Code mort supprimé.
- **Vague B · Cartes vivantes + Traitement + Documents (Phases 3, 7, 8)** : traitement vivant (anneau de progression du jour, créneaux Matin/Midi/Soir ✔ pris · ● maintenant · ○ à venir, validation animée persistée **localement**, pastille par forme, « Pourquoi ? » seulement si renseigné) ; Documents façon Fichiers (grille de cartes à miniatures colorées, aperçu dérivé du réel).
- **Vague C · Fil de santé + Mon Médecin + Mon Histoire (Phases 4, 6, 12)** : historique → fil façon Apple Fitness (regroupé par jour, phrases humaines) ; Mon Médecin (vue émotionnelle, coordonnées réelles seulement, **aucune fausse stat de temps de réponse**) ; Parcours Santé présenté comme un **livre** (kicker, lettrine, chapitres).
- **Vague D · Messagerie intelligente (Phases 5, 2, 14)** : messagerie patient **bidirectionnelle** (backend : `message_threads.category` medical/admin, endpoints patient d'envoi/lecture, le patient ne voit que SES fils) ; hub à **deux conversations** (médecin / secrétariat) ; conversation **façon iMessage** (bulles, identité + signature du médecin, séparateurs de jour, saisie en verre) ; **Conversations intelligentes** : bouton « Transmettre au médecin » après chaque réponse de l'assistant, qui joint la question + le contexte (traitement). Réactions/épinglés/recherche laissés au backlog (pas de faux boutons).
- **Vague E · Journal, Check-in, Rappels, Famille (Phases 15, 13, 10, 11)** : ⭐ **Journal de santé** (humeur du jour + note, évolution 14 j colorée par ressenti — « MediAI met en valeur votre ressenti, pas seulement vos analyses ») ; **Check-in** avant consultation (curseurs douleur/fatigue/sommeil + constantes, transmis au médecin via la messagerie) ; **Smart Reminder** (rappels calmes groupés Ce soir / Demain / Prochainement, dérivés du réel) ; **Mode Famille** (sélecteur de profils façon Apple Family, proches en démo). Journal & Check-in **stockés uniquement sur l'appareil** (localStorage).
- **Décisions produit** (données de santé sensibles → règle d'or HDS) : Journal Santé + Check-in = **démo locale** ; Mode Famille = **sélecteur de profils démo**. Vraie architecture serveur + comptes liés/mineurs → **[ADR-009 & ADR-010](17_ADR.md)**.
- **Périmètre assumé** : messagerie — réactions/épinglés/recherche non simulés (backlog) ; check-in — photos non implémentées (HDS).
- **Vue médecin branchée** (`app.html`) : la messagerie du cockpit affiche la **catégorie** (🩺 Médical / 🗂️ Secrétariat), signale et met en forme les **check-ins reçus** ; l'alerte des nouveaux messages patient était déjà assurée par le compteur non-lus. **Non branché volontairement** : l'évolution du ressenti (Journal Santé) reste locale à l'appareil du patient (ADR-009) — visible côté médecin seulement après stockage serveur post-HDS.

## [Non publié] — Sprint 19 · Trust & Polish — 2026-08-02

Sprint 100 % qualité & crédibilité de marque (aucune fonctionnalité métier). Site `mediai-site`.

- **Phase 1 · Logo & favicon** : logo officiel recréé en **SVG vectoriel** (`/logo.svg`, transparent, net, swap-ready) — header/footer de la landing + **favicon sur toutes les pages** (app, patient, admin, trust, marketing) ; brand `trust.html` migré du carré ✦ vers le logo. *(Wordmark **« MediAI » sans accent — décision confirmée** ; le logo fourni portait « MédiAI » mais on conserve la graphie du domaine/produit.)*
- **Phase 2 · Navigation** : nav **5 items unifiée** sur toutes les pages (Produit · Fonctionnalités · Tarifs · Ressources · Entreprise + « Demander un accès »). « Fonctionnalités » pointe vers la démo `/#essayer` (fin du doublon avec « Produit » → `/#comment`).
- **Phase 3 · Alignement** : étoile « Nous simplifions le quotidien » (chemin SVG asymétrique) **recentrée** (tracé symétrique).
- **Phase 4 · Tarifs façon Apple** : cartes plus respirantes (gap 22px, padding 32/26px), **un seul CTA bleu dominant** (Pro, le plan populaire) — « Commencer gratuitement » passe en soft ; CTA Enterprise « Sur devis » → **/enterprise** (page devis). 4 cartes hauteur identique, CTA alignés en bas et pleine largeur (vérifié DOM).
- **Phase 5 · Enterprise** : page **/enterprise** (formulaire de devis complet) + endpoint **`POST /api/enterprise-quote`** (Resend → contactmediaifr@gmail.com, isolé et remplaçable par un CRM ; anti-spam ; aucune donnée patient).
- **Phases 6-9 · Pages** : footer refondu en 4 colonnes vers de **vraies pages** ; création de **/entreprise** (mission/vision/valeurs/contact/presse), **/ressources** (comment ça marche/FAQ/sécurité/nouveautés), **/legal** (mentions/confidentialité/CGU/cookies — honnête, sans inventer d'identifiants juridiques). Sur `site.css` partagé.
- **Phase 10 · Audit liens** : **tous** les `#footer` morts corrigés (0 restant) ; audit complet des `href` sur les 9 pages — toutes les ancres cibles vérifiées (ressources/legal/entreprise), aucune route morte (`cleanUrls`).
- **Phase 11 · SEO** : favicon SVG, données structurées **Organization** (JSON-LD), meta/OG cohérents par page.
- **Reste** : passe visuelle pixel sur le déploiement live (pane navigateur throttlé en session — layout tarifs validé par mesure DOM) ; décision wordmark MediAI/MédiAI.

## [Non publié] — Sprint 18 · Zero Click Medicine — 2026-08-02

« Le meilleur clic est celui qui n'existe plus. » MediAI prépare, organise et simplifie *avant* que le médecin n'agisse. Posture CPO + CTO. Audit préalable ([19_SPRINT18_ZERO_CLICK.md](19_SPRINT18_ZERO_CLICK.md)) : **~50 % du cahier existait déjà** (Focus Mode, Centre d'actions, timeline-narrative) → élevé/unifié plutôt que reconstruit (règle #4). Conflits signalés et résolus honnêtement (salle d'attente/multi-fenêtres/workspace/OCR → alternatives légères + ADR ; vraies données patient hors HDS refusées). **Sprint complet — 4 vagues livrées.**

**Vague A — Intelligence du dossier.**
- **⭐ Le Journal Clinique** : l'histoire du patient **en prose** (médecin), qui remplace la relecture de dizaines de comptes-rendus. Nouvel endpoint `GET /api/patients/:id/journal-clinique` (`CLINICAL_JOURNAL_PROMPT`, anonymisé avant/après, cache `clinical_journals`). Bouton « 📖 Journal clinique » du dossier → récit + **export Copier / Télécharger / Régénérer**. Badge « IA · à vérifier ».
- **AI Inbox** : le Centre d'actions devient une **boîte que le médecin vide** (Gmail-style) — items (résultats à vérifier, renouvellements, signaux) cochés un par un, « Tout marquer comme traité », état « Boîte vide 🎉 », « traité » persisté par jour. Langage couleur sémantique.

**Vague B — Le flux de consultation.**
- **Smart Queue** (vue « File du jour ») : rendez-vous du jour triés/colorés par complexité (🔴 complexe / 🟠 à surveiller / 🟢 simple), dérivée des signaux + résultats, badges ⚡📄. Déterministe.
- **Focus Mode « Terminer → patient suivant »** : le Mode Consultation enchaîne automatiquement sur le patient suivant de la file (sans retour manuel) ; fin de file → sortie auto.
- **Consultation Snapshot** : fiche visuelle de la dernière consultation (diagnostic, traitement, suivi, durée si présente, constantes), déterministe, champs jamais inventés.

**Vague C — Zéro perte, zéro friction.**
- **Auto-save universel** (`MediaiAutosave`) : tout champ `[data-autosave]` sauvegarde son brouillon en continu et le restaure s'il est vide. Branché sur la dictée de consultation (restauration à l'ouverture, effacement après génération). « Plus jamais un texte perdu. »
- **Dossier Patient 2.0 — bandeau fixe** : infos vitales sticky en tête du dossier (nom, âge, traitements, allergies si trouvées, dernière consultation, « Vigilance élevée »). Uniquement le réel — contact/urgence non stockés → non affichés.
- **Préchargement intelligent** : reporté en incrément dédié (modifie le chemin critique d'ouverture du dossier — à tester finement). → backlog #30.

**Vague D — Langage & entrée.**
- **Langage couleur sémantique** formalisé (bleu info · vert terminé · orange à vérifier · rouge urgent · violet IA) — appliqué (AI Inbox, Smart Queue, bandeau patient) et documenté ([04_DESIGN_SYSTEM.md](04_DESIGN_SYSTEM.md)).
- **MediAI Early Access** : section landing (programme fondateur, 100 places, perks + CTA vers le flux d'accès) — honnête (« données synthétiques tant que pas HDS » ; Discord/tarif/vote = décisions ops, non simulés).
- **ADR** : salle d'attente (texte, pas de photos, pré-HDS), multi-fenêtres (bascule récents/épinglés), workspace (masquer/réordonner, pas de drag-drop), documents intelligents (extraction structurée, OCR différé). → [17_ADR.md](17_ADR.md).
- **Barre supérieure** : déjà intelligente (recherche ⌘K · notifications · Copilote ⌘J · Journal « temps gagné ») → consolidation documentée, pas de refonte risquée du topbar.

## [Non publié] — Sprint 17 · The Intelligent Clinic — 2026-08-01

MediAI n'attend plus, il **travaille pour le médecin**. Posture CPO + CTO. Audit préalable ([18_SPRINT17_INTELLIGENT_CLINIC.md](18_SPRINT17_INTELLIGENT_CLINIC.md)) : **~60 % du cahier existait déjà** (Copilote, signaux prédictifs, Smart Timeline, pré-consult, dossier vivant) — décision de CPO d'**élever/unifier** plutôt que reconstruire (règle #4). Conflits signalés et résolus honnêtement (temps gagné = estimation transparente ; PDF = périmètre synthétique ; mobile = passe responsive réaliste). **Sprint complet — 4 vagues livrées.**

**Vague A — ⭐ Copilote omniprésent.** Unifie le Copilote dossier (IA) et l'Assistant dashboard (déterministe) en **un** copilote joignable partout : lanceur flottant + **⌘J** sur toutes les vues. Mode **cockpit** (hors dossier) → exploitation de la journée en déterministe instantané (« prépare mon après-midi », examens arrivés, renouvellements, priorités) ; mode **dossier** → IA anonymisée. Badge « IA · à vérifier » partout. Aucune nouvelle dépendance backend.

**Vague B — Temps & friction.**
- **Journal du cabinet** (nouvelle vue) : « Ce que MediAI a fait pour vous » — activité **réelle** par période (jour/7j/30j, `GET /api/journal` sur `medical_events`) + **temps gagné en estimation transparente** (hypothèses minutes/type affichées, étiqueté « non mesuré »).
- **Quick Actions** : menu rapide sur la carte patient (Ouvrir · ✦ Demander au Copilote · Préparer) — agir sans ouvrir le dossier ; « Demander au Copilote » ouvre dossier + Copilote en un geste.

**Vague C — Intelligence visuelle.**
- **Health Graph** (bouton « 🗺️ Graphe » du dossier) : carte mentale radiale — patient au centre, branches par type (consultations, ordonnances, analyses, imagerie, courriers, traitements) reliées, avec éléments récents. 100 % déterministe, « aide à la lecture, jamais un avis médical ». Repli mobile en colonne.
- **Smart Calendar & extraction documentaire** : servis par l'existant (`PRE_CONSULT_PROMPT`, `LAB_/IMAGING_STRUCTURING_PROMPT`) — non reconstruits (règle #4) ; l'import « n'importe quel PDF » reste hors périmètre tant que l'infra n'est pas HDS.

**Vague D — Cockpit & companion.**
- **⭐ Mission Control** : le Command Center devient Mission Control — section **« Intelligence artificielle · usage réel »** (tokens consommés, appels IA, répartition par source) via `GET /api/admin/ai-stats` (agrégats **réels** de `tokens_used`, aucune donnée personnelle) + rafraîchissement léger de la santé système. Entrée sidebar médecin renommée.
- **Patient Companion** : digest du jour en une phrase humaine sur l'accueil patient (traitement / prochain RDV / nouveau document), faits réels, sans interprétation.
- **Workspace adaptatif** : indice contextuel selon l'heure sur le tableau de bord médecin (matin/après-midi/soir).
- **Responsive médecin** : passe complète notée comme chantier dédié (l'app conserve ses points de rupture existants) — pas de fausse promesse de parité.

## [Non publié] — Sprint 16 · Project Renaissance — 2026-08-01

Changement de posture : d'un excellent prototype vers un **produit** pensé pour durer (posture CTO). Audit chiffré + feuille de route en vagues dans [15_SPRINT16_RENAISSANCE.md](15_SPRINT16_RENAISSANCE.md). Ligne rouge : **transparence non négociable** (jamais « HDS conforme », jamais un chiffre inventé). **Sprint complet — 4 vagues livrées.**

**Vague 0 — Design System v2 (fondation).**
- **`mediai-site/tokens.css`** devient la **source unique** des design tokens (palette, typo, spacing, radius, élévation, motion, composants + `:focus-visible`/`prefers-reduced-motion` partagés). Chargée par les 3 frontends.
- **Suppression du token legacy `--sage`** (195 occurrences → `--accent`). **`app.html`** consomme désormais entièrement `tokens.css` (`:root` local supprimé) ; correction au passage d'une circularité et du token **`--bg-secondary`** référencé mais jamais défini. Zéro régression visuelle (3 univers vérifiés).

**Vague 1 — Maturité produit (honnête).**
- **Trust Center** (`/trust`) : page publique investisseurs/CHU — hébergement, sécurité, chiffrement, RGPD, sauvegardes, disponibilité, incidents. Contenu **strictement honnête** (« HDS en cours », pas de SLA affiché, « aucun incident à ce jour »). Bâtie sur `tokens.css`.
- **i18n** (`i18n.js`) : mécanisme léger sans build (`data-i18n`, langue persistée, repli fr) ; **FR/EN** traduits sur le Trust Center (preuve), es/it en repli honnête.
- **Feature flags** (activation **sans redéploiement**) : table `feature_flags` (surcharges admin), `GET /api/flags` (public) + `PUT /api/admin/flags/:key` (admin), notion d'admin minimale et auditable (`ADMIN_EMAILS`, `isAdmin`, `requireAdmin`), helper client `flags.js`.
- **⭐ Command Center** (`/admin`, shell) : cockpit admin (portail réel via jeton médecin + `isAdmin`). Santé du système (ping réel), **UI de bascule des flags en direct**, **feuille de route** (badges), métriques produit « À instrumenter » (Vague 2 — jamais de faux chiffre).
**Vague 2 — Plateforme.**
- **Moteur de notifications** (`notif-engine.js`) : module déterministe partagé — priorité, déduplication, plafond, « non lus » persistants (jamais de bruit, jamais de donnée inventée). Intégré à l'app patient (accents de priorité, « Tout marquer comme lu », badge qui s'efface après lecture).
- **Command Center — santé réelle** via `/health` (version, base de données, conformité).
- **Cartographie de navigation** ([16_NAVIGATION.md](16_NAVIGATION.md)) : preuve de la règle des **2 clics** (⌘K médecin, tabbar+hub patient). **ADR** ([17_ADR.md](17_ADR.md)) : plugins (pas de runtime), observabilité (hooks d'abord), analytics (privacy-first), tokens.

**Vague 3 — ⭐ Command Center complet.**
- **Métriques produit RÉELLES** via `GET /api/admin/metrics` (admin) : compteurs agrégés (comptes, patients, documents par type, RDV) — aucune donnée personnelle. « Temps gagné » / feedbacks restent **« À instrumenter »** (ADR-003).
- **Entrée « Command Center »** dans la sidebar médecin, visible seulement si `isAdmin` **et** flag `command_center` actif — **consommation réelle d'un feature flag** (masquable sans redéploiement).
- **Décision CTO** : runtime de plugins/Marketplace, observabilité et analytics restent au stade **ADR/hooks** (pas d'infra spéculative ni de faux dashboards) — validé.

> ⚙️ **Action requise (config)** : définir `ADMIN_EMAILS` (emails séparés par des virgules) dans l'environnement du backend Render pour ouvrir l'accès au Command Center.

---

## [Non publié] — Sprint 15 · Patient Experience Revolution — 2026-08-01

Transformation de l'espace patient (`patient.html`) : de « portail » vers une **application santé du quotidien** qu'on garde sur son écran d'accueil (esprit Apple Santé). **Contrainte absolue : ne jamais modifier l'espace médecin — tout ce sprint ne touche que `/patient`.** Toujours 100 % de données réelles, jamais inventées ; placeholders honnêtes (« Bientôt ») en l'absence de données. **Sprint complet (15 étapes + signature).**

**Navigation** — nouvelle tabbar/sidebar **Accueil · Santé · Assistant · Documents · Profil**, avec un hub **« Santé »** (façon réglages Apple) regroupant Parcours, Rendez-vous, Traitements, Résultats, Historique, Évolution, Préparer et Santé connectée. Sous-vues rattachées à l'onglet parent ; cloche de notifications dans la topbar.

- **① Accueil « compagnon santé »** : tableau de bord santé — **❤️ État de santé** (statut de suivi + dernières constantes réelles), **📅 Prochain RDV** + **💊 Traitement du jour**, **📈 Mon suivi** (sparklines déterministes poids/tension/pouls, delta factuel).
- **② Assistant MediAI patient** : chat sur son propre dossier. Endpoint **`POST /api/patient/chat`** (`requirePatientAuth`, `PATIENT_CHAT_PROMPT`) — réponses uniquement depuis le dossier, anonymisé avant/après, vouvoiement, zéro diagnostic, renvoi vers le médecin. Bulles, suggestions, indicateur de saisie, barre d'input fixe.
- **③ Rendez-vous** : cartes riches (médecin + initiales, spécialité, statut, date/heure/durée, motif, lieu mode-aware) À venir / Passés + **« Ajouter au calendrier »** (.ics client).
- **④ Traitements** : depuis la dernière ordonnance — nom, posologie, rythme **matin/midi/soir** (parsé), durée, prescripteur ; notice/effets « à demander à votre pharmacien » (pas de base médicament).
- **⑤ Documents** : détail par document (contenu réel du dossier) + téléchargement `.txt` client. **⑥ Résultats** : analyses/imagerie avec valeurs, **normes et mentions « signalé » reportées telles que transmises par le labo** — aucune interprétation ajoutée + rappel « seul votre médecin établit le diagnostic ».
- **⑦ Préparer ma consultation** : prochain RDV + checklist « à apporter » (persistée) + rappel traitements + notes de questions. **⑧ Notifications** : centre dérivé des événements/RDV + cloche à badge. **⑨ Mon historique** : chronologie factuelle cliquable (complément du récit Parcours).
- **⑩ Profil** : en-tête avatar + accès Messagerie/Notifications/Santé connectée/Sécurité. **⑪ Santé connectée** : Apple Santé/Google Fit/montre — « Bientôt » honnête (rien n'est collecté tant que rien n'est relié). **⑫ Mon évolution** : graphes en aires déterministes (poids/tension/pouls) ; sommeil/activité/FC → « connecter un appareil ». **⑬ Sécurité & confidentialité** : **« Télécharger mes données »** (export JSON client, réel), partage/accès « Bientôt », note HTTPS sans surpromesse de conformité.
- **⑭ Expérience premium** : bannière proactive contextuelle sur l'accueil, haptics légers, `focus-visible`, `prefers-reduced-motion`. **⑮ Carte blanche** : une seule attention proactive (la plus utile du moment), 100 % dérivée des données ; nettoyage du code mort de l'ancien accueil.
- **⭐ Mon Parcours Santé** (fonctionnalité signature) : le dossier **raconté pour le patient** en langage clair — récit en chapitres façon frise premium + synthèse, skeleton, états vide/erreur, rappel « seul votre médecin établit le diagnostic ». Endpoint **`GET /api/patient/parcours`** (`requirePatientAuth`, `PATIENT_PARCOURS_PROMPT`) : anonymisation avant/après, cache `patient_parcours` régénéré au changement du dossier.

**Backend (mediai)** : 2 endpoints IA patient additifs (`/api/patient/parcours`, `/api/patient/chat`) + prompts dédiés + table `patient_parcours`. Réutilise l'infra existante (anonymisation, `callClaude`, `buildDossierContext`) ; **aucune modification du comportement médecin**.

---

## [Non publié] — Sprint 14 · The First Impression — 2026-07-30

Refonte **complète** de la page publique (`index.html`) pour créer une émotion (Apple / Linear / Arc / Nothing), sans casser l'architecture : tokens et palette officiels conservés, sélecteur de connexion Pro/Patient et redirection checkout préservés. Responsive desktop/tablette/mobile dès le départ, `prefers-reduced-motion` géré.

- **① Hero** épuré « Moins d'administratif. Plus de médecine. » + **MacBook animé** (un dossier qui se construit, curseur, parallax léger).
- **② Le temps retrouvé** : compteur animé au scroll 0 → 1 h 18 + chips (1/15/32 min).
- **③ Une consultation, trois étapes** · **④ Timeline interactive** (Consultation→Analyse→Ordonnance→Patient→Pharmacie→Suivi) · **⑤ Pourquoi MediAI** (3 convictions) · **⑥ Fonctionnalités progressives** au scroll (mockups CSS) · **⑦ Témoignages** (placeholders « à venir », jamais de faux témoignage).
- **⑧ Tarifs premium** (Pro agrandi + badge + hover) · **⑨ FAQ accordéon** · **⑩ Le futur** (6 features « En développement ») · **⑪ Footer 4 colonnes** + « Version 0.9.14 · Sprint 14 ».
- **⑫ Micro-interactions** discrètes (reveal au scroll + **fallback anti-FOUC**, hover, parallax) · **⑬ Perf/SEO** (OpenGraph/Twitter, `display=swap`, **zéro image externe** — mockups en CSS).
- **⑭ WOW « Essayer MediAI »** : démonstration **jouable** sur la page (Dicter → transcription animée → Générer → compte-rendu structuré « à vérifier »), **patient fictif**, sans compte ni vraie donnée.

---

## [Non publié] — Sprint 13 · Platform Experience — 2026-07-29

Expérience globale : page publique, point d'entrée unique, briefing + assistant, et pages plateforme préparant les prochains sprints. **Sprint complet.** Sans casser l'architecture ni la sidebar existante (au-delà des nouvelles entrées). Plusieurs points du cahier étaient **déjà livrés** (connexion Professionnel/Patient — Sprints 10e/11.6 ; briefing d'accueil — Sprint 12.1 ; carte patient proactive — Sprint 12.11 ; assistant dossier — Copilote Sprint 12.4). Note : pas de TypeScript dans MediAI (JS vanilla) ; « données simulées » réservées aux features **plateforme** (jamais des données patient inventées).

- **④ Carte patient** (finition) : accueil `patient.html` au format exact — « Votre prochain rendez-vous » (compte à rebours + date), « Votre traitement » (médicaments), « N'oubliez pas ». Factuel/déterministe.
- **⑤ Assistant dossier** (finition) : carte « Assistant MediAI » en tête du rail du dossier (colonne droite, distincte du Résumé) → ouvre le Copilote « Discuter avec le dossier ». `renderDossierAsstEntry`.
- **⑩ Audit final** : responsive vérifié (dashboard 2 colonnes → 1 en mobile, aucun débordement horizontal ; tarifs 4/2/1 ; pages plateforme auto-fit), syntaxe JS OK (app + patient), design system cohérent, animations/accessibilité intactes. Rappel : **pas de TypeScript** dans MediAI (JS vanilla).
- **③ Assistant MediAI** (dashboard médecin) : le tableau de bord passe en **deux colonnes** — briefing + modules à gauche, nouvel **« Assistant MediAI »** (rail droit sticky). Répond de façon **déterministe** aux intentions à partir des vraies données de la journée (`/api/cockpit`) : « Prépare ma journée » (synthèse + lien vers le dossier prioritaire), « examens arrivés », « ordonnances à renouveler », « patients à rappeler » (réponse honnête — pas de file), « Résume X » (ouvre le dossier + « ✦ Discuter »). Aucune donnée inventée ; intentions non couvertes → message de capacités. `renderDashAssistant`/`dashAsstAnswer`. Responsive < 1100px.
- **⑥⑦⑧ Pages plateforme** (`app.html`) : 3 nouvelles entrées sidebar (section « Plateforme ») + vues. **⑥ Centre d'actions** (Sparkles) — catégories au même endroit : Résultats & examens, Renouvellements, Notifications IA (**données réelles** `/api/cockpit`, cliquables) + « Bientôt » honnête pour Ordonnances à signer / Patients à rappeler (pas de faux patient). **⑦ MediAI Labs** (Flask) — 6 expérimentations, toutes « Bientôt disponible ». **⑧ Marketplace** (Puzzle) — 7 intégrations futures « Bientôt disponible ». `renderActionsCenter`/`renderLabs`/`renderMarketplace`.
- **① Section Tarifs** (landing `index.html`, `#pricing`) : 4 formules — Student (Gratuit), Start (39 €/mois), **Pro (99 €/mois, « Le plus populaire »)**, Enterprise (Sur devis). Après les fonctionnalités, avant le CTA/footer, cohérente avec le design system. Responsive 4/2/1.

---

## [Non publié] — Sprint 12 · Intelligence First — 2026-07-28

MediAI devient un **copilote clinique** : l'information vient au médecin. **Sprint complet (12/12 étapes)**, par étapes validées + déployées une à une ; plusieurs items élèvent l'existant (⌘K, centre de notifications, Mode Focus, récit clinique), d'autres sont vraiment nouveaux (Copilote conversationnel, Smart Search). Garde-fous IA tenus (anonymisation avant/ré-identification après, « à vérifier », rien d'inventé, rien stocké non-HDS) ; contraintes de données signalées honnêtement (médicaments : photo/observance/pharmacie ; patient : observance/questionnaire).

- **Étape 1 — Home briefing quotidien** : le tableau de bord ouvre sur un briefing (compréhension en 15 s) — accueil + **« Aujourd'hui »** (compteurs réels : consultations, urgences potentielles = priorités importantes, ordonnances à renouveler, résultats arrivés) + **« ✨ Priorités IA »** (top 3 signaux nom + raison, ⚠ rouge si important, « à vérifier ») + **« Continuer ma journée ↓ »** vers les modules de travail. Module « Patients à voir » retiré (doublon des Priorités IA). 100 % `/api/cockpit`, aucune donnée inventée (compteurs adossés à de vraies données uniquement).
- **Étape 6 — Vue Traitements structurée** : carte « Traitements » dans le dossier (sous les signes vitaux), d'après la dernière ordonnance — médicament · posologie · durée · statut de renouvellement (En cours / proche / à renouveler) + **vérification d'interactions** (endpoint existant, résultat inline, « pas un avis pharmaceutique »). `renderPatientTreatmentsCard`/`checkPatientInteractions`. **Transparence** : photo / observance / pharmacie NON gérées (données inexistantes) — signalé, pas inventé.
- **Étape 10 — Détails premium** : peaufinage ciblé et natif (l'Étape 9 du Sprint 11 couvrant déjà modales/skeletons/hover) — entrée en **cascade** du dossier à l'ouverture (header → contenu → rail, fondu + montée, une fois par ouverture) ; **scrollbars fines** et discrètes sur les panneaux (Copilote, notifications, Mode Consultation, ⌘K, menus). Gated `prefers-reduced-motion`.
- **Étape 5 — Timeline enrichie (dépliage au clic)** : au clic, l'événement se déplie **inline** — détail structuré par type (consultation : motif/diagnostic/constantes/traitements/suivi ; ordonnance ; courrier ; analyses ; imagerie) + bouton « Ouvrir le détail complet » vers la modale. Chevron animé, dépliage fluide. Complète l'aperçu au survol (Sprint 10c) + les badges vivants (Étape 7). `tlToggleExpand`/`tlDetailHtml`.
- **Étape 11 — Patient App proactive** : l'accueil du portail patient (`patient.html`) devient un briefing — « Bonjour, [prénom] 👋 » + carte factuelle/déterministe (`renderPatientBriefing`) : prochain rendez-vous avec compte à rebours (aujourd'hui/demain/dans N jours), nombre de traitements en cours (factuel), nouveau résultat disponible (< 14 j). Rafraîchi au chargement + au polling temps réel. **Transparence** : « traitement bien suivi » (observance) et « questionnaire » non faits (données inexistantes).
- **Étape 9 — Mode Consultation (plein écran)** : le Mode Focus devient un vrai mode consultation — dictée seule à gauche (chrome masquée), **panneau de contexte permanent** à droite alimenté par le dossier du patient sélectionné : Points critiques (`computePatientSignals`, « à vérifier »), Traitements actifs (`deriveTreatments`), Dernières constantes, Historique récent. `renderConsultContext` (déterministe, cache d'événements). Panneau masqué < 1080 px. Rien d'inventé.
- **Étape 7 — Dossier vivant (badges timeline)** : la chronologie se signale d'elle-même — badge **« À revoir »** (pulsation douce) sur un résultat labo/imagerie récent (≤ 60 j) sans consultation postérieure ; badge **« À renouveler »** sur la dernière ordonnance dont la durée est écoulée. `computeTimelineFlags` (déterministe, calculé sur tout le dossier). **Transparence** : « carte rouge si anormal » non fait (pas de marqueur de normalité dans les données labo) ; « Nouveau depuis la dernière visite » non fait (horodatage par dossier requis).
- **Étape 2 — Command Palette ⌘K enrichie** : en plus de la recherche (dont le Smart Search) et de la navigation, le ⌘K propose les **actions de création** — Créer une ordonnance, Ajouter une analyse / imagerie / document, Note rapide, Générer un courrier, Inviter un patient (portail), Exporter en PDF. Réutilisent `openQuickCreate`/`withPatient` (routing identique à l'action bar, sélection de patient si besoin). État vide scindé Actions rapides / Aller à (`isNav`). « Créer un rendez-vous » écarté (pas de flux global propre).
- **Étape 8 — Centre de notifications = centre d'actions** : la cloche ouvre un centre d'**actions groupées** — bloc « Aujourd'hui » (compteurs) + sections cliquables par catégorie : 🛎️ Patients à regarder, 📈 Résultats à revoir, 💊 Renouvellements (badge Échue/Bientôt), 📅 RDV à venir, 🚫 Patients absents ; chaque ligne ouvre le dossier. « Activité récente » conservée en secondaire. Réutilise `/api/cockpit` + appointments (déterministe). **Transparence** : « interactions » / « CR à signer » écartés faute de file de données réelle (pas de fabrication). `ncRow`/`ensureNcStyles`.
- **Étape 3 — Smart Search inter-patients** : recherche clinique en langage naturel dans le ⌘K (« patients diabétiques », « hypertension non contrôlée »). Item **« ✨ Recherche clinique »** (tag IA) en tête ; `POST /api/search/interpret` (`SEARCH_INTERPRET_PROMPT`) traduit **la seule requête** (aucune donnée patient) en critères `{ termes, types, mois, annee }` (synonymes cliniques : HbA1c, metformine…), puis **filtrage déterministe en local** sur le cache d'événements (accents normalisés). Résultats groupés par patient, cliquables. `runSmartSearch`.
- **Étape 12 — Histoire clinique (signature MediAI)** : le récit clinique chronologique généré par l'IA (endpoint `timeline-narrative` existant, masqué au Sprint 10b) devient une **carte premium « ✨ Histoire clinique »** au-dessus de la chronologie. **Partageable** : ⧉ Copier (presse-papiers), ✉️ Courrier (intègre le récit dans l'éditeur de courrier — objet + corps confraternel pré-remplis, éditable, export PDF / email), ↻ régénérer (`?refresh=1`). Récit = données du dossier uniquement, « à vérifier ». `narrativeToCourrier`/`copyNarrative`/`refreshNarrative`.
- **Étape 4 — IA Conversationnelle « Discuter avec le dossier »** ⭐ : panneau latéral « Copilote » dans le dossier (bouton header **✦ Discuter**). Le médecin pose des questions, l'IA répond **uniquement à partir des données du dossier**. Backend `POST /api/patients/:id/chat` (`requireAuth` + `aiLimiter` + `enforceAiQuota`) : le message complet (contexte du dossier + historique + question) est **anonymisé d'un bloc** (`anonymize` + `buildKnownTerms` → aucun nom patient en clair vers Claude) → `callClaude` avec `DOSSIER_CHAT_PROMPT` (jamais d'invention, « le dossier ne le précise pas » si absent, non décisionnel, ≤ 6 lignes) → **ré-identification** (`deanonymize`). Chaque réponse porte **« ✦ IA · à vérifier · établi à partir des seules données du dossier »**. **Conversation non persistée** (aucune donnée patient stockée — règle HDS), isolée par patient. Quota IA partagé.

> En cours du Sprint 12. Prochaines étapes candidates : Home briefing (1), Smart Search inter-patients (3), timeline clinique partageable (12), et l'élévation de l'existant (⌘K actions, notifications, Mode Consultation). Étapes contraintes signalées honnêtement (médicaments : photo/observance/pharmacie sans source de données ; patient 2.0 : observance/questionnaire).

---

## [Non publié] — Sprint 11 · The Apple Experience — 2026-07-27

Élévation premium (Apple/Linear) : supprimer, hiérarchiser, respirer. Procédé par étapes validées + déployées une à une, sans casser l'existant. **Stack réelle assumée** : frontend HTML/CSS/JS vanilla (pas React/Next), backend Node/Express + PostgreSQL sur Render (pas Supabase) — l'Étape 10 « perf » vise donc le *ressenti instantané* (skeletons, rendu paresseux, cache), pas des Server Components.

- **Étape 1 — Dashboard médecin** : hero léger sur fond papier (accueil + une seule priorité IA « à vérifier » + 2 actions) remplaçant le bandeau navy massif ; 5 modules aérés en 2 colonnes — Agenda du jour · **Dernières consultations** (nouveau) · Patients à voir · Alertes · **Raccourcis** (nouveau). Branché sur `/api/cockpit` + `fetchAllEvents`, aucune donnée inventée.
- **Étape 4 — Cap IA strict** : les 3 blocs IA du dossier ne débordent plus — **Résumé** plafonné à 6 lignes (`-webkit-line-clamp`, texte complet en infobulle), **Points critiques / Actions** en lignes compactes (détail sur une ligne). Blocs gardés complets (max 4) pour ne jamais masquer un point critique en silence.
- **Étape 5 — Navigation** : sidebar réduite de **11 à 6 entrées**. Les 5 sous-onglets Documents (Comptes-rendus, Ordonnances, Courriers, Analyses, Imagerie) deviennent des filtres du hub Documents ; les appels historiques redirigés via `DOC_VIEW_ALIAS`.
- **Étape 8 — Design System v2** : échelle typographique en tokens (`--fs-2xs`→`--fs-2xl`), `--r-xl`, composants canoniques **`.badge`** (+ tons) et **`.input`/`.field`** (comme `.btn`). Adoption progressive (dashboard déjà migré). → [04_DESIGN_SYSTEM.md](04_DESIGN_SYSTEM.md).
- **Étape 6 — Authentification** : **front door unique** — ouvrir `/app` en accès direct (non connecté, sans `?mode`) affiche d'abord le sélecteur « Bienvenue sur MediAI · Professionnel / Patient » (`openEntrySelector`/`chooseEntry`) ; Patient → redirection `/patient`, aucune URL technique perçue. Bouton **« Continuer avec Apple »** posé dans l'écran de connexion en état honnête « bientôt » (`appleSignInPending` — activation en attente des identifiants Apple Developer, prérequis au [14_BACKLOG.md](14_BACKLOG.md)). Google déjà fonctionnel (init fiabilisée) vérifié.
- **Étape 7 — Liaison patient ⇄ médecin (quasi temps réel)** : le portail patient (`patient.html`) se rafraîchit en douceur pendant qu'il est ouvert (polling léger 45 s + à chaque retour d'onglet, pause quand l'onglet est masqué). Quand le médecin partage un nouveau document / RDV / message, le patient le voit **quasi immédiatement** — liste re-rendue + toast discret (« Nouveau document de votre médecin »). Honnête sur la stack actuelle (pas de websockets → polling, cohérent avec la philosophie perf de l'Étape 10). Fonctions `startPatientLive`/`pollPatientUpdates`/`pToast`.
- **Étape 9 — Micro-interactions** : entrée unifiée des modales `.modal-overlay` (fondu du fond + pop de la boîte), feedback de pression `.btn-export` — le tout gated `prefers-reduced-motion`. L'existant (skeletons, stagger, toasts, ⌘K) conservé.
- **Étape 11 — Nettoyage** : suppression du code mort (`renderIntelligentHome`, `computeDayFacts`, `renderDashboardSignals`, `ensureSignalStyles`, vues `doc-*` orphelines + `renderDocView`/`DOC_TYPES`, `generateDossierSummary`/`applyTimelineAnnotations` + carte de résumé, styles legacy `dash-stats`/`dash-today`/`dash-section-title`/`dash-recent-grid`, `.dsh-pill`). `app.html` : ~7050 → 6938 lignes, aucune régression (smoke test dashboard + hub + dossier).

> **Sprint 11 complet** (étapes 1-11). Seule dépendance externe restante : l'activation réelle d'« Sign in with Apple » (identifiants Apple Developer — bouton déjà posé, prérequis au [14_BACKLOG.md](14_BACKLOG.md)). Étape 10 (perf) assumée au niveau de la stack (ressenti instantané : skeletons, rendu paresseux, cache, polling patient) plutôt que Server Components/Supabase.

---

## [Non publié] — Sprint 10 · Patient Workspace Redesign — 2026-07-27

Refonte UX du dossier patient (app médecin) en workspace type Apple, lisible en moins de 10 s. Procédé par étapes validées + déployées une à une (Render inchangé, Vercel), sans casser l'existant. **100 % réutilisation des données existantes — aucune donnée patient inventée.**

- **10a — Header premium** : bandeau pleine largeur (avatar, nom, **badge état santé** Vigilance élevée / À surveiller / Rien à signaler, sous-ligne âge · médecin référent · traitements actifs · dernier RDV) + actions groupées à droite : **＋ Nouveau ▾** (Consultation / Ordonnance / Analyse / Document / Imagerie / Courrier), Accès patient, Partager, **•••** (Épingler, Notes). Supprime l'ancienne grille de 7 boutons dispersés + le hero dupliqué du cockpit.
- **10b — L'IA ne se répète plus** : 3 blocs distincts en tête — **Résumé** (récit du snapshot, marqué « ✦ IA · à vérifier »), **Points critiques** (vigilance + `computePatientSignals`, dédupliqués), **Actions proposées** (suivi + actions dérivées, boutons directs). Masque les surfaces qui doublonnaient (cockpit, carte snapshot, récit timeline, rail insights).
- **10c — Timeline Premium** : la chronologie remonte juste sous les blocs IA (cœur du dossier) ; **aperçu au survol** (popover flottant : type + date + titre + résumé + « Cliquer pour ouvrir → », suit le curseur, se cache au scroll, ne bloque pas le clic). Couleurs par type, filtres + compteurs, recherche intelligente et clic → ouverture directe : conservés.
- **10d — Mini-dashboard santé** : rangée de tuiles compactes façon Apple Health (Tension, Poids, FC, SpO₂, **IMC**) entre les blocs IA et la timeline — dernière valeur + micro-courbe dégradée + tendance neutre. 100 % déterministe (mêmes constantes que l'évolution). **IMC calculé uniquement si poids ET taille présents**, sinon « — · Taille non renseignée ».
- **10e — Sélecteur de connexion** (`index.html`) : « Se connecter » ouvre un choix **Professionnel de santé** (`/app?mode=login`) / **Patient** (`/patient`) — le patient ne voit aucune URL technique. Fermeture ×/backdrop/Escape, responsive, repli `href` sans JS.
- **10f — Nettoyage** : retrait du bouton secondaire « Résumé intelligent » (doublon du bloc Résumé) ; Notes générales + Documents importants repoussés en bas (secondaires). Docs mises à jour.

> Note dette : le mini-dashboard santé (glance) et la vue « Évolution des constantes » (détail) coexistent volontairement (complémentaires, non doublons). Voir [14_BACKLOG.md](14_BACKLOG.md).

---

## [Non publié] — Sprint 9 · Stabilisation / Premium UX / V1 — 2026-07-20

Sprint entièrement dédié à la qualité (procédé par étapes validées, sans casser l'existant). MediAI atteint le niveau d'une **V1 commercialisable**.

- **Étape 1 — Auth** : récupération de mot de passe (jeton JWT/email, sans table) + écrans forgot/reset, message login orienté action pour les comptes Google. Apple Sign-In reporté (infra Apple requise).
- **Étape 2 — Design system appliqué** : échelle `--space-1…8`, alias `--accent*`, bouton canonique `.btn`, normalisation transversale (rayon cartes `--r-lg`, focus champs) — aligner sans renommer.
- **Étape 3 — États chargement/vide/erreur** : `apiFetch`, `showErrorModal` réutilisable (réseau/introuvable/serveur) + **bandeau « Connexion perdue »** global.
- **Étape 4 — Uniformisation** : audit desktop+mobile (aucun débordement à 375px), rythme d'en-tête tokenisé, politiques icônes/responsive formalisées.
- **Étape 5 — Notifications + Recherche universelle** : centre de notifs élevé (tous types + **RDV à venir** réels) ; ⌘K universel (Patients + Documents tous types + Rendez-vous).
- **Étape 6 — Portail patient** : 8 sections (Accueil, Rendez-vous réel, Prendre RDV placeholder, Ordonnances/Résultats, Documents, Messagerie lecture seule, Profil) ; endpoints patient lecture seule ; correctif sidebar mobile.
- **Étape 7 — Accessibilité + perf** : `aria-live`, `role=dialog/alertdialog` + `aria-modal`, `aria-label` recherche ; appels clés via `apiFetch`.
- **Étape 8 — Dashboard** : conservé « Aurora » (déjà au niveau visé) ; clôture du sprint.

> Reporté honnêtement (hors périmètre d'une passe qualité) : Apple Sign-In, prise de RDV en ligne, externalisation des logos base64, extraction du monofichier — au [14_BACKLOG.md](14_BACKLOG.md).

---

## [Non publié] — Sprint 8 · Clinical Workspace — Lot 1 : module Ordonnance — 2026-07-20

L'ordonnance cesse d'être un document généré : c'est un **vrai module**, déployé (Render + Vercel).

### Ajouté
- **Backend** : l'ordonnance reste un `medical_event` type `ordonnance` **enrichi** (`status` brouillon/active/archivee/arretee, `prescriptions[]`, `date_debut`/`date_fin`, `signed_at`/`signed_by`, `renewed_from`, `version`, `history[]`). Endpoints `POST /api/patients/:id/ordonnances`, `PUT /api/ordonnances/:id`, `/sign`, `/renew`, `/stop`, `/duplicate`, `DELETE`. Helpers db `updateMedicalEventData` / `deleteMedicalEvent`. `createMedicalEvent` accepte une date d'événement.
- **Frontend** : éditeur d'ordonnance en modale floutée (`openOrdonnanceEditor`) — lignes éditables, brouillon → **Signer** (validation + verrouillage + horodatage + RPPS, **jamais** une signature électronique légale), **Renouveler en 1 clic** (ancienne archivée, historique conservé), Dupliquer, Arrêter, Exporter PDF, panneau Historique. Ouverture depuis la fiche et la timeline.
- **Transparence** : « Signer » n'est pas présenté comme une signature électronique qualifiée (eIDAS/CPS = chantier conformité séparé).

### Lot 2 — Action Bar + Quick Create + raccourcis (frontend)
- **Action Bar** flottante navy (toujours visible en app-mode, masquée en Mode Focus) : Consultation, Ordonnance, Analyse, Imagerie, Courrier, Note, Document, PDF, Partager — route vers les flux existants. **Quick Create** (`openQuickCreate`) + Note rapide en modale floutée. **Raccourcis clavier** : N/C/O/A/D, ⌘K (recherche), Esc (ferme la modale du dessus ; écran de connexion non-fermable).

### Lot 3 — Centre documentaire + Favoris (backend + frontend)
- **Backend** : table `favorites` (`item_type` patient|event, unique). `GET /api/favorites` (liste résolue) · `POST /api/favorites` (bascule, vérifie l'appartenance).
- **Frontend** : vue « Documents » (sidebar) — onglets par type + recherche **instantanés** + épingle par document ; section **Favoris** (patients + documents) ; bouton **★ Épingler** sur la fiche patient.

### Lot 4 — micro-interactions & performance (frontend)
- Pack `ensureMicroStyles` : focus-visible, press des boutons, entrées échelonnées (`mi-stagger`), scroll fluide, hover lift — neutralisés sous `prefers-reduced-motion`. Centre documentaire : **pagination « Voir plus »** (pages de 40).

---

## [Non publié] — Sprint 7 · Dossier médical intelligent — 2026-07-19

Le dossier patient devient un dossier médical intelligent (déployé).

### Ajouté
- **Backend** : table `patient_key_facts` (« À retenir » structuré) + `patient_evolution` (cache). Endpoints `POST /api/patients/:id/events` (événement manuel daté), CRUD `/key-facts`, `GET /evolution` (IA descriptive anonymisée, cachée, « à vérifier »). Prompt `EVOLUTION_PROMPT`.
- **Frontend** : 6 nouveaux types d'événements (hospitalisation 🏥, urgences 🚑, vaccination 💉, téléconsultation 📞, document 📄, analyse IA 🧬) ; rail **« À retenir »** éditable (allergies, maladies chroniques, antécédents, vaccins) + dérivé (traitements actifs, dernière hospitalisation) ; toggle **Chronologie / Évolution** ; **＋ Événement**. Filtres et recherche instantanés + récit IA par période conservés.

---

## [Non publié] — Sprint 6bis · Dashboard « Aurora » (refonte de la Home) — 2026-07-19

Refonte complète du dashboard, **supersède** le cockpit à widgets du Sprint 6 (déployé).

### Modifié
- La Home devient un **bandeau navy** (salutation, date, **une** priorité, phrase IA « à vérifier », 2 actions) + **4 cartes** (Agenda · Patients à regarder · Alertes · Recommandation IA). Namespace `.aur-*`, alimenté par `/api/cockpit`. Deux couleurs (navy/blanc), bleu en accent, sidebar polie. Bouton « Continuer avec Google » fiabilisé (retry GSI) et rendu proéminent. Résolution d'une collision de classes `.ckpt-*`.
- Les widgets Sprint 6 (modes, tâches, messages…) restent en code mais quittent la Home.

---

## [Non publié] — Nouvelle porte d'entrée : la landing premium devient l'accueil officiel — 2026-07-19

Frontend (`mediai-site`). Restructuration de l'entrée du produit, **sans perte de fonctionnalité** (l'application médecin est strictement inchangée). Vérifié en local (serveur statique + navigateur).

### Modifié
- **Suppression de l'ancien mini-site marketing intégré à `app.html`** (nav + hero « Racontez la consultation / Dictez votre consultation » + sections features/tarifs/footer). Cette « ancienne page » n'était pas un fichier séparé mais du markup affiché en mode déconnecté ; elle **n'apparaît plus**.
- **`/app` ouvre directement l'écran de connexion** (modal d'auth réutilisé, présenté plein écran, non refermable tant qu'on n'est pas connecté, avec lien « ← Retour à l'accueil » → `/`). Un jeton valide entre directement dans l'app (`enterAppMode`).
- **Paramètre `?mode`** : `/app?mode=login` (onglet connexion), `/app?mode=signup` (onglet création de compte).
- **Landing `index.html`** : « Se connecter » → `/app?mode=login`, « Demander une démo » → `/app?mode=signup` (liens relatifs, indépendants du domaine). Les autres liens restent des ancres internes.
- `README.md` (mediai-site) mis à jour (arborescence des routes).

### Inchangé (non-régression vérifiée)
- Coquille applicative (sidebar, cockpit, patients, consultation, IA, portail), logique d'auth (`submitAuth`/Google), retour Stripe (`/app?checkout=success`), voie d'abonnement (paywall quota) — tous préservés. `startCheckout()` conservé (le `#upgradeBtn` retiré n'y était pas utilisé).

### Route finale
`/` → landing premium · `/app` → connexion → application · `/patient` → portail. Flux : **Landing premium → Connexion → Application**.

---

## [Non publié] — Sprint 6 · MediAI Cockpit (Lots 1 & 2) — 2026-07-19

La Home devient le **cerveau de MediAI** : un cockpit où l'information vient au médecin (agenda, priorités, tâches, résultats, renouvellements, recommandations IA), personnalisable par modes. **Backend d'abord** — déployer le backend avant le frontend (le cockpit dégrade proprement si l'endpoint manque). Aucun commit (consigne de sprint).

### Ajouté — Backend (Lot 1)
- **Nouveau module métier `cockpit.js`** (fonctions PURES, déterministes, testées) : `computeCrossPatientSignals`, `computePrescriptionStatus` (moteur d'expiration d'ordonnance), `buildAgenda`, `buildRenewals`, `buildRecentResults`, `materializeSystemTasks`, `buildCockpitFacts`. Reproduit fidèlement la logique de signaux du frontend.
- **Nouvelles tables** (`db.js`, `initDb` idempotent) : `appointments` (rendez-vous), `tasks` (moteur de tâches, index unique partiel anti-doublon sur `source_ref`), `workspace_layouts` (workspace persistant), `message_threads` + `messages` (messagerie), `cockpit_briefings` (cache du récit IA).
- **Nouvelles API** : `GET /api/cockpit` (agrégat déterministe), `GET /api/cockpit/briefing` (récit IA caché, anonymisé, non décompté) ; CRUD `appointments`, `tasks` (+ `POST /api/tasks/sync-signals`), `workspace/layouts`, `threads`/`messages`. Toutes sous `requireAuth` + vérification `medecin_id`.
- **Prompt `COCKPIT_BRIEFING_PROMPT`** : ne reçoit QUE des faits agrégés anonymisés (tokens `[PATIENT_n]`), rend un récit + des **suggestions** (jamais de décision). `/health` → `2.7.0` (inchangé).
- **Tests** : `test/cockpit.test.js` (9 tests) — expiration, signaux, dédup, agrégats. Total : **29 tests** au vert.

### Ajouté — Frontend (Lot 2, `mediai-site/app.html`)
- La vue `dashboard` devient un **cockpit** : barre de briefing IA (« ✨ à vérifier »), **sélecteur de modes** (Cockpit / Consultation / Cabinet / Visite / Urgences), grille de **widgets** actionnables : Agenda du jour (+ création de RDV), Patients à regarder, Tâches (cocher / créer / « ↻ Signaux »), Résultats récents, Ordonnances à renouveler, Recommandations IA, Messages (fil compact), Activité récente.
- **Personnalisation légère** (Lot 2) : masquer/réafficher et réordonner les widgets, choix de mode — persistés en `localStorage`. Le drag & drop / redimensionnement / layouts serveur multiples arrivent au **Lot 3**.
- `renderDashboard()` réorchestré (cockpit) ; anciennes fonctions `renderIntelligentHome`/`renderDashboardSignals`/`computeDayFacts` conservées mais superséd­ées.

### Garde-fous (règle d'or tenue)
- Aucune donnée médicale inventée : agenda/tâches/messages = **saisis** ; priorités/renouvellements/résultats = **déterministes** ; récit IA = **suggestions anonymisées** marquées « à vérifier ».
- Additif et non destructif : auth, Stripe, génération de compte-rendu, fiche patient, portail **inchangés**.

### Reste (Lots 3 & 4)
- **Lot 3** : workspace drag & drop + redimensionnement + layouts serveur (`workspace_layouts` déjà prêt).
- **Lot 4** : inbox messagerie complète + activation côté portail patient ; capture des durées structurées d'ordonnance à la création (`duree_jours`/`renouvellements`) pour fiabiliser le moteur d'expiration.

---

## [Non publié] — Routage production : landing en page d'accueil — 2026-07-17

Frontend (`mediai-site`). Réorganisation domain-agnostic, déployée.

### Modifié
- **`index.html` = landing** (page d'accueil officielle) ; l'app déplacée en **`app.html` servie sur `/app`** ; portail sur `/patient`. URLs propres via `vercel.json` (`cleanUrls`).
- Boutons **Se connecter / Demander une démo** → `/app` en **liens relatifs** (indépendants du domaine).
- Retour de paiement **Stripe** ré-acheminé vers `/app` par un script en tête de landing — **aucune modification backend**.
- **`README.md`** d'architecture + procédure de bascule vers `mediai.fr` / `app.mediai.fr` sans changement de code.
- Vérifié en prod : `/` → landing (200), `/app` → app (200), `/patient` → portail (200), `/app.html` → 308 vers `/app`.

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
