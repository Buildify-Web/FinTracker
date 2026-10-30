'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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

  return (
    <form onSubmit={onSubmit}>
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Email</label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full mb-4 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm"
      />
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Password</label>
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full mb-4 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm"
      />
      {error && <div className="text-neg text-sm mb-4">{error}</div>}
      <button type="submit" disabled={loading} className="w-full bg-accent text-white font-semibold rounded-full py-2.5 text-sm hover:bg-accent-2 transition-colors disabled:opacity-60">
        {loading ? 'Signing in…' : 'Sign in'}
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
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Phone number</label>
        <input
          type="tel"
          required
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full mb-4 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm"
        />
        {error && <div className="text-neg text-sm mb-4">{error}</div>}
        <button type="submit" disabled={loading} className="w-full bg-accent text-white font-semibold rounded-full py-2.5 text-sm hover:bg-accent-2 transition-colors disabled:opacity-60">
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
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Enter the code</label>
      <input
        type="text"
        inputMode="numeric"
        required
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full mb-2 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm font-mono tracking-widest"
      />
      <button type="button" onClick={() => setCodeSent(false)} className="text-xs text-muted mb-4 underline">
        Use a different number
      </button>
      {error && <div className="text-neg text-sm mb-4">{error}</div>}
      <button type="submit" disabled={loading} className="w-full bg-accent text-white font-semibold rounded-full py-2.5 text-sm hover:bg-accent-2 transition-colors disabled:opacity-60">
        {loading ? 'Verifying…' : 'Verify & sign in'}
      </button>
    </form>
  );
}

// Phone sign-in is off until a real SMS provider is set up (see OTP_MODE in lib/otp.ts);
// the API refuses it too. Flip both when going live.
const PHONE_LOGIN = false;

function LoginForm() {
  const [tab, setTab] = useState<'email' | 'phone'>('email');

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-7">
        <div className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-wordmark.png" alt="Buildify" className="logo-adaptive h-8 w-auto" />
          <div className="text-[10px] font-semibold tracking-[0.12em] text-accent mt-2 uppercase">FinTracker</div>
        </div>
        <h1 className="font-display text-xl font-bold mb-5">Sign in</h1>
        {PHONE_LOGIN && (
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setTab('email')}
              className={`text-xs font-semibold rounded-full px-4 py-2 transition-colors ${tab === 'email' ? 'bg-accent text-white' : 'border border-border text-muted'}`}
            >
              Email
            </button>
            <button
              onClick={() => setTab('phone')}
              className={`text-xs font-semibold rounded-full px-4 py-2 transition-colors ${tab === 'phone' ? 'bg-accent text-white' : 'border border-border text-muted'}`}
            >
              Phone (OTP)
            </button>
          </div>
        )}
        {tab === 'email' ? <EmailLoginForm /> : <PhoneLoginForm />}
      </div>
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
