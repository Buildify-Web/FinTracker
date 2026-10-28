import { getClients, getProjects, getProjectFinance, getClientFinance } from '@/lib/queries';
import { Card } from '@/components/ui';
import { fmtCompactINR } from '@/lib/format';
import ClientsCharts from './ClientsCharts';
import NewClientProject from './NewClientProject';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const [clients, projects] = await Promise.all([getClients(), getProjects()]);

  const projectFin = await Promise.all(
    projects.map(async (p) => ({ project: p, fin: await getProjectFinance(p.id) }))
  );
  const clientFin = await Promise.all(clients.map(async (c) => ({ client: c, fin: await getClientFinance(c.id) })));

  return (
    <>
      <NewClientProject clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      <ClientsCharts projectFin={projectFin.map((p) => ({ label: `${p.project.client_name ?? '—'} · ${p.project.service_line}`, margin: p.fin.margin }))} clientFin={clientFin.map((c) => ({ name: c.client.name, revenue: c.fin.revenue, margin: c.fin.avgMargin }))} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projectFin.map(({ project, fin }) => (
          <Card key={project.id}>
            <div className="text-[13px] font-semibold">
              {project.client_name ?? '—'} · {project.service_line}
            </div>
            <div className="text-[11px] text-muted mb-2">
              {project.status} · budget {fmtCompactINR(project.budget)}
            </div>
            <Row label="Revenue" value={fmtCompactINR(fin.revenue)} color="text-pos" />
            <Row label="Cost" value={fmtCompactINR(fin.cost)} color="text-neg" />
            <Row label="Margin" value={`${Math.round(fin.margin)}%`} color={fin.margin > 40 ? 'text-pos' : fin.margin >= 25 ? 'text-warn' : 'text-neg'} />
            <div className="mt-1.5 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${fin.budgetUsed}%` }} />
            </div>
            <div className="text-[10.5px] text-muted mt-1">{fin.budgetUsed}% of budget used</div>
          </Card>
        ))}
      </div>
    </>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-muted">{label}</span>
      <span className={`font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}
