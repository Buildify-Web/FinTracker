'use client';

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { useRouter } from 'next/navigation';

type Account = { id: string; name: string };

export default function StatementImporter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [kind, setKind] = useState<'bank' | 'slice'>('bank');
  const [accountId, setAccountId] = useState('');
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState({ date: '', description: '', amount: '', debit: '', credit: '' });
  const [mode, setMode] = useState<'signed' | 'debitCredit'>('signed');
  const [result, setResult] = useState<{ inserted: number; skipped: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) fetch('/api/reference').then((r) => r.json()).then((d) => setAccounts(d.accounts));
  }, [open]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setResult(null);
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const fields = res.meta.fields ?? [];
        setHeaders(fields);
        setRows(res.data);
        const guess = (names: string[]) => fields.find((f) => names.some((n) => f.toLowerCase().includes(n))) || '';
        setMapping({
          date: guess(['date']),
          description: guess(['description', 'narration', 'particulars', 'details', 'merchant']),
          amount: guess(['amount']),
          debit: guess(['debit', 'withdrawal']),
          credit: guess(['credit', 'deposit'])
        });
      }
    });
  }

  async function commit() {
    setBusy(true);
    setError(null);
    const map = mode === 'signed' ? { date: mapping.date, description: mapping.description, amount: mapping.amount } : { date: mapping.date, description: mapping.description, debit: mapping.debit, credit: mapping.credit };
    const res = await fetch('/api/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: accountId, kind, rows, mapping: map, filename })
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Import failed.');
      return;
    }
    const data = await res.json();
    setResult(data);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-accent text-white rounded-full px-3.5 py-2 text-sm font-semibold">
        + Import statement
      </button>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Import a statement</h3>
        <button onClick={() => setOpen(false)} className="text-xs border border-border rounded-full px-2 py-1">
          Close
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-2.5">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Statement type</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="input">
            <option value="bank">Bank / UPI CSV</option>
            <option value="slice">Slice card CSV</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Account</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">CSV file</label>
          <input type="file" accept=".csv" onChange={onFile} className="text-sm" />
        </div>
      </div>

      {headers.length > 0 && (
        <>
          <div className="text-xs text-muted">{rows.length} rows detected in {filename}. Map the columns below.</div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Date column</label>
              <select value={mapping.date} onChange={(e) => setMapping({ ...mapping, date: e.target.value })} className="input">
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Description column</label>
              <select value={mapping.description} onChange={(e) => setMapping({ ...mapping, description: e.target.value })} className="input">
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setMode('signed')} className={`text-xs rounded-full px-2.5 py-1.5 ${mode === 'signed' ? 'bg-accent text-white' : 'border border-border'}`}>
              Single signed amount column
            </button>
            <button
              onClick={() => setMode('debitCredit')}
              className={`text-xs rounded-full px-2.5 py-1.5 ${mode === 'debitCredit' ? 'bg-accent text-white' : 'border border-border'}`}
            >
              Separate debit/credit columns
            </button>
          </div>

          {mode === 'signed' ? (
            <div className="flex flex-col gap-1 max-w-xs">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Amount column (negative = money out)</label>
              <select value={mapping.amount} onChange={(e) => setMapping({ ...mapping, amount: e.target.value })} className="input">
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5 max-w-md">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Debit column</label>
                <select value={mapping.debit} onChange={(e) => setMapping({ ...mapping, debit: e.target.value })} className="input">
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">Credit column</label>
                <select value={mapping.credit} onChange={(e) => setMapping({ ...mapping, credit: e.target.value })} className="input">
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="text-left px-2 py-1.5 border-b border-border font-semibold text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 4).map((r, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h} className="px-2 py-1.5 border-b border-border last:border-0">
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <div className="text-neg text-sm">{error}</div>}
          {result && (
            <div className="text-pos text-sm">
              Imported {result.inserted} new transactions ({result.skipped} skipped as duplicates or unparsable) out of {result.total} rows.
            </div>
          )}

          <button
            onClick={commit}
            disabled={busy || !accountId || !mapping.date || !mapping.description}
            className="self-start bg-accent text-white rounded-full px-3.5 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? 'Importing…' : 'Commit import'}
          </button>
        </>
      )}

      <style jsx global>{`
        .input {
          background: rgb(var(--bg));
          border: 1px solid rgb(var(--border));
          border-radius: 10px;
          padding: 8px 9px;
          font-size: 13px;
          color: rgb(var(--fg));
          width: 100%;
        }
      `}</style>
    </div>
  );
}
