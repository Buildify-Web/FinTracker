import { getClients, getProjects, getProjectFinances, getClientFinances, projectFinanceOf } from '@/lib/queries';
import { Card, Chip } from '@/components/ui';
import { fmtCompactINR } from '@/lib/format';
import ClientsCharts from './ClientsCharts';
import NewClientProject from './NewClientProject';
import EditProject from './EditProject';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const [clients, projects, projectFins] = await Promise.all([getClients(), getProjects(), getProjectFinances()]);
  const clientFins = await getClientFinances(projectFins);

  const projectFin = projects.map((p) => ({ project: p, fin: projectFinanceOf(projectFins, p.id) }));
  const clientFin = clients.map((c) => ({ client: c, fin: clientFins.get(c.id) ?? { revenue: 0, avgMargin: 0 } }));

  const activeProjects = projectFin.filter((p) => p.project.status === 'active');
  const totalContracted = projects.reduce((s, p) => s + parseFloat(p.budget), 0);

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Clients</h2>
          <p className="text-[13px] text-muted mt-0.5">
            {activeProjects.length} active · {fmtCompactINR(totalContracted)} in budgets
          </p>
        </div>
        <NewClientProject />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {projectFin.map(({ project, fin }) => (
          <Card key={project.id}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <div className="font-display text-[15px] font-bold truncate">{project.service_line}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Chip kind={fin.margin > 40 ? 'paid' : fin.margin >= 25 ? 'due' : 'overdue'}>{Math.round(fin.margin)}% margin</Chip>
                <EditProject project={project} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wide">Income</div>
                <div className="font-mono font-semibold text-[15px] mt-0.5">{fmtCompactINR(fin.revenue)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wide">Cost</div>
                <div className="font-mono font-semibold text-[15px] mt-0.5">{fmtCompactINR(fin.cost)}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-muted mb-1">
                <span>Budget spent</span>
                <span>{fin.budgetUsed}%</span>
              </div>
              <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${fin.budgetUsed}%` }} />
              </div>
            </div>
          </Card>
        ))}
      </div>


      <ClientsCharts projectFin={projectFin.map((p) => ({ label: p.project.service_line, margin: p.fin.margin }))} clientFin={clientFin.map((c) => ({ name: c.client.name, revenue: c.fin.revenue, margin: c.fin.avgMargin }))} />
    </>
  );
}
