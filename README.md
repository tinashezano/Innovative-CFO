# Innovative CFO — Operations Platform

An operations app for an accounting firm. It carries a prospect from first
contact through to a live, task-managed client, and then runs the recurring
compliance calendar that keeps them served.

```
LEAD  →  DISCOVERY  →  PROPOSAL  →  SIGNED + PAID  →  ONBOARDING  →  TASK MANAGEMENT
```

Each arrow is automated. Nothing sits waiting for someone to remember it.

---

## What it does

### 1. Lead & qualification
- Capture a lead and it gets a CRM record, a reference (`LD-0004`), an owner and
  a follow-up task due in two days.
- The lead is emailed a **discovery-call booking link** — a public page showing
  real slots drawn from your working hours, with taken slots removed.
- A confirmed booking moves the lead to **Discovery**, raises the discovery-call
  task (with its own subtasks) on the owner's board, confirms to the prospect
  and notifies the owner.
- Logging the call outcome as **Proceed** moves the lead to **Proposal** and
  raises the "build the proposal" task. **Not a fit** marks it lost with the
  reason recorded.
- Drag leads between stages on the pipeline board, or work from the list view.

### 2. Proposal & engagement
- Build a proposal from your service catalogue: line items, quantities, billing
  cycles, discount, VAT, and how much is payable on signature.
- The client gets **one link** that does everything:
  1. **Review** — scope, pricing and terms.
  2. **Sign** — the engagement letter opens in an embedded **DocuSign** session.
  3. **Pay** — a **Paystack** transaction opens the moment the letter is signed.
- Signature and payment both arrive back by webhook, verified and deduplicated.
- A signed proposal is locked against edits — it is a contract record.

### 3. Signed + paid → client
Payment is the hinge. On a successful charge the app:
- creates the **client** with its reference, contact and monthly fee,
- marks the lead **Won** and links the two,
- opens **onboarding** with the full checklist,
- sends the **welcome pack** and the **information request**,
- installs the **recurring compliance calendar**,
- notifies the responsible team member and the managers.

All of it is idempotent — Paystack retries webhooks, and a replay creates
nothing and sends nothing.

### 4. Client onboarding
`Information requested → Information received → Setup → Review → Complete`

- Every client gets the standard checklist (CIPC certificate, director IDs,
  SARS references, bank statements, ledger access, FICA pack, and so on),
  grouped by stage and editable per client.
- Items cycle Pending → Received → Approved with one click; optional items can
  be waived.
- The panel names the required items still outstanding before a stage is left.
- A board across all clients shows every onboarding in flight; dropping one into
  **Complete** flips the client to **Active**.

### 5. Task management
Four views over the same work, all grouped by client:

| View | What it is for |
|---|---|
| **List** | Client-by-client, subtasks expanding inline and tickable in place |
| **Board** | Kanban across To do / In progress / Blocked / Review / Done, drag-and-drop |
| **Calendar** | Month grid keyed on due date, plus an undated-task tray |
| **Timeline** | Gantt bars from start to due date, in 4/8/12-week windows |

- **Subtasks** on every task, one level deep. Closing a parent closes them.
- **Recurring work** — monthly bookkeeping, VAT returns, payroll, provisional
  tax, annual accounts, CIPC returns — generated ahead of the due date with
  their subtasks cloned on.
- **Reminder emails** at 7, 3 and 1 days before, on the day, and daily once
  overdue. Grouped per person: eight tasks due tomorrow is one email, not eight.

---

## Getting started

```bash
npm install
cp .env.example .env      # then edit AUTH_SECRET and CRON_SECRET
npm run setup             # generate client, create the database, seed demo data
npm run dev
```

Open <http://localhost:3000> and sign in:

| Role | Email | Password |
|---|---|---|
| Owner | `admin@innovativecfo.co.za` | `ChangeMe123!` |
| Manager | `manager@innovativecfo.co.za` | `ChangeMe123!` |
| Staff | `accountant@innovativecfo.co.za` | `ChangeMe123!` |

**Change these before anyone else can reach the app.** Add real people under
Settings → Team, then deactivate the demo accounts.

### Try the whole pipeline in five minutes

1. **Leads** → *New lead*. Leave "email the booking link" ticked.
2. Open the lead, copy the **booking link**, open it in a private window and
   pick a slot. Watch the lead move to Discovery and the call task appear.
3. Back on the lead, **Log the outcome** → *Proceed*.
4. **Build proposal** → add lines from the catalogue → *Save and send*.
5. Open the proposal's **client link** → *Accept and sign* → sign → *Pay now* →
   pay on the demo checkout.
6. The client now exists, with onboarding open and the recurring calendar
   installed. Settings → **Email log** shows every message the flow sent.

---

## Going live

Everything runs out of the box in demo mode. Each integration switches on
independently — see **Settings → Integrations** for live status.

### Email
```env
EMAIL_MODE="smtp"
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASSWORD="..."
EMAIL_FROM="Innovative CFO <hello@yourfirm.co.za>"
```
Until then, nothing leaves the machine — every message is recorded in the
Email log instead.

### DocuSign
```env
DOCUSIGN_MODE="live"
DOCUSIGN_INTEGRATION_KEY="..."
DOCUSIGN_USER_ID="..."
DOCUSIGN_ACCOUNT_ID="..."
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
DOCUSIGN_WEBHOOK_SECRET="..."
```
1. Create an app in the DocuSign developer console and add an **RSA keypair**.
2. Grant consent once for the integration key:
   `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=<KEY>&redirect_uri=<URI>`
3. Add a **Connect** subscription pointing at `POST /api/webhooks/docusign`,
   with *Include HMAC signature* on and the same secret in the env var.
   Subscribe to envelope-completed and envelope-declined.
4. Move `DOCUSIGN_BASE_PATH` / `DOCUSIGN_OAUTH_BASE` off the demo hosts when you
   go to production.

In demo mode the engagement letter is rendered and signed inside the app. It is
the *same document* and the *same webhook handler* — only the signing surface
differs, so switching over changes nothing downstream.

### Paystack
```env
PAYSTACK_MODE="live"
PAYSTACK_SECRET_KEY="sk_live_..."
PAYSTACK_PUBLIC_KEY="pk_live_..."
```
Point your Paystack dashboard's webhook URL at `POST /api/webhooks/paystack`.
The signature is an HMAC-SHA512 of the raw body keyed on the secret key, and
the handler checks the amount matches before activating anything.

### The scheduled job
Recurring task generation, reminder emails and proposal expiry all run from one
job. Run it once a day — early morning suits a firm.

**Vercel** — add to `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/run", "schedule": "0 6 * * *" }] }
```

**Any host with cron:**
```bash
0 6 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/run
```

**No scheduler available** — run the bundled one as a long-lived process:
```bash
npm run scheduler        # daily at SCHEDULER_HOUR, default 06:00
npm run jobs:run         # or just once, right now
```

You can also trigger it by hand from **Settings → Automation → Run it now**.

### Database
SQLite by default, so there is nothing to provision. For production, switch to
Postgres — no model changes needed, because every status field is a `String`
backed by a TypeScript union rather than a Prisma enum:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
then `npx prisma db push`.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run setup` | Generate client, create the database, seed demo data |
| `npm run db:reset` | Wipe and reseed |
| `npm run db:push` | Apply schema changes |
| `npm test` | Recurrence and end-to-end workflow tests |
| `npm run typecheck` | TypeScript, no emit |
| `npm run jobs:run` | Run the scheduled job once |
| `npm run scheduler` | Long-running daily scheduler |

---

## How it is built

| | |
|---|---|
| Framework | Next.js 16, App Router, React 19, TypeScript |
| Database | Prisma 6 — SQLite by default, Postgres-ready |
| Styling | Tailwind CSS |
| Auth | Signed JWT session cookie, bcrypt, three roles |
| Email | Nodemailer, with a preview mode that logs instead of sending |
| Signing | DocuSign JWT grant + embedded signing, mock mode included |
| Payments | Paystack, mock mode included |

### Where things live

```
prisma/schema.prisma        Data model, commented by domain
prisma/seed.ts              Demo firm: users, leads, clients, tasks

src/lib/
  workflow.ts               The automation chain (this is the heart of it)
  tasks.ts                  Task creation, recurring generation, reminders
  recurrence.ts             Schedule maths — month clamping, period keys
  reminders.ts              Grouped due-date reminder emails
  docusign.ts               DocuSign adapter (live + mock)
  paystack.ts               Paystack adapter (live + mock)
  documents.ts              Engagement letter renderer
  email-templates.ts        Every outbound email
  onboarding-presets.ts     Standard checklist + recurring calendar presets
  constants.ts              Every status string, in one place

src/app/(app)/              The internal app, behind auth
src/app/book/[token]        Public discovery-call booking
src/app/p/[token]           Public proposal: review, sign, pay
src/app/api/webhooks/       DocuSign + Paystack listeners

tests/                      Recurrence maths and a full pipeline run
```

### Decisions worth knowing about

- **Statuses are strings, not Prisma enums.** SQLite has no enum type; keeping
  them as strings with TypeScript unions means the same schema runs on SQLite
  and Postgres unchanged.
- **Recurring generation is idempotent.** Every generated task carries a
  `periodKey` (`2026-03`, `2026-Q2`), unique per template. Running the job twice
  in a day cannot double up.
- **Generation only ever looks forward.** A template that starts in the past —
  a migrated client, or one paused for a while — generates from today, not from
  its start date. Nobody wants last year's VAT returns raised.
- **Month-length clamping.** A "31st of the month" rule falls on 28 February,
  or 29 in a leap year. Covered by tests.
- **Webhooks are deduplicated and verified.** Every delivery is recorded before
  it is processed; a repeat is recognised and ignored. Paystack payloads are
  checked against the expected amount before a client is activated.
- **Failed emails never roll back business state.** An SMTP outage must not undo
  a signed proposal. Sends are logged and swallowed.
- **Proposal terms are copied, not referenced.** Changing the firm-wide
  engagement terms never alters a contract someone has already signed.

### Roles

| Role | Can |
|---|---|
| **Staff** | Work leads, proposals, clients, onboarding and tasks; edit their own profile |
| **Manager** | Everything above, plus firm settings and deleting clients |
| **Owner** | Everything, plus managing team members and roles |

The app refuses to leave itself without an active owner.
