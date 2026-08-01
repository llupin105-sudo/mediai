# 17 — ARCHITECTURE DECISION RECORDS (ADR)

> Décisions d'architecture structurantes, datées et justifiées. Un ADR fige un **choix** et son **pourquoi**, pour qu'un futur développeur (ou investisseur) comprenne l'intention sans archéologie. Sprint 16 : on documente l'architecture cible de ce qui est **prématuré à construire**, et on pose des points d'extension légers plutôt que de l'infra spéculative.

Statuts : `accepté` · `proposé` · `remplacé`.

---

## ADR-001 — Extensibilité : pas de runtime de plugins avant le product-market fit
**Date :** 2026-08-01 · **Statut :** accepté

**Contexte.** Le cahier du Sprint 16 imagine MediAI comme une plateforme (modules, plugins, Marketplace, partenaires). La tentation est de construire un moteur de plugins générique.

**Décision.** **Ne pas** construire de runtime de plugins ni de Marketplace fonctionnel maintenant. À la place :
- **Points d'extension déjà en place** : couche `services/` (sous-traitants isolés), `feature_flags` (activation par capacité, sans redéploiement), conventions de modules front (`tokens.css`, `i18n.js`, `flags.js`, `notif-engine.js` — petits modules autonomes chargés par `<script>`).
- La Marketplace reste une **vitrine « Bientôt »** (honnête), pas un runtime.

**Conséquences.** On évite de figer une API de plugins avant d'avoir des partenaires réels (coût de maintenance élevé, risque de sur-ingénierie). Quand un premier intégrateur existera, on définira le contrat minimal à partir de son besoin réel. **Révision** : dès le premier partenaire signé.

---

## ADR-002 — Observabilité : hooks minimaux d'abord, stack complète différée
**Date :** 2026-08-01 · **Statut :** accepté

**Contexte.** Un produit « qui dure » a besoin de logs, monitoring, traçage, alertes. Mais il n'a encore ni utilisateurs réels ni volumétrie.

**Décision.** Poser les **hooks minimaux** utiles tout de suite, différer la stack lourde :
- **En place** : endpoint **`GET /health`** (statut, version, état base de données, `hds_compliant`, `data_policy`) — consommé en direct par le **Command Center** (santé système réelle). Journaux d'audit (`audit_logs`) et `requestId` déjà présents.
- **Cible différée** : logs structurés (niveau/JSON), métriques (latence, taux d'erreur), traçage distribué (OpenTelemetry) et alerting — à brancher quand le trafic le justifie, via l'infra managée (Render/Vercel) sans réécriture applicative.

**Conséquences.** La santé système est **réelle et honnête** dès aujourd'hui, sans tableau de bord vide. On n'installe pas une usine à métriques avant d'avoir des métriques. **Révision** : à la première mise en production avec de vrais cabinets (post-HDS).

---

## ADR-003 — Product analytics : privacy-first, jamais de donnée personnelle
**Date :** 2026-08-01 · **Statut :** accepté

**Contexte.** On veut mesurer la valeur (temps gagné, fonctionnalités utilisées, consultations/ordonnances/documents produits) — sans jamais trahir la confidentialité, ni afficher de faux chiffres.

**Décision.**
- **Principe non négociable** : aucune donnée personnelle ni patient à des fins de mesure. Uniquement des **compteurs anonymes agrégés** (ex. « nombre de comptes-rendus générés »), jamais de contenu clinique.
- **Schéma d'événements cible** : `{ event, ts, count }` agrégé côté serveur ; pas de traceur tiers, pas de cookie marketing.
- **Command Center** : les indicateurs produit restent affichés **« À instrumenter »** tant qu'ils ne sont pas réellement mesurés. **Jamais** de nombre inventé (règle d'or de transparence).

**Conséquences.** La page métriques est honnête (vides déclarés vides). L'instrumentation se branchera sur des compteurs serveur simples quand le besoin sera réel. **Révision** : quand une décision produit exigera une mesure précise.

---

## ADR-004 — Design tokens : source unique partagée (rappel)
**Date :** 2026-08-01 · **Statut :** accepté

**Décision.** `mediai-site/tokens.css` est la source unique des design tokens, chargée par les 3 frontends. Interdiction de redéfinir un token en `:root` local (sauf override de surface documenté). Détail : [04_DESIGN_SYSTEM.md](04_DESIGN_SYSTEM.md). **Conséquence** : fin de la dérive visuelle inter-surfaces ; tout nouveau composant est cohérent par construction.
