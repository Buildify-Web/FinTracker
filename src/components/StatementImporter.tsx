'use client';

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { useRouter } from 'next/navigation';

type Account = { id: string; name: string };

export default function StatementImporter() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [kind, setKind] = useState<'bank' | 'slice'>('bank');
  const [accountId, setAccountId] = useState('');
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState({ date: '', description: '', amount: '', debit: '', credit: '', type: '' });
  const [mode, setMode] = useState<'signed' | 'debitCredit' | 'amountType'>('signed');
  const [result, setResult] = useState<{ inserted: number; skipped: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  useEffect(() => {
    fetch('/api/reference').then((r) => r.json()).then((d) => setAccounts(d.accounts));
  }, []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setResult(null);
    setError(null);
    // Bank exports often have an account-details preamble and a footer; parse as raw rows, find the real header row,
    // and keep only rows that start with a date.
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (res) => {
        const raw = res.data.map((r) => r.map((c) => (c ?? '').trim()));
        const hasDate = (r: string[]) => r.some((c) => /date/i.test(c));
        const hasText = (r: string[]) => r.some((c) => /particulars|description|narration|details|merchant/i.test(c));
        let hi = raw.findIndex((r) => r.length > 2 && hasDate(r) && hasText(r));
        if (hi < 0) hi = 0;
        const fields = raw[hi];
        const dateCol = Math.max(0, fields.findIndex((f) => /date/i.test(f)));
        const data = raw
          .slice(hi + 1)
          .filter((r) => /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(r[dateCol] ?? ''))
          .map((r) => Object.fromEntries(fields.map((f, i) => [f, r[i] ?? ''])));
        setHeaders(fields);
        setRows(data);
        const guess = (names: string[]) => fields.find((f) => names.some((n) => f.toLowerCase().includes(n))) || '';
        setMapping({
          date: guess(['tran date', 'date']),
          description: guess(['description', 'narration', 'particulars', 'details', 'merchant']),
          amount: guess(['amount']),
          debit: guess(['debit', 'withdrawal']),
          credit: guess(['credit', 'deposit']),
          type: guess(['dr|cr', 'dr/cr', 'cr/dr', 'type'])
        });
        const typeCol = guess(['dr|cr', 'dr/cr', 'cr/dr']);
        setMode(typeCol && guess(['amount']) ? 'amountType' : guess(['debit', 'withdrawal']) && guess(['credit', 'deposit']) ? 'debitCredit' : 'signed');
        setShowMapping(false);
      }
    });
  }

  async function commit() {
    setBusy(true);
    setError(null);
    const base = { date: mapping.date, description: mapping.description };
    const map =
      mode === 'signed' ? { ...base, amount: mapping.amount } : mode === 'amountType' ? { ...base, amount: mapping.amount, type: mapping.type } : { ...base, debit: mapping.debit, credit: mapping.credit };
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
    // Straight to the approval screen so imported rows can be sorted into invoices / bills.
    if (data.inserted > 0) router.push('/categorize');
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-3.5">

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
          {!showMapping && (mapping.date && mapping.description && (mode === 'debitCredit' ? mapping.debit && mapping.credit : mode === 'amountType' ? mapping.amount && mapping.type : mapping.amount)) ? (
            <div className="text-xs text-muted">
              Columns matched automatically: date <b className="text-fg">{mapping.date}</b>, description <b className="text-fg">{mapping.description}</b>, amount <b className="text-fg">{mode === 'debitCredit' ? `${mapping.debit} / ${mapping.credit}` : mode === 'amountType' ? `${mapping.amount} + ${mapping.type}` : mapping.amount}</b>.{' '}
              <button onClick={() => setShowMapping(true)} className="underline">
                Change
              </button>
            </div>
          ) : (
            <>
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
              One amount column (negative = out)
            </button>
            <button
              onClick={() => setMode('debitCredit')}
              className={`text-xs rounded-full px-2.5 py-1.5 ${mode === 'debitCredit' ? 'bg-accent text-white' : 'border border-border'}`}
            >
              Separate debit/credit columns
            </button>
            <button
              onClick={() => setMode('amountType')}
              className={`text-xs rounded-full px-2.5 py-1.5 ${mode === 'amountType' ? 'bg-accent text-white' : 'border border-border'}`}
            >
              Amount + DR/CR flag
            </button>
          </div>

          {mode === 'signed' || mode === 'amountType' ? (
            <div className="grid sm:grid-cols-2 gap-2.5 max-w-md">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">{mode === 'signed' ? 'Amount column (negative = money out)' : 'Amount column'}</label>
              <select value={mapping.amount} onChange={(e) => setMapping({ ...mapping, amount: e.target.value })} className="input">
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            {mode === 'amountType' && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-muted">DR/CR column</label>
                <select value={mapping.type} onChange={(e) => setMapping({ ...mapping, type: e.target.value })} className="input">
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            )}
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

            </>
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
              Imported {result.inserted} new transactions ({result.skipped} skipped as duplicates or unparsable) out of {result.total} rows.{' '}
              <a href="/categorize" className="underline font-semibold">
                Categorize them →
              </a>
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
    </div>
  );
}
