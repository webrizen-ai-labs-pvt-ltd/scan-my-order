# Scan My Order

A unified restaurant operations platform — QR menus, POS, KDS, and payments consolidated into one dashboard.

Built as a B2B SaaS product under the **Webrizen** umbrella.

---

## Business Overview

### What It Does

Scan My Order replaces the fragmented stack of separate QR-menu apps, traditional POS terminals, kitchen display systems, and third-party delivery aggregators with a single, multi-tenant platform.

### Target Market

Independent restaurants, cafes, food courts, and small-to-medium franchises that are currently paying for 3–4 disconnected tools and losing margins to payment/delivery intermediaries.

### Unique Value Proposition

- **Consolidation** — one subscription replaces multiple software tools.
- **BYOAK (Bring Your Own API Key)** — tenants plug in their own payment gateway credentials. No transaction fee skimming — they keep 100 % of their revenue.

### Revenue Model

Tiered SaaS subscriptions (monthly or annual), priced by the number of physical **Stores** (locations) a Tenant operates — not by headcount.

### Multi-Tenant Architecture

| Concept   | Meaning                                                                 |
| --------- | ----------------------------------------------------------------------- |
| **Tenant**| A restaurant brand/business that subscribes to the platform. Holds global identity (Brand Name, Logo, Colors) and legal/billing details (GSTIN, Company Legal Name). |
| **Store**  | A physical location belonging to a tenant. Stores inherit the Tenant's brand identity but have local operational fields (Address, Operational Hours, Banners). |
| **User**   | A person with a role. `TENANT_ADMIN` manages the brand globally. `STORE_MANAGER` manages a specific store location. |

---

## Developer Guide

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9 (ships with Node)
- **PostgreSQL** — a Supabase project is used for hosted Postgres

### Clone & Install

```bash
git clone <repo-url> smo
cd smo
npm install
```

`npm install` at the root bootstraps all workspaces (`apps/*`, `packages/*`) via npm workspaces + Turborepo.

### Environment Setup

1. Copy the template into a real env file:

   ```bash
   cp apps/backend/.env.example apps/backend/.env
   ```

2. Fill in the required values in `apps/backend/.env`:

   | Variable           | Required | Description                                |
   | ------------------ | -------- | ------------------------------------------ |
   | `DATABASE_URL`     | ✅       | Prisma connection string (pooled)          |
   | `DIRECT_URL`       | ✅       | Direct Postgres connection (for migrations)|
   | `JWT_SECRET`       | ✅       | Secret key for signing JWTs                |
   | `GOOGLE_CLIENT_ID` | ✅       | Google OAuth client ID                     |
   | `SMTP_HOST`        | ✅       | SMTP server hostname                       |
   | `SMTP_PORT`        | ✅       | SMTP port (default `465`)                  |
   | `SMTP_USER`        | ✅       | SMTP username                              |
   | `SMTP_PASS`        | ✅       | SMTP password                              |
   | `EMAIL_FROM`       | ✅       | Default "from" email address               |
   | `ENCRYPTION_KEY`   | ✅       | 32-byte hex string for AES-256-GCM encryption |
   | `PORT`             |          | Server port (default `8000`)               |
   | `NODE_ENV`         |          | `development` or `production`              |

   Supabase, PhonePe, and frontend app URL variables are optional until those integrations are wired. Note: The `ENCRYPTION_KEY` is crucial for securely storing tenant BYOAK Razorpay keys.

> **⚠️ Never commit `.env` files.** They are git-ignored. Only `.env.example` is tracked.

### Database

Generate the Prisma client and apply migrations:

```bash
npm --workspace @smo/backend run prisma:generate
npm --workspace @smo/backend run prisma:migrate
```

To browse data visually:

```bash
npm --workspace @smo/backend run prisma:studio
```

### Running

**Development** (all workspaces, auto-restart on change):

```bash
npm run dev
```

**Backend only:**

```bash
npm --workspace @smo/backend run dev
```

**Production start:**

```bash
npm start
```

**Syntax check (build):**

```bash
npm run build
```

The backend will be available at `http://localhost:8000` (or whatever `PORT` is set to).

### API Quick Reference

| Method   | Path                                  | Auth     | Description                      |
| -------- | ------------------------------------- | -------- | -------------------------------- |
| `GET`    | `/`                                   | —        | Health banner                    |
| `GET`    | `/health`                             | —        | `{ status: "ok" }`              |
| `GET`    | `/assets/*`                           | —        | Static assets from shared pkg    |
| `POST`   | `/api/auth/bootstrap-super-admin`     | —        | One-time super admin creation    |
| `POST`   | `/api/auth/login`                     | —        | JWT login                        |
| `POST`   | `/api/auth/google`                    | —        | Google OAuth sign-in/sign-up     |
| `POST`   | `/api/auth/passkeys/auth-options`     | —        | Passkey authentication options   |
| `POST`   | `/api/auth/passkeys/authenticate`     | —        | Passkey authentication           |
| `GET`    | `/api/auth/passkeys/register-options` | Bearer   | Passkey registration options     |
| `POST`   | `/api/auth/passkeys/register`         | Bearer   | Passkey registration             |
| `GET`    | `/api/users/me`                       | Bearer   | Current user profile             |
| `GET`    | `/api/users`                          | Bearer   | List users (scoped, filterable)  |
| `POST`   | `/api/users`                          | Bearer   | Create user (strict staff rules) |
| `GET`    | `/api/users/:id`                      | Bearer   | Get user by ID                   |
| `PATCH`  | `/api/users/:id`                      | Bearer   | Update user                      |
| `PATCH`  | `/api/users/:id/status`               | Bearer   | Change user status               |
| `DELETE` | `/api/users/:id`                      | Bearer   | Soft-delete user                 |
| `GET`    | `/api/billing/plans`                  | Bearer   | List SaaS plans                  |
| `POST`   | `/api/billing/plans`                  | Bearer   | Create SaaS plan (SUPER_ADMIN)   |
| `GET`    | `/api/billing/subscription`           | Bearer   | View tenant sub (TENANT_ADMIN)   |
| `POST`   | `/api/billing/subscription/initiate`  | Bearer   | Start PhonePe sub (TENANT_ADMIN) |
| `GET`    | `/api/billing/subscription/redirect`  | —        | Synchronous PhonePe check & redirect |
| `GET`    | `/api/billing/gateways`               | Bearer   | View BYOAK keys (TENANT_ADMIN)   |
| `POST`   | `/api/billing/gateways`               | Bearer   | Save BYOAK keys (TENANT_ADMIN)   |
| `POST`   | `/api/stores`                         | Bearer   | Create a store (Admin only)      |
| `GET`    | `/api/stores`                         | Bearer   | List stores (scoped by role)     |
| `GET`    | `/api/stores/:id`                     | Bearer   | Get store details by ID          |
| `PATCH`  | `/api/stores/:id`                     | Bearer   | Update store details             |
| `DELETE` | `/api/stores/:id`                     | Bearer   | Delete a store (Admin only)      |
| `GET`    | `/api/stores/:storeId/menu`           | Bearer   | Get full dashboard menu          |
| `POST`   | `/api/stores/:storeId/menu/items`     | Bearer   | Create a menu item               |
| `POST`   | `/api/stores/:storeId/inventory/transactions` | Bearer | Add stock (RESTOCK/CONSUME) |
| `GET`    | `/api/public/stores/:storeId/menu`    | —        | Public QR menu (available items) |
| `POST`   | `/api/stores/:storeId/tables`         | Bearer   | Provision secure Table UUIDs     |
| `GET`    | `/api/stores/:storeId/orders?status=PENDING_VERIFICATION` | Bearer | Waiter pending orders inbox |
| `PATCH`  | `/api/stores/:storeId/orders/:id/verify` | Bearer | Waiter approves QR Postpaid  |
| `POST`   | `/api/public/stores/:storeId/orders`  | —        | Create QR Menu Cart / Order      |
| `GET`    | `/api/stores/:storeId/orders/stream`  | Bearer   | SSE Real-time order events       |
| `GET`    | `/api/stores/:storeId/kds/orders`     | Bearer   | Kitchen processing queue         |
| `POST`   | `/api/public/webhooks/razorpay/:tenantId` | —   | Inbound razorpay secure webhook  |
| `POST`   | `/api/public/stores/:storeId/calls`   | —        | Trigger a Waiter Call            |
| `PATCH`  | `/api/stores/:storeId/calls/:id/acknowledge` | Bearer | Claim a Waiter Call         |
| `POST`   | `/api/public/stores/:storeId/feedback`| —        | Submit Customer Feedback         |
### Project Structure

```text
smo/
├── apps/
│   ├── backend/              # Express API (@smo/backend)
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── config/       # Environment loading
│   │       ├── constants/    # Roles, statuses
│   │       ├── lib/          # Service clients (Prisma, JWT, mailer, etc.)
│   │       ├── middleware/   # Auth, error handling, async wrapper
│   │       ├── modules/      # Feature modules (auth, users)
│   │       ├── routes/       # Route registry
│   │       ├── app.js        # Express app setup
│   │       └── index.js      # Server entry point
│   └── frontend/
│       ├── admin/            # Super Admin & Tenant Dashboard (Port 5173)
│       ├── marketing/        # Public SaaS Landing Page (Port 5174)
│       ├── menu/             # Customer QR Menu (Port 5175)
│       └── operations/       # Staff POS and KDS (Port 5176)
├── packages/
│   ├── shared/               # Cross-app constants & assets (@smo/shared)
│   │   ├── assets/           # Images, videos, audios
│   │   └── src/
│   │       ├── index.js      # Browser-safe exports
│   │       └── node.js       # Node-only exports
│   └── ui/                   # Centralized Shadcn UI & Tailwind (@smo/ui)
│       ├── components/       # Shadcn JSX primitives (hugeicons)
│       ├── styles/           # globals.css (DM Sans, Elsie)
│       └── tailwind.config.js # Base preset config
├── turbo.json
└── package.json
```

### Conventions

- All file and folder names are **lowercase kebab-case**.
- Backend is **CommonJS** (no ESM).
- Shared cross-app logic goes in `packages/shared`.
- Backend-only service clients go in `apps/backend/src/lib`.
- Configuration goes in `apps/backend/src/config`.
- Real credentials live only in git-ignored `.env` files.
- Tests are removed by request — no test runner is configured.

---

## License

Proprietary — © Webrizen AI Labs Pvt Ltd. All rights reserved.
