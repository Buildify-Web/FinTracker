import { getAlerts } from '@/lib/queries';
import { query } from '@/lib/db';
import { Card } from '@/components/ui';
import AlertList from '@/components/AlertList';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const alerts = await getAlerts();
  const settingsRows = await query<{ key: string; value: any }>('SELECT key, value FROM settings');
  const settings: Record<string, any> = {};
  for (const r of settingsRows) settings[r.key] = r.value;

  return (
    <>
      <Card title="All alerts" sub={`${alerts.length} open`}>
        <AlertList alerts={alerts} />
      </Card>
      <Card title="Settings" sub="thresholds">
        <SettingsForm cashFloorMonths={settings.cash_floor_months ?? 2} thresholds={settings.thresholds ?? {}} />
      </Card>
    </>
  );
}
