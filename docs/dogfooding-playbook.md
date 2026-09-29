# Pleasant Dogfooding Playbook — Stand Up a Pilot Supply Agency

Treat Pleasant as the actual ops stack for running a real, paying UK care **supply
agency** (temps into care homes / nursing homes). The point is not "can the
product do it" — it is to have a real agency whose every shift, invoice and
payroll run flows through Pleasant, giving a demo with real numbers and a
sharable proof story.

This is the no-CQC supply model: the agency is an employment business; the care
home remains responsible for care delivery. Confirm that with the home and put
it in the framework agreement (GOV.UK: "you may not need to register [with CQC]
if you only provide staff to other registered providers").

---

## 1. Entity & setup (weeks −6 to −4)

| Task | Where | Notes |
|---|---|---|
| Ltd company at Companies House (~£50) | Companies House | Name check first; registered office required |
| Employer registration with HMRC (PAYE) | HMRC | Get the PAYE reference (e.g. `123/AB456`) |
| VAT registration | — | Not required yet; register once taxable turnover nears the threshold |
| Business bank account | e.g. Starling / Revolut / Wise Business | Needed before first payroll |
| Employer's liability insurance (mandatory) | insurer/broker | Plus public liability + professional indemnity |
| Accountant / bookkeeper | — | Statutory accounts, RTI via Pleasant, HMRC payments |
| Set Pleasant Agency record | Oversight/seed | `payrollRef`, weekly `payFrequency`, Monday 16:00 cutoff, Friday pay, 15-min rounding |

GDPR: you will hold special-category data (health info, NI numbers, bank details,
DBS refs). Basis + data-processing agreement with homes; staff consent; keep
records access-controlled. Continental + retained: FPS export gives HMRC the
full file; keep payslips + invoices 6 years under HMRC rules.

---

## 2. The money loop — read this first

- Carers are paid **weekly**; homes typically pay **30 days** (framework terms vary).
- Every filled shift fronts ~4–6 weeks of gross pay. Pilot buffer target:
  80–120 hrs/week × ~£13 avg pay ≈ **£1,100–1,600 gross/week** → keep a
  **£6–8k working-capital buffer** or start with 2–3 regular placements only.
- Economics: framework charge ≈ **£16–18/hr** vs pay ≈ **£12.50–14/hr**.
  After employer NI (~13.8% on the pay), pension (3%), holiday accrual (12.07%),
  the operating margin is thin — **£1.50–3/hr before overhead** (~15–20% gross).
  The invoice `margin` field in Pleasant excludes employer on-costs by design;
  use the payroll run totals (NI + pension + gross) for true P&L.
- **Collection is the pilot.** Invoice the frame home weekly, chase every week.
  An aged-receivables view (see §5.4) keeps this honest.

---

## 3. Week-by-week run

- **W−6..−4** — entity, bank, insurer, HMRC employer reg, accountant. Create the
  Pleasant agency with real PAYE reference and weekly cycle.
- **W−4..−2** — recruit 4–6 carers: Enhanced DBS + barred list, right to work,
  two references, Care Certificate confirmation, NI number, bank details.
  Persist in Pleasant (`RightToWork`, `TrainingRecord`, `StaffDocument`).
- **W−3..−2** — sign the **anchor home**: framework agreement, charge rates,
  how shifts get raised (email/phone → you create them), and the signatory list
  for Pleasant Link authorisation. Create the Client + its wards as Sites.
  Send a test Pleasant Link and get one sign-off through it.
- **W−2** — dry-run week #0 with 2–3 trial shifts: timesheet → carer e-sign →
  client Pleasant Link authorisation → invoice → payroll run → RTI export.
  Fix anything that hurts.
- **W1+** — live cadence below. ~1–2 hrs/week at pilot scale.

### Weekly operating cadence (Mon–Sun, Friday pay)

| Day | Action |
|---|---|
| Mon–Thu | Raise shifts as homes phone/email; book from compliant roster; triage unattended at Monday 16:00 |
| Fri–Sun | Shifts run; timesheets on file |
| Mon 16:00 | **Cutoff** — all timesheets must be approved + client-authorised |
| Mon/Tue | Generate payroll run (paid next Friday); raise the weekly invoice |
| Wed–Thu | Chase the invoice; approve run details; export RTI/FPS |
| Fri | Bank payment via your bank app; pay day |

---

## 4. Pleasant coverage today (the honest map)

- **Payroll identity & cycle** — `Agency.payrollRef`, weekly cycle (cutoff
  Monday 16:00, pay Friday), quarterly rounding; payroll page pre-fills the
  correct period/pay date.
- **Scheduling** — shifts with role, ward (`Site`), charge rate, sleep-in
  allowance; staff shift requests; unattended-triage view feeding the queue.
- **Timesheet + sign-off** — hours + expenses, carer e-sign, and the client
  **Pleasant Link** authorisation (`clientAuthName/Position`) that makes a
  timesheet billable. This is the paper-sign-off killer.
- **Billing** — invoice with hours, charge, pay, margin, VAT; invoice lines
  mirror payroll rounding so billable hours == paid hours.
- **Payroll** — payslips with tax/NI/pension/holiday/expenses, run totals,
  RTI/FPS export, £-exact for HMRC.
- **Compliance data** — right-to-work, training records with expiry, signed
  staff docs, onboarding forms (medical/banking/reference).
- **Oversight** — one screen: unattended shifts, timesheets to approve, latest
  payroll + billing, activity log.

---

## 5. Product fixes that would block a real pilot

### Blockers (build before going live for real)

1. **Client = the home with wards.** Today `Client` is person-shaped
   (firstName/lastName, "people you care for"). For supply work the billable
   entity is a care home and the signatory is its manager. For the pilot you
   can use Client name ≈ home + contact, but invoices/receipts should present
   **home + ward** and land on the framework agreement. (Minor-Medium.)
2. **Aged receivables / cash radar.** Pilot lives or dies on collection. Add a
   small Oversight view: invoices by status (ISSUED vs PAID), days overdue vs
   due date. (Medium — no schema change needed, invoice has issueDate/dueDate.)
3. **Recurring rota.** Supply work is the same carer on the same ward each week.
   A "repeat" action on a shift (create next week's copy on the anchor home
   template) removes the biggest manual time sink. (Medium.)

### Serious, workaround-able (phase 2)

4. **Real dispatch channel.** Triage is an internal simulator — no WhatsApp/SMS
   actually leaves. Pilot runs on phone + Pleasant's internal shift requests.
   Wiring Twilio/Meta is a bigger project; do not hold the pilot on it.
5. **Expiry radar.** DBS/training/right-to-work expiry alerts — the models and
   data exist; a spreadsheet works at pilot scale; surface later.
6. **Accounting/BACS sync.** RTI exports manually; paying is via your bank app.
   A Xero/BACS export is fine to defer.
7. **Framework rate tables.** Per-home per-role charge rates are entered per
   shift today; rate tables are a post-pilot nicety.

### Already fine (leave alone)

Weekly close exists (`NewPayrollRunForm` pre-fills the cycle). Multi-agency
tenancy exists (run the pilot agency alongside the "Brightwater" marketing sandbox).

---

## 6. Decisions to make

1. **One anchor home vs several** — recommendation: one anchor home, 2–3
   regular carers on a rota, then expand. Predictable, reliable payer, fastest
   to proof.
2. **Your pilot P&L** — set the charge to clear pay + employer NI + pension +
   holiday + a margin. Write it as a number before week #0.
3. **Operator** — you, or a hired coordinator (a care-industry ops person who
   can also talk to homes). The pilot is also about what "someone who runs the
   agency" needs from Pleasant.
4. **Same instance or separate** — multi-agency is supported, so run the pilot
   agency *inside* the product (dogfooding) and keep demo data as the marketing
   sandbox.

---

## 7. First concrete move

1. Create the pilot Agency record in Pleasant (real name, PAYE ref, weekly
   Fri-pay cycle) — not the demo agency.
2. Settle the pilot P&L: charge, pay, oncosts, working-capital buffer.
3. Pick the anchor home and its signatories.

Then, in build order: **§5.2 aged receivables → §5.3 recurring rota → §5.1
client-as-home** — then the product is ready to actually run the pilot week loop.