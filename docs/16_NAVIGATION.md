# 16 — CARTOGRAPHIE DE NAVIGATION (Sprint 16 · Vague 2)

> **Objectif : la navigation devient invisible.** Un médecin ne doit jamais se demander où cliquer ; toute action importante est accessible en **≤ 2 clics** (ou ≤ 2 frappes via ⌘K). Ce document cartographie les surfaces et prouve la règle.

---

## 1. Les quatre univers

| Univers | Fichier | Point d'entrée | Navigation primaire |
|---|---|---|---|
| **Public** | `index.html` (`/`) | Landing | Ancres (#comment, #pricing, #faq) + choix de connexion Pro/Patient |
| **Confiance** | `trust.html` (`/trust`) | Footer landing | Page unique, bascule FR/EN |
| **Médecin** | `app.html` (`/app`) | Connexion Pro | Sidebar (9 entrées) + **⌘K Spotlight** + Copilote |
| **Patient** | `patient.html` (`/patient`) | Connexion patient | Tabbar 5 onglets + hub « Santé » |
| **Admin** | `admin.html` (`/admin`) | Jeton médecin + `isAdmin` | Command Center (sections verticales) |

---

## 2. Médecin — preuve du « 2 clics »

**Accélérateur universel : ⌘K (Spotlight).** N'importe quelle action, patient ou document est atteignable en **1 raccourci + 1 frappe/entrée**. C'est la garantie forte de la règle des 2 clics.

Navigation de découverte (sidebar, toujours visible) :

| Action | Chemin | Clics |
|---|---|---|
| Voir le tableau de bord | Sidebar › Tableau de bord | 1 |
| Ouvrir un patient | Sidebar › Patients › [patient] | 2 |
| Ouvrir un dossier depuis n'importe où | ⌘K › taper le nom | ≤ 2 |
| Nouvelle consultation | Sidebar › Consultations *(ou Action Bar)* | 1–2 |
| Discuter avec le dossier (IA) | Dossier › « ✦ Discuter » | ≤ 2 |
| Centre d'actions / notifications | Sidebar › Centre d'actions | 1 |
| Paramètres | Sidebar › Paramètres | 1 |

➡️ **Aucune action clé au-delà de 2 clics.** ⌘K couvre les cas profonds.

---

## 3. Patient — preuve du « 2 clics »

Tabbar permanente : **Accueil · Santé · Assistant · Documents · Profil**. Le hub « Santé » regroupe les sous-pages (Parcours, RDV, Traitements, Résultats, Historique, Évolution, Préparer, Santé connectée).

| Action | Chemin | Clics |
|---|---|---|
| État de santé / prochain RDV / traitement | Accueil (tuiles) | 1 |
| Poser une question sur son dossier | Onglet Assistant | 1 |
| Ouvrir un résultat | Santé › Résultats › [item] *(ou Accueil › bannière)* | 2 |
| Mon Parcours Santé | Accueil › carte *(ou Santé › Parcours)* | 1–2 |
| Préparer sa consultation | Bannière proactive *(ou Santé › Préparer)* | 1–2 |
| Notifications | Cloche (topbar) | 1 |
| Télécharger ses données | Profil › Sécurité | 2 |

➡️ Toute page patient est atteignable en **≤ 2 clics** ; les actions du moment remontent en **1 clic** via l'accueil (tuiles + bannière proactive).

---

## 4. Principes tenus

- **Une barre permanente par univers** (sidebar médecin / tabbar patient) : le repère ne bouge jamais.
- **Les sous-pages passent par un hub**, pas par une arborescence profonde.
- **Le contexte remonte l'action** : bannière proactive (patient), Copilote et ⌘K (médecin).
- **Surbrillance du parent** : une sous-vue éclaire toujours son onglet/section d'origine.

## 5. À surveiller (dette navigation)

- L'entrée **Command Center** (`/admin`) n'est pas encore reliée depuis la sidebar médecin pour les admins (accès direct par URL). → à ajouter en Vague 3, sous flag `command_center` + `isAdmin`.
- `app.html` reste un monofichier (~7 800 lignes) : la navigation est saine mais l'implémentation gagnerait à être modularisée (backlog #21).
