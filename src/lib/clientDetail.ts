import { query, queryOne } from './db';

// Everything behind one client's detail page. A client and its project are one thing in the app, so the id is the project's.
// The margin pieces use exactly the same rules as getProjectFinances, so this adds up to the number on the client card.

export type ClientDetail = {
  project: {
    id: string;
    service_line: string;
    budget: number;
    status: string;
    start_date: string | null;
    end_date: string | null;
    description: string | null;
    prior_paid: number;
    client_id: string | null;
    client_name: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    billing_address: string | null;
    gstin: string | null;
    payment_terms_days: number | null;
  };
  invoices: { id: string; number: string; total: number; balance: number; issue_date: string; due_date: string; status: string; paid_date: string | null; part_label: string | null; days_overdue: number }[];
  /** Money-out payments in a "direct" category tagged to this client: the real project costs. */
  costs: { id: string; date: string; amount: number; note: string | null; category: string }[];
  /** Team members' monthly cost, by their share of this client. */
  team: { name: string; role: string | null; monthly: number; pct: number; cost: number }[];
  bills: { id: string; vendor: string; amount: number; paid: number; due_date: string; status: string; category: string | null }[];
  monthly: { label: string; revenue: number; cost: number }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const n = (v: unknown) => parseFloat(String(v ?? 0));

export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  if (!UUID.test(id)) return null;
  const p = await queryOne<any>(
    `SELECT p.id, p.service_line, p.budget, p.status, p.start_date, p.end_date, p.description, p.prior_paid, p.client_id,
       c.name AS client_name, c.contact_name, c.contact_phone, c.contact_email, c.billing_address, c.gstin, c.payment_terms_days
     FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.id = $1`,
    [id]
  );
  if (!p) return null;

  const [invoices, costs, team, bills, monthly] = await Promise.all([
    query<any>(
      `SELECT id, number, amount, advance_paid, issue_date, due_date, status, paid_date, part_label,
         GREATEST(0, (current_date - due_date))::int AS days_overdue
       FROM invoices WHERE project_id = $1 AND status != 'void' ORDER BY issue_date DESC, created_at DESC`,
      [id]
    ),
    query<any>(
      `SELECT t.id, t.date, t.amount, t.note, c.name AS category
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.project_id = $1 AND t.direction = 'out' AND c.type = 'direct' ORDER BY t.date DESC, t.created_at DESC`,
      [id]
    ),
    query<any>(
      `SELECT tc.person_name, tc.role, tc.monthly_cost, ta.pct, (tc.monthly_cost * ta.pct / 100.0) AS cost
       FROM team_allocations ta JOIN team_costs tc ON tc.id = ta.team_cost_id
       WHERE ta.project_id = $1 AND (tc.start_date IS NULL OR tc.start_date <= current_date) AND (tc.end_date IS NULL OR tc.end_date >= current_date)
       ORDER BY cost DESC`,
      [id]
    ),
    query<any>(
      `SELECT b.id, b.vendor, b.amount, b.paid_amount, b.due_date, b.status, c.name AS category
       FROM bills b LEFT JOIN categories c ON c.id = b.category_id WHERE b.project_id = $1 ORDER BY b.due_date DESC`,
      [id]
    ),
    query<any>(
      `SELECT to_char(m, 'Mon YY') AS label, SUM(rev) AS revenue, SUM(cost) AS cost FROM (
         SELECT date_trunc('month', paid_date) AS m, SUM(amount) AS rev, 0 AS cost FROM invoices
           WHERE project_id = $1 AND status = 'paid' AND paid_date IS NOT NULL GROUP BY 1
         UNION ALL
         SELECT date_trunc('month', t.date), 0, SUM(t.amount) FROM transactions t JOIN categories c ON c.id = t.category_id
           WHERE t.project_id = $1 AND t.direction = 'out' AND c.type = 'direct' GROUP BY 1
       ) x GROUP BY m ORDER BY m`,
      [id]
    )
  ]);

  return {
    project: { ...p, budget: n(p.budget), prior_paid: n(p.prior_paid) },
    invoices: invoices.map((i) => ({ id: i.id, number: i.number, total: n(i.amount) + n(i.advance_paid), balance: n(i.amount), issue_date: i.issue_date, due_date: i.due_date, status: i.status, paid_date: i.paid_date, part_label: i.part_label, days_overdue: i.days_overdue })),
    costs: costs.map((c) => ({ id: c.id, date: c.date, amount: n(c.amount), note: c.note, category: c.category })),
    team: team.map((t) => ({ name: t.person_name, role: t.role, monthly: n(t.monthly_cost), pct: n(t.pct), cost: n(t.cost) })),
    bills: bills.map((b) => ({ id: b.id, vendor: b.vendor, amount: n(b.amount), paid: n(b.paid_amount), due_date: b.due_date, status: b.status, category: b.category })),
    monthly: monthly.map((m) => ({ label: m.label, revenue: n(m.revenue), cost: n(m.cost) }))
  };
}
