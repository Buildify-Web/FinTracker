import { getTotalCash, getNetBurnLast3Months, getInvoices, getClients, getRunwayMonths, getTeam } from '@/lib/queries';
import ForecastClient from './ForecastClient';

export const dynamic = 'force-dynamic';

export default async function ForecastPage() {
  const [cash, burn, openInvoices, clients, runway, team] = await Promise.all([
    getTotalCash(),
    getNetBurnLast3Months(),
    getInvoices(true),
    getClients(),
    getRunwayMonths(),
    getTeam()
  ]);

  const today = new Date().toISOString().slice(0, 10);
  // Changes to payroll that past spending doesn't know about yet: people who
  // haven't started (cost begins) and people who are leaving (cost stops).
  const changes = [
    ...team
      .filter((m) => m.start_date && m.start_date > today)
      .map((m) => ({ id: m.id, name: m.person_name, role: m.role, date: m.start_date!, monthly: parseFloat(m.monthly_cost) })),
    ...team
      .filter((m) => m.end_date && m.end_date >= today && (!m.start_date || m.start_date <= today))
      .map((m) => ({ id: `${m.id}-end`, name: m.person_name, role: m.role, date: m.end_date!, monthly: -parseFloat(m.monthly_cost) }))
  ].sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <ForecastClient
      cash={cash}
      burn={burn}
      runway={runway}
      changes={changes}
      invoices={openInvoices.map((iv) => ({ id: iv.id, client_id: iv.client_id, client_name: iv.client_name, due_date: iv.due_date, amount: parseFloat(iv.amount) }))}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
