import { query } from '@/lib/db';
import { getCategories, getProjects } from '@/lib/queries';
import { classify } from '@/lib/classify';
import { Empty } from '@/components/ui';
import CategorizeClient from './CategorizeClient';

export const dynamic = 'force-dynamic';

type Row = { id: string; date: string; amount: string; direction: 'in' | 'out'; note: string | null };

// Imported bank rows waiting for you to say what they are. Nothing changes until you save.
export default async function CategorizePage() {
  const [rows, categories, clients, projects] = await Promise.all([
    query<Row>(`SELECT id, date, amount, direction, note FROM transactions WHERE reviewed = false AND source IN ('csv','slice') ORDER BY date DESC, created_at DESC`),
    getCategories(),
    query<{ name: string }>('SELECT name FROM clients ORDER BY name'),
    getProjects()
  ]);
  if (!rows.length) return <Empty>All caught up. Import a bank statement from the Cash page and the new transactions will show up here.</Empty>;

  const tx = rows.map((r) => ({ id: r.id, date: r.date, amount: Number(r.amount), direction: r.direction, note: r.note }));
  const suggestions = classify(tx);
  const items = tx.map((t) => ({ ...t, ...suggestions.get(t.id)! }));

  return (
    <CategorizeClient
      items={items}
      clients={clients.map((c) => c.name)}
      projects={projects.map((p) => ({ id: p.id, label: p.service_line }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name, type: c.type }))}
    />
  );
}
