import Link from 'next/link';

export function Card({ title, sub, action, href, children }: { title?: string; sub?: string; action?: React.ReactNode; href?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      {title && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-[15px] font-semibold">{title}</h3>
            {sub && <p className="text-[13px] text-muted mt-0.5">{sub}</p>}
          </div>
          {action}
          {href && (
            <Link href={href} className="text-[12px] font-semibold text-accent hover:underline flex-shrink-0 mt-0.5">
              View →
            </Link>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function Kpi({ label, value, trend, trendDir, href }: { label: string; value: string; trend?: string; trendDir?: 'up' | 'down' | 'flat'; href?: string }) {
  const color = trendDir === 'up' ? 'text-pos' : trendDir === 'down' ? 'text-neg' : 'text-muted';
  const arrow = trendDir === 'up' ? '▲' : trendDir === 'down' ? '▼' : '—';
  const body = (
    <>
      <div className="text-[11px] uppercase tracking-wide font-semibold text-muted">{label}</div>
      <div className="font-mono text-lg font-semibold mt-1 tabular">{value}</div>
      {trend && (
        <div className={`text-[11px] font-semibold mt-0.5 ${color}`}>
          {arrow} {trend}
        </div>
      )}
    </>
  );
  const box = 'block bg-surface border border-border rounded-2xl px-4 py-3.5 min-w-0';
  if (!href) return <div className={box}>{body}</div>;
  return (
    <Link href={href} className={`${box} transition-all hover:border-accent/60 hover:-translate-y-0.5`}>
      {body}
    </Link>
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

export { Empty, Table } from './table';
export { Button } from './button';
export { Disclosure } from './disclosure';
export { FormDialog, useCloseDialog } from './form-dialog';
