# 04 — DESIGN SYSTEM

> **Référence officielle du design MediAI.** Aucun composant ne doit être créé sans respecter ce document. Source d'implémentation : le bloc `:root` en tête de `mediai-site/index.html` (et son équivalent dans `patient.html`).

Identité actuelle : **claire, bleue, sans-serif intégral**, densité type Linear, chaleur type Notion. Le pivot vers le bleu (juillet 2026, chantier `phase-1bis-ui`) remplace l'ancienne piste « marine/sage/vert ».

---

## 1. Couleurs

### Palette de marque

| Token | Hex | Usage |
|---|---|---|
| `--navy` | `#0A1128` | Bleu Nuit — texte principal (`--ink`), fonds profonds, sidebar |
| `--blue` | `#1460FF` | **Bleu principal** — accent, CTA, liens, état actif |
| `--blue-light` | `#00C6FF` | Bleu clair — dégradés, touches vives |
| `--blue-tint` | `#E6F2FF` | Bleu très clair — fonds de surbrillance douce |
| `--green` | `#22C55E` | Vert succès |
| `--violet` | `#8B5CF6` | Violet — accent secondaire (données cliniques) |
| `--pink` | `#EC4899` | Rose — accent ponctuel |
| `--gray` | `#64748B` | Gris neutre |

### Rôles sémantiques (à utiliser en priorité sur les couleurs brutes)

| Token | Valeur | Rôle |
|---|---|---|
| `--paper` | `#F8FAFC` | Fond principal de l'application |
| `--paper-line` | `#E2E8F0` | Filets, séparateurs |
| `--card` | `#FFFFFF` | Surface des cartes |
| `--ink` | `var(--navy)` | Texte principal |
| `--ink-soft` | `#475569` | Texte secondaire |
| `--ink-faint` | `var(--gray)` | Texte tertiaire / métadonnées |
| `--sage` | `var(--blue)` | Accent principal (héritage de nom — pointe vers `--blue`) |
| `--sage-deep` | `#0D3EBF` | Survol de l'accent principal |
| `--sage-tint` | `var(--blue-tint)` | Fond d'accent |
| `--clinical` | `var(--violet)` | Accent secondaire |
| `--clinical-tint` | `#F1EDFF` | Fond d'accent secondaire |
| `--amber` / `--amber-tint` | `#F59E0B` / `#FEF3E2` | Alerte / avertissement |
| `--rose` / `--rose-tint` | `#EF4444` / `#FEE2E2` | Erreur / danger |
| `--green-tint` / `--green-deep` | `#DCFCE7` / `#15803D` | Succès (fond / texte) |
| `--tint-border` | `#C7DDFF` | Bordure sur fond bleu-tint |
| `--blue-tint-2` | `#D6E6FF` | Survol des fonds bleu-tint |

> ⚠️ **Dette de nommage connue** : les tokens `--sage*` datent de l'ancienne identité verte et pointent désormais vers le bleu. Ne pas introduire de nouvelles couleurs vertes « sage » ; à terme, renommer `--sage*` → `--accent*`. Voir [14_BACKLOG.md](14_BACKLOG.md).

### Dégradés

| Token | Définition |
|---|---|
| `--grad-primary` | `linear-gradient(135deg, var(--navy), var(--blue-light))` |
| `--grad-secondary` | `linear-gradient(135deg, var(--blue), var(--violet))` |

---

## 2. Typographie

- **Police unique : Inter** (`--sans`), avec repli `-apple-system, BlinkMacSystemFont, 'SF Pro Display/Text', sans-serif`.
- Identité **100 % sans-serif** : `--serif` et `--mono` pointent volontairement vers Inter (plus d'italique éditorial, plus de monospace). Les « labels » se différencient par la **casse majuscule + letter-spacing**, pas par une autre fonte.
- Corps de texte : `line-height ≈ 1.55`, `-webkit-font-smoothing: antialiased`.

---

## 3. Espacements

⚠️ **Il n'existe pas encore d'échelle d'espacement tokenisée** (`--space-*`). Les marges/paddings sont aujourd'hui ad hoc. **Recommandation officielle** : utiliser une échelle 4 px (4 / 8 / 12 / 16 / 24 / 32 / 48). La tokenisation est une tâche de [14_BACKLOG.md](14_BACKLOG.md) ; en attendant, s'aligner sur les valeurs existantes des composants voisins.

---

## 4. Rayons

| Token | Valeur |
|---|---|
| `--r-xs` | `4px` |
| `--r-sm` | `8px` |
| `--r-md` | `12px` (rayon des boutons) |
| `--r-lg` | `18px` |
| `--r-full` | `9999px` (pastilles, avatars) |

---

## 5. Ombres

| Token | Valeur | Usage |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(10,17,40,.05)` | Élévation minimale |
| `--shadow-sm` | `0 2px 8px rgba(10,17,40,.06)` | Cartes au repos |
| `--shadow-md` | `0 8px 20px rgba(10,17,40,.08)` | Survol, panneaux |
| `--shadow-lg` | `0 16px 40px rgba(10,17,40,.14)` | Modales, popovers |

---

## 6. Boutons (tokens dédiés)

| Token | Valeur |
|---|---|
| `--btn-h` | `42px` (hauteur unifiée de **tous** les boutons) |
| `--btn-radius` | `var(--r-md)` |
| `--btn-transition` | `background .16s, border-color .16s, color .16s, transform .1s, box-shadow .16s` |

---

## 7. Animations & mouvement

### Tokens de mouvement

| Token | Valeur | Usage |
|---|---|---|
| `--ease` | `cubic-bezier(.4, 0, .2, 1)` | Standard, naturel |
| `--ease-out` | `cubic-bezier(.22, .61, .36, 1)` | Sortie douce, **sans rebond** |
| `--dur-1` | `.1s` | Press / feedback immédiat |
| `--dur-2` | `.16s` | Hover / transitions courantes |
| `--dur-3` | `.24s` | Apparition de panneaux / cartes |

### Keyframes disponibles (dans `index.html`)

`fadeIn`, `fadeUp`, `dashIn` (entrée décalée des cartes dashboard), `emptyIn` (états vides), `skeletonShimmer` (chargement), `toastIn` / `toastOut`, `cmdkFadeIn` / `cmdkSlideIn` (palette ⌘K), `pulse-ring`, `blink`, `wave`.

### Règles

- **Discrétion** : translations ≤ 4 px, pas de rebond. Le mouvement guide, il ne distrait pas.
- **Accessibilité obligatoire** : tout mouvement doit être neutralisé sous `@media (prefers-reduced-motion: reduce)`.
- Toujours passer par les tokens `--dur-*` / `--ease*`, jamais des durées magiques en dur.

---

## 8. Accessibilité

- `:focus-visible` stylé sur tous les éléments interactifs (navigation clavier).
- `prefers-reduced-motion` respecté.
- Contrastes : viser AA (le texte `--ink` sur `--paper`/`--card` est conforme).

---

## 9. Responsive

- **App médecin** (`index.html`) : pensée desktop en priorité (usage station de travail). Sidebar réductible (250 px → 64 px avec tooltips). Le confort tablette/mobile est une amélioration ouverte ([14_BACKLOG.md](14_BACKLOG.md)).
- **Portail patient** (`patient.html`) : pensé **mobile-first** (tabbar bas d'écran, `padding-bottom` réservé). C'est le bon modèle pour un usage patient ponctuel.

---

## 10. Règles d'or

1. Toujours utiliser les **tokens sémantiques** (`--ink`, `--card`, `--sage`) plutôt que les couleurs brutes.
2. Une seule police : **Inter**. Différencier par le poids, la casse et le tracking.
3. Hauteur de bouton unique : `--btn-h`.
4. Mouvement discret, tokenisé, désactivable.
5. Deux univers distincts : ne pas transposer tel quel un composant médecin dans le portail patient (→ [09_PATIENT_SYSTEM.md](09_PATIENT_SYSTEM.md)).

L'inventaire des composants concrets est dans [13_COMPONENTS.md](13_COMPONENTS.md).
