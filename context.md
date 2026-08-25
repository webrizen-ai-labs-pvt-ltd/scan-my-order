# Project Context

## Overview
This project is a Turborepo monorepo for **Scan My Order**, a unified restaurant operations platform.
- `apps/backend`: Express API (CommonJS).
- `apps/frontend/admin`: Super Admin / Tenant Admin (Brand) dashboard (Vite + React).
- `apps/frontend/operations`: Staff POS and KDS (Vite + React).
- `apps/frontend/menu`: Customer QR Menu (Vite + React).
- `apps/frontend/marketing`: Public landing page (Vite + React).
- `packages/shared`: Shared assets and utilities (`@smo/shared`).
- `packages/ui`: Centralized Shadcn UI components, Tailwind config, and fonts (`@smo/ui`).

## Theory of the System & Hierarchy
The core architecture follows a **Brand -> Store** hierarchy to allow businesses to scale from a single outlet to a global franchise under one account.
1. **Tenant (Brand)**: Acts as the top-level umbrella for a business. It holds global identity (Brand Name, Logo, Brand Colors) and legal/billing details (GSTIN, Company Legal Name). 
2. **Store (Location)**: Represents physical outlets that belong to a Tenant. Stores inherit the Tenant's brand identity but have local operational fields (Address, Operational Hours, Local Banners).
3. **Users & Roles**:
   - `SUPER_ADMIN`: Manages all tenants, creates SaaS billing plans, and can oversee the entire platform.
   - `TENANT_ADMIN`: The Brand Owner. Can manage the Brand's global settings, view all their stores, create new stores, and invite users across the brand.
   - `STORE_MANAGER`: Scoped strictly to a single `Store`. Can manage local inventory, staff, and orders for their location, but cannot view other stores in the brand.

## Work Completed
- **Architecture**: Turborepo, npm workspaces, basic Express app setup with error handling and async wrappers.
- **Database**: Prisma configured with PostgreSQL (Supabase).
- **Core Models**: Tenants, Stores, Users, Roles. Refactored architecture to decouple Brand (Tenant) global assets from Store local data.
- **Auth**:
  - JWT Login & Google OAuth (Customer default).
  - Strict staff provisioning (e.g., `TENANT_ADMIN` can create a `STORE_MANAGER` and instantly assign them to a specific store).
- **Billing Pipelines**:
  - **SaaS Pipeline**: Integrated **PhonePe UPI/Autopay** for tenant platform subscriptions (`SubscriptionPlan`, `TenantSubscription`). Implemented a robust hybrid verification system where PhonePe webhooks update the DB asynchronously, but a synchronous backend redirect interceptor guarantees state updates if webhooks fail in local development, supporting dynamic redirection back to the originating app (`admin` or `operations`).
  - **BYOAK Food Pipeline**: `TenantPaymentGateway` for Razorpay. Symmetrically encrypted BYOAK keys (`AES-256-GCM` using `ENCRYPTION_KEY`).
- **Store & Brand Management**: 
  - Complete React UIs for Super Admins and Brand Owners to manage Tenant globals and localized Stores.
  - CRUD APIs enforcing `storeId` constraints and strict role access. 
- **Menu & Inventory**:
  - Menu Items with `isManuallyDisabled` (manager) and `isSystemDisabled` (inventory).
  - Raw Materials and Stock Transactions (`RESTOCK`, `CONSUME`, `ADJUST`).
  - Recipes bridging Raw Materials to base Items OR Modifiers.
- **Ordering Engine**:
  - `Table` model using unguessable UUIDs to prevent QR spoofing.
  - `Order` state machine (`DRAFT`, `PENDING_VERIFICATION`, `PENDING_PAYMENT`, `PROCESSING`, `READY`, `SERVED`, `SETTLED`).
  - Strict inventory deduction: only happens when status reaches `PROCESSING`.
  - Native Server-Sent Events (SSE) `/stream` pushing zero-latency updates to Waiter/KDS.
- **Waiters & Feedback**:
  - `WaiterCall` model with anti-spam mechanism and real-time SSE coordination.
  - Review Gatekeeper logic on Feedback: publicly redirects 4-5 stars to Google Review URL, hides 1-3 stars.
- **Frontend Architecture**:
  - Centralized UI package using Shadcn (Zinc theme), TailwindCSS presets, and Hugeicons.
  - Global fonts: `DM Sans` (default) and `Elsie` (`.font-elsie`).
  - 4 distinct Vite React apps sharing the `@smo/ui` package and running on assigned local ports (5173 - 5176).

## Conventions to Keep
- **Naming**: All file and folder names must be lowercase kebab-case.
- **Architecture**:
  - Backend is strictly **CommonJS**.
  - Put shared cross-app logic in `packages/shared`.
  - Put backend-only service clients in `apps/backend/src/lib`.
  - Tests are removed by request.
  - React Frontends use Vite and JSX. Tailwind and Shadcn are centralized in `@smo/ui`.
- **Security**: Real credentials only live in git-ignored `.env` files (`.env.example` is safe). Keep auth verification on the backend.

## Things to Remember
- Database changes require `npm --workspace @smo/backend run prisma:generate` followed by `prisma:migrate`.
- `ENCRYPTION_KEY` is a 32-byte hex string critical for decrypting Tenant API keys.
- Store endpoints rely on `storeId` being extracted securely from params/actor to enforce RLS equivalent isolation.
