# 19 — SPRINT 18 · Zero Click Medicine (audit & plan CPO/CTO)

> **Le meilleur clic est celui qui n'existe plus.** Objectif : MediAI *pense avant* le médecin — prépare, organise, simplifie. Posture CPO + CTO. Règle appliquée : audit → priorités par impact → corriger les incohérences → **ne jamais reconstruire si améliorer l'existant apporte plus** (règle #4).

Date : 2026-08-02 · Statut : proposé.

---

## 1. Audit — déjà présent (à élever, pas reconstruire)

| Brique | Où | Décision |
|---|---|---|
| **Focus / Mode Consultation** (`enterFocusMode`, `focus-mode`, `exitFocus`) | `app.html` | Élever : « Terminer → patient suivant » automatique |
| **Centre d'actions** (`renderActionsCenter`) | `app.html` | Reframer en **AI Inbox** « à vider » |
| **timeline-narrative + parcours** (récits IA) | `server.js`/`prompts.js` | Élever en **Journal Clinique** (récit prose exportable) |
| **workspace_layouts** (table + API) | `db.js` | Version légère (masquer/réordonner), pas de drag-drop complet |
| **LAB/IMAGING structuring** | `prompts.js` | Fondation Smart Documents (pas d'OCR « tout PDF ») |
| **Tokens sémantiques** (`--blue/green/amber/red/violet`) | `tokens.css` | Formaliser le **langage couleur** |
| **⌘K Spotlight** (`cmdk`) | `app.html` | Consolider la barre supérieure autour |

**Données patient réelles** : la table `patients` ne contient que nom/prénom/date_naissance/notes. Allergies possibles via key-facts/dossier ; **contact d'urgence / personne à prévenir n'existent pas** → le bandeau (Innovation 8) affichera le réel et marquera « non renseigné » le reste (jamais inventé).

---

## 2. Les 10 améliorations à plus fort impact

1. **⭐ Le Journal Clinique** (signature) — élever `timeline-narrative` en un **récit clinique en prose**, vivant, auto-mis à jour, **exportable** (courrier / spécialiste / patient / préparation de consultation). *L'idée qui peut marquer MediAI.*
2. **AI Inbox** — le Centre d'actions devient une boîte que le médecin **vide** (comptes-rendus prêts, analyses à vérifier, ordonnance expirée, document importé, patients à rappeler).
3. **Smart Queue** — file patients **triée par couleur** (simple / 15 min / complexe / résultat arrivé / imagerie dispo), dérivée des signaux + agenda. Déterministe.
4. **Focus Mode → Terminer → suivant** — enchaînement automatique vers le patient suivant de la file.
5. **Consultation Snapshot** — fiche visuelle de fin de consultation (durée, diagnostic, traitement, prochain RDV, documents). Déterministe.
6. **Dossier Patient 2.0 — bandeau fixe** — nom/âge/traitements/dernier RDV toujours visibles (+ allergies si présentes ; contact/urgence « non renseigné »).
7. **Auto-save universel** — brouillons sauvegardés en continu (localStorage) — plus jamais de texte perdu.
8. **Cache / préchargement intelligent** (Préparation Invisible) — précharger les dossiers fréquemment ouverts → ouverture instantanée.
9. **Langage couleur sémantique** — bleu info · vert terminé · orange à vérifier · rouge urgent · violet IA — formalisé et appliqué.
10. **Barre supérieure intelligente** — recherche · notifications · assistant · **temps gagné aujourd'hui** (→ Journal) · profil.

---

## 3. Conflits signalés (garant de la qualité)

- **④ Mode Salle d'Attente** (photos/documents/symptômes patient) → **vraies données patient, interdites hors HDS** + feature lourde. ✅ Alternative : questionnaire **texte synthétique** ou ADR jusqu'à HDS.
- **⑩ Multi-fenêtres** (onglets patients) → refonte SPA lourde/risquée (monofichier 7 800 lignes). ✅ Alternative : **bascule rapide récents/épinglés**.
- **⑦ Workspace drag-drop** → coût élevé. ✅ Alternative : **masquer/réordonner** par bascules (backend déjà prêt).
- **⑨ Smart Documents OCR « tout PDF »** → OCR fragile + vrais fichiers = HDS. ✅ Alternative : extraction structurée existante + détection de type sur saisie.
- **Business — Early Access / Discord / tarif à vie / vote** → décisions business + outils externes. ✅ Alternative : **page d'inscription honnête** ; l'ops reste côté humain.

---

## 4. Feuille de route en vagues

- **Vague A — ⭐ Le Journal Clinique** (récit prose exportable) + **AI Inbox**.
- **Vague B — Le flux de consultation** : Smart Queue + Focus Mode « Terminer → suivant » + Consultation Snapshot.
- **Vague C — Zéro perte, zéro attente** : Dossier 2.0 (bandeau fixe) + auto-save universel + préchargement intelligent.
- **Vague D — Langage & entrée** : couleurs sémantiques + barre supérieure intelligente + page Early Access. **ADR** pour Multi-fenêtres, Workspace drag-drop, Salle d'attente, OCR.

**Transparence non négociable** : « Suggestion IA · à vérifier » sur toute anticipation ; aucun champ patient inventé ; « à instrumenter » là où rien n'est mesuré.
