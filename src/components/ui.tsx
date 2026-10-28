export function Card({ title, sub, children }: { title?: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      {title && (
        <div className="flex items-baseline justify-between gap-2 mb-2.5">
          <h3 className="text-[11px] uppercase tracking-wide font-semibold text-muted">{title}</h3>
          {sub && <span className="text-[11px] font-mono text-muted">{sub}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Kpi({ label, value, trend, trendDir }: { label: string; value: string; trend?: string; trendDir?: 'up' | 'down' | 'flat' }) {
  const color = trendDir === 'up' ? 'text-pos' : trendDir === 'down' ? 'text-neg' : 'text-muted';
  const arrow = trendDir === 'up' ? '▲' : trendDir === 'down' ? '▼' : '—';
  return (
    <div className="bg-surface border border-border rounded-xl px-3.5 py-3 min-w-0">
      <div className="text-[11px] uppercase tracking-wide font-semibold text-muted">{label}</div>
      <div className="font-mono text-lg font-semibold mt-1 tabular">{value}</div>
      {trend && (
        <div className={`text-[11px] font-semibold mt-0.5 ${color}`}>
          {arrow} {trend}
        </div>
      )}
    </div>
  );
}

export function Chip({ kind, children }: { kind: 'paid' | 'due' | 'overdue' | 'info'; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    paid: 'bg-pos/15 text-pos',
    due: 'bg-warn/15 text-warn',
    overdue: 'bg-neg/15 text-neg',
    info: 'bg-accent/15 text-accent'
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[kind]}`}>{children}</span>;
}

export function SeverityDot({ severity }: { severity: string }) {
  const color = severity === 'high' ? 'bg-neg' : severity === 'medium' ? 'bg-warn' : 'bg-muted';
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-sm text-muted">{children}</div>;
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <Empty>No data yet. Add an entry to get started.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="text-left text-[11px] uppercase tracking-wide font-semibold text-muted px-2 py-1.5 border-b border-border">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-2 py-2 border-b border-border last:border-0 align-middle">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
