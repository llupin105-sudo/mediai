# Sprint 23 — MediAI « calme, intelligent, premium »

**Date :** 2026-08 · **Périmètre :** dashboard médecin (produit/UX) + audit Supabase (technique).
**Règle du sprint :** faire *mieux*, pas *plus*. Évolution de l'existant, jamais reconstruction. Conservateur sur données/auth/sécurité.

---

## 1. Objectifs

Transformer le dashboard médecin en une interface radicalement simple, façon Apple : le médecin comprend en 5 secondes « qu'est-ce que je peux faire maintenant ? », sans chercher où cliquer. En parallèle, vérifier que MediAI exploite réellement Supabase (schéma, index, RLS, perf, Auth, observabilité).

## 2. Architecture (confirmée par audit)

```
mediai.fr (Vercel, frontends statiques)  →  api.mediai.fr (Render, Express + pg + JWT)  →  Supabase (PostgreSQL)
```
- Frontend médecin servi par **Vercel** à `mediai.fr/app` (`app.html`).
- Backend **Express** sur Render, cible DB via `process.env.DATABASE_URL` (aucune URL en dur).
- Auth : **JWT maison + Google Identity Services** (réparé au Sprint 22 : bascule sur le Client ID `…k8ho8…`, origins `mediai.fr`/`www.mediai.fr`). **Pas de Passport, pas de Supabase Auth.**

## 3. Décisions produit — Avant / Après

### Avant (dashboard « Aurora »)
Bandeau navy (salutation + phrase IA + 1 priorité + 2 actions) · 4 cartes (Agenda/Prioritaires/Alertes/Reco IA) · colonne Assistant permanente · **sidebar de 11 entrées**. Dense — le « logiciel médical » qu'on veut quitter.

### Après (dashboard « calme »)
```
Bonjour Dr Martin
Votre journée, simplement.

✦  Que souhaitez-vous faire ?            →     ← Magic Input (ouvre le Copilote)
   « Résumer un dossier » · « Préparer une consultation » · …

Patients récents
○ Sophie Martin      aujourd'hui   →
○ Thomas Bernard     hier          →
○ Claire Dupont      hier          →
```

### Décisions UX (par élément)
| Élément | Décision | Destination |
|---|---|---|
| Bandeau + phrase IA | Réduire | salutation + sous-titre |
| 4 cartes cockpit | **Déplacer** (rien perdu) | replié sous « Voir le détail de ma journée » |
| Colonne Assistant permanente | **Remplacer** | Magic Input central |
| Sidebar 11 items | **Réduire** | 4 primaires (Aujourd'hui · Patients · Consultations · Documents) + ✦ Intelligence + « Plus » repliable (Journal, File du jour, Assistant IA, AI Inbox, Labs, Marketplace) + Paramètres. **11 vues préservées, zéro orphelin.** |
| Gros tableau patients | déjà supprimé (Sprint 21) ; ici → **Patients récents** (3–5) | 1er écran |
| Menu « IA » | **Supprimer en tant que menu** → IA contextuelle (`✦ Résumer`) | Focus + Copilote |

### Interaction signature « Focus »
Clic sur un patient → le dashboard s'efface en douceur (blur, 300 ms), le patient devient le **centre** : avatar, « Dossier clinique », dernière activité, sections (Résumé/Consultations/Documents), **✦ Résumer avec MediAI** (IA contextuelle → Copilote centré patient), « Ouvrir le dossier complet ». Fermeture ✕/Échap. Le dossier complet ne s'ouvre que si nécessaire. Transition douce = le « wow ».

### Design & animations
Base blanc/noir/gris, accent bleu très discret (tokens existants). Rayons légers (14–18 px), ombres douces. Animations **fonctionnelles** uniquement (champ → actif → étendu ; fondu du Focus), 180–320 ms, easing naturel. Mobile-first vérifié (empilement propre à 375 px).

## 4. Supabase — Audit technique

### 4.1 Schéma & relations
**18 tables** applicatives : `users`, `patients`, `medical_events`, `appointments`, `tasks`, `message_threads`, `messages`, `workspace_layouts`, `feature_flags`, `audit_logs`, `cockpit_briefings`, `clinical_journals`, `favorites`, `patient_evolution`, `patient_key_facts`, `patient_parcours`, `patient_synthesis`, `timeline_narratives`.
Relations (FK `ON DELETE CASCADE`) : **10** vers `patients(id)`, **8** vers `users(id)` (= médecins), **1** `messages → message_threads(id)`. Le graphe est cohérent : un médecin possède ses patients ; les données cliniques pendent du patient. Schéma **géré par le code** (`db.js initDb`, `CREATE TABLE IF NOT EXISTS` + `ALTER … IF NOT EXISTS`) — pas de framework de migration (ni Prisma ni Drizzle). Avantage : reproductible et idempotent ; limite : pas d'historique de migrations versionné (→ recommandation en §6).

### 4.2 Index
**6 existants** : `idx_medical_events_patient`, `idx_appointments_medecin`, `idx_tasks_medecin`, `idx_workspace_medecin`, `idx_messages_thread`, `idx_key_facts_patient`.
**7 manquants identifiés** (filtres les plus chauds non couverts) — prêts dans [`scripts/optimizations.sql`](../../scripts/optimizations.sql), idempotents, à appliquer sur Supabase **après validation** :
`idx_patients_medecin`, `idx_threads_patient`, `idx_threads_medecin(medecin_id,last_message_at DESC)`, `idx_appointments_patient`, `idx_events_patient_date(patient_id,event_date DESC)`, `idx_favorites_medecin`, `idx_audit_ts`. Le plus impactant : **`idx_patients_medecin`** (chaque chargement de la page Patients filtre `WHERE medecin_id = …`).

### 4.3 Contraintes
PK UUID partout, `users.email UNIQUE`, index unique partiel sur `patients.login_email`. Intégrité référentielle par FK + cascade. RAS.

### 4.4 Performance
- **`SELECT *`** : usage large mais volumétrie par requête bornée (filtrée par médecin/patient). À surveiller sur `listPatientsByMedecin` (sous-requêtes de comptage `events_count`/`last_event_date` par patient) si un cabinet dépasse quelques milliers de dossiers → envisager une vue matérialisée ou un `LEFT JOIN LATERAL` agrégé. Non urgent.
- **Pooling** : `pg.Pool` côté Express (connexions longues). Sur Supabase, **utiliser la connexion directe (5432) ou le session pooler**, **pas** le pooler transaction (6543 / pgBouncer) qui casse les prepared statements de `pg`. À confirmer dans le `DATABASE_URL` de Render.
- **Pagination** : la page Patients pagine déjà côté client (rendu progressif Sprint 21). Les listes serveur restent bornées par médecin. OK.

### 4.5 RLS (Row-Level Security) — analyse honnête
**Isolation actuelle** : le backend filtre systématiquement par `medecin_id` (issu du JWT vérifié) — protection **applicative** solide et testée.
**RLS au niveau DB** serait un +défense-en-profondeur, **mais** deux incompatibilités avec l'architecture actuelle :
1. Le backend se connecte avec **un seul rôle** (service/owner) qui **contourne RLS** par défaut. Activer RLS sans adaptation ne protège rien de plus… ou **bloque toutes les requêtes** si le rôle n'est pas exempté — **risque de casse totale**.
2. RLS « utile » s'appuie sur `auth.uid()` de **Supabase Auth** — que MediAI **n'utilise pas** (JWT maison). Il faudrait soit adopter Supabase Auth, soit propager un claim `medecin_id` via `SET LOCAL` par requête.
**Recommandation : ne pas activer RLS maintenant.** Conserver le filtrage applicatif (déjà robuste). RLS deviendra pertinent **si** on adopte Supabase Auth (§4.6) ou si on introduit un accès direct à la base hors backend. Chantier à cadrer, jamais activer de policy destructive sans comprendre l'accès du service-role.

### 4.6 Supabase Auth — étude (sans migration)
| Critère | JWT maison + GIS (actuel) | Supabase Auth |
|---|---|---|
| Google | ✅ fonctionne (Sprint 22) | ✅ natif |
| Contrôle du JWT | total (claims MediAI, `medecin_id`) | géré par Supabase |
| RLS `auth.uid()` | non (filtrage applicatif) | ✅ débloque RLS |
| Coût | inclus | inclus (quotas) |
| Complexité migration | — | **élevée** : réécrire le flux `/api/auth/*`, migrer les mots de passe, re-mapper `users.id` ↔ `auth.users.id`, adapter tout le backend |
| Risque | faible (statu quo) | **élevé** (auth = chemin critique, on vient de le réparer) |
**Recommandation : garder JWT + GIS.** La seule vraie valeur ajoutée de Supabase Auth serait de débloquer RLS — bénéfice marginal face au filtrage applicatif existant et au risque de retoucher l'auth. À réévaluer seulement si un besoin d'accès direct à la DB (ex. clients mobiles natifs sans backend) apparaît.

### 4.7 Observabilité
Health-check réutilisable livré : [`scripts/db-health.js`](../../scripts/db-health.js) (connexion, latence, version, SSL, nombre de tables) et [`scripts/db-verify.js`](../../scripts/db-verify.js) (comptes de lignes). Côté Supabase, activer le **Dashboard → Reports/Logs** et les **sauvegardes automatiques** (plan). Rien n'est exposé au médecin.

## 5. Tests

- **Produit (local, données synthétiques)** : dashboard calme (desktop + mobile 375 px), Magic Input → Copilote, 4 suggestions, Patients récents triés, **Focus** (fondu + centrage patient + ✦ contextuel), nav réduite (5 primaires + « Plus » + Paramètres), « détail de ma journée » repliable. Aucune vue perdue.
- **Prod (`mediai.fr/app`)** : déploiement Vercel propagé (`dash-calm` + Magic Input détectés en ligne), Client ID `…k8ho8…` confirmé, connexion classique + Google intactes.
- **Supabase** : audit statique (schéma/index/relations) ; les optimisations (index) et toute action live restent **à exécuter avec les accès du propriétaire**, jamais en aveugle.

## 6. Résultats & suites

**Livré :** dashboard « calme » + Magic Input + Patients récents + **interaction Focus** + IA contextuelle + nav réduite (déployés en prod) ; audit Supabase complet (ce document) ; index manquants prêts (`optimizations.sql`) ; recommandations RLS/Auth argumentées.

**Reste au backlog (à décider, non bloquant) :**
- Appliquer `optimizations.sql` sur Supabase (après validation) puis remonter les index dans `db.js initDb`.
- Confirmer que `DATABASE_URL` (Render) utilise la connexion **directe/session** Supabase, pas le pooler transaction.
- Étendre l'IA contextuelle (`✦`) aux comptes-rendus/documents (« ✦ Améliorer »).
- Adopter un vrai outil de migrations versionnées si le schéma se complexifie.
- RLS / Supabase Auth : **différés** (analyse ci-dessus) — à rouvrir seulement sur besoin réel.
