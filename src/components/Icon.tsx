const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  statements: 'M7 3h7l5 5v13H7V3Zm7 0v5h5M9.5 13h5M9.5 16.5h5M9.5 9.5h2',
  cash: 'M3 7h18v10H3V7Zm9 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6 7v10M18 7v10',
  receivables: 'M12 4v13m0 0 5-5m-5 5-5-5M5 20h14',
  payables: 'M12 20V7m0 0-5 5m5-5 5 5M5 4h14',
  debt: 'M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm0 4v11m2.75-8.5c0-1.1-1.23-2-2.75-2s-2.75.9-2.75 2 1.23 1.75 2.75 1.75 2.75.75 2.75 1.75-1.23 2-2.75 2-2.75-.75-2.75-1.75',
  pnl: 'M4 20V4m0 16h16M8 16V11m4.5 5V7m4.5 9v-4',
  clients: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5M15 14.5c2.8.3 5 2.5 5 5.5',
  forecast: 'm3 17 6-6 4 4 7-8m0 0h-5m5 0v5',
  notifications: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9ZM10 21a2 2 0 0 0 4 0',
  plus: 'M12 5v14M5 12h14',
  moon: 'M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z',
  chevron: 'm9 6 6 6-6 6',
  menu: 'M3 6h18M3 12h18M3 18h18',
  help: 'M9.1 9a3 3 0 1 1 4.9 2.3c-.9.7-1.5 1.4-1.5 2.7M12 17.5h.01',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M4 21h16'
};

export default function Icon({ name, size = 18, className = '' }: { name: keyof typeof PATHS; size?: number; className?: string }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}
