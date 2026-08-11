# Sprint UI — MediAI 2.0 (refonte premium)

## Objectif
Transformer l'app médecin (`mediai-site/app.html`) en expérience **premium, simple, fluide, très visuelle**, inspirée d'Apple. *Moins d'éléments, plus de hiérarchie, plus d'espace, plus de feedback visuel.* **UI/UX uniquement** — aucun changement backend/API/auth/Supabase. Réseau (structure/logique) non modifié, seuls ses détails responsive/cohérence sont retouchés.

Méthode : **incrémental, un item = un déploiement vérifié** (test local + non-régression Google à chaque fois).

---

## P0 — livré (7/7)

### #1 — Sidebar premium + logo (`7a57301`, `1ec2646`)
- **Logo corrigé** : PNG base64 (croix incorrecte) → **SVG inline** (tuile dégradé bleu→cyan `#1F6BFF→#12C6FF`, croix médicale discrète + étoile blanche centrée, 26px). Appliqué sidebar **et** écran de connexion (marque cohérente, fin du base64).
- **Drawer mobile** : suppression du hack `box-shadow` → scrim dédié `#sidebarScrim` (`backdrop-filter` blur, fermeture au clic extérieur), ombre propre. `toggleSidebar`/`closeMobileSidebar` synchronisent `body.sidebar-mobile-open`.
- États actifs/hover premium conservés, entrée **Alertes** avec indicateur discret.

### #2 — Floating Action Bar liquid glass (`a2347b5`)
- Barre du bas dense (9 boutons icône+texte, emojis) → **barre flottante icônes-seules** : Nouvelle consultation (primaire, dégradé) · Ordonnance · Note · Document · Analyse.
- **SVG uniquement** (zéro emoji), tooltip au survol (`data-tip`), liquid glass (`backdrop-filter blur(22px) saturate`), micro-scale au clic, `prefers-reduced-motion`.
- Responsive : centrée, tient dès 375px ; **safe-area** (`env(safe-area-inset-bottom)`) ; tooltips masqués au tactile.

### #3 — Recherche globale / Search Overlay ⌘K (`2bd8dbd`)
- La palette (`cmdk`) avait déjà saisie + suggestions + résultats catégorisés (Actions/Patients/Documents/RDV) + recherche clinique IA. Ajout du manque : **recherches récentes** (localStorage, max 6, icône horloge, bouton « Effacer »), enregistrées à l'activation (`cmdkActivate`), re-jouables au clic. État vide : **Récents · Suggestions · Aller à**.

### #4 — Page Aujourd'hui (`df6c85f`)
- Header épuré : retrait des deux boutons redondants (🔔 déjà topbar+Alertes ; ＋ Nouvelle déjà barre flottante). Un emoji de moins.
- **Recherche = composant majeur** (plus haute, arrondie, ombre, hover premium). Salutation « Bon après-midi Dr X 👋 » + date conservées.

### #5 — Consultations (dictée premium) (`ce7e9f1`)
- Dictée dynamique : **durée live** (MM:SS) + **Pause/Reprendre** (`MediaRecorder.pause/resume`) + waveform synchronisée.
- Génération : séquence **« ✦ MediAI analyse la consultation… »** avec 4 étapes cochées une à une (Motifs · Traitements · Antécédents · Points à vérifier) — purement visuel, aucun fait clinique inventé.
- Contexte récent déjà couvert par `prepBriefingCard`.

### #6 — Loading system global (`21a899f`)
- **Loader initial** `#bootSplash` : logo pulsant + wordmark + barre de progression + « Préparation… », plein écran, jamais de page vide. Disparaît (fade) dès que la session est résolue ; garde-fous `window.load` + timeout 5s.
- Skeletons shimmer déjà présents/réutilisés ; état IA déjà unifié (#5).

### #7 — Responsive + safe-areas (`821ef84`)
- **Fix débordement Réseau mobile** : `.rz-split`/`.rz-panel` en `1fr` (=`minmax(auto,1fr)`) → un enfant `nowrap` forçait 412px. Passé en **`minmax(0,1fr)`** + ellipsis. Overflow 73px → **0**.
- **Safe-areas iOS** : `env(safe-area-inset-top)` sur topbar/contenu/sidebar (barre flottante avait déjà l'inset-bottom).
- Vérifié : **0 débordement horizontal** sur dashboard/consultation/documents/ia-hub/réseau à **375** et **768px** ; layouts 2 colonnes (`piw-layout`@1000, `dash-grid2`@760, `rz-split`@860) repliés.

---

## P1 — livré (4/4)

### #8 — Patients (`2ce323d`)
Header du Calm Workspace épuré : retrait 🔔 + ⚙ ; « + Nouveau patient » dominant → bouton **« ＋ Ajouter »** discret (SVG) ; retrait de « Voir le tableau complet → ». Cartes inchangées (déjà visuelles, couleur = statut).

### #9 — Documents (`f8e0f5b`)
Lignes plus visuelles : **tuile de type colorée à icône SVG** (`docTypeVisual` : ordonnance/compte-rendu/analyse/imagerie/courrier/vaccin) + **avatar patient coloré** (`patientAvatarColor`) → identifie qui/quoi/quand/type d'un coup d'œil, zéro emoji.

### #10 — Alertes vs Notifications (`49e84d3`)
Séparation claire : **cloche = Notifications** (événements app), **sidebar « Alertes » = signaux médicaux** (icône triangle, **point rouge discret**). `openAlertes()` → Patients filtrés « à voir aujourd'hui » (état action + RDV du jour). Indicateur = `updateAlertesIndicator()` sur `cockpitState.data.priorites` réelles, jamais inventé. Cloche découplée.

### #11 — Paramètres → Control Center (`56188fc`)
Page pauvre → **Control Center groupé** (Compte · Sécurité & confidentialité · Préférences · Cabinet). Réel : Profil (`openProfileModal`), Intelligence MediAI (`openPreferencesModal`), Compte, Déconnexion. En préparation, étiquetés **« Bientôt »** (transparence, `settingsSoon` = toast) : Sécurité, Confidentialité, Notifications, Apparence, Cabinet & équipe. Icônes SVG colorées, zéro emoji.

## Reste (P2, non démarré)
- **P2** : micro-interactions transversales, polish visuel, animations, détails responsive.
- **Dette « no emoji »** : emojis résiduels dans « Accès rapides » (dashboard), icônes de la palette `cmdk`, quick-create, onglets IA Assist rapides — à nettoyer en P2.

## Garde-fous tenus
UI only ; auth Google / Stripe / API / Supabase intacts ; Réseau logique inchangée ; transparence (étapes d'analyse = processus, pas de fait inventé) ; non-régression Google vérifiée à chaque déploiement.
