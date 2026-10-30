import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { query } from '@/lib/db';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  // Imported rows still waiting on the Categorize page; the sidebar shows the number only when it's above zero.
  const pending = await query<{ n: string }>("SELECT COUNT(*) AS n FROM transactions WHERE reviewed = false AND source IN ('csv','slice')");
  return (
    <AppShell userName={session.name} pendingCount={Number(pending[0]?.n ?? 0)}>
      {children}
    </AppShell>
  );
}
