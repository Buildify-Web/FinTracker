import { unstable_cache } from 'next/cache';
import { query, queryOne } from './db';

// Heavy, shared reads are cached for a minute and dropped on any write (see
// invalidateFinanceCache in db.ts). Only plain-JSON results can go through here.
function cached<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string) {
  return unstable_cache(fn, [key], { tags: ['finance'], revalidate: 60 });
}

export type Account = { id: string; name: string; type: string; opening_balance: string; archived: boolean };
export type Category = { id: string; name: string; type: 'income' | 'direct' | 'expense'; color: string; monthly_budget: string | null };
export type Client = {
  id: string;
  name: string;
  payment_terms_days: number;
  contact_email: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  billing_address: string | null;
  gstin: string | null;
};
export type Project = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  service_line: string;
  budget: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  /** Already received before this app existed (not in the books); only reduces what is left to invoice. */
  prior_paid: string;
};

// Accounts you can use right now (pickers, imports). Archived ones keep their history and balance but are hidden here.
export async function getAccounts() {
  return query<Account>('SELECT * FROM accounts WHERE NOT archived ORDER BY created_at');
}

// Every account, archived or not, with its current balance and entry count. For the Cash page and anything that must add up to total cash.
export type AccountWithBalance = Account & { balance: string; tx_count: string; last_tx: string | null; transfer_count: string };
export async function getAccountsWithBalances() {
  return query<AccountWithBalance>(
    `SELECT a.*,
       a.opening_balance + COALESCE((SELECT SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END) FROM transactions t WHERE t.account_id = a.id), 0) AS balance,
       (SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id) AS tx_count,
       (SELECT MAX(t.date) FROM transactions t WHERE t.account_id = a.id) AS last_tx,
       (SELECT COUNT(*) FROM transfers tr WHERE tr.from_account_id = a.id OR tr.to_account_id = a.id) AS transfer_count
     FROM accounts a ORDER BY a.archived, a.created_at`
  );
}

export async function getCategories() {
  return query<Category>('SELECT * FROM categories WHERE NOT archived ORDER BY type, name');
}

export async function getClients() {
  return query<Client>('SELECT * FROM clients ORDER BY name');
}

export async function getProjects() {
  return query<Project>(
    `SELECT p.*, c.name AS client_name
     FROM projects p LEFT JOIN clients c ON c.id = p.client_id
     ORDER BY c.name, p.service_line`
  );
}

// ---------- Cash (Section 5.2 / 9) ----------

export async function getAccountBalance(accountId: string, asOf?: string): Promise<number> {
  const row = await queryOne<{ balance: string }>(
    `SELECT (a.opening_balance +
        COALESCE(SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END), 0)
      ) AS balance
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id AND ($2::date IS NULL OR t.date <= $2)
     WHERE a.id = $1
     GROUP BY a.opening_balance`,
    [accountId, asOf ?? null]
  );
  return row ? parseFloat(row.balance) : 0;
}

export async function getTotalCash(asOf?: string): Promise<number> {
  // Sum the two sides separately: joining accounts to transactions first would
  // repeat each opening balance once per transaction row.
  const row = await queryOne<{ total: string }>(
    `SELECT (SELECT COALESCE(SUM(opening_balance), 0) FROM accounts) +
        (SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount WHEN direction = 'out' THEN -amount ELSE 0 END), 0)
         FROM transactions WHERE account_id IS NOT NULL AND ($1::date IS NULL OR date <= $1)) AS total`,
    [asOf ?? null]
  );
  return row ? parseFloat(row.total) : 0;
}

async function getAccountBalancesByMonthUncached(months = 6) {
  // One balance-as-of-month-end per account, for the stacked chart (single query).
  const [allAccounts, rows] = await Promise.all([
    query<Account>('SELECT * FROM accounts ORDER BY created_at'),
    query<{ month_end: string; label: string; account_id: string; balance: string }>(
      `WITH m AS (
         SELECT (date_trunc('month', d) + interval '1 month - 1 day')::date AS month_end,
                to_char(d, 'Mon YY') AS label
         FROM generate_series(date_trunc('month', now()) - ($1::int - 1) * interval '1 month', date_trunc('month', now()), interval '1 month') d
       )
       SELECT m.month_end, m.label, a.id AS account_id,
              a.opening_balance + COALESCE(SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END), 0) AS balance
       FROM m CROSS JOIN accounts a
       LEFT JOIN transactions t ON t.account_id = a.id AND t.date <= m.month_end
       GROUP BY m.month_end, m.label, a.id, a.opening_balance
       ORDER BY m.month_end`,
      [months]
    )
  ]);
  const byMonth = new Map<string, { label: string; balances: Record<string, number> }>();
  for (const r of rows) {
    let entry = byMonth.get(r.month_end);
    if (!entry) byMonth.set(r.month_end, (entry = { label: r.label, balances: {} }));
    entry.balances[r.account_id] = parseFloat(r.balance);
  }
  const series = [...byMonth.values()];
  // An archived account only appears if it still held money in one of these months, so the stack always adds up to total cash.
  const accounts = allAccounts.filter((a) => !a.archived || series.some((m) => Math.abs(m.balances[a.id] ?? 0) > 0.004));
  return { accounts, series };
}
export const getAccountBalancesByMonth = cached(getAccountBalancesByMonthUncached, 'getAccountBalancesByMonth');

async function getCashSeriesUncached(days = 180) {
  // Running total cash for each of the last `days` days, in one round trip.
  const rows = await query<{ date: string; cash: string }>(
    `WITH net AS (
       SELECT date, SUM(CASE WHEN direction = 'in' THEN amount WHEN direction = 'out' THEN -amount ELSE 0 END) AS amt
       FROM transactions GROUP BY date
     ), base AS (SELECT COALESCE(SUM(opening_balance), 0) AS opening FROM accounts)
     SELECT to_char(d, 'YYYY-MM-DD') AS date,
            base.opening + COALESCE((SELECT SUM(amt) FROM net WHERE net.date <= d), 0) AS cash
     FROM base, generate_series(current_date - ($1::int - 1), current_date, interval '1 day') AS d
     ORDER BY d`,
    [days]
  );
  return rows.map((r) => ({ date: r.date, cash: parseFloat(r.cash) }));
}
export const getCashSeries = cached(getCashSeriesUncached, 'getCashSeries');

// ---------- Net burn / runway (Section 9) ----------

export async function getNetBurnLast3Months(): Promise<number> {
  const row = await queryOne<{ burn: string }>(
    `SELECT COALESCE(AVG(monthly), 0) AS burn FROM (
       SELECT date_trunc('month', date) AS m,
         SUM(CASE WHEN direction = 'out' THEN amount ELSE -amount END) AS monthly
       FROM transactions
       WHERE date >= date_trunc('month', now()) - interval '3 months' AND transfer_id IS NULL
       GROUP BY m
     ) x`
  );
  return row ? parseFloat(row.burn) : 0;
}

export async function getRunwayMonths(): Promise<number | null> {
  const burn = await getNetBurnLast3Months();
  if (burn <= 0) return null; // cash positive
  const cash = await getTotalCash();
  return cash / burn;
}

// ---------- Monthly P&L (Section 5.5 / 9) ----------

export type MonthlyPnl = {
  month: string;
  label: string;
  revenue: number;
  direct: number;
  expense: number;
  profit: number;
  gross_margin: number;
  net_margin: number;
};

async function getMonthlyPnlUncached(months = 12): Promise<MonthlyPnl[]> {
  const rows = await query<{
    month: string;
    revenue: string;
    direct: string;
    expense: string;
  }>(
    `WITH months AS (
       SELECT generate_series(date_trunc('month', now()) - interval '${months - 1} months', date_trunc('month', now()), interval '1 month') AS m
     )
     SELECT
       to_char(months.m, 'YYYY-MM-DD') AS month,
       COALESCE(SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE 0 END), 0) AS revenue,
       COALESCE(SUM(CASE WHEN t.direction = 'out' AND c.type = 'direct' THEN t.amount ELSE 0 END), 0) AS direct,
       COALESCE(SUM(CASE WHEN t.direction = 'out' AND (c.type = 'expense' OR c.type IS NULL) THEN t.amount ELSE 0 END), 0) AS expense
     FROM months
     LEFT JOIN transactions t ON date_trunc('month', t.date) = months.m AND t.transfer_id IS NULL
     LEFT JOIN categories c ON c.id = t.category_id
     GROUP BY months.m
     ORDER BY months.m`
  );
  return rows.map((r) => {
    const revenue = parseFloat(r.revenue);
    const direct = parseFloat(r.direct);
    const expense = parseFloat(r.expense);
    const profit = revenue - direct - expense;
    const d = new Date(r.month);
    return {
      month: r.month,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      revenue,
      direct,
      expense,
      profit,
      gross_margin: revenue ? ((revenue - direct) / revenue) * 100 : 0,
      net_margin: revenue ? (profit / revenue) * 100 : 0
    };
  });
}
export const getMonthlyPnl = cached(getMonthlyPnlUncached, 'getMonthlyPnl');

export async function getExpenseByCategory(monthStart: string) {
  return query<{ name: string; total: string }>(
    `SELECT COALESCE(c.name, 'Other') AS name, SUM(t.amount) AS total
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.direction = 'out' AND t.transfer_id IS NULL AND date_trunc('month', t.date) = date_trunc('month', $1::date)
     GROUP BY c.name ORDER BY total DESC`,
    [monthStart]
  );
}

export async function getRevenueByServiceLine(monthStart: string) {
  return query<{ name: string; total: string }>(
    `SELECT COALESCE(p.service_line, 'Other') AS name, SUM(iv.amount) AS total
     FROM invoices iv LEFT JOIN projects p ON p.id = iv.project_id
     WHERE iv.status = 'paid' AND date_trunc('month', iv.paid_date) = date_trunc('month', $1::date)
     GROUP BY p.service_line ORDER BY total DESC`,
    [monthStart]
  );
}

// ---------- Dashboard: the same four views over any date range ----------
// `from` / `to` are inclusive YYYY-MM-DD days (see dashboardRange.ts).

export async function getCashSeriesBetween(from: string, to: string) {
  const rows = await query<{ date: string; cash: string }>(
    `WITH net AS (
       SELECT date, SUM(CASE WHEN direction = 'in' THEN amount WHEN direction = 'out' THEN -amount ELSE 0 END) AS amt
       FROM transactions GROUP BY date
     ), base AS (SELECT COALESCE(SUM(opening_balance), 0) AS opening FROM accounts)
     SELECT to_char(d, 'YYYY-MM-DD') AS date,
            base.opening + COALESCE((SELECT SUM(amt) FROM net WHERE net.date <= d), 0) AS cash
     FROM base, generate_series($1::date, $2::date, interval '1 day') AS d
     ORDER BY d`,
    [from, to]
  );
  return rows.map((r) => ({ date: r.date, cash: parseFloat(r.cash) }));
}

// Income and spending per week or month inside the range (same income / direct / expense split as the P&L).
export async function getPnlBetween(from: string, to: string, unit: 'week' | 'month'): Promise<MonthlyPnl[]> {
  const rows = await query<{ month: string; label: string; revenue: string; direct: string; expense: string }>(
    `WITH b AS (
       SELECT generate_series(date_trunc($3, $1::date), date_trunc($3, $2::date), ('1 ' || $3)::interval) AS s
     )
     SELECT to_char(b.s, 'YYYY-MM-DD') AS month,
       to_char(GREATEST(b.s, $1::date), CASE WHEN $3 = 'week' THEN 'DD Mon' ELSE 'Mon YY' END) AS label,
       COALESCE(SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE 0 END), 0) AS revenue,
       COALESCE(SUM(CASE WHEN t.direction = 'out' AND c.type = 'direct' THEN t.amount ELSE 0 END), 0) AS direct,
       COALESCE(SUM(CASE WHEN t.direction = 'out' AND (c.type = 'expense' OR c.type IS NULL) THEN t.amount ELSE 0 END), 0) AS expense
     FROM b
     LEFT JOIN transactions t ON t.date BETWEEN $1::date AND $2::date AND date_trunc($3, t.date) = b.s AND t.transfer_id IS NULL
     LEFT JOIN categories c ON c.id = t.category_id
     GROUP BY b.s
     ORDER BY b.s`,
    [from, to, unit]
  );
  return rows.map((r) => {
    const revenue = parseFloat(r.revenue);
    const direct = parseFloat(r.direct);
    const expense = parseFloat(r.expense);
    const profit = revenue - direct - expense;
    return { month: r.month, label: r.label, revenue, direct, expense, profit, gross_margin: revenue ? ((revenue - direct) / revenue) * 100 : 0, net_margin: revenue ? (profit / revenue) * 100 : 0 };
  });
}

export async function getExpenseByCategoryBetween(from: string, to: string) {
  return query<{ name: string; total: string }>(
    `SELECT COALESCE(c.name, 'Other') AS name, SUM(t.amount) AS total
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.direction = 'out' AND t.transfer_id IS NULL AND t.date BETWEEN $1::date AND $2::date
     GROUP BY c.name ORDER BY total DESC`,
    [from, to]
  );
}

export async function getRevenueByServiceLineBetween(from: string, to: string) {
  return query<{ name: string; total: string }>(
    `SELECT COALESCE(p.service_line, 'Other') AS name, SUM(iv.amount) AS total
     FROM invoices iv LEFT JOIN projects p ON p.id = iv.project_id
     WHERE iv.status = 'paid' AND iv.paid_date BETWEEN $1::date AND $2::date
     GROUP BY p.service_line ORDER BY total DESC`,
    [from, to]
  );
}

// ---------- Receivables (Section 5.3 / 9) ----------

export type Invoice = {
  id: string;
  number: string;
  client_id: string | null;
  client_name: string | null;
  project_id: string | null;
  amount: string;
  issue_date: string;
  due_date: string;
  status: string;
  paid_date: string | null;
  days_overdue: number;
};

export async function getInvoices(openOnly = false) {
  return query<Invoice>(
    `SELECT iv.*, cl.name AS client_name,
       GREATEST(0, (current_date - iv.due_date))::int AS days_overdue
     FROM invoices iv LEFT JOIN clients cl ON cl.id = iv.client_id
     ${openOnly ? "WHERE iv.status != 'paid'" : ''}
     ORDER BY iv.due_date DESC`
  );
}

export async function getAgingBuckets() {
  const rows = await query<{ bucket: string; total: string }>(
    `SELECT
       CASE
         WHEN (current_date - due_date) <= 30 THEN '0-30'
         WHEN (current_date - due_date) <= 60 THEN '31-60'
         WHEN (current_date - due_date) <= 90 THEN '61-90'
         ELSE '90+'
       END AS bucket,
       SUM(amount) AS total
     FROM invoices WHERE status != 'paid'
     GROUP BY bucket`
  );
  const buckets: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const r of rows) buckets[r.bucket] = parseFloat(r.total);
  return buckets;
}

export async function getOutstandingByClient() {
  return query<{ name: string; total: string }>(
    `SELECT cl.name, SUM(iv.amount) AS total
     FROM invoices iv JOIN clients cl ON cl.id = iv.client_id
     WHERE iv.status != 'paid'
     GROUP BY cl.name ORDER BY total DESC`
  );
}

// Average days-to-pay for every client that has paid invoices, keyed by client id.
export async function getAvgDaysToPayByClient(): Promise<Map<string, number>> {
  const rows = await query<{ client_id: string; avg_days: string }>(
    `SELECT client_id, AVG(paid_date - issue_date) AS avg_days FROM invoices
     WHERE client_id IS NOT NULL AND status = 'paid' AND paid_date IS NOT NULL
     GROUP BY client_id`
  );
  return new Map(rows.map((r) => [r.client_id, Math.round(parseFloat(r.avg_days))]));
}

export async function getDSO(): Promise<number> {
  const rec = await queryOne<{ total: string }>(`SELECT COALESCE(SUM(amount), 0) AS total FROM invoices WHERE status != 'paid'`);
  const rev = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE direction = 'in' AND transfer_id IS NULL AND date >= current_date - interval '90 days'`
  );
  const avgDaily = rev ? parseFloat(rev.total) / 90 : 0;
  return avgDaily ? parseFloat(rec!.total) / avgDaily : 0;
}

// ---------- Payables (Section 5.4) ----------

export type Bill = {
  id: string;
  vendor: string;
  category_id: string | null;
  category_name: string | null;
  amount: string;
  due_date: string;
  recurring: boolean;
  frequency: string | null;
  status: string;
  in_use: boolean;
  paid_amount: string;
  /** What is still owed: amount minus everything paid so far. */
  remaining: string;
  /** Payroll breakdown, one line per person, when the bill came from the Payroll page. */
  items: { key: string; name: string; role: string | null; amount: number }[] | null;
  payroll_month: string | null;
  client_id: string | null;
  project_id: string | null;
  client_name: string | null;
  payments: { id: string; amount: number; paid_date: string; item_key: string | null; label: string | null }[];
};

export async function getBills(openOnly = false) {
  return query<Bill>(
    `SELECT b.*, c.name AS category_name, cl.name AS client_name, (b.amount - b.paid_amount) AS remaining,
       COALESCE((SELECT json_agg(json_build_object('id', p.id, 'amount', p.amount, 'paid_date', p.paid_date, 'item_key', p.item_key, 'label', p.label) ORDER BY p.created_at)
                 FROM bill_payments p WHERE p.bill_id = b.id), '[]'::json) AS payments
     FROM bills b LEFT JOIN categories c ON c.id = b.category_id LEFT JOIN clients cl ON cl.id = b.client_id
     ${openOnly ? "WHERE b.status != 'paid'" : ''}
     ORDER BY b.due_date`
  );
}

export async function getRecurringCostsByCategory() {
  return query<{ name: string; total: string }>(
    `SELECT COALESCE(c.name, 'Other') AS name, SUM(b.amount) AS total
     FROM bills b LEFT JOIN categories c ON c.id = b.category_id
     WHERE b.recurring = true
     GROUP BY c.name ORDER BY total DESC`
  );
}

// ---------- Clients & Projects (Section 5.6) ----------

export type ProjectFinance = { revenue: number; cost: number; margin: number; budgetUsed: number };

// Finance numbers for every project at once (two queries total, however many projects).
export async function getProjectFinances(): Promise<Map<string, ProjectFinance & { client_id: string | null }>> {
  const rows = await query<{ id: string; client_id: string | null; budget: string; revenue: string; direct_cost: string; team_cost: string }>(
    `SELECT p.id, p.client_id, p.budget,
       COALESCE(inv.revenue, 0) AS revenue,
       COALESCE(dc.direct_cost, 0) AS direct_cost,
       COALESCE(tm.team_cost, 0) AS team_cost
     FROM projects p
     LEFT JOIN (SELECT project_id, SUM(amount) AS revenue FROM invoices WHERE status = 'paid' GROUP BY project_id) inv ON inv.project_id = p.id
     LEFT JOIN (SELECT t.project_id, SUM(t.amount) AS direct_cost
                FROM transactions t JOIN categories c ON c.id = t.category_id
                WHERE t.direction = 'out' AND c.type = 'direct' GROUP BY t.project_id) dc ON dc.project_id = p.id
     LEFT JOIN (SELECT ta.project_id, SUM(tc.monthly_cost * ta.pct / 100.0) AS team_cost
                FROM team_allocations ta JOIN team_costs tc ON tc.id = ta.team_cost_id
                WHERE (tc.start_date IS NULL OR tc.start_date <= current_date) AND (tc.end_date IS NULL OR tc.end_date >= current_date)
                GROUP BY ta.project_id) tm ON tm.project_id = p.id`
  );
  const out = new Map<string, ProjectFinance & { client_id: string | null }>();
  for (const r of rows) {
    const revenue = parseFloat(r.revenue);
    const cost = parseFloat(r.direct_cost) + parseFloat(r.team_cost);
    const budget = parseFloat(r.budget);
    out.set(r.id, {
      client_id: r.client_id,
      revenue,
      cost,
      margin: revenue ? ((revenue - cost) / revenue) * 100 : 0,
      budgetUsed: budget ? Math.min(100, Math.round((cost / budget) * 100)) : 0
    });
  }
  return out;
}

const EMPTY_PROJECT_FINANCE: ProjectFinance = { revenue: 0, cost: 0, margin: 0, budgetUsed: 0 };

export function projectFinanceOf(map: Map<string, ProjectFinance>, projectId: string): ProjectFinance {
  return map.get(projectId) ?? EMPTY_PROJECT_FINANCE;
}

// Paid revenue and average project margin for every client, keyed by client id.
export async function getClientFinances(
  projectFin?: Map<string, ProjectFinance & { client_id: string | null }>
): Promise<Map<string, { revenue: number; avgMargin: number }>> {
  const [rows, fins] = await Promise.all([
    query<{ client_id: string; revenue: string }>(
      `SELECT client_id, SUM(amount) AS revenue FROM invoices WHERE client_id IS NOT NULL AND status = 'paid' GROUP BY client_id`
    ),
    projectFin ?? getProjectFinances()
  ]);
  const margins = new Map<string, number[]>();
  for (const f of fins.values()) {
    if (!f.client_id) continue;
    const list = margins.get(f.client_id) ?? [];
    list.push(f.margin);
    margins.set(f.client_id, list);
  }
  const out = new Map<string, { revenue: number; avgMargin: number }>();
  for (const [clientId, list] of margins) out.set(clientId, { revenue: 0, avgMargin: list.reduce((a, b) => a + b, 0) / list.length });
  for (const r of rows) out.set(r.client_id, { revenue: parseFloat(r.revenue), avgMargin: out.get(r.client_id)?.avgMargin ?? 0 });
  return out;
}

// ---------- Debts / Slice (Section: debt tracking) ----------

export type Debt = {
  id: string;
  name: string;
  kind: string;
  credit_limit: string | null;
  current_balance: string;
  apr_pct: string;
  statement_day: number | null;
  due_date: string | null;
  minimum_payment: string;
  full_payment: string;
  tenure_months: number | null;
  monthly_payment: string | null;
  plan_start: string | null;
};

export async function getDebts() {
  return query<Debt>('SELECT * FROM debts ORDER BY created_at');
}

export async function getDebt(id: string) {
  return queryOne<Debt>('SELECT * FROM debts WHERE id = $1', [id]);
}

export async function getDebtPayments(debtId: string) {
  return query(
    `SELECT * FROM debt_payments WHERE debt_id = $1 ORDER BY paid_date DESC`,
    [debtId]
  );
}

export type DebtDue = { id: string; name: string; kind: string; due_date: string; amount: string; balance: string; overdue: boolean; total: string };

// Debts with a repayment overdue or coming up in the next 30 days. The amount is the plan's monthly
// payment (else the minimum), never more than what is still owed.
export async function getDebtsDue() {
  return query<DebtDue>(
    `SELECT id, name, kind, due_date, current_balance AS balance,
            LEAST(current_balance, COALESCE(NULLIF(monthly_payment, 0), NULLIF(minimum_payment, 0), current_balance)) AS amount,
            due_date < current_date AS overdue,
            SUM(LEAST(current_balance, COALESCE(NULLIF(monthly_payment, 0), NULLIF(minimum_payment, 0), current_balance))) OVER () AS total
     FROM debts
     WHERE current_balance > 0 AND due_date IS NOT NULL AND due_date <= current_date + 30
     ORDER BY due_date, name`
  );
}

export async function getTotalDebt(): Promise<number> {
  const row = await queryOne<{ total: string }>('SELECT COALESCE(SUM(current_balance), 0) AS total FROM debts');
  return row ? parseFloat(row.total) : 0;
}

// Payoff / amortization projection: fixed monthly payment, monthly-compounded APR.
export function payoffProjection(balance: number, aprPct: number, monthlyPayment: number, maxMonths = 240) {
  const monthlyRate = aprPct / 100 / 12;
  const schedule: { month: number; balance: number; interest: number; principal: number }[] = [];
  let bal = balance;
  let totalInterest = 0;
  for (let m = 1; m <= maxMonths && bal > 0.5; m++) {
    const interest = bal * monthlyRate;
    let principal = monthlyPayment - interest;
    if (principal <= 0) {
      // payment doesn't even cover interest — debt never clears at this payment level
      schedule.push({ month: m, balance: bal, interest, principal: 0 });
      return { schedule, payoffMonths: null, totalInterest: null };
    }
    if (principal > bal) principal = bal;
    bal -= principal;
    totalInterest += interest;
    schedule.push({ month: m, balance: bal, interest, principal });
  }
  return { schedule, payoffMonths: schedule.length, totalInterest };
}

// ---------- Budgets & team ----------

export type BudgetLine = { id: string; name: string; type: string; budget: number; spent: number; pct: number };

// This month's spending against each category's monthly budget.
export async function getBudgetStatus(): Promise<BudgetLine[]> {
  const rows = await query<{ id: string; name: string; type: string; budget: string; spent: string }>(
    `SELECT c.id, c.name, c.type, c.monthly_budget AS budget, COALESCE(SUM(t.amount), 0) AS spent
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id AND t.direction = 'out'
       AND t.date >= date_trunc('month', current_date) AND t.date < date_trunc('month', current_date) + interval '1 month'
     WHERE c.monthly_budget > 0 AND NOT c.archived
     GROUP BY c.id ORDER BY c.type, c.name`
  );
  return rows.map((r) => {
    const budget = parseFloat(r.budget);
    const spent = parseFloat(r.spent);
    return { id: r.id, name: r.name, type: r.type, budget, spent, pct: budget ? Math.round((spent / budget) * 100) : 0 };
  });
}

export type TeamMember = {
  id: string;
  person_name: string;
  role: string | null;
  monthly_cost: string;
  start_date: string | null;
  end_date: string | null;
  category_id: string | null;
  category_name: string | null;
  project_id: string | null;
  project_label: string | null;
  project_pct: string | null;
};

export async function getTeam() {
  return query<TeamMember>(
    `SELECT tc.*, c.name AS category_name, ta.project_id, ta.pct AS project_pct,
       p.service_line AS project_label
     FROM team_costs tc
     LEFT JOIN categories c ON c.id = tc.category_id
     LEFT JOIN team_allocations ta ON ta.team_cost_id = tc.id
     LEFT JOIN projects p ON p.id = ta.project_id
     LEFT JOIN clients cl ON cl.id = p.client_id
     ORDER BY tc.start_date NULLS FIRST, tc.person_name`
  );
}

// ---------- Payroll ----------

export type PayrollRow = {
  id: string;
  person_name: string;
  role: string | null;
  monthly_cost: string;
  payable: string;
  active_days: number;
  days_in_month: number;
  /** The whole roster's payable, summed in SQL (same value on every row). */
  total: string;
};

// Everyone on the team who works at all during `ym` (YYYY-MM), with their cost
// prorated by the days they're on the team that month (joiners and leavers).
export async function getPayrollRoster(ym: string) {
  return query<PayrollRow>(
    `WITH m AS (
       SELECT ($1 || '-01')::date AS ms, (date_trunc('month', ($1 || '-01')::date) + interval '1 month - 1 day')::date AS me
     ), x AS (
       SELECT tc.id, tc.person_name, tc.role, tc.monthly_cost, tc.created_at,
         GREATEST(0, LEAST(COALESCE(tc.end_date, m.me), m.me) - GREATEST(COALESCE(tc.start_date, m.ms), m.ms) + 1) AS active_days,
         (m.me - m.ms + 1) AS days_in_month
       FROM team_costs tc, m
     )
     SELECT id, person_name, role, monthly_cost, active_days, days_in_month,
            ROUND(monthly_cost * active_days / days_in_month, 2) AS payable,
            SUM(ROUND(monthly_cost * active_days / days_in_month, 2)) OVER () AS total
     FROM x WHERE active_days > 0
     ORDER BY monthly_cost DESC, person_name`,
    [ym]
  );
}

export type PayrollBaseline = {
  cash: number;
  collections: number;
  otherExpenses: number;
  debtMinimums: number;
  cashFloorMonths: number;
};

// The numbers the affordability planner starts from; the page lets the user change each one.
//  - otherExpenses: what leaves the bank in a typical month apart from salaries and debt repayments
//  - collections: open invoices (including overdue) due by the end of the month
export async function getPayrollBaseline(ym: string): Promise<PayrollBaseline> {
  const [cash, row] = await Promise.all([
    getTotalCash(),
    queryOne<{ other: string; collections: string; debt: string; floor: string | null }>(
      `SELECT
         (SELECT COALESCE(AVG(monthly), 0) FROM (
            SELECT SUM(t.amount) AS monthly
            FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.direction = 'out' AND t.transfer_id IS NULL
              AND t.date >= date_trunc('month', now()) - interval '3 months' AND t.date < date_trunc('month', now())
              AND COALESCE(c.name, '') <> 'Debt Repayment'
              AND COALESCE(c.name, '') NOT ILIKE '%salar%'
              AND NOT EXISTS (SELECT 1 FROM team_costs tc WHERE tc.category_id = t.category_id)
            GROUP BY date_trunc('month', t.date)
          ) x) AS other,
         (SELECT COALESCE(SUM(amount), 0) FROM invoices
           WHERE status IN ('due','overdue') AND due_date <= (date_trunc('month', ($1 || '-01')::date) + interval '1 month - 1 day')::date) AS collections,
         (SELECT COALESCE(SUM(minimum_payment), 0) FROM debts WHERE current_balance > 0) AS debt,
         (SELECT value #>> '{}' FROM settings WHERE key = 'cash_floor_months') AS floor`,
      [ym]
    )
  ]);
  return {
    cash,
    collections: parseFloat(row?.collections ?? '0'),
    otherExpenses: parseFloat(row?.other ?? '0'),
    debtMinimums: parseFloat(row?.debt ?? '0'),
    cashFloorMonths: Number(row?.floor ?? 2) || 0
  };
}

export type PayrollBill = { id: string; vendor: string; amount: string; due_date: string; status: string; paid_amount: string; items: { key: string; name: string; role: string | null; amount: number }[] | null };

export function payrollVendor(ym: string) {
  return `Payroll — ${monthLabelOf(ym)}`;
}
function monthLabelOf(ym: string) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[parseInt(ym.slice(5, 7), 10) - 1]} ${ym.slice(0, 4)}`;
}

// The consolidated bill already pushed to Bills for this month, if any.
export async function getPayrollBill(ym: string) {
  return queryOne<PayrollBill>('SELECT id, vendor, amount, due_date, status, paid_amount, items FROM bills WHERE payroll_month = $1 OR vendor = $2 ORDER BY due_date DESC LIMIT 1', [ym, payrollVendor(ym)]);
}

// The per-person amounts last sent to Bills for this month (person id -> amount), or null if none were.
export async function getSavedPayrollPlan(ym: string): Promise<Record<string, number> | null> {
  const row = await queryOne<{ amounts: Record<string, number> }>('SELECT amounts FROM payroll_plans WHERE month = $1', [ym]);
  return row?.amounts ?? null;
}

// How much of each project has been invoiced so far (voided invoices don't count), for part-payment invoices.
export async function getProjectBilled(): Promise<Record<string, number>> {
  const rows = await query<{ project_id: string; billed: string }>(
    `SELECT project_id, SUM(amount + advance_paid) AS billed FROM invoices WHERE project_id IS NOT NULL AND status != 'void' GROUP BY project_id`
  );
  return Object.fromEntries(rows.map((r) => [r.project_id, parseFloat(r.billed)]));
}

// ---------- Alerts (Section 6) ----------

export type Alert = {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  message: string;
  link: string;
  action: string;
};

async function getAlertsUncached(): Promise<Alert[]> {
  const out: Alert[] = [];
  const [settingsRows, burn, cash, overdueInvoices, projectFins, projects, debts, resolved, budgets] = await Promise.all([
    query<{ key: string; value: unknown }>('SELECT key, value FROM settings'),
    getNetBurnLast3Months(),
    getTotalCash(),
    query<{ id: string; number: string; client_name: string; amount: string; days_overdue: number }>(
      `SELECT iv.id, iv.number, cl.name AS client_name, iv.amount,
         GREATEST(0, (current_date - iv.due_date))::int AS days_overdue
       FROM invoices iv LEFT JOIN clients cl ON cl.id = iv.client_id
       WHERE iv.status != 'paid' AND iv.due_date < current_date`
    ),
    getProjectFinances(),
    query<{ id: string; service_line: string; client_name: string | null; status: string }>(
      `SELECT p.id, p.service_line, cl.name AS client_name, p.status FROM projects p LEFT JOIN clients cl ON cl.id = p.client_id WHERE p.status = 'active'`
    ),
    getDebts(),
    query<{ alert_key: string }>('SELECT alert_key FROM resolved_alerts'),
    getBudgetStatus()
  ]);
  const settings: Record<string, unknown> = {};
  for (const r of settingsRows) settings[r.key] = r.value;
  const cashFloorMonths = Number(settings.cash_floor_months ?? 2);
  const thresholds = (settings.thresholds as Record<string, number>) ?? {};

  if (burn > 0) {
    const floor = burn * cashFloorMonths;
    if (cash < floor) {
      out.push({
        id: 'cash-low',
        type: 'cash',
        severity: 'high',
        message: `Cash covers less than ${cashFloorMonths} months of spending.`,
        link: '/cash',
        action: 'See cash'
      });
    }
  }

  for (const iv of overdueInvoices) {
    const high = thresholds.overdueHigh ?? 45;
    const medium = thresholds.overdueMedium ?? 15;
    if (iv.days_overdue >= high) {
      out.push({ id: `inv-${iv.id}`, type: 'invoice', severity: 'high', message: `${iv.number} (${iv.client_name ?? 'client'}) is ${iv.days_overdue} days overdue.`, link: '/receivables', action: 'See invoice' });
    } else if (iv.days_overdue >= medium) {
      out.push({ id: `inv-${iv.id}`, type: 'invoice', severity: 'medium', message: `${iv.number} (${iv.client_name ?? 'client'}) is ${iv.days_overdue} days overdue.`, link: '/receivables', action: 'See invoice' });
    }
  }

  const dueSoonBills = await query<{ id: string; vendor: string; amount: string; due_date: string }>(
    `SELECT id, vendor, amount, due_date FROM bills WHERE status != 'paid' AND due_date BETWEEN current_date AND current_date + interval '${thresholds.dueSoonDays ?? 3} days'`
  );
  for (const b of dueSoonBills) {
    out.push({ id: `bill-${b.id}`, type: 'bill', severity: 'medium', message: `${b.vendor} is due on ${b.due_date}.`, link: '/payables', action: 'See bill' });
  }

  const marginFloor = thresholds.marginFloor ?? 25;
  for (const p of projects) {
    const fin = projectFinanceOf(projectFins, p.id);
    if (fin.revenue > 0 && fin.margin < marginFloor) {
      out.push({ id: `margin-${p.id}`, type: 'margin', severity: 'medium', message: `${p.service_line} is only ${Math.round(fin.margin)}% profitable (target ${marginFloor}%).`, link: '/clients', action: 'See client' });
    }
  }

  // Debt alerts: payment due soon, balance near limit.
  for (const d of debts) {
    if (d.due_date) {
      const days = Math.round((new Date(d.due_date).getTime() - Date.now()) / 86400000);
      if (days >= 0 && days <= (thresholds.dueSoonDays ?? 3)) {
        out.push({ id: `debt-${d.id}`, type: 'debt', severity: 'medium', message: `${d.name}: minimum payment of ₹${d.minimum_payment} is due in ${days} day${days === 1 ? '' : 's'}.`, link: '/debt', action: 'See debt' });
      }
    }
    if (d.credit_limit && parseFloat(d.current_balance) / parseFloat(d.credit_limit) > 0.85) {
      out.push({ id: `debt-limit-${d.id}`, type: 'debt', severity: 'medium', message: `${d.name} is over 85% of its credit limit.`, link: '/debt', action: 'See debt' });
    }
  }

  // Budget alerts are keyed by month so a new month starts fresh even if last month's was dismissed.
  const monthKey = new Date().toISOString().slice(0, 7);
  for (const b of budgets) {
    if (b.pct >= 100) {
      out.push({ id: `budget-${b.id}-${monthKey}`, type: 'budget', severity: 'high', message: `${b.name} is over budget this month (${b.pct}% used).`, link: '/pnl', action: 'See budgets' });
    } else if (b.pct >= 90) {
      out.push({ id: `budget-${b.id}-${monthKey}`, type: 'budget', severity: 'medium', message: `${b.name} has used ${b.pct}% of this month's budget.`, link: '/pnl', action: 'See budgets' });
    }
  }

  const resolvedSet = new Set(resolved.map((r) => r.alert_key));
  return out
    .filter((a) => !resolvedSet.has(a.id))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2, info: 3 }[a.severity] - { high: 0, medium: 1, low: 2, info: 3 }[b.severity]));
}
export const getAlerts = cached(getAlertsUncached, 'getAlerts');
