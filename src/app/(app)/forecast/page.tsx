import { getTotalCash, getNetBurnLast3Months, getInvoices, getClients, getRunwayMonths } from '@/lib/queries';
import ForecastClient from './ForecastClient';

export const dynamic = 'force-dynamic';

export default async function ForecastPage() {
  const [cash, burn, openInvoices, clients, runway] = await Promise.all([
    getTotalCash(),
    getNetBurnLast3Months(),
    getInvoices(true),
    getClients(),
    getRunwayMonths()
  ]);

  return (
    <ForecastClient
      cash={cash}
      burn={burn}
      runway={runway}
      invoices={openInvoices.map((iv) => ({ id: iv.id, client_id: iv.client_id, client_name: iv.client_name, due_date: iv.due_date, amount: parseFloat(iv.amount) }))}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
