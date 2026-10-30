// Brand palette the chart components are written against. AppChart swaps the
// accent/navy entries for theme-appropriate colors (see CHART_PALETTE_REMAP):
// the light theme uses the palette as-is, dark brightens it for the warm-black bg.
export const CHART_COLORS = ['#6D28D9', '#7C3AED', '#0F172A', '#16A34A', '#D97706', '#DC2626'];
export const COLOR_ACCENT = '#6D28D9';
export const COLOR_ACCENT_2 = '#7C3AED';
export const COLOR_SECONDARY = '#0F172A';
export const COLOR_POS = '#16A34A';
export const COLOR_WARN = '#D97706';
export const COLOR_NEG = '#DC2626';

export const CHART_PALETTE_REMAP: Record<'light' | 'dark', Record<string, string>> = {
  light: {},
  dark: { '#6D28D9': '#9B5DE5', '#7C3AED': '#B794F6', '#0F172A': '#6B6B6B' }
};
