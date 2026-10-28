# FinTracker — Buildify's live finance app

A real, running web app (not a mockup) for Buildify's day-to-day finance:
monthly statement breakdowns, revenue forecasting, debt tracking (Slice and
other credit lines), cash/payables/receivables management, and P&L — all
backed by your own PostgreSQL database on your VPS.

Every total on screen is computed by a SQL query against your own Postgres —
nothing is estimated or made up by an LLM.

## Stack

- Next.js 14 (App Router, TypeScript), server-rendered pages + API routes
- PostgreSQL (your managed instance — this app never provisions its own DB)
- `pg` for queries (plain SQL, no ORM) — see `src/lib/queries.ts`
- Chart.js for charts
- Single-user cookie session auth (no third-party auth provider)

## One-time setup

1. **Copy the env file** and fill it in:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — your managed Postgres connection string. Most managed
     providers need `?sslmode=require` appended.
   - `SESSION_SECRET` — generate with `openssl rand -hex 32`.
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your login. Only used once, by the
     seed script below, to create your account.

2. **Apply the database schema** (safe to re-run; every statement is
   idempotent):

   ```bash
   npm install
   npm run migrate
   ```

   This creates all tables and seeds a starter chart of accounts
   (`db/schema.sql`). It does **not** create fake transactions — the app
   starts empty and real, waiting for your first account/statement.

3. **Create your login:**

   ```bash
   npm run seed:admin
   ```

   Re-run it any time to change your password (same email = update).

## Running it

### On the VPS, with Docker (recommended)

```bash
docker compose up -d --build
```

`docker-compose.yml` reads `DATABASE_URL` and `SESSION_SECRET` from your
shell environment or a `.env` file in the same directory — it does **not**
run its own Postgres container, since you already have a managed one. The
container runs `node db/migrate.mjs` on every start before serving traffic,
so schema changes after a `git pull` apply automatically.

Put this behind your usual reverse proxy (nginx/Caddy) for TLS; the app
itself just listens on port 3000.

### Without Docker

```bash
npm install
npm run build
npm run migrate
npm start   # serves on :3000
```

Run it under `pm2` or `systemd` so it survives reboots.

## Day-to-day usage

- **Statements** — upload a bank or Slice CSV export, map its columns once
  (date / description / amount, or separate debit/credit columns), and every
  row becomes a reviewed transaction. Re-uploading the same statement won't
  double-count rows (de-duped by date + amount + description per account).
  Each statement gets its own breakdown page (spend by category, full
  transaction list).
- **Debt** — add Slice or any other credit line (balance, APR, due date,
  minimum/full payment). The page projects payoff time and total interest at
  both the minimum and full payment, and logs every payment you make against
  it (optionally posting the matching outflow to a bank account).
- **Cash / Receivables / Payables / P&L / Clients & Projects / Forecast** —
  all read live from Postgres; nothing is seeded or fake.
- **Notifications** — rule-based alerts (low cash, overdue invoices, bills
  due soon, thin margins, debt near its limit/due date) computed fresh on
  every page load; thresholds are editable under Notifications → Settings.

## Categorization rules

`categorization_rules` (substring match on the statement description, case
insensitive) auto-tags future imports. Add rules via `POST /api/rules`, e.g.
matching "AWS" to your Hosting category, so re-imports need less manual
cleanup over time.

## Project structure

```
db/schema.sql        single source of truth for the schema (idempotent)
db/migrate.mjs        applies schema.sql to DATABASE_URL
db/seed-admin.mjs     creates/updates your login from env vars
src/lib/queries.ts    every SQL aggregate the app uses (cash, P&L, aging, debt payoff…)
src/lib/auth.ts       session cookie signing/verification
src/app/api/*         route handlers (mutations + reads used by client components)
src/app/(app)/*       the actual screens (server components, data fetched directly)
```
