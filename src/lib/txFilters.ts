// Filters + paging for the Cash transactions list, shared by the page and the "select all matching" endpoint.
export type TxFilters = { q: string; dir: '' | 'in' | 'out'; account: string; category: string; from: string; to: string; page: number; size: number };

export const PAGE_SIZES = [10, 25, 50, 100];
type Raw = Record<string, string | string[] | undefined> | URLSearchParams;

export function parseTxFilters(sp: Raw): TxFilters {
  const get = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const size = Number(get('size'));
  return {
    q: get('q').trim().slice(0, 100),
    dir: get('dir') === 'in' ? 'in' : get('dir') === 'out' ? 'out' : '',
    account: get('account'),
    category: get('category'), // a category id, or 'none' for uncategorised
    from: date(get('from')),
    to: date(get('to')),
    page: Math.max(1, Math.floor(Number(get('page'))) || 1),
    size: PAGE_SIZES.includes(size) ? size : 25
  };
}

const UUID = /^[0-9a-f-]{36}$/i;

export function txWhere(f: TxFilters): { sql: string; params: unknown[] } {
  const conds: string[] = [];
  const params: unknown[] = [];
  const add = (cond: string, v: unknown) => {
    params.push(v);
    conds.push(cond.replace(/\?/g, `$${params.length}`));
  };
  if (f.q) add(`(t.note ILIKE ? OR cl.name ILIKE ?)`, `%${f.q.replace(/[%_\\]/g, '\\$&')}%`);
  if (f.dir) add('t.direction = ?', f.dir);
  if (UUID.test(f.account)) add('t.account_id = ?', f.account);
  if (f.category === 'none') conds.push('t.category_id IS NULL');
  else if (UUID.test(f.category)) add('t.category_id = ?', f.category);
  if (f.from) add('t.date >= ?', f.from);
  if (f.to) add('t.date <= ?', f.to);
  return { sql: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

export const TX_FROM = `FROM transactions t LEFT JOIN accounts a ON a.id = t.account_id LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN clients cl ON cl.id = t.client_id`;
