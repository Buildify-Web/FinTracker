-- FinTracker schema. All money columns are integer paise/rupee-minor-unit free:
-- we store rupees as NUMERIC(14,2) and let Postgres do every sum/aggregate.
-- The app never computes a total in JS/AI — only SQL does (see README).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Founder',
  role TEXT NOT NULL DEFAULT 'owner',
  phone_number TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phone/OTP login. In mock mode (default) the code is returned directly in
-- the request API response instead of being sent via SMS — see src/lib/otp.ts.
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone_number);

-- Upgrade path for databases migrated before phone_number existed on users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank','gateway','cash','card')),
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('income','direct','expense')),
  color TEXT NOT NULL DEFAULT '#b5651d'
);

CREATE TABLE IF NOT EXISTS categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_text TEXT NOT NULL,          -- substring matched against the statement description, case-insensitive
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  client_id UUID,
  project_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  payment_terms_days INT NOT NULL DEFAULT 30,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  service_line TEXT NOT NULL,
  budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','paused')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name TEXT NOT NULL,
  monthly_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_cost_id UUID NOT NULL REFERENCES team_costs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pct NUMERIC(5,2) NOT NULL CHECK (pct >= 0 AND pct <= 100)
);

-- One row per uploaded bank/Slice statement file.
CREATE TABLE IF NOT EXISTS statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bank','slice')),
  filename TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  row_count INT NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','csv','slice')),
  statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
  external_ref TEXT,                 -- raw statement row id/hash, used to de-dupe re-imports
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_dedupe ON transactions(account_id, external_ref) WHERE external_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due','paid','overdue','void')),
  paid_date DATE,
  paid_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);

CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT CHECK (frequency IN ('monthly','yearly',NULL)),
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due','paid','overdue')),
  paid_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  in_use BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bills_due ON bills(due_date);

-- Debt lines: Slice and any other credit-line/credit-card style debt.
CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                       -- e.g. "Slice Card"
  kind TEXT NOT NULL DEFAULT 'credit_line' CHECK (kind IN ('credit_line','credit_card','loan','other')),
  credit_limit NUMERIC(14,2),
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  apr_pct NUMERIC(6,3) NOT NULL DEFAULT 0,  -- annual interest rate, used for payoff projections
  statement_day INT,                        -- day of month the statement is cut
  due_date DATE,                            -- next payment due date
  minimum_payment NUMERIC(14,2) NOT NULL DEFAULT 0,
  full_payment NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_date DATE NOT NULL,
  kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','minimum','full','scheduled')),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('scheduled','paid')),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Starter chart of accounts (Appendix A of the PRD). Safe to edit/delete after install.
INSERT INTO categories (name, type, color) VALUES
  ('Web development', 'income', '#2f7a4f'),
  ('AI automation', 'income', '#3a6ea5'),
  ('LMS / ERP', 'income', '#8a4f9e'),
  ('Retainers', 'income', '#b8860b'),
  ('Ads management', 'income', '#5f7a66'),
  ('Other income', 'income', '#6b7280'),
  ('Allocated team salaries', 'direct', '#b5651d'),
  ('Freelancers & contractors', 'direct', '#b5651d'),
  ('Client hosting & APIs', 'direct', '#b5651d'),
  ('Pass-through ad spend', 'direct', '#b5651d'),
  ('Overhead salaries', 'expense', '#b3402f'),
  ('Rent & utilities', 'expense', '#b3402f'),
  ('Software subscriptions', 'expense', '#b3402f'),
  ('Marketing', 'expense', '#b3402f'),
  ('Travel', 'expense', '#b3402f'),
  ('Professional fees', 'expense', '#b3402f'),
  ('Bank & gateway charges', 'expense', '#b3402f'),
  ('Misc', 'expense', '#b3402f')
ON CONFLICT (name) DO NOTHING;

INSERT INTO settings (key, value) VALUES
  ('cash_floor_months', '2'),
  ('thresholds', '{"overdueMedium":15,"overdueHigh":45,"dueSoonDays":3,"renewSoonDays":7,"expenseJumpPct":30,"marginFloor":25,"staleDays":3}')
ON CONFLICT (key) DO NOTHING;

-- alerts are computed live from the tables above via SQL views (see db/views.sql),
-- but "handled" state needs to persist somewhere:
CREATE TABLE IF NOT EXISTS resolved_alerts (
  alert_key TEXT PRIMARY KEY,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Budgets, custom categories, team & planned hires ----------
-- Additive only (safe to re-run): monthly budget per category, and categories
-- are archived instead of deleted so past transactions keep their label and
-- the seed above can't resurrect one the user removed.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(14,2);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

INSERT INTO categories (name, type, color) VALUES
  ('R&D', 'expense', '#7c3aed'),
  ('Hiring & recruitment', 'expense', '#b3402f')
ON CONFLICT (name) DO NOTHING;

-- A team member with a future start_date is a planned hire; the forecast adds
-- their cost from that date. end_date marks someone leaving.
ALTER TABLE team_costs ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE team_costs ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE team_costs ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE team_costs ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);

-- Imported statement rows the user has already triaged (turned into an invoice/bill, or left as is).
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT false;

-- Money received against a debt (e.g. a loan from family). One row per bank transaction, so re-saving can't double count.
CREATE TABLE IF NOT EXISTS debt_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  drawn_date DATE NOT NULL,
  transaction_id UUID UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Repayment plan for a debt: how long, how much a month, and when the first instalment is due.
ALTER TABLE debts ADD COLUMN IF NOT EXISTS tenure_months INT;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS monthly_payment NUMERIC(14,2);
ALTER TABLE debts ADD COLUMN IF NOT EXISTS plan_start DATE;
