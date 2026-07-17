# 03 — PROJECT STATE

> **État vivant du projet.** À mettre à jour à la fin de chaque session de travail significative. C'est le fichier qu'on lit pour savoir « où on en est ».

**Version produit :** 1.0 (préparation bêta interne)
**Dernière consolidation :** 2026-07-17 (Phase 0 — professionnalisation)

---

## Vue d'ensemble

- Le **backend est fonctionnel, stabilisé et sécurisé**.
- Le **frontend** (repo `mediai-site`) est en cours de polish premium (Phase 2).
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
- ⏭️ Sprint 3 — Ambient AI Consultation (dictée → CR/ordonnances/courriers/tâches en un clic) · Sprint 4 — Signaux & alertes · différenciation patient. → [11_ROADMAP.md](11_ROADMAP.md).

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
