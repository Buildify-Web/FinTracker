'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, BellRing, Eye, EyeOff, FileText, Loader2, Lock, ShieldCheck, TrendingUp, Users } from 'lucide-react';

const LABEL = 'block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5';
const INPUT = 'w-full rounded-xl border border-border bg-bg px-3.5 py-3 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15';
const BUTTON = 'group flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-2 hover:shadow-accent/40 disabled:opacity-60 disabled:shadow-none';

function EmailLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not sign in.');
      return;
    }
    router.push(params.get('next') || '/');
    router.refresh();
  }

  const [show, setShow] = useState(false);

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="email" className={LABEL}>
        Email
      </label>
      <input id="email" type="email" required autoFocus autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className={`${INPUT} mb-4`} />
      <label htmlFor="password" className={LABEL}>
        Password
      </label>
      <div className="relative mb-5">
        <input id="password" type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${INPUT} pr-11`} />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-fg">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-neg/30 bg-neg/10 px-3.5 py-2.5 text-[13px] text-neg">
          {error}
        </div>
      )}
      <button type="submit" disabled={loading} className={BUTTON}>
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Signing in…
          </>
        ) : (
          <>
            Sign in <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </form>
  );
}

function PhoneLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Could not send a code.');
      return;
    }
    setCodeSent(true);
    setMockCode(data.mock ? data.code : null);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not verify that code.');
      return;
    }
    router.push(params.get('next') || '/');
    router.refresh();
  }

  if (!codeSent) {
    return (
      <form onSubmit={sendCode}>
        <label className={LABEL}>Phone number</label>
        <input
          type="tel"
          required
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={`${INPUT} mb-4`}
        />
        {error && <div role="alert" className="mb-4 rounded-xl border border-neg/30 bg-neg/10 px-3.5 py-2.5 text-[13px] text-neg">{error}</div>}
        <button type="submit" disabled={loading} className={BUTTON}>
          {loading ? 'Sending…' : 'Send code'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode}>
      {mockCode && (
        <div className="mb-4 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
          <div className="font-semibold text-warn text-xs uppercase tracking-wide mb-0.5">Mock mode — no SMS sent</div>
          <div>
            Your code is <span className="font-mono font-bold tracking-widest">{mockCode}</span>
          </div>
        </div>
      )}
      <label className={LABEL}>Enter the code</label>
      <input
        type="text"
        inputMode="numeric"
        required
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className={`${INPUT} mb-2 font-mono tracking-widest`}
      />
      <button type="button" onClick={() => setCodeSent(false)} className="text-xs text-muted mb-4 underline">
        Use a different number
      </button>
      {error && <div role="alert" className="mb-4 rounded-xl border border-neg/30 bg-neg/10 px-3.5 py-2.5 text-[13px] text-neg">{error}</div>}
      <button type="submit" disabled={loading} className={BUTTON}>
        {loading ? 'Verifying…' : 'Verify & sign in'}
      </button>
    </form>
  );
}

// Phone sign-in is off until a real SMS provider is set up (see OTP_MODE in lib/otp.ts);
// the API refuses it too. Flip both when going live.
const PHONE_LOGIN = false;

const HIGHLIGHTS = [
  { Icon: FileText, title: 'Invoices that get paid', text: 'Branded invoices, part payments and a link your client can open and pay from.' },
  { Icon: BellRing, title: 'Reminders on autopilot', text: 'Polite emails every 2 days until the money lands. Pause any time.' },
  { Icon: Users, title: 'Payroll and bills, in parts', text: 'Pay your team one person at a time and keep the books right.' },
  { Icon: TrendingUp, title: 'Always know your runway', text: 'Cash, budgets and what is coming in and going out, in one place.' }
];

function LoginForm() {
  const [tab, setTab] = useState<'email' | 'phone'>('email');

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-bg">
      {/* Brand panel: always dark, whatever theme the app is in. */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-black p-12 text-white">
        <div aria-hidden className="pointer-events-none absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-accent/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-24 h-[30rem] w-[30rem] rounded-full bg-pos/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-wordmark.png" alt="Buildify" className="h-9 w-auto" />
        </div>

        <div className="relative max-w-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-pos" /> FinTracker
          </div>
          <h2 className="font-display text-[2.6rem] font-bold leading-[1.1] tracking-tight">
            Know where every <span className="text-pos">rupee</span> stands.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/60">Your studio&apos;s money, simply: who owes you, what you owe, and what is left after payroll.</p>

          <ul className="mt-9 grid gap-5">
            {HIGHLIGHTS.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/90">
                  <Icon size={17} />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold">{title}</span>
                  <span className="block text-[13px] leading-relaxed text-white/50">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[12px] text-white/40">
          <span>© {new Date().getFullYear()} Buildify</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} /> Private workspace
          </span>
        </div>
      </aside>

      <main className="relative flex flex-col items-center justify-center px-5 py-10">
        {/* On phones the brand panel is hidden, so the logo sits above the form on a dark chip. */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <div className="rounded-2xl bg-black px-6 py-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-wordmark.png" alt="Buildify" className="h-7 w-auto" />
          </div>
          <div className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">FinTracker</div>
        </div>

        <div className="w-full max-w-[26rem]">
          <div className="mb-7">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Lock size={18} />
            </div>
            <h1 className="font-display text-[1.7rem] font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-[14px] text-muted">Sign in to see your numbers.</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-7">
            {PHONE_LOGIN && (
              <div className="mb-5 flex gap-2">
                <button onClick={() => setTab('email')} className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${tab === 'email' ? 'bg-accent text-white' : 'border border-border text-muted'}`}>
                  Email
                </button>
                <button onClick={() => setTab('phone')} className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${tab === 'phone' ? 'bg-accent text-white' : 'border border-border text-muted'}`}>
                  Phone (OTP)
                </button>
              </div>
            )}
            {tab === 'email' ? <EmailLoginForm /> : <PhoneLoginForm />}
          </div>

          <p className="mt-5 text-center text-[12px] text-muted">Trouble signing in? Ask the account owner to reset your password.</p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
