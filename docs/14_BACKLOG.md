# 14 — BACKLOG

Dette technique, améliorations et idées **non planifiées**. Ce fichier remplace les anciens `bugs/` et `decisions/` vides. Ce qui est planifié vit dans [11_ROADMAP.md](11_ROADMAP.md).

Légende priorité : 🔴 élevée · 🟠 moyenne · 🟢 faible.

---

## Dette technique

| # | Priorité | Sujet | Détail |
|---|---|---|---|
| 1 | 🔴 | Conformité HDS | Bloqueur avant vrais patients. Voir [10_SECURITY.md](10_SECURITY.md). |
| 2 | 🟠 | `DROP TABLE compte_rendus` | Table legacy retirée du code ; exécuter le `DROP` manuel sur les bases existantes après vérification. → [07_DATABASE.md](07_DATABASE.md). |
| 3 | 🟠 | Quota = 2 crédits/consultation | Transcription + analyse consomment 2 crédits sur 3. Relever `FREE_LIMIT` ou exclure les endpoints légers. → [08_AI_SYSTEM.md](08_AI_SYSTEM.md). |
| 4 | 🟠 | Tokens `--sage*` mal nommés | Héritage de l'ancienne identité verte, pointent vers le bleu. Renommer en `--accent*`. → [04_DESIGN_SYSTEM.md](04_DESIGN_SYSTEM.md). |
| 5 | 🟠 | Échelle d'espacement non tokenisée | Introduire `--space-*` (échelle 4 px) dans le frontend. |
| 6 | 🟠 | Stockage de documents | PDF générés côté client, non stockés → timeline documents patient incomplète. Décider un stockage objet S3-compatible (aligné HDS). |
| 7 | 🟢 | Anonymisation des tiers | Noms de confrères cités sans civilité restent best-effort (nécessiterait un NER). |
| 8 | 🟢 | Rate limiting en mémoire | Passer à un store Redis en cas de scaling horizontal. |
| 9 | 🟢 | Pas de migrations versionnées | `initDb()` fait foi (ALTER idempotents). Envisager `node-pg-migrate` quand le schéma grandit. |
| 10 | 🟢 | Frontend monofichier | ~4000 lignes (médecin). Extraction en composants possible, non prioritaire tant que la vélocité reste bonne. |
| 11 | 🟢 | Couverture de tests | Base posée (anonymiseur, helpers, snapshot). Étendre vers les endpoints avec une base de test dédiée. → `test/`. |
| 12 | 🟠 | Coût du Patient Snapshot | Non décompté du quota : surveiller la consommation Claude (option : générer à la demande explicite pour le tier gratuit, ou débouncer). → [08_AI_SYSTEM.md](08_AI_SYSTEM.md). |
| 13 | 🟢 | Édition manuelle du Snapshot | Aujourd'hui régénéré (lecture seule côté médecin). Permettre au médecin d'épingler/corriger des éléments (« l'IA propose, il décide »). |
| 14 | 🟢 | Anonymisation du Snapshot | Utilise la tokenisation du nom (comme `resume-intelligent`), pas le pipeline `anonymize()` complet. Uniformiser si besoin. |
| 15 | 🟠 | Cockpit Lot 3 — Workspace | Drag & drop + redimensionnement + layouts serveur multiples. Backend `workspace_layouts` + API déjà prêts (Sprint 6 Lot 1) ; reste le frontend. |
| 16 | 🟠 | Cockpit Lot 4 — Messagerie | Inbox médecin complète + activation côté portail patient (`patient.html`). Fondations (`message_threads`/`messages` + API + widget compact) déjà en place. |
| 17 | 🟠 | Durées d'ordonnance structurées | Capturer `duree_jours`/`renouvellements`/`date_debut` à la création d'ordonnance pour fiabiliser `computePrescriptionStatus` (aujourd'hui : repli sur le texte libre via `parseDelayToDays`). |
| 18 | 🟢 | Coût du briefing cockpit | `GET /api/cockpit/briefing` appelle Claude (caché par signature des faits). Surveiller la consommation ; option debounce/à la demande pour le tier gratuit. |
| 19 | 🟢 | Cockpit desktop-first | La grille de widgets passe à 1 colonne < 900px mais reste pensée desktop. Confort tablette à affiner. |

---

## Améliorations produit (idées)

- **Différenciation visuelle du portail patient** (priorité UX, cf. [11_ROADMAP.md](11_ROADMAP.md)).
- Confort **tablette/mobile** de l'app médecin (aujourd'hui desktop-first).
- **Compte patient unique** multi-médecins.
- Recherche de praticien (fondations déjà dans `profile_specialite` / `profile_presentation`).
- Envoi automatique des identifiants portail au patient (email), une fois un fournisseur email UE en place.

---

## Décisions d'architecture (ADR — à consigner ici)

Format léger : quand une décision structurante est prise, l'ajouter ci-dessous (date · décision · raison · alternatives écartées).

- **2026-07-14 — Isoler les sous-traitants dans `services/`.** Raison : portabilité HDS (changer de fournisseur = 1 fichier). Alternative écartée : appels directs dans `server.js` (couplage).
- **2026-07 — Palette bleue** (remplace marine/sage/vert). Raison : identité plus claire et moderne. Impact : tokens `--sage*` conservés par compat (dette #4).
- **2026-07-17 — `medical_events` comme table polymorphe unique** (abandon de `compte_rendus`). Raison : chronologie unifiée, extensibilité.
- **2026-07-17 — Tests via `node:test`** (pas de framework externe). Raison : zéro dépendance, durable.
