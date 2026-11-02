import { query } from '@/lib/db';
import { getCategories, getProjects } from '@/lib/queries';
import { classify } from '@/lib/classify';
import { Empty } from '@/components/ui';
import CategorizeClient from './CategorizeClient';
import TransferPairs from './TransferPairs';
import { suggestTransferPairs } from '@/lib/transferPairs';

export const dynamic = 'force-dynamic';

type Row = { id: string; date: string; amount: string; direction: 'in' | 'out'; note: string | null; account_id: string | null; account_name: string | null };

// Imported bank rows waiting for you to say what they are. Nothing changes until you save.
export default async function CategorizePage() {
  const [rows, categories, clients, projects] = await Promise.all([
    query<Row>(`SELECT t.id, t.date, t.amount, t.direction, t.note, t.account_id, a.name AS account_name FROM transactions t LEFT JOIN accounts a ON a.id = t.account_id WHERE t.reviewed = false AND t.source IN ('csv','slice') AND t.transfer_id IS NULL ORDER BY t.date DESC, t.created_at DESC`),
    getCategories(),
    query<{ name: string }>('SELECT name FROM clients ORDER BY name'),
    getProjects()
  ]);
  if (!rows.length) return <Empty>All caught up. Import a bank statement from the Cash page and the new transactions will show up here.</Empty>;

  const tx = rows.map((r) => ({ id: r.id, date: r.date, amount: Number(r.amount), direction: r.direction, note: r.note }));
  const pairs = suggestTransferPairs(rows.map((r) => ({ id: r.id, date: r.date, amount: Number(r.amount), direction: r.direction, account_id: r.account_id, account_name: r.account_name, note: r.note })));
  const suggestions = classify(tx);
  const items = tx.map((t) => ({ ...t, ...suggestions.get(t.id)! }));

  return (
    <>
      <TransferPairs pairs={pairs} />
      <CategorizeClient
        items={items}
        clients={clients.map((c) => c.name)}
        projects={projects.map((p) => ({ id: p.id, label: p.service_line }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, type: c.type }))}
      />
    </>
  );
}
