# Intégration Doctolib

> **État : MOCK opérationnel de bout en bout.** L'architecture est prête à
> accueillir le connecteur **officiel** Doctolib sans réécriture. Le connecteur réel
> nécessite l'accès et les paramètres fournis **dans le cadre d'une intégration
> officielle avec Doctolib** (voir [Mise en production](#mise-en-production)).
>
> Règles tenues : **jamais** d'API Doctolib inventée, **jamais** de scraping,
> **jamais** de contournement d'authentification, **jamais** de secret côté frontend.

## Architecture

```
integrations/doctolib/
├── index.js         — getConnector() (mock | real) + ré-exports
├── config.js        — lecture d'environnement (DOCTOLIB_*)
├── connector.js     — contrat abstrait DoctolibConnector
├── mock-connector.js— MockDoctolibConnector (dataset réaliste déterministe)
├── mapper.js        — Doctolib → MediAI (+ checksum de changement)
├── validator.js     — validation des enregistrements entrants
├── sync.js          — moteur full/incrémental + déduplication + observabilité
├── webhook.js       — signature HMAC → anti-rejeu → idempotence
├── security.js      — HMAC, chiffrement AES-256-GCM at rest, redact, allowlist IP
├── errors.js        — DoctolibError (codes stables, messages médecin-friendly)
├── audit.js         — journalisation (ACTIONS) avec redaction des secrets
├── store.js         — accès aux tables integration_* (UPSERT, dédup)
└── routes.js        — routeur Express (status, mock/*, webhook, diagnostic)
```

Le reste de MediAI **ne dépend jamais** directement de Doctolib : tout passe par la
couche d'intégration et le contrat `DoctolibConnector`.

## Configuration

Variables (`.env.example`), **sans valeur réelle** committée :

| Variable | Rôle |
|---|---|
| `DOCTOLIB_ENABLED` | `true` pour activer le mode réel (sinon mock). |
| `DOCTOLIB_BASE_URL` | URL du connecteur officiel. |
| `DOCTOLIB_CLIENT_ID` / `DOCTOLIB_CLIENT_SECRET` | Identifiants OAuth du connecteur. |
| `DOCTOLIB_SECRET_KEY` | Clé de chiffrement des secrets stockés (défaut : `JWT_SECRET`). |
| `DOCTOLIB_WEBHOOK_SECRET` | Secret HMAC de vérification des webhooks. |
| `DOCTOLIB_IP_ALLOWLIST` | Restriction IP optionnelle (liste). |

Tant que `DOCTOLIB_ENABLED` n'est pas `true` **et** que les identifiants ne sont pas
fournis, `getConnector()` renvoie le **MockDoctolibConnector** (aucun appel réseau).

## Sécurité

- **Credentials côté serveur uniquement.** Le frontend n'appelle que
  `/api/integrations/doctolib/*` ; il ne voit jamais un secret.
- **Chiffrement at rest** (AES-256-GCM) des secrets en base (`encrypted_secret`).
- **HMAC** pour l'authentification/intégrité des webhooks ; comparaison à temps
  constant (`timingSafeEqual`).
- **Anti-rejeu** : fenêtre d'horodatage + idempotence par `event_id`.
- **Restriction IP** supportée (`DOCTOLIB_IP_ALLOWLIST`).
- **Redaction** systématique des secrets dans les logs et l'audit.
- **Révocation** : la déconnexion efface `encrypted_secret` et passe la connexion en
  `disconnected`.

Doctolib documente qu'un connecteur peut utiliser une clé secrète fournie par
Doctolib (à protéger), avec possibilité de restriction par IP et HMAC pour
l'authentification/intégrité des messages — c'est exactement le modèle implémenté.

## Synchronisation

Flux : **Doctolib → Fetch → Validation → Mapping → Déduplication → MediAI → Audit**

- `fullSync()` : lit tout (première synchro).
- `incrementalSync()` : ne lit que les changements depuis le dernier run réussi
  (`since`, dérivé de `external_updated_at` / dernier `sync_run`).
- **Déduplication** : chaque enregistrement est réconcilié via
  `(medecin_id, provider, resource_type, external_id)`. Synchroniser deux fois ne
  crée **aucun doublon** (checksum → `unchanged`).
- **Ordre** : patients → rendez-vous → documents (pour résoudre les rattachements).
- **Observabilité** : chaque run renvoie `created / updated / unchanged / failed` par
  ressource + totaux + durée (table `integration_sync_runs`).

## Mapping

| Doctolib | MediAI |
|---|---|
| Patient (`externalId, firstName, lastName, birthDate, sex, phone`) | `patients` (+ `source='doctolib'`, `external_id`, `external_synced_at`) |
| Appointment (`externalId, patientExternalId, startAt, endAt, status, type`) | `appointments` (statut mappé, rattaché au patient interne) |
| Document (`externalId, patientExternalId, type, title, createdAt, externalUrl`) | `medical_events` (métadonnées ; **contenu non téléchargé**) |

> Les **documents** ne sont **pas** téléchargés automatiquement : seule la métadonnée
> (type, titre, URL éventuelle) est conservée. L'architecture est prête ; le
> téléchargement dépendra des droits réels du connecteur officiel.

## Webhooks (abstraction + mock)

`POST /api/integrations/doctolib/webhook`

Défenses, dans l'ordre : **signature HMAC → fraîcheur d'horodatage → idempotence**
(`event_id`). Types abstraits : `AppointmentCreated`, `AppointmentUpdated`,
`PatientUpdated`, `DocumentCreated`.

> ⚠️ Ces types ne sont **pas présumés** exister tels quels chez Doctolib tant que la
> documentation officielle du connecteur retenu ne les confirme pas. Seuls le contrat
> et le mock sont fournis.

## Mock

`MockDoctolibConnector` — dataset **déterministe** : 3 praticiens, 10 patients, 15
rendez-vous, 8 documents. Endpoints de démonstration :

- `POST /api/integrations/doctolib/mock/connect`
- `POST /api/integrations/doctolib/mock/sync` (`{ kind: 'full' | 'incremental' }`)
- `POST /api/integrations/doctolib/mock/disconnect`
- `GET  /api/integrations/doctolib/status`
- `GET  /api/integrations/doctolib/diagnostic` (admin)

Parcours : Connexion → Synchronisation → 10 patients → 15 rendez-vous → 8 documents →
Terminé. Les données apparaissent réellement dans **Aujourd'hui**, **Patients** et
**Documents** (mêmes tables MediAI), avec une étiquette source discrète « Doctolib ».

## Tests

`test/doctolib.test.js` (node:test, 100 % hors-ligne) :
mapping · déduplication (2× → 0 doublon) · synchro incrémentale · signature webhook ·
anti-rejeu · idempotence · chiffrement/redaction des secrets · erreurs propres ·
connecteur réel non branché → erreur claire.

```bash
npm test   # 41 tests (dont 12 Doctolib)
```

## Mise en production

Le **Mock n'est pas** une intégration réelle. Étapes externes :

1. Contacter Doctolib → présenter MediAI.
2. Demander les conditions d'accès au connecteur (interopérabilité SI, standards
   HL7/FHIR selon le contrat).
3. Récupérer la documentation technique correspondant au contrat.
4. Implémenter `integrations/doctolib/official-connector.js` conforme au contrat
   `DoctolibConnector`, puis brancher `getConnector({ mode: 'real' })`.
5. Renseigner les variables `DOCTOLIB_*`.
6. Tests d'intégration → validation sécurité → production.

Aucune de ces étapes ne nécessite de réécrire l'architecture : seul le connecteur
change.
