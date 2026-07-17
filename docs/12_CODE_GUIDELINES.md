# 12 — CODE GUIDELINES

Comment écrire du code dans MediAI. L'objectif : qu'un nouveau contributeur (humain ou IA) produise du code cohérent avec l'existant, du premier coup.

---

## Principes

1. **Analyser avant de modifier.** Lire le code concerné et la doc pertinente avant d'écrire.
2. **Amélioration incrémentale.** Éviter les réécritures inutiles. Ne jamais casser une fonctionnalité existante (auth, Stripe, API, logique métier).
3. **Qualité > vitesse.** On construit une entreprise qui doit durer plusieurs années.
4. **Simplicité.** Pas de dépendance ni d'abstraction sans bénéfice clair. Le monolithe Express et le frontend sans build sont des choix assumés.
5. **Le code lit comme son voisinage.** Respecter le style, la densité de commentaires et les idiomes des fichiers alentour.

---

## Stack & conventions

| | Choix | Note |
|---|---|---|
| Langage | JavaScript (Node ≥ 18), CommonJS (`require`) | Pas de TypeScript pour l'instant |
| Backend | Express, `pg` (SQL brut, requêtes paramétrées) | Pas d'ORM |
| Tests | `node:test` (intégré) | Aucune dépendance de test externe |
| Frontend | HTML/CSS/JS vanilla, monofichier | Pas de framework, pas de bundler |
| Langue | **Français** : commentaires, messages d'erreur, libellés, noms métier | Cohérence produit |

### Backend
- **SQL** : toujours des requêtes **paramétrées** (`$1, $2…`), jamais de concaténation. Toute la couche DB vit dans `db.js`.
- **Sous-traitants externes** : uniquement via `services/`. `server.js` n'appelle jamais une API tierce en direct.
- **IA** : passer par `callClaude()` ; anonymiser avant, ré-identifier après (→ [08_AI_SYSTEM.md](08_AI_SYSTEM.md)).
- **Sécurité** : chaque route patient vérifie l'appartenance (`medecin_id`) ; ne jamais faire confiance à un id fourni par le client pour un accès patient.
- **Erreurs** : `try/catch` autour de l'I/O, log avec `requestId`, message utilisateur en français, **jamais** de donnée sensible dans le log.
- **Config** : toute variable passe par `process.env` et est documentée dans `.env.example`.

### Frontend
- Respecter le **[04_DESIGN_SYSTEM.md](04_DESIGN_SYSTEM.md)** : tokens sémantiques, Inter, `--btn-h`, mouvement tokenisé.
- Réutiliser les composants existants (→ [13_COMPONENTS.md](13_COMPONENTS.md)) avant d'en créer.
- Accessibilité : `:focus-visible`, `prefers-reduced-motion`.
- Ne pas dupliquer un composant médecin dans le portail patient.

---

## Vérifications avant de livrer

```bash
node --check server.js        # syntaxe backend
npm test                      # base de tests
```
Pour le frontend monofichier, vérifier la syntaxe du dernier bloc `<script>` avec `node --check`.

Checklist :
- [ ] `npm test` passe.
- [ ] Aucune fonctionnalité existante cassée (auth, Stripe, IA).
- [ ] Doc mise à jour si le comportement/schéma/API change (**doc = source de vérité**).
- [ ] `.env.example` mis à jour si une variable est ajoutée.
- [ ] Aucun secret ni donnée patient dans les logs ou le code.

---

## Git & sessions

- Commits en **français**, à l'impératif, décrivant le *pourquoi*.
- Branches : le travail backend/docs se fait sur une branche dédiée puis merge sur `main` (auto-deploy Render). Le frontend a son propre repo `mediai-site`.
- **Fin de session** : mettre à jour [03_PROJECT_STATE.md](03_PROJECT_STATE.md) et [CHANGELOG.md](CHANGELOG.md), proposer les prochaines étapes.

---

## Améliorations d'architecture

En tant que contributeur, proposer des améliorations de structure/doc/organisation est **encouragé** si elles rendent le projet plus robuste et maintenable. Les inscrire dans [14_BACKLOG.md](14_BACKLOG.md) plutôt que de les mener en douce au milieu d'une autre tâche.
