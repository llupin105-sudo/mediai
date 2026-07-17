# 07 — DATABASE

Schéma PostgreSQL de MediAI. Source d'implémentation : `db.js` (`initDb()` crée/migre les tables au démarrage). Toutes les migrations sont **idempotentes** (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) — sûres à chaque redéploiement.

---

## Schéma relationnel

```mermaid
erDiagram
    users ||--o{ patients : "medecin_id"
    users ||--o{ medical_events : "medecin_id"
    patients ||--o{ medical_events : "patient_id"
    patients ||--o| patient_synthesis : "cache snapshot"

    users {
        uuid id PK
        text email UK
        text password_hash "NULL si Google"
        text auth_provider "password | google"
        bool is_pro
        int free_usage_count
        text free_usage_month "YYYY-MM (reset mensuel)"
        text stripe_customer_id
        text profile_nom
        text profile_rpps
        text profile_cabinet
        text profile_telephone
        text profile_specialite
        text profile_presentation
        text pref_default_specialite
        text pref_instructions
        timestamptz created_at
    }
    patients {
        uuid id PK
        uuid medecin_id FK
        text nom
        text prenom
        text date_naissance
        text notes
        text login_email "portail (UK partiel)"
        text login_password_hash
        timestamptz portal_activated_at
        timestamptz created_at
    }
    medical_events {
        uuid id PK
        uuid patient_id FK
        uuid medecin_id FK
        text type "consultation | ordonnance | courrier | analyse_labo | imagerie"
        text title
        timestamptz event_date
        jsonb data "contenu spécifique au type"
        int tokens_used
        timestamptz created_at
    }
    audit_logs {
        uuid id PK
        timestamptz timestamp
        text method
        text path
        text ip
        text user_email
        text request_id
    }
    patient_synthesis {
        uuid patient_id PK "FK patients"
        jsonb data "snapshot IA + faits"
        int source_events_count "clé de fraîcheur du cache"
        int tokens_used
        timestamptz generated_at
    }
```

---

## Tables

### `users` — comptes médecins
Identité, abonnement et préférences du médecin.
- **Auth** : `password_hash` peut être `NULL` (comptes Google) ; `auth_provider` distingue `password` / `google`.
- **Quota gratuit** : `free_usage_count` + `free_usage_month`. La remise à zéro est **paresseuse** : si `free_usage_month` ≠ mois courant, le compteur est considéré à 0 (voir `effectiveFreeUsage` dans `server.js`). Aucune tâche planifiée nécessaire.
- **Abonnement** : `is_pro` + `stripe_customer_id` (permet de retrouver l'utilisateur depuis un événement webhook).
- **Profil** : `profile_*` (dont `specialite` / `presentation`, fondation d'une future recherche de praticien).

### `patients` — fiches patients
Créée et **possédée par un médecin** (`medecin_id`, `ON DELETE CASCADE`).
- **Portail** : `login_email` (index unique partiel `WHERE login_email IS NOT NULL`), `login_password_hash`, `portal_activated_at`. Accès activé dossier par dossier. → [09_PATIENT_SYSTEM.md](09_PATIENT_SYSTEM.md).

### `medical_events` — chronologie polymorphe ⭐
Table centrale. **Un type d'événement = une valeur de `type`**, le contenu spécifique vit dans `data` (JSONB).
- Types actuels : `consultation`, `ordonnance`, `courrier`, `analyse_labo`, `imagerie`.
- Index : `idx_medical_events_patient (patient_id, event_date DESC)` pour la timeline.
- C'est cette structure qui permet la chronologie unifiée et la timeline intelligente sans multiplier les tables.

### `patient_synthesis` — cache du Patient Snapshot (Phase 5)
Une ligne par patient (`patient_id` en PK, `ON DELETE CASCADE`). Mémorise la synthèse de fond du dossier (JSONB) et le nombre d'événements au moment de la génération (`source_events_count`). Le snapshot est régénéré quand ce compteur ne correspond plus au nombre réel d'événements. Upsert via `savePatientSynthesis`. → [08_AI_SYSTEM.md](08_AI_SYSTEM.md).

### `audit_logs` — journalisation
Une ligne par requête HTTP (méthode, chemin, IP, email éventuel, `request_id`). L'écriture n'échoue **jamais** une requête (erreurs seulement journalisées). Fondation de traçabilité pour la conformité HDS.

---

## Conventions

- **Clés primaires** : `UUID` générés côté application (`crypto.randomUUID()`), jamais de séquences auto-incrémentées.
- **Horodatage** : `TIMESTAMPTZ DEFAULT now()`.
- **Cascade** : la suppression d'un médecin supprime ses patients et événements ; la suppression d'un patient supprime ses événements.
- **SSL** : activé automatiquement quand `DATABASE_URL` a un hôte à domaine complet (base externe), désactivé pour un hôte interne Render (voir `detectNeedsSSL`).

---

## Migrations & évolution

Il n'y a **pas d'outil de migration dédié** : `initDb()` fait foi et applique des `ALTER` idempotents. Pour ajouter une colonne : ajouter un `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` dans `initDb()`.

> À mesure que le schéma grandit, envisager un vrai gestionnaire de migrations versionnées (ex. `node-pg-migrate`). → [14_BACKLOG.md](14_BACKLOG.md).

---

## Table retirée — `compte_rendus` (legacy)

L'ancienne table `compte_rendus` (comptes-rendus non rattachés à un patient) a été **abandonnée** au profit de `medical_events`. Son code (endpoints `/api/historique`, `/api/compterendu/:id` et fonctions DB) a été supprimé lors de la consolidation Phase 0. → [CHANGELOG.md](CHANGELOG.md).

**Nettoyage des bases existantes** — un script sûr est fourni : il vérifie que la table est **vide** avant de la supprimer (sinon il abandonne). À exécuter une fois contre la base de production :
```bash
DATABASE_URL='postgres://...' node scripts/drop-compte-rendus.js
```
Ce `DROP` n'est **pas** exécuté au démarrage du serveur (une suppression destructive ne doit jamais tourner à chaque boot).
