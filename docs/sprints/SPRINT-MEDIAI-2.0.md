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

## P2 — livré (2/2)

### P2a — Nettoyage des emojis (`d11f0c1`)
Surfaces visibles converties en icônes SVG (cahier §1) : dashboard « Accès rapides » (mic/doc/étoile/stylo), chips IA Assist (calendrier/triangle/pilule/fiole), **palette ⌘K** (jeu `CIC` de 16 SVG : commandes + navigation + résultats patient/document/RDV/recherche). Palette 100 % sans emoji (vérifié).

### P2b — Micro-interactions (`aa92914`)
Feedback press (scale .99) sur les lignes/cartes cliquables non-boutons (`.dc-row`, `.pcalm`, `.settings-row`, `.cmdk-item`, `.dt-row`, `.td-row`, `.at-p`, `.rz-conv`) + transitions harmonisées, dans `ensureMicroStyles` (socle existant : focus-visible, press boutons, stagger). Neutralisé sous `prefers-reduced-motion`.

### P2c — Dette emoji : TL_TYPES → SVG (`770d7be`)
Le système d'icônes de type `TL_TYPES` (11 types) passe de l'emoji au **SVG** via helper `_ti` + classe `.tl-typ-ic` dimensionnée en **1em** : l'icône hérite automatiquement du `font-size` **et** de la couleur de chaque conteneur (`.tl-node` par type, `.tlh-ic` du hover, `fav-chip`, etc.) — **aucun des 8 consommateurs n'a été modifié**. Fallbacks `'📄'` → `TL_TYPES.document.icon`. Vérifié : timeline + favoris rendent les SVG à la bonne taille/couleur par type.

## Dette résiduelle (documentée, dispersée)
Emojis **one-off** restants, hors systèmes d'icônes cohérents (déjà convertis : Action Bar, palette `CIC`, documents `docTypeVisual`, `TL_TYPES`) : `NOTIF_META` (centre de notifications), icônes de résultats du cockpit (🔴🟠), `emptyState` (icône par défaut + ~15 appels), sélecteur « + Demander » du Réseau, quelques badges. Surface éclatée à faible valeur marginale → passe dédiée ultérieure si souhaité.

## ✅ Sprint MediAI 2.0 — COMPLET (P0 7/7 · P1 4/4 · P2 2/2)
Refonte premium livrée de bout en bout, incrémentale, chaque item déployé + vérifié (non-régression Google). Auth/API/Supabase/Réseau intacts, transparence tenue (« Bientôt » honnête, aucune donnée inventée).

## Garde-fous tenus
UI only ; auth Google / Stripe / API / Supabase intacts ; Réseau logique inchangée ; transparence (étapes d'analyse = processus, pas de fait inventé) ; non-régression Google vérifiée à chaque déploiement.
