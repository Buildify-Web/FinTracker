'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import NewEntryModal, { type EntryTab } from './NewEntryModal';
import QuickAdd from './QuickAdd';
import NotifPanel from './NotifPanel';
import Icon from './Icon';
import { setTheme, useTheme } from '@/lib/theme';
import { usePref } from '@/lib/prefs';
import { Switch } from './ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Button } from './ui/button';

const ROUTES = [
  { href: '/', label: 'Home', icon: 'home' as const, hint: 'Your cash, runway and this month at a glance. Click any number to dig in.' },
  { href: '/cash', label: 'Cash', icon: 'cash' as const, hint: 'Bank balances and every transaction. Import bank statements at the bottom. Click Edit on a row to fix or delete it.' },
  { href: '/categorize', label: 'Categorize', icon: 'categorize' as const, hint: 'Sort imported bank transactions: mark which are invoices or bills, or give any of them a category. Nothing changes until you save.' },
  { href: '/receivables', label: 'Invoices', icon: 'receivables' as const, hint: 'Money clients owe you. Mark an invoice paid when the money arrives — it then shows up in Cash.' },
  { href: '/payables', label: 'Bills', icon: 'payables' as const, hint: 'Money you owe. Mark a bill paid when you pay it; repeating bills create the next one automatically.' },
  { href: '/debt', label: 'Debt', icon: 'debt' as const, hint: 'Credit cards and loans, and how long each takes to pay off.' },
  { href: '/pnl', label: 'Profit & Loss', icon: 'pnl' as const, hint: 'Income minus costs, month by month, and how each budget is tracking.' },
  { href: '/clients', label: 'Clients', icon: 'clients' as const, hint: 'Which clients and projects actually make you money.' },
  { href: '/forecast', label: 'Forecast', icon: 'forecast' as const, hint: 'Where cash is heading over the next 90 days, including planned hires.' },
  { href: '/settings', label: 'Settings', icon: 'settings' as const, hint: 'Set up once: categories and budgets, your team and planned hires, auto-tagging, and alerts.' }
];

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AppShell({ userName, pendingCount = 0, children }: { userName: string; pendingCount?: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [newEntryTab, setNewEntryTab] = useState<EntryTab | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const dark = useTheme() === 'dark';
  const [sidebarPref, setSidebarPref] = usePref('fintracker_sidebar', 'expanded');
  const [hintsPref, setHintsPref] = usePref('fintracker_hints', 'on');
  const collapsed = sidebarPref === 'collapsed';
  const hintsOn = hintsPref === 'on';
  // Class that hides a label on desktop once the sidebar is collapsed to its icon rail.
  const lbl = collapsed ? 'md:hidden' : '';

  async function refreshAlertCount() {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      setAlertCount(data.alerts?.length ?? 0);
    } catch {
      /* ignore */
    }
  }

  // The shell persists across client-side navigations, so fetch the badge once
  // on mount; saving an entry or resolving an alert refreshes it explicitly.
  useEffect(() => {
    refreshAlertCount();
  }, []);

  function toggleDark() {
    setTheme(dark ? 'light' : 'dark');
  }

  // Nested pages keep their section's title; statement breakdowns belong to Cash.
  const section = pathname.startsWith('/statements') ? '/cash' : pathname;
  const current = ROUTES.find((r) => r.href === section) ?? ROUTES.find((r) => r.href !== '/' && section.startsWith(r.href + '/')) ?? ROUTES[0];

  // Only step back through in-app pages; a page opened directly (fresh tab,
  // shared link, reload) has nowhere in-app to go back to, so go Home instead.
  const navCount = useRef(0);
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) navCount.current += 1;
    lastPath.current = pathname;
  }, [pathname]);

  function goBack() {
    if (navCount.current > 0) {
      navCount.current -= 1;
      router.back();
    } else {
      router.push('/');
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex min-h-screen">
      <aside
        className={`sidebar-dark ${collapsed ? 'md:w-16 md:px-2' : 'md:w-56'} w-56 flex-shrink-0 bg-sidebar border-r border-border p-3 pt-4 fixed md:sticky top-0 h-screen overflow-y-auto overflow-x-hidden z-40 transition-[transform,width] duration-200 flex flex-col ${
          menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className={`pb-5 pt-1 flex ${collapsed ? 'md:flex-col md:items-center md:gap-3' : ''} items-start justify-between gap-2`}>
          <div className={`px-2 ${lbl}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-wordmark.png" alt="Buildify" className="logo-adaptive h-7 w-auto" />
            <div className="text-[10px] font-semibold tracking-[0.12em] text-accent mt-2 uppercase">FinTracker</div>
          </div>
          {collapsed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo-mark.png" alt="Buildify" className="logo-adaptive hidden md:block h-8 w-8" />
          )}
          <button
            onClick={() => setSidebarPref(collapsed ? 'expanded' : 'collapsed')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-muted hover:text-fg hover:bg-bg transition-colors flex-shrink-0"
          >
            <Icon name={collapsed ? 'expand' : 'collapse'} size={18} />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5">
          {ROUTES.map((r) => {
            const active = current.href === r.href;
            return (
              <NavTip key={r.href} label={r.label} show={collapsed}>
                <Link
                  href={r.href}
                  aria-label={r.label}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors ${
                    collapsed ? 'md:justify-center md:px-0' : ''
                  } ${active ? 'relative bg-white text-neutral-900 shadow-sm' : 'relative text-fg/80 hover:bg-bg'}`}
                >
                  <Icon name={r.icon} size={18} className={`flex-shrink-0 ${active ? 'text-neutral-900' : 'text-muted'}`} />
                  <span className={lbl}>{r.label}</span>
                  {r.href === '/categorize' && pendingCount > 0 && (
                    <span
                      aria-label={`${pendingCount} to categorize`}
                      className={`ml-auto rounded-full bg-accent text-white text-[11px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center ${
                        collapsed ? 'md:absolute md:top-0.5 md:right-0.5 md:ml-0 md:min-w-[16px] md:h-4 md:px-1 md:text-[9px]' : ''
                      }`}
                    >
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </Link>
              </NavTip>
            );
          })}
        </nav>

        <div className="mt-auto pt-3 flex flex-col gap-0.5">
          <SwitchRow label="Hints" icon="info" on={hintsOn} collapsed={collapsed} onClick={() => setHintsPref(hintsOn ? 'off' : 'on')} />
          <SwitchRow
            label={dark ? 'Dark mode' : 'Light mode'}
            icon={dark ? 'moon' : 'sun'}
            on={dark}
            collapsed={collapsed}
            onClick={toggleDark}
          />
          <div className={`border-t border-border mt-2 pt-3 px-1 flex items-center gap-2.5 ${collapsed ? 'md:flex-col' : ''}`}>
            <div
              title={userName}
              className="w-8 h-8 rounded-full bg-accent-2/15 text-accent flex items-center justify-center text-[12px] font-bold flex-shrink-0"
            >
              {initials(userName)}
            </div>
            <div className={`min-w-0 flex-1 ${lbl}`}>
              <div className="text-[13px] font-semibold truncate">{userName}</div>
              <div className="text-[11px] text-muted">Founder</div>
            </div>
            <button onClick={logout} aria-label="Sign out" title="Sign out" className="text-muted hover:text-fg">
              <Icon name="logout" size={16} />
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
          <button
            onClick={goBack}
            aria-label="Go back"
            title="Back"
            className="w-10 h-10 border border-border rounded-full flex items-center justify-center flex-shrink-0 bg-surface text-fg/80 hover:text-accent hover:border-accent/60 transition-colors"
          >
            <Icon name="back" size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="font-display text-[26px] font-bold leading-tight truncate">{current.label}</h1>
              {hintsOn && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button aria-label={`About ${current.label}`} className="w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-accent transition-colors flex-shrink-0">
                      <Icon name="info" size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-[16rem]">
                    {current.hint}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <button onClick={() => setNotifOpen(true)} className="relative w-10 h-10 border border-border rounded-full flex items-center justify-center flex-shrink-0 bg-surface hover:bg-bg">
            <Icon name="notifications" size={18} />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-neg text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-bg">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>
        </div>
        <div className="p-4 md:p-7 pb-28 flex flex-col gap-4">{children}</div>
      </div>

      <QuickAdd
        onEntry={setNewEntryTab}
        onImport={() => (pathname === '/cash' ? window.dispatchEvent(new Event('fintracker:open-import')) : router.push('/cash#import'))}
      />

      {newEntryTab && (
        <NewEntryModal
          initialTab={newEntryTab}
          onClose={() => setNewEntryTab(null)}
          onSaved={() => {
            setNewEntryTab(null);
            router.refresh();
            refreshAlertCount();
          }}
        />
      )}
      {notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} onChanged={refreshAlertCount} />}
    </div>
    </TooltipProvider>
  );
}

// Sidebar footer row with a switch; collapses to just its icon in the icon rail.
function SwitchRow({ label, icon, on, collapsed, onClick }: { label: string; icon: 'info' | 'moon' | 'sun'; on: boolean; collapsed: boolean; onClick: () => void }) {
  if (collapsed) {
    return (
      <>
        {/* icon-only rail on desktop */}
        <div className="hidden md:block">
          <NavTip label={`${label}: ${on ? 'on' : 'off'}`} show>
            <Button variant="ghost" size="icon" onClick={onClick} aria-label={label} className="w-full rounded-xl h-10">
              <Icon name={icon} size={18} className={on ? 'text-accent' : 'text-muted'} />
            </Button>
          </NavTip>
        </div>
        <div className="md:hidden">
          <SwitchRowFull label={label} icon={icon} on={on} onClick={onClick} />
        </div>
      </>
    );
  }
  return <SwitchRowFull label={label} icon={icon} on={on} onClick={onClick} />;
}

function SwitchRowFull({ label, icon, on, onClick }: { label: string; icon: 'info' | 'moon' | 'sun'; on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-fg/80 hover:bg-bg cursor-pointer">
      <span className="flex items-center gap-2.5">
        <Icon name={icon} size={18} className="flex-shrink-0 text-muted" />
        {label}
      </span>
      <Switch checked={on} onClick={(e) => e.stopPropagation()} onCheckedChange={onClick} aria-label={label} />
    </div>
  );
}

// Tooltip only when the sidebar is the icon rail (labels hidden); otherwise pass through.
function NavTip({ label, show, children }: { label: string; show: boolean; children: React.ReactNode }) {
  if (!show) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
