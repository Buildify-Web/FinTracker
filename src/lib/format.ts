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

export function fmtDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function monthLabel(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}
