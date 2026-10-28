import { getClients, getProjects, getProjectFinance, getClientFinance } from '@/lib/queries';
import { Card, Chip } from '@/components/ui';
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

  const activeProjects = projectFin.filter((p) => p.project.status === 'active');
  const totalContracted = projects.reduce((s, p) => s + parseFloat(p.budget), 0);

  return (
    <>
      <ClientsCharts projectFin={projectFin.map((p) => ({ label: `${p.project.client_name ?? '—'} · ${p.project.service_line}`, margin: p.fin.margin }))} clientFin={clientFin.map((c) => ({ name: c.client.name, revenue: c.fin.revenue, margin: c.fin.avgMargin }))} />

      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Active projects</h2>
          <p className="text-[13px] text-muted mt-0.5">
            {activeProjects.length} projects · {fmtCompactINR(totalContracted)} contracted revenue
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {projectFin.map(({ project, fin }) => (
          <Card key={project.id}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <div className="font-display text-[14px] font-semibold truncate">{project.client_name ?? '—'}</div>
                <div className="text-[12px] text-muted truncate">{project.service_line}</div>
              </div>
              <Chip kind={fin.margin > 40 ? 'paid' : fin.margin >= 25 ? 'due' : 'overdue'}>{Math.round(fin.margin)}% margin</Chip>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wide">Revenue</div>
                <div className="font-mono font-semibold text-[15px] mt-0.5">{fmtCompactINR(fin.revenue)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wide">Cost</div>
                <div className="font-mono font-semibold text-[15px] mt-0.5">{fmtCompactINR(fin.cost)}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-muted mb-1">
                <span>Budget used</span>
                <span>{fin.budgetUsed}%</span>
              </div>
              <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${fin.budgetUsed}%` }} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <NewClientProject clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
    </>
  );
}
