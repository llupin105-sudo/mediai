# 05 — UX PRINCIPLES

Principes d'expérience de MediAI. Ils prolongent la [01_VISION.md](01_VISION.md) et encadrent chaque décision d'interface. Le « comment » visuel est dans [04_DESIGN_SYSTEM.md](04_DESIGN_SYSTEM.md).

---

## Principe fondateur

> **« Comment faire gagner du temps au professionnel de santé ? »**

Chaque écran, chaque interaction, chaque fonctionnalité doit répondre à cette question. Si la réponse est floue, on ne l'ajoute pas.

---

## Les 6 principes

### 1. Plus rapide que la méthode actuelle
Une action dans MediAI doit battre l'alternative (papier, autre logiciel, copier-coller). Si dicter puis corriger un compte-rendu n'est pas plus rapide que de le taper, on a échoué.

### 2. Compréhensible immédiatement
Aucun écran ne doit nécessiter de notice. Les libellés sont explicites, les états vides **guident** vers la première action (pattern `emptyState`), les erreurs disent quoi faire.

### 3. Deux univers, jamais identiques
- **Médecin** : dense, rapide, ergonomique, sans distraction — agréable après 8 h.
- **Patient** : rassurant, simple, aéré, ponctuel.
Un composant n'est jamais copié tel quel d'un univers à l'autre.

### 4. L'IA assiste, l'humain décide
Toute sortie d'IA est **modifiable**. On signale ce qui est *déduit / suggéré*. On n'affiche jamais une suggestion IA comme une vérité clinique. → [08_AI_SYSTEM.md](08_AI_SYSTEM.md).

### 5. Discrétion et confiance
Le mouvement guide sans distraire (≤ 4 px, sans rebond). Le luxe est *discret*, pas démonstratif. La transparence prime : ne jamais afficher une affirmation fausse (ex. « conforme HDS » si ce n'est pas vrai). → [10_SECURITY.md](10_SECURITY.md).

### 6. Ne jamais casser l'existant
Chaque évolution préserve auth, Stripe, API et logique métier. L'amélioration est incrémentale.

---

## Patterns de référence (déjà en place)

| Pattern | Rôle |
|---|---|
| **États vides guidés** (`emptyState`) | Transformer un écran vide en invitation à agir |
| **Skeletons shimmer** | Chargement perçu comme rapide, sans saut de layout |
| **Toasts** | Feedback non bloquant sur les actions |
| **Command palette ⌘K** | Navigation clavier rapide (public médecin) |
| **Signalement « déduit »** | Distinguer donnée saisie et donnée inférée par l'IA |

---

## Anti-patterns (à éviter)

- Ajouter une fonctionnalité « parce que les concurrents l'ont » sans gain de temps concret.
- Multiplier les options de configuration au lieu de choisir un bon défaut.
- Animations longues ou rebondissantes.
- Densité type médecin dans le portail patient (et inversement).
- Afficher une donnée IA sans possibilité de la corriger.
