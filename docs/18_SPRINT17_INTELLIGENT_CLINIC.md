# 18 — SPRINT 17 · The Intelligent Clinic (audit & plan CPO/CTO)

> **Philosophie : MediAI n'ajoute pas de fonctionnalités — il crée 10× plus de valeur avec les données déjà là.** Objectif ressenti : « je ne peux plus revenir en arrière ». Posture : CPO + CTO. Règle appliquée : auditer, prioriser par impact, corriger les incohérences, **ne jamais reconstruire ce qui existe si l'améliorer apporte plus de valeur**.

Date : 2026-08-01 · Statut : proposé.

---

## 1. Audit — ce qui existe déjà (ne pas reconstruire)

| Brique | Où | Décision |
|---|---|---|
| Copilote dossier (`openCopilote`) + Assistant dashboard (`dashAsstAnswer`) | `app.html` | **Unifier** en un Copilote omniprésent |
| Signaux prédictifs `computePatientSignals` | `cockpit.js` | **Étendre + remonter** dans le Copilote |
| Smart Timeline `timeline-narrative` | `server.js`/`prompts.js` | Polir |
| Pré-consultation `PRE_CONSULT_PROMPT` | `server.js` | Câbler au calendrier |
| Dossier vivant `patient_synthesis` (régen auto) | `db.js`/`server.js` | Déjà là |
| Extraction labo/imagerie `LAB_/IMAGING_STRUCTURING_PROMPT` | `prompts.js` | Fondation intelligence documentaire |
| `tokens_used` stocké (synthesis, narrative, parcours…) | `db.js` | **Vraies stats IA** pour Mission Control |

**Conclusion :** ~60 % du cahier est déjà couvert. La valeur du Sprint 17 est dans l'**unification**, l'**anticipation** et la **réduction de friction**, pas dans la duplication.

---

## 2. Les 10 améliorations à plus fort impact (priorisées)

1. **⭐ Copilote omniprésent** — fusionner Copilote dossier + Assistant dashboard en UN copilote joignable partout (⌘K + bouton flottant), capable de répondre aux questions d'**exploitation transversale** : « prépare mon après-midi », « patients à risque », « qui rappeler », « examens arrivés », « traitements qui expirent ». Réutilise `/api/cockpit` + signaux. *Le moment « je ne peux plus revenir en arrière ».*
2. **Journal du Cabinet** — activité réelle du jour/semaine/mois (consultations, ordonnances, analyses) + **estimation transparente** du temps gagné (formule affichée, étiquetée *estimation*).
3. **Health Graph** — carte visuelle du dossier (consultation → ordonnance → analyse → imagerie → courrier → traitement) ; compréhension immédiate.
4. **Quick Actions** — survol/appui long sur un patient → menu (nouvelle consult / ordonnance / courrier / préparer) **sans ouvrir le dossier**.
5. **Mission Control** (⭐ signature) — évolution du Command Center : disponibilité services, base de données, **stats IA réelles (agrégation `tokens_used`)**, version, comptes actifs, état des flags. Honnête « à instrumenter » pour error-tracking / historique de latence.
6. **IA prédictive étendue** — enrichir `computePatientSignals` (diabète sans contrôle, HTA à suivre, traitements qui expirent) — toujours « Suggestion IA · à vérifier », jamais une décision.
7. **Smart Calendar** — remonter automatiquement le briefing pré-consultation (existant) sur les RDV à venir.
8. **Zero-friction** — audit des actions répétitives ; supprimer ~30 % de clics (quick-create, raccourcis, valeurs par défaut).
9. **Workspace adaptatif** — l'accueil s'adapte à l'heure (matin : consultations ; soir : comptes-rendus).
10. **Patient Companion** — digest matinal concis (traitement du jour, prochain RDV, nouveau document, tendance) — enrichit l'accueil patient existant.

---

## 3. Conflits signalés (garant de la qualité)

- **« Temps économisé » chiffré comme mesuré** → interdit (donnée inventée). ✅ Alternative : estimation transparente + formule + étiquette *estimation*.
- **Import « n'importe quel PDF »** → vraies données patient interdites hors HDS + OCR fragile en stack vanilla. ✅ Alternative : intelligence documentaire sur entrées synthétiques/texte via extracteurs existants, périmètre honnête.
- **Mobile 95 % parité** → `app.html` desktop-first (7 817 lignes). ✅ Alternative : passe responsive réelle sur surfaces clés, sans surpromesse.
- **Redondance** (règle #4) → élever/unifier, ne pas reconstruire.

---

## 4. Feuille de route en vagues

- **Vague A — Le Copilote (flagship)** : Copilote omniprésent unifié + IA prédictive remontée + réponses d'exploitation transversale. *Backend : réutilise `/api/cockpit`, signaux ; éventuel endpoint copilote d'agrégation.*
- **Vague B — Temps & friction** : Journal du Cabinet (honnête), Quick Actions, passe zero-friction, workspace adaptatif.
- **Vague C — Intelligence visuelle** : Health Graph, câblage Smart Calendar, polish Smart Timeline, auto-classement documentaire (synthétique).
- **Vague D — Mission Control (signature)** + Patient Companion + passe responsive médecin.

**Transparence non négociable** : aucun chiffre inventé, « Suggestion IA · à vérifier » sur toute anticipation, « à instrumenter » là où rien n'est mesuré.
