import { getAlerts } from '@/lib/queries';
import { query } from '@/lib/db';
import NotificationsClient from './NotificationsClient';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const alerts = await getAlerts();
  const settingsRows = await query<{ key: string; value: any }>('SELECT key, value FROM settings');
  const settings: Record<string, any> = {};
  for (const r of settingsRows) settings[r.key] = r.value;

  return <NotificationsClient alerts={alerts} cashFloorMonths={settings.cash_floor_months ?? 2} thresholds={settings.thresholds ?? {}} />;
}
