# Pleasant

Shift staffing, timesheets, payroll and client billing for UK healthcare staffing agencies — one loop
from a care home's shift request to the carer's payslip and the home's invoice.

## What's in the box

| Area | Highlights |
| --- | --- |
| **Operations** | Shifts, recurring rota, dispatch offers, open-shift marketplace, unattended triage |
| **Clients** | Care homes, nursing homes and domiciliary providers with their units/branches, contacts, named timesheet signatories and a rate card (day, night, weekend, bank holiday) that prices new shifts |
| **People** | Workers, timesheets with carer e-sign and client authorisation (Pleasant Link), compliance expiry tracking, onboarding pipeline |
| **Finance** | UK PAYE payroll (tax, NI, pension, holiday, student loan), RTI/FPS export, BACS STD18 + CSV payment files, invoicing with margin, aged receivables, Xero sales-invoice CSV export |
| **Workers app** | Mobile-first PWA for carers: open shifts, offers, timesheets, profile |
| **Workspace** | Team management with roles, append-only audit log, CSV import, ⌘K command palette |

## Roles and access

| Role | Can access |
| --- | --- |
| **Admin** | Everything, including payroll, invoices, agency settings, team, audit log, imports and add-ons |
| **Manager** | Day-to-day operations: Oversight (operational view), shifts, rota, dispatch, timesheets, workers, onboarding, compliance, clients |
| **Carer** | The Workers app only |

Rules live in `lib/permissions.ts` and are enforced server-side by `requireOps()` / `requireAdmin()` in
`lib/auth.ts`; navigation and the command palette read the same rules.

## Security model

- **Sessions** — HMAC-signed, `httpOnly` cookies carrying a per-user `sessionVersion`. Password resets,
  role changes, access removal and "Sign out of all devices" bump the version, revoking every session
  immediately.
- **Sign-in throttling** — 5 consecutive failures lock the account for 15 minutes (stored in Postgres,
  so it holds across serverless instances). Unknown emails take the same time as known ones.
- **Tenant isolation** — every query is scoped by `agencyId` from the session, never from the request.
- **Audit log** — sign-ins, lockouts, team changes, bank-detail changes, pay-run and invoice status
  changes, imports and exports are written to `AuditEvent` with actor and IP. Settings → Audit log,
  with CSV export (formula-injection safe).
- **Headers** — HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, strict referrer and
  permissions policies (`next.config.ts`).
- **Redirects** — post-login `next` is restricted to same-origin paths.

## Local development

Requires Node 22 and Postgres 16.

```bash
cp .env.example .env          # set DATABASE_URL and AUTH_SECRET
npm install
npm run db:up                 # optional: embedded Postgres if you don't have one running
npx prisma db push            # apply the schema
npm run db:seed               # demo agency (Brightwater Care)
npm run dev                   # http://localhost:3000
```

Demo sign-ins (password `pleasant123`):

- `admin@pleasant.demo` — Admin
- `manager@pleasant.demo` — Manager (operations only)
- `tunde.adeyemi@brightwatercare.co.uk` — Carer (Workers app)

## Checks

```bash
npm run check                 # typecheck + lint + unit tests
npm run build
```

CI (`.github/workflows/ci.yml`) runs the same checks against a real Postgres, applies the schema and
runs the seed on every pull request.

## Configuration

See `.env.example`. Notable variables:

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Session signing key. Required in production (`openssl rand -base64 32`). Rotating it signs everyone out. |
| `APP_URL` | Base URL for links in invite and reset emails |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email. Without a key, admins get a copyable one-time link instead |
| `NEXT_PUBLIC_DEMO_MODE` | Shows demo credentials on the sign-in page. Leave unset on customer deployments |

## Operations

- `GET /api/health` returns `200 {"status":"ok"}` when Postgres is reachable, `503` otherwise — point
  your uptime monitor at it.
- `npm run db:backup` writes a JSON backup of the database.
- Deploys on Vercel run `prisma db push`, then `scripts/backfill-clients.ts` (idempotent: names any
  client rows created before clients were organisations), then the build (`vercel.json`).

## Project layout

```
app/(app)/        back office (admins and managers)
app/workforce/    carer PWA
app/pleasant-link client sign-off portal (token links, no login)
lib/              domain logic — payroll engine, RTI, BACS, billing, compliance, permissions
prisma/           schema and seed
docs/             pilot playbook
```
