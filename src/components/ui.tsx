export function Card({ title, sub, action, children }: { title?: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      {title && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-[15px] font-semibold">{title}</h3>
            {sub && <p className="text-[13px] text-muted mt-0.5">{sub}</p>}
          </div>
          {action}
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
    <div className="bg-surface border border-border rounded-2xl px-4 py-3.5 min-w-0">
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
    paid: 'bg-pos/10 text-pos',
    due: 'bg-warn/10 text-warn',
    overdue: 'bg-neg/10 text-neg',
    info: 'bg-accent/10 text-accent'
  };
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${styles[kind]}`}>{children}</span>;
}

export function SeverityDot({ severity }: { severity: string }) {
  const color = severity === 'high' ? 'bg-neg' : severity === 'medium' ? 'bg-warn' : severity === 'low' ? 'bg-pos' : 'bg-muted';
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-sm text-muted">{children}</div>;
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: { children: React.ReactNode; variant?: 'primary' | 'outline' | 'ghost' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: 'bg-accent text-white hover:bg-accent-2',
    outline: 'border border-border text-fg hover:bg-bg',
    ghost: 'text-muted hover:text-fg'
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60 ${styles[variant]} ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
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
                <td key={j} className="px-2 py-2.5 border-b border-border last:border-0 align-middle">
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
