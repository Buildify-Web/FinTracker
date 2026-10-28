'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import NewEntryModal from './NewEntryModal';
import NotifPanel from './NotifPanel';

const ROUTES = [
  { href: '/', label: 'Home', icon: '◆' },
  { href: '/statements', label: 'Statements', icon: '▤' },
  { href: '/cash', label: 'Cash', icon: '⌁' },
  { href: '/receivables', label: 'Receivables', icon: '↗' },
  { href: '/payables', label: 'Payables', icon: '↙' },
  { href: '/debt', label: 'Debt', icon: '◎' },
  { href: '/pnl', label: 'P&L', icon: '≋' },
  { href: '/clients', label: 'Clients & Projects', icon: '▣' },
  { href: '/forecast', label: 'Forecast', icon: '⌬' },
  { href: '/notifications', label: 'Notifications', icon: '●' }
];

export default function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

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

  const current = ROUTES.find((r) => r.href === pathname) ?? ROUTES[0];

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`w-52 flex-shrink-0 bg-[#1f1b14] text-[#e9e4d8] p-2.5 pt-4 fixed md:sticky top-0 h-screen overflow-y-auto z-40 transition-transform ${
          menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="font-mono text-[13px] uppercase tracking-wide text-[#9a9280] px-2.5 pb-4">
          <b className="text-[#e9e4d8]">Buildify</b> · God&apos;s View
        </div>
        <nav className="flex flex-col gap-0.5">
          {ROUTES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] font-medium ${
                pathname === r.href ? 'bg-[#2c2619] text-accent' : 'text-[#9a9280] hover:bg-[#2c2619] hover:text-[#e9e4d8]'
              }`}
            >
              <span className="w-4 text-center text-[13px] opacity-90">{r.icon}</span>
              {r.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 pt-2.5 border-t border-[#2a2619]">
          <div className="text-[11px] text-[#9a9280] px-0.5 mb-2">Signed in as {userName}</div>
          <button onClick={logout} className="text-[11px] text-[#9a9280] hover:text-[#e9e4d8] px-0.5">
            Sign out
          </button>
        </div>
      </aside>

      {menuOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-20 bg-bg border-b border-border px-4 md:px-5 py-3 flex items-center gap-3.5">
          <button className="md:hidden w-8 h-8 border border-border rounded-md" onClick={() => setMenuOpen(true)}>
            ☰
          </button>
          <h1 className="text-[17px] font-semibold flex-1 min-w-0">{current.label}</h1>
          <button onClick={() => setNewEntryOpen(true)} className="border border-border rounded-md px-3 py-1.5 text-[13px] font-semibold">
            + New entry
          </button>
          <button onClick={() => setNotifOpen(true)} className="relative w-8.5 h-8.5 border border-border rounded-md flex items-center justify-center">
            🔔
            {alertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-neg text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>
        </div>
        <div className="p-4 md:p-5 flex flex-col gap-4">{children}</div>
      </div>

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
