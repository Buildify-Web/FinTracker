'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-surface border border-border rounded-xl p-6">
        <div className="font-mono text-xs uppercase tracking-wide text-muted mb-1">Buildify</div>
        <h1 className="text-lg font-semibold mb-6">Sign in to God&apos;s View</h1>
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
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-white font-semibold rounded-lg py-2 text-sm disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
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
