import { getCategories, getTeam, getProjects } from '@/lib/queries';
import { query } from '@/lib/db';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

// One place for everything you set up once: categories & budgets, team & planned hires,
// auto-tag rules for imports, and when alerts fire.
export default async function SettingsPage() {
  const [categories, team, projects, rules, settingsRows] = await Promise.all([
    getCategories(),
    getTeam(),
    getProjects(),
    query<{ id: string; match_text: string; category_name: string | null }>(
      `SELECT r.id, r.match_text, c.name AS category_name FROM categorization_rules r LEFT JOIN categories c ON c.id = r.category_id ORDER BY r.created_at DESC`
    ),
    query<{ key: string; value: any }>('SELECT key, value FROM settings')
  ]);
  const settings: Record<string, any> = {};
  for (const r of settingsRows) settings[r.key] = r.value;

  return (
    <SettingsClient
      categories={categories}
      team={team}
      projects={projects.map((p) => ({ id: p.id, label: p.service_line }))}
      rules={rules}
      cashFloorMonths={Number(settings.cash_floor_months ?? 2)}
      thresholds={settings.thresholds ?? {}}
    />
  );
}
