# Sprint 24 — Patients · Calm Workspace

## Objectif
Repenser l'interface **Patients** (app médecin, `mediai-site/app.html`) vers une vue radicalement calme et premium (Apple × Linear × médecine) : en moins de 5 secondes, le médecin comprend **combien de patients il suit, qui nécessite son attention, et quoi faire ensuite**. UI/UX uniquement — aucune logique métier, API, auth, Supabase, Render ou Vercel modifiée.

## Avant
La page Patients était le **Patient Intelligence Workspace** du Sprint 21 : cartes denses (pulse, mini-timeline, relationship, tags, favoris), toolbar à 5 vues + collections + smart filters + recherche par tag, sélection multiple, fiche latérale au clic. Puissant mais **chargé** — l'inverse de la philosophie « calme ».

## Après
Une **liste de cartes horizontales**, une par patient, triées par priorité (action → surveiller → nouveau → stable) :
`● pastille · [initiales] · Nom / âge·sexe / état · Prochain RDV · Suivi · action recommandée · ›`
- **Header épuré** : « Patients · N patients · Vue simplifiée », une seule recherche, `🔔 ⚙ + Nouveau patient`.
- **Filtres calmes** (pills Apple) : Tous · À voir aujourd'hui (n) · Suivi actif · Nouveaux · À surveiller (n).
- **4 états seulement** : 🟢 Stable · 🟠 À surveiller · 🔴 Action recommandée · ⚪ Nouveau patient.
- **Barre de statut** discrète en bas : RDV aujourd'hui · Actions requises · À surveiller · Patients suivis, + « Voir le tableau complet → ».
- **Une seule interaction** : toute la card est cliquable → ouverture du dossier (`openPatientDetail`). Le détail (tags, timeline, documents…) reste dans le dossier — *progressive disclosure*.

## Décisions UX
- **Réutiliser la couche données du Sprint 21** (`piwBuildModels`/`piwState`) : les 4 états, le prochain RDV, les compteurs et l'ancienneté étaient déjà dérivés du réel. On ne refait que la **présentation** → zéro risque backend, zéro donnée inventée.
- **Progressive disclosure assumée** : le workspace riche du Sprint 21 n'est pas supprimé — il est accessible via « Voir le tableau complet → » (`piwToggleFullTable` / retour `piwBackToCalm`). Rien de perdu.
- **Moins d'éléments** : retrait de la vue principale des badges multiples, mini-timeline, tags, favoris, sélection multiple, emojis sur cards.
- **Hiérarchie typographique stricte** : Nom (fort) > âge·sexe (secondaire) > état (couleur) ; labels RDV/Suivi en capitales fines, valeurs en gras.
- **Responsive** : desktop = 7 colonnes ; < 760 px = pastille + avatar + identité + chevron (colonnes secondaires masquées, détail dans le dossier) — adaptation, pas écrasement.
- **Accessibilité** : cards `role="button"` + `tabindex` + activation clavier (Enter/Espace) + `aria-label` (nom + état), focus visible, l'état est aussi **textuel** (pas uniquement la couleur).

## Fichiers modifiés
- `mediai-site/app.html` — ajout d'une couche « calme » : `piwCalmToolbar`, `piwCalmCard`, `piwCalmFilteredModels`, `piwCalmStatusBar`, `piwSetCalmFilter`, `piwToggleFullTable`/`piwBackToCalm`, `ensurePcalmStyles` (styles `#pcalmStyles`). `piwRenderToolbar`/`piwRenderGrid` branchent le mode calme par défaut (`piwCalm=true`). **Aucune fonction Sprint 21 supprimée.**

## Tests
- Frontend statique : pas de `npm test` applicable (le test backend n'est pas concerné). Vérif JS : parsing OK.
- Manuel (données synthétiques) : liste patients ✓, 4 états dérivés + tri priorité ✓, recherche ✓, 5 filtres ✓ (À surveiller → 1), ouverture patient au clic/clavier ✓, toggle « tableau complet » ↔ « vue simplifiée » ✓, barre de statut ✓, responsive desktop + mobile 375 px ✓. Aucune régression (auth/API inchangés ; workspace riche préservé).

## Résultat
La page Patients répond aux 3 questions du sprint (qui regarder / qui nécessite mon attention / quoi faire) en un coup d'œil. Rouge = attention, action énoncée à droite, le reste est du blanc. Objectif « 5 secondes » atteint.

## Dette éventuelle
- « Suivi depuis » = ancienneté depuis la **première trace** (événement ou création) — cohérent mais peut différer de l'ancienneté réelle si des événements anciens manquent.
- Graphify `update .` / `query` non exécutés (CLI non disponible dans l'environnement — ni PATH ni npx).
- Sidebar : déjà simplifiée au Sprint 23 (primaires + « Plus ») ; la structure exacte du cahier (#3, raccourcis Messages/Alertes/Tâches chiffrés) n'a pas été refaite pour rester focalisé sur la page Patients et ne rien casser.

## Prochaine étape
Brancher les compteurs « Messages / Alertes / Tâches » de la sidebar sur les données réelles si on veut les afficher ; envisager de faire de la vue calme la référence et de retirer progressivement le tableau complet si l'usage le confirme.
