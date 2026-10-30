// Typefaces offered in Settings. `id` is what's stored in localStorage and set on <html data-font>.
// `google` is the Google Fonts css2 family spec; globals.css maps each id to its font stack.
export const FONTS = [
  { id: 'playfair', name: 'Playfair Display', kind: 'Serif · default', family: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@400;500;600;700;800' },
  { id: 'instrument', name: 'Instrument Serif', kind: 'Serif · elegant', family: "'Instrument Serif', Georgia, serif", google: 'Instrument+Serif' },
  { id: 'jakarta', name: 'Plus Jakarta Sans', kind: 'Sans · Buildify brand', family: "'Plus Jakarta Sans', system-ui, sans-serif", google: 'Plus+Jakarta+Sans:wght@400;500;600;700;800' },
  { id: 'inter', name: 'Inter', kind: 'Sans · neutral, very popular', family: "'Inter', system-ui, sans-serif", google: 'Inter:wght@400;500;600;700;800' },
  { id: 'poppins', name: 'Poppins', kind: 'Sans · geometric, friendly', family: "'Poppins', system-ui, sans-serif", google: 'Poppins:wght@400;500;600;700;800' },
  { id: 'dmsans', name: 'DM Sans', kind: 'Sans · clean, modern', family: "'DM Sans', system-ui, sans-serif", google: 'DM+Sans:wght@400;500;600;700' },
  { id: 'manrope', name: 'Manrope', kind: 'Sans · crisp, fintech feel', family: "'Manrope', system-ui, sans-serif", google: 'Manrope:wght@400;500;600;700;800' },
  { id: 'lora', name: 'Lora', kind: 'Serif · readable', family: "'Lora', Georgia, serif", google: 'Lora:wght@400;500;600;700' }
] as const;

export type Font = (typeof FONTS)[number]['id'];
export const DEFAULT_FONT: Font = 'playfair';
export const FONT_IDS: string[] = FONTS.map((f) => f.id);
export const GOOGLE_FONTS_HREF = `https://fonts.googleapis.com/css2?${FONTS.map((f) => `family=${f.google}`).join('&')}&family=IBM+Plex+Mono:wght@400;500;600&display=swap`;
