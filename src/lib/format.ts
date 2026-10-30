export function fmtINR(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  const neg = num < 0;
  const abs = Math.round(Math.abs(num));
  const s = abs.toString();
  const last3 = s.length > 3 ? s.slice(-3) : s;
  const rest = s.length > 3 ? s.slice(0, -3) : '';
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (neg ? '-' : '') + '₹' + (grouped ? grouped + ',' : '') + last3;
}

export function fmtCompactINR(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  const neg = num < 0;
  const abs = Math.abs(num);
  let out: string;
  if (abs >= 1e7) out = (abs / 1e7).toFixed(2) + 'Cr';
  else if (abs >= 1e5) out = (abs / 1e5).toFixed(2) + 'L';
  else if (abs >= 1e3) out = (abs / 1e3).toFixed(1) + 'k';
  else out = Math.round(abs).toString();
  return (neg ? '-' : '') + '₹' + out;
}

// Fixed month names (not toLocaleDateString): Node and browsers disagree on "Sep" vs "Sept" for en-IN,
// which breaks hydration. Plain YYYY-MM-DD strings are read as-is so there's no timezone shift either.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(d: string | Date): { y: number; m: number; day: number } {
  const iso = typeof d === 'string' ? d.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (iso) return { y: +iso[1], m: +iso[2] - 1, day: +iso[3] };
  const date = typeof d === 'string' ? new Date(d) : d;
  return { y: date.getFullYear(), m: date.getMonth(), day: date.getDate() };
}

export function fmtDate(d: string | Date): string {
  const { y, m, day } = parts(d);
  return `${String(day).padStart(2, '0')} ${MONTHS[m]} ${y}`;
}

export function monthLabel(d: string | Date): string {
  const { y, m } = parts(d);
  return `${MONTHS[m]} ${String(y).slice(2)}`;
}
