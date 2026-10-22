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
| **Assist** | AI assistant in every back-office page (⌘J, or "Ask Assist" from ⌘K). Answers questions from live data and carries out work — finding and filling shifts, approving timesheets and requests, setting up workers and clients, invoicing and payroll for admins — through the app's own server actions, with the user confirming every change |
| **Workspace** | Team management with roles, append-only audit log, CSV import, ⌘K command palette |

## Roles and access

| Role | Can access |
| --- | --- |
| **Admin** | Everything, including payroll, invoices, agency settings, team, audit log, imports and add-ons |
| **Manager** | Day-to-day operations: Oversight (operational view), shifts, rota, dispatch, timesheets, workers, onboarding, compliance, clients |
| **Carer** | The Workers app only |

Rules live in `lib/permissions.ts` and are enforced server-side by `requireOps()` / `requireAdmin()` in
`lib/auth.ts`; navigation and the command palette read the same rules.

## Assist (AI assistant)

Assist runs Claude (`claude-opus-5-5`) with a tool for each thing it can do (`lib/assist/tools.ts`).

- **Same rules as the UI.** Every change goes through the existing server action for that feature, so permissions,
  validation and audit logging are identical to clicking the button. Tools are filtered by role with
  `canAccess()`, so a Manager's Assist has no payroll or invoice tools.
- **Nothing changes without a click.** Read tools run straight away; every write tool pauses the conversation and
  shows a confirmation card with a plain-English summary. Declining tells the model nothing changed.
- **Verified results.** Many actions fail silently, so each write tool re-reads the record afterwards and reports
  what actually happened. Executed actions are written to the audit log ("Assist" category).
- **Bounded.** At most 8 model calls per message and 120 messages per conversation; record text (notes, names,
  carer messages) is treated as data, never instructions.
- Not available through Assist by design: agency bank details, team roles, deleting records, imports and
  add-ons. Assist opens the right page instead.

Set `ANTHROPIC_API_KEY` to enable it. Requests use streaming, prompt caching for the tools and instructions,
effort `medium`, and the server-side refusal fallback (`fallbacks: "default"`).

### Assist workspace (`/assist`)

- **Chats** — a full-page chat with searchable history. Conversations are stored server-side per user
  (`AssistConversation`), private to their owner, and can be renamed, pinned and deleted. The server keeps the
  history, so a client can't rewrite what Assist said or approve changes it never proposed.
- **Automations** — scheduled prompts (daily, weekdays or weekly, UK time) such as a morning briefing or a
  compliance watch. They run as their owner with **read-only** tools, save the result as a conversation and
  optionally email it. Changes are suggested, never made: open the run to continue and approve them.
  Admins can pause, run or delete their team's automations but can't edit their prompts or read results.
- **Connections** — status and tests for the AI model, email and the scheduler; links to the Xero, HMRC/bank
  and Pleasant Link exports; and (admins) the agency's Assist access policy: which areas Assist may read
  or change, enforced on the server for every user and automation.

The scheduler is `GET /api/cron/assist` with `Authorization: Bearer $CRON_SECRET`. Call it every 15 minutes:
`.github/workflows/assist-automations.yml` does this when the repository secrets `APP_URL` and
`CRON_SECRET` are set (Vercel Hobby crons only run daily). Overlapping calls are safe: each run is claimed
atomically.

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
