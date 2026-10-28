'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import NewEntryModal from './NewEntryModal';
import NotifPanel from './NotifPanel';
import Icon from './Icon';

const ROUTES = [
  { href: '/', label: 'Home', icon: 'home' as const, subtitle: "Buildify's finances at a glance" },
  { href: '/statements', label: 'Statements', icon: 'statements' as const, subtitle: 'Imported bank & card statements' },
  { href: '/cash', label: 'Cash', icon: 'cash' as const, subtitle: 'Balances across every account' },
  { href: '/receivables', label: 'Receivables', icon: 'receivables' as const, subtitle: 'Who owes Buildify, and since when' },
  { href: '/payables', label: 'Payables', icon: 'payables' as const, subtitle: 'Bills and subscriptions due' },
  { href: '/debt', label: 'Debt', icon: 'debt' as const, subtitle: 'Credit lines and payoff plans' },
  { href: '/pnl', label: 'P&L', icon: 'pnl' as const, subtitle: "Buildify's P&L at a glance" },
  { href: '/clients', label: 'Clients & Projects', icon: 'clients' as const, subtitle: "Buildify's clients & projects at a glance" },
  { href: '/forecast', label: 'Forecast', icon: 'forecast' as const, subtitle: 'Plan with confidence, not guesswork' },
  { href: '/notifications', label: 'Notifications', icon: 'notifications' as const, subtitle: "Buildify's notifications at a glance" }
];

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [dark, setDark] = useState(false);

  async function refreshAlertCount() {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      setAlertCount(data.alerts?.length ?? 0);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refreshAlertCount();
  }, [pathname]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fintracker_theme');
      if (saved === 'dark') {
        setDark(true);
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch {
      /* ignore */
    }
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    try {
      localStorage.setItem('fintracker_theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }

  const current = ROUTES.find((r) => r.href === pathname) ?? ROUTES[0];

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`w-56 flex-shrink-0 bg-surface border-r border-border p-3 pt-4 fixed md:sticky top-0 h-screen overflow-y-auto z-40 transition-transform flex flex-col ${
          menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2.5 px-1.5 pb-5">
          <div className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center font-display font-bold text-base flex-shrink-0">B</div>
          <div className="min-w-0">
            <div className="font-display font-bold text-[15px] leading-tight truncate">Buildify</div>
            <div className="text-[10px] font-semibold tracking-[0.12em] text-accent">GOD&apos;S VIEW</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {ROUTES.map((r) => {
            const active = pathname === r.href;
            return (
              <Link
                key={r.href}
                href={r.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors ${
                  active ? 'bg-accent/10 text-accent' : 'text-fg/80 hover:bg-bg'
                }`}
              >
                <Icon name={r.icon} size={18} className={active ? 'text-accent' : 'text-muted'} />
                {r.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-3">
          <button onClick={toggleDark} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-fg/80 hover:bg-bg">
            <span className="flex items-center gap-2.5">
              <Icon name="moon" size={18} className="text-muted" />
              Dark mode
            </span>
            <span className={`w-9 h-5 rounded-full relative transition-colors ${dark ? 'bg-accent' : 'bg-border'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${dark ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
          </button>
          <div className="border-t border-border mt-2 pt-3 px-1 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent-2/15 text-accent flex items-center justify-center text-[12px] font-bold flex-shrink-0">
              {initials(userName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate">{userName}</div>
              <div className="text-[11px] text-muted">Founder</div>
            </div>
            <button onClick={logout} aria-label="Sign out" className="text-muted hover:text-fg">
              <Icon name="chevron" size={16} />
            </button>
          </div>
        </div>
      </aside>

      {menuOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-border px-4 md:px-7 py-4 flex items-center gap-4">
          <button className="md:hidden w-8 h-8 border border-border rounded-lg flex-shrink-0" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" size={16} className="mx-auto" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-[26px] font-bold leading-tight truncate">{current.label}</h1>
            <p className="text-[13px] text-muted mt-0.5 truncate">{current.subtitle}</p>
          </div>
          <button
            onClick={() => setNewEntryOpen(true)}
            className="flex items-center gap-1.5 bg-accent text-white rounded-full pl-3.5 pr-4 py-2.5 text-[13px] font-semibold flex-shrink-0 hover:bg-accent-2 transition-colors"
          >
            <Icon name="plus" size={16} />
            New entry
          </button>
          <button onClick={() => setNotifOpen(true)} className="relative w-10 h-10 border border-border rounded-full flex items-center justify-center flex-shrink-0 bg-surface hover:bg-bg">
            <Icon name="notifications" size={18} />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-neg text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-bg">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>
        </div>
        <div className="p-4 md:p-7 flex flex-col gap-4">{children}</div>
      </div>

      <button className="fixed bottom-6 right-6 w-11 h-11 rounded-full bg-fg text-bg flex items-center justify-center shadow-lg z-30" aria-label="Help">
        <Icon name="help" size={19} />
      </button>

      {newEntryOpen && (
        <NewEntryModal
          onClose={() => setNewEntryOpen(false)}
          onSaved={() => {
            setNewEntryOpen(false);
            router.refresh();
            refreshAlertCount();
          }}
        />
      )}
      {notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} onChanged={refreshAlertCount} />}
    </div>
  );
}
