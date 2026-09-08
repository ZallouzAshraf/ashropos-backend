# AshroPOS Backend

API NestJS multi-tenant pour une plateforme SaaS de gestion et de vente multi-boutiques.

## Stack

- NestJS 11 + TypeScript
- PostgreSQL + TypeORM (`synchronize: false`, migrations versionnées)
- JWT access + refresh, guards de rôles / permissions / tenant
- Swagger sur `/api/docs`
- Jest (ventes, transferts de stock, permissions)

## Démarrage

```bash
docker compose up -d
cp .env.example .env
npm install
npm run migration:run
npm run seed
npm run start:dev
```

PostgreSQL Docker écoute sur le port **5433** (5432 est souvent déjà pris en local).

- API : `http://localhost:3000/api/v1`
- Swagger : `http://localhost:3000/api/docs`
- Santé : `http://localhost:3000/api/v1/health`

## Compte démo

| Rôle | Email | Mot de passe |
| --- | --- | --- |
| Owner | `owner@ashropos.demo` | `Demo123!` |
| Admin | `admin@ashropos.demo` | `Demo123!` |
| Manager | `manager@ashropos.demo` | `Demo123!` |
| Cashier | `cashier@ashropos.demo` | `Demo123!` |
| Accountant | `accountant@ashropos.demo` | `Demo123!` |

Organisation de démo : **Ashro Demo** (`ashro-demo`) avec 2 boutiques, produits à variantes et ventes factices.

## Isolation multi-tenant

Toutes les entités métier portent `organization_id` (et `store_id` si applicable). Le JWT embarque l'organisation courante ; `TenantContext` (AsyncLocalStorage) + requêtes toujours filtrées par `organizationId`. Les rôles Owner/Admin voient toutes les boutiques ; Manager/Cashier sont limités aux `store_members` assignés.

## Phasage

- **V1** : Auth, Organizations, Stores, Products + variantes, Stock, Sales, Dashboard boutique
- **V2** : Customers, Suppliers, PurchaseOrders, Employees, Subscriptions (webhook Stripe idempotent)
- **V4** : Dashboard organisation agrégé, transferts de stock inter-boutiques, permissions par boutique (`store_members.role_override`)

## Tests

```bash
npm test
```
