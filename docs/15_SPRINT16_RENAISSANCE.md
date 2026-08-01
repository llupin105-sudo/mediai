# 15 — SPRINT 16 · Project Renaissance (audit & feuille de route CTO)

> **Changement de posture.** À partir du Sprint 16, MediAI n'est plus un prototype qu'on étend fonctionnalité par fonctionnalité : c'est un **produit** qui doit tenir dix ans et se justifier devant un CHU, un investisseur, YC ou Apple. Ce document est l'**audit** (Étape 1) et la **feuille de route** qui en découle. **Aucun code n'est écrit avant validation de cette analyse.**

Date : 2026-08-01 · Auteur : CTO (Claude) · Statut : proposé, en attente d'arbitrage.

---

## 1. Audit — état réel (chiffré sur le code, pas sur l'intuition)

### 🔴 Dette structurelle (à traiter en premier)

1. **Design System éclaté — pas de source unique de vérité.**
   Trois frontends (`index.html`, `app.html`, `patient.html`) redéfinissent chacun leur propre `:root`, avec des **vocabulaires de tokens divergents** :
   - `app.html` : `--accent / --clinical / --fs-* / --dur-* / --grad-*` (~40 tokens).
   - `patient.html` : `--paper / --navy / --r-lg / --pink / --violet` (~21 tokens).
   - `index.html` : encore un autre sous-ensemble.
   Un même composant n'a pas le même rendu d'un univers à l'autre. Le `04_DESIGN_SYSTEM.md` **existe mais n'est pas appliqué** : la doc a dérivé du code.

2. **`app.html` = 7 817 lignes, 320 `style=` inline, 197 `onclick=` inline.**
   Monofichier ingérable à terme, non testable, hostile à une CSP stricte. C'est le premier « ça ne tiendra pas dix ans ».

3. **Token legacy `--sage` : 192 occurrences dans `app.html`.**
   Héritage de l'ancienne identité verte, pointant aujourd'hui vers le bleu. Signal « amateur » visible pour quiconque lit le CSS.

### 🟠 Maturité produit

4. **Accessibilité sous WCAG AA.** `index.html` : **0 `focus-visible`, 0 `alt`** sur images, aria minimal → navigation clavier et lecteur d'écran défaillantes sur la vitrine. `patient.html` : aria/role faibles.
5. **Sécurité front — CSP impossible.** 241 `onclick` inline (app + patient) imposent `unsafe-inline`. Une CSP stricte (attendue par un CHU/DPO) exige de sortir les handlers du HTML.
6. **Pas d'i18n.** Toutes les chaînes sont en dur dans le HTML/JS. L'externalisation manuelle de ~10 000 lignes est un chantier lourd.
7. **Aucune instrumentation.** Pas de logs structurés, monitoring, analytics, error tracking, ni table `licences`/`users` exploitable pour des métriques produit.

### ✅ Ce qui est déjà sain (à préserver, ne pas casser)

- **Transparence conformité correcte** : la landing affiche « Conforme RGPD / **HDS en cours** » et « aucune vraie donnée patient tant que l'infra n'est pas conforme ». **À ne jamais transformer en surpromesse.**
- **Backend robuste** : JWT fail-closed, rate limiting (global/auth/IA), CORS, anonymisation avant/après IA, sous-traitants isolés dans `services/`, `Dockerfile` prêt HDS.
- **Deux univers UX cohérents en interne** (médecin dense / patient rassurant), IA non décisionnelle, règle d'or « jamais de donnée inventée » tenue.

---

## 2. Arbitrages de CTO sur le cahier des 15 étapes

Le cahier est ambitieux et juste sur la **direction**. Mais tout construire d'un bloc serait une erreur de CTO : plusieurs items sont **prématurés** pour le stade actuel (pré-HDS, zéro utilisateur réel, stack HTML vanilla sans build) ou **risqueraient la règle de transparence**. Décisions :

| Étape | Décision CTO | Raison |
|---|---|---|
| ① Audit | ✅ **Fait** (ce document) | — |
| ② Design System | ✅ **Construire en premier** | Fondation de tout le reste ; supprime la dette #1-3 |
| ⑩ Accessibilité AA | ✅ **Construire tôt**, avec ② | Dette réelle, exigée par CHU/investisseur |
| ⑬ Feature Flags | ✅ **Construire** | Cheap, à forte valeur, débloque le reste |
| ⑧ Trust Center | ✅ **Construire, honnête** | Utile investisseurs — **mais « HDS en cours », jamais « conforme »** |
| ⑫ Roadmap (page admin) | ✅ **Construire** | Alimente le Command Center |
| ⑦ i18n | 🟡 **Mécanisme + preuve sur 1 surface**, pas de retrofit total | Retrofit de 10 000 lignes = coût élevé, valeur différée (pas d'international avant HDS) |
| ④⑤⑥ Navigation / IA partout / Notifs | 🟡 **Améliorer l'existant**, ne pas réécrire | La nav médecin et l'IA fonctionnent déjà (⌘K, copilote, signaux) |
| ③ MediAI OS / plugins / Marketplace | 📐 **ADR (doc d'architecture) + points d'extension légers**, PAS de runtime de plugins | Construire un moteur de plugins avant product-market fit = sur-ingénierie |
| ⑨ Observabilité · ⑪ Analytics | 📐 **Architecture + hooks minimaux**, PAS de faux dashboards | La donnée n'existe pas encore ; l'inventer violerait la transparence |
| ⭐ Command Center | ✅ **Construire sur données RÉELLES + placeholders honnêtes** | Cockpit admin : vraies infos (roadmap, flags, git, comptes DB) ; « à instrumenter » ailleurs |
| ⑮ Carte blanche | ✅ **En continu** | Tuer `--sage`, sortir les handlers inline, cohérence |

**Ligne rouge de transparence (non négociable) :** ni le Trust Center, ni le Command Center, ni les Analytics n'afficheront un chiffre inventé ou une conformité non atteinte. Là où la donnée n'existe pas : « à instrumenter / en cours », jamais un faux nombre.

---

## 3. Feuille de route en vagues

**Vague 0 — Fondations (la vraie dette).**
`docs/16_DESIGN_SYSTEM_V2` = source unique de tokens (palette, type, spacing, radius, elevation, motion, icônes, composants) → un fichier `tokens.css` partagé par les 3 frontends. Suppression de `--sage`. Passe accessibilité AA (focus, alt, contrastes, clavier). *Livrable qui fait gagner tout le reste.*

**Vague 1 — Maturité produit honnête.**
Feature Flags (module runtime) · Trust Center (honnête) · page Roadmap admin · mécanisme i18n + preuve.

**Vague 2 — Plateforme & intelligence (sur l'existant).**
Cartographie de navigation (règle des 2 clics) · IA comme couche discrète · moteur de notifications (pertinence, jamais de bruit).

**Vague 3 — ⭐ Command Center.**
Le cockpit admin, alimenté par les briques réelles des vagues précédentes + placeholders honnêtes.

**Hors-code pour l'instant (ADR uniquement) :** runtime de plugins/Marketplace, pipeline analytics, stack d'observabilité. On documente l'architecture cible et on pose des points d'extension, on ne construit pas de l'infra spéculative.

---

## 4. Règle permanente (à partir du Sprint 16)

Avant chaque sprint : **audit rapide auto + proposition des priorités**. Toute demande en conflit avec la qualité, la sécurité ou la cohérence est **signalée avec une meilleure alternative**, pas exécutée aveuglément. Le CTO est garant de la qualité, pas un exécutant.
