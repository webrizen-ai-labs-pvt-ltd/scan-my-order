# Scan My Order

> A high-performance, multi-platform restaurant Point of Sale (POS), QR dining, and kitchen management ecosystem built with Turborepo and pnpm workspaces.

---

## 🏗️ System Architecture & Services

```text
scan-my-order/
├── apps/
│   ├── backend/         # Express REST API (PostgreSQL + Prisma)
│   ├── web/
│   │   ├── admin/       # Master Store Configuration & Analytics
│   │   ├── operations/  # Live Table Map, POS & Order Dispatch
│   │   ├── menu/        # Guest QR Menu & Mobile Ordering
│   │   └── marketing/   # Showcase & Landing Page
│   └── native/
│       ├── kitchen/     # Kitchen Display System (KDS) Tablet
│       └── staff/       # Waiter Handheld POS Companion
└── packages/
    ├── db/              # Prisma schema & singleton client
    ├── types/           # Shared TypeScript interfaces & Zod schemas
    ├── eslint-config/   # Shared ESLint rules
    └── typescript-config/# Shared TS configuration presets
```

---

## ⚡ Application Ports & Stack

| Application | Path | Port | Technology |
| :--- | :--- | :--- | :--- |
| **Backend API** | `apps/backend` | **8080** | Node.js, Express, TypeScript, Zod, Prisma |
| **Admin Portal** | `apps/web/admin` | **3000** | Vite, React 18, Tailwind CSS, `shadcn/ui` |
| **Operations POS** | `apps/web/operations` | **3001** | Vite, React 18, Tailwind CSS, `shadcn/ui` |
| **Customer QR Menu**| `apps/web/menu` | **3002** | Vite, React 18, Tailwind CSS, Mobile-First |
| **Marketing Site** | `apps/web/marketing` | **3003** | Vite, React 18, Tailwind CSS |
| **Kitchen KDS** | `apps/native/kitchen`| **8081** | Expo 52, React Native, NativeWind v4 |
| **Staff Handheld** | `apps/native/staff` | **8082** | Expo 52, React Native, NativeWind v4 |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** `>= 20.0.0`
- **pnpm** `>= 11.0.0`
- **PostgreSQL** instance (Local or Hosted e.g., Render / Supabase)

### 2. Setup & Database
```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env

# 3. Generate Prisma client
pnpm db:generate

# 4. Push schema to database
pnpm db:push
```

### 3. Development
```bash
# Start all 7 services concurrently on assigned ports
pnpm dev

# Build all applications and packages
pnpm build

# Run linter
pnpm lint
```

---

## 📄 License
MIT © Webrizen AI Labs Pvt Ltd
