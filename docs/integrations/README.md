# Intégrations externes — MediAI

MediAI expose une **couche d'intégration** générique (`integrations/`) permettant de
connecter des systèmes tiers de santé sans que le cœur du produit dépende
directement de leur implémentation.

Principe : **abstraction stable** (un « connecteur ») + **connecteur mock** pour le
développement, remplaçable par le connecteur réel le jour où l'accès officiel est
disponible.

```
MediAI (server.js)
   ↓  app.use('/api/integrations/<provider>')
Integration Layer (integrations/<provider>/routes.js)
   ↓
Connector (contrat abstrait)
   ↓
MockConnector  ──►  (plus tard) Connecteur officiel
```

Tables communes (`db.js`, préfixe `integration_`) :
- `integration_connections` — 1 ligne par (médecin, provider), secret chiffré.
- `integration_external_records` — registre de déduplication (externalId → interne).
- `integration_sync_runs` — observabilité des synchronisations.
- `integration_audit_logs` — traçabilité (jamais de secret ni de contenu médical).
- `integration_webhook_events` — idempotence des webhooks.

## Intégrations disponibles
- **[Doctolib](doctolib.md)** — agenda, patients, rendez-vous, documents. **MOCK** aujourd'hui ;
  le connecteur réel nécessite une intégration officielle avec Doctolib.
