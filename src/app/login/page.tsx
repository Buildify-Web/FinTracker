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
        className="w-full mb-4 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
      />
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">Password</label>
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full mb-4 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
      />
      {error && <div className="text-neg text-sm mb-4">{error}</div>}
      <button type="submit" disabled={loading} className="w-full bg-accent text-white font-semibold rounded-lg py-2 text-sm disabled:opacity-60">
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
          className="w-full mb-4 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        />
        {error && <div className="text-neg text-sm mb-4">{error}</div>}
        <button type="submit" disabled={loading} className="w-full bg-accent text-white font-semibold rounded-lg py-2 text-sm disabled:opacity-60">
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
        className="w-full mb-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm font-mono tracking-widest"
      />
      <button type="button" onClick={() => setCodeSent(false)} className="text-xs text-muted mb-4 underline">
        Use a different number
      </button>
      {error && <div className="text-neg text-sm mb-4">{error}</div>}
      <button type="submit" disabled={loading} className="w-full bg-accent text-white font-semibold rounded-lg py-2 text-sm disabled:opacity-60">
        {loading ? 'Verifying…' : 'Verify & sign in'}
      </button>
    </form>
  );
}

function LoginForm() {
  const [tab, setTab] = useState<'email' | 'phone'>('email');

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-6">
        <div className="font-mono text-xs uppercase tracking-wide text-muted mb-1">Buildify</div>
        <h1 className="text-lg font-semibold mb-5">Sign in to God&apos;s View</h1>
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab('email')}
            className={`text-xs font-semibold rounded-md px-3 py-1.5 ${tab === 'email' ? 'bg-accent text-white' : 'border border-border text-muted'}`}
          >
            Email
          </button>
          <button
            onClick={() => setTab('phone')}
            className={`text-xs font-semibold rounded-md px-3 py-1.5 ${tab === 'phone' ? 'bg-accent text-white' : 'border border-border text-muted'}`}
          >
            Phone (OTP)
          </button>
        </div>
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
