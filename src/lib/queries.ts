import { query, queryOne } from './db';

export type Account = { id: string; name: string; type: string; opening_balance: string };
export type Category = { id: string; name: string; type: 'income' | 'direct' | 'expense'; color: string };
export type Client = { id: string; name: string; payment_terms_days: number; contact_email: string | null };
export type Project = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  service_line: string;
  budget: string;
  status: string;
  start_date: string | null;
};

export async function getAccounts() {
  return query<Account>('SELECT * FROM accounts ORDER BY created_at');
}

export async function getCategories() {
  return query<Category>('SELECT * FROM categories ORDER BY type, name');
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
  const row = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(a.opening_balance), 0) +
        COALESCE(SUM(CASE WHEN t.direction = 'in' THEN t.amount WHEN t.direction = 'out' THEN -t.amount ELSE 0 END), 0) AS total
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id AND ($1::date IS NULL OR t.date <= $1)`,
    [asOf ?? null]
  );
  return row ? parseFloat(row.total) : 0;
}

export async function getAccountBalancesByMonth(months = 6) {
  // One balance-as-of-month-end per account, for the stacked chart.
  const accounts = await getAccounts();
  const monthEnds = await query<{ month_end: string; label: string }>(
    `SELECT (date_trunc('month', d) + interval '1 month - 1 day')::date AS month_end,
            to_char(d, 'Mon YY') AS label
     FROM generate_series(date_trunc('month', now()) - interval '${months - 1} months', date_trunc('month', now()), interval '1 month') d`
  );
  const series = [];
  for (const m of monthEnds) {
    const balances: Record<string, number> = {};
    for (const a of accounts) balances[a.id] = await getAccountBalance(a.id, m.month_end);
    series.push({ label: m.label, balances });
  }
  return { accounts, series };
}

export async function getCashSeries(days = 180) {
  const rows = await query<{ d: string }>(
    `SELECT generate_series(current_date - interval '${days - 1} days', current_date, interval '1 day')::date AS d`
  );
  const out = [];
  for (const r of rows) out.push({ date: r.d, cash: await getTotalCash(r.d) });
  return out;
}

// ---------- Net burn / runway (Section 9) ----------

export async function getNetBurnLast3Months(): Promise<number> {
  const row = await queryOne<{ burn: string }>(
    `SELECT COALESCE(AVG(monthly), 0) AS burn FROM (
       SELECT date_trunc('month', date) AS m,
         SUM(CASE WHEN direction = 'out' THEN amount ELSE -amount END) AS monthly
       FROM transactions
       WHERE date >= date_trunc('month', now()) - interval '3 months'
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

export async function getMonthlyPnl(months = 12): Promise<MonthlyPnl[]> {
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
     LEFT JOIN transactions t ON date_trunc('month', t.date) = months.m
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

export async function getExpenseByCategory(monthStart: string) {
  return query<{ name: string; total: string }>(
    `SELECT COALESCE(c.name, 'Other') AS name, SUM(t.amount) AS total
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.direction = 'out' AND date_trunc('month', t.date) = date_trunc('month', $1::date)
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

export async function getAvgDaysToPay(clientId: string): Promise<number | null> {
  const row = await queryOne<{ avg_days: string | null }>(
    `SELECT AVG(paid_date - issue_date) AS avg_days FROM invoices
     WHERE client_id = $1 AND status = 'paid' AND paid_date IS NOT NULL`,
    [clientId]
  );
  return row?.avg_days != null ? Math.round(parseFloat(row.avg_days)) : null;
}

export async function getDSO(): Promise<number> {
  const rec = await queryOne<{ total: string }>(`SELECT COALESCE(SUM(amount), 0) AS total FROM invoices WHERE status != 'paid'`);
  const rev = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE direction = 'in' AND date >= current_date - interval '90 days'`
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
};

export async function getBills(openOnly = false) {
  return query<Bill>(
    `SELECT b.*, c.name AS category_name
     FROM bills b LEFT JOIN categories c ON c.id = b.category_id
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

export async function getProjectFinance(projectId: string) {
  const row = await queryOne<{ revenue: string; direct_cost: string; team_cost: string; budget: string }>(
    `SELECT
       (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE project_id = $1 AND status = 'paid') AS revenue,
       (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t JOIN categories c ON c.id = t.category_id
          WHERE t.project_id = $1 AND t.direction = 'out' AND c.type = 'direct') AS direct_cost,
       (SELECT COALESCE(SUM(tc.monthly_cost * ta.pct / 100.0), 0) FROM team_allocations ta
          JOIN team_costs tc ON tc.id = ta.team_cost_id WHERE ta.project_id = $1) AS team_cost,
       (SELECT budget FROM projects WHERE id = $1) AS budget`,
    [projectId]
  );
  if (!row) return { revenue: 0, cost: 0, margin: 0, budgetUsed: 0 };
  const revenue = parseFloat(row.revenue);
  const cost = parseFloat(row.direct_cost) + parseFloat(row.team_cost);
  const budget = parseFloat(row.budget);
  const margin = revenue ? ((revenue - cost) / revenue) * 100 : 0;
  const budgetUsed = budget ? Math.min(100, Math.round((cost / budget) * 100)) : 0;
  return { revenue, cost, margin, budgetUsed };
}

export async function getClientFinance(clientId: string) {
  const row = await queryOne<{ revenue: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS revenue FROM invoices WHERE client_id = $1 AND status = 'paid'`,
    [clientId]
  );
  const projects = await query<{ id: string }>(`SELECT id FROM projects WHERE client_id = $1`, [clientId]);
  let marginSum = 0;
  for (const p of projects) marginSum += (await getProjectFinance(p.id)).margin;
  return { revenue: row ? parseFloat(row.revenue) : 0, avgMargin: projects.length ? marginSum / projects.length : 0 };
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

// ---------- Alerts (Section 6) ----------

export type Alert = {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  message: string;
  link: string;
  action: string;
};

export async function getAlerts(): Promise<Alert[]> {
  const out: Alert[] = [];
  const settingsRows = await query<{ key: string; value: unknown }>('SELECT key, value FROM settings');
  const settings: Record<string, unknown> = {};
  for (const r of settingsRows) settings[r.key] = r.value;
  const cashFloorMonths = Number(settings.cash_floor_months ?? 2);
  const thresholds = (settings.thresholds as Record<string, number>) ?? {};

  const burn = await getNetBurnLast3Months();
  const cash = await getTotalCash();
  if (burn > 0) {
    const floor = burn * cashFloorMonths;
    if (cash < floor) {
      out.push({
        id: 'cash-low',
        type: 'cash',
        severity: 'high',
        message: `Cash is below the ${cashFloorMonths}-month floor.`,
        link: '/cash',
        action: 'View cash'
      });
    }
  }

  const overdueInvoices = await query<{ id: string; number: string; client_name: string; amount: string; days_overdue: number }>(
    `SELECT iv.id, iv.number, cl.name AS client_name, iv.amount,
       GREATEST(0, (current_date - iv.due_date))::int AS days_overdue
     FROM invoices iv LEFT JOIN clients cl ON cl.id = iv.client_id
     WHERE iv.status != 'paid' AND iv.due_date < current_date`
  );
  for (const iv of overdueInvoices) {
    const high = thresholds.overdueHigh ?? 45;
    const medium = thresholds.overdueMedium ?? 15;
    if (iv.days_overdue >= high) {
      out.push({ id: `inv-${iv.id}`, type: 'invoice', severity: 'high', message: `${iv.number} (${iv.client_name ?? 'client'}) is ${iv.days_overdue} days overdue.`, link: '/receivables', action: 'Send reminder' });
    } else if (iv.days_overdue >= medium) {
      out.push({ id: `inv-${iv.id}`, type: 'invoice', severity: 'medium', message: `${iv.number} (${iv.client_name ?? 'client'}) is ${iv.days_overdue} days overdue.`, link: '/receivables', action: 'Send reminder' });
    }
  }

  const dueSoonBills = await query<{ id: string; vendor: string; amount: string; due_date: string }>(
    `SELECT id, vendor, amount, due_date FROM bills WHERE status != 'paid' AND due_date BETWEEN current_date AND current_date + interval '${thresholds.dueSoonDays ?? 3} days'`
  );
  for (const b of dueSoonBills) {
    out.push({ id: `bill-${b.id}`, type: 'bill', severity: 'medium', message: `${b.vendor} payment due ${b.due_date}.`, link: '/payables', action: 'View bill' });
  }

  const marginFloor = thresholds.marginFloor ?? 25;
  const projects = await query<{ id: string; service_line: string; client_name: string | null; status: string }>(
    `SELECT p.id, p.service_line, cl.name AS client_name, p.status FROM projects p LEFT JOIN clients cl ON cl.id = p.client_id WHERE p.status = 'active'`
  );
  for (const p of projects) {
    const fin = await getProjectFinance(p.id);
    if (fin.revenue > 0 && fin.margin < marginFloor) {
      out.push({ id: `margin-${p.id}`, type: 'margin', severity: 'medium', message: `${p.client_name ?? ''} · ${p.service_line} margin is ${Math.round(fin.margin)}%, below the ${marginFloor}% floor.`, link: '/clients', action: 'View project' });
    }
  }

  // Debt alerts: payment due soon, balance near limit.
  const debts = await getDebts();
  for (const d of debts) {
    if (d.due_date) {
      const days = Math.round((new Date(d.due_date).getTime() - Date.now()) / 86400000);
      if (days >= 0 && days <= (thresholds.dueSoonDays ?? 3)) {
        out.push({ id: `debt-${d.id}`, type: 'debt', severity: 'medium', message: `${d.name} payment of ${d.minimum_payment} minimum is due in ${days} day(s).`, link: '/debt', action: 'Manage payment' });
      }
    }
    if (d.credit_limit && parseFloat(d.current_balance) / parseFloat(d.credit_limit) > 0.85) {
      out.push({ id: `debt-limit-${d.id}`, type: 'debt', severity: 'medium', message: `${d.name} balance is above 85% of its credit limit.`, link: '/debt', action: 'View debt' });
    }
  }

  const resolved = await query<{ alert_key: string }>('SELECT alert_key FROM resolved_alerts');
  const resolvedSet = new Set(resolved.map((r) => r.alert_key));
  return out
    .filter((a) => !resolvedSet.has(a.id))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2, info: 3 }[a.severity] - { high: 0, medium: 1, low: 2, info: 3 }[b.severity]));
}
