// Shared dark theme for the admin panel — kept in one place since every
// admin screen needs to match exactly, unlike the citizen-facing screens
// which each embed their own (light) COLORS object.
export const ADMIN_COLORS = {
  bg: '#0B1220',          // page background
  surface: '#141B2E',     // card / panel background
  surfaceAlt: '#1B2438',  // input fields, chips, hover states
  border: '#26314A',      // subtle dividers/borders on dark
  primary: '#3B82F6',     // bright blue — pops on dark, same hue family as the brand's #1E3A8A
  primaryDark: '#1E3A8A',
  accent: '#FCD34D',      // brand gold
  text: '#E2E8F0',        // primary text (near-white)
  textMuted: '#94A3B8',   // secondary text
  textDim: '#64748B',     // placeholders / least important text
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.12)',
  success: '#4ADE80',
  successSoft: 'rgba(74,222,128,0.12)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251,191,36,0.12)',
  info: '#60A5FA',
  infoSoft: 'rgba(96,165,250,0.12)',
};
