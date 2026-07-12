# AssetFlow

**Enterprise Asset & Resource Management System** — track, allocate, and maintain physical assets and shared resources on one platform. Built for the Odoo Hackathon 2026.

AssetFlow replaces spreadsheets and paper logs with structured asset lifecycles, conflict-free allocation and booking, an approval-driven maintenance board, and structured audit cycles — with role-based access throughout.

## Tech stack

- **Next.js 16** (App Router, TypeScript)
- **PostgreSQL** + **Prisma** ORM
- **Auth.js (NextAuth v5)** — credentials auth, JWT sessions, RBAC
- **Tailwind CSS v4** + custom UI components
- **Recharts** for analytics

## Getting started

```bash
# 1. install
npm install

# 2. configure environment
cp .env.example .env        # set DATABASE_URL + AUTH_SECRET

# 3. database
npm run db:migrate          # apply schema
npm run db:seed             # load demo data

# 4. run
npm run dev                 # http://localhost:3000
```

### Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@assetflow.com` | `admin123` |
| Asset Manager | `manager@assetflow.com` | `manager123` |
| Department Head | `head@assetflow.com` | `head123` |
| Employee | `priya@assetflow.com` | `employee123` |

> New signups always create an **Employee** account — elevated roles are assigned only by an Admin in Organization Setup.

## Screens

1. Login / Signup · 2. Dashboard · 3. Organization Setup · 4. Assets Registry ·
5. Allocation & Transfer · 6. Resource Booking · 7. Maintenance · 8. Audit ·
9. Reports & Analytics · 10. Notifications & Activity Log

## Core business rules

The interesting logic lives in `lib/services/` (not buried in UI handlers):

- **Double-allocation block** (`allocation.ts`) — an asset that's already held can't be re-allocated directly; the system forces a **transfer request → approval → re-allocation** flow and preserves allocation history.
- **Booking overlap rejection** (`booking.ts`) — shared resources use half-open `[start, end)` intervals, so a 9:00–10:00 booking rejects 9:30–10:30 but allows 10:00–11:00.
- **Maintenance state machine** (`maintenance.ts`) — moving a card to *Approved* flips the asset to `UNDER_MAINTENANCE`; *Resolved* returns it to `AVAILABLE`.
- **Audit discrepancy** (`audit.ts`) — closing a cycle auto-generates a discrepancy report and marks `MISSING` assets as `LOST`.

## Roles (RBAC)

Enforced server-side in `lib/rbac.ts` (`can(role, action)`), not just hidden in the UI.

| | Admin | Asset Mgr | Dept Head | Employee |
|--|:--:|:--:|:--:|:--:|
| Organization setup | ✅ | | | |
| Register / allocate assets | ✅ | ✅ | ✅¹ | |
| Approve transfers / maintenance | ✅ | ✅ | ✅¹ | |
| Raise maintenance / book / request transfer | ✅ | ✅ | ✅ | ✅ |
| Create / close audit cycles | ✅ | ✅ | | |

¹ within their own department

## State machines

- **Asset:** `AVAILABLE ⇄ ALLOCATED ⇄ RESERVED ⇄ UNDER_MAINTENANCE → LOST / RETIRED / DISPOSED`
- **Transfer:** `REQUESTED → APPROVED | REJECTED`
- **Maintenance:** `PENDING → APPROVED → TECHNICIAN_ASSIGNED → IN_PROGRESS → RESOLVED` (or `REJECTED`)
- **Booking:** `UPCOMING → ONGOING → COMPLETED` (or `CANCELLED`)
- **Audit:** `OPEN → CLOSED`

## Project structure

```
prisma/         schema.prisma + seed
lib/            db client, auth helpers, rbac, services (business rules)
app/(auth)/     login & signup
app/(app)/      authenticated screens (shared sidebar layout)
app/api/        route handlers
components/     shared UI
```

## Team

- **Divyang Kuntar** — foundation, dashboard, maintenance, notifications
- **Vishvam** — organization setup, assets, resource booking
- **Miral** — allocation & transfer, audit, reports
