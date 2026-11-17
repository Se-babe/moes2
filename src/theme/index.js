import { Platform } from 'react-native';

// ------------------------------------------------------------------
// NWSC e-Participation design tokens. Every screen should take colours,
// spacing, type and elevation from here — never hard-code them.
// ------------------------------------------------------------------

export const COLORS = {
  // Brand
  primary: '#0A4D8C',       // NWSC deep water blue
  primaryDark: '#06325C',
  primaryDarker: '#041F3A',
  primaryLight: '#1A73C9',
  primarySoft: '#E6F0FA',
  accent: '#38BDF8',        // clear-water cyan
  accentSoft: '#E0F6FE',

  // Neutrals
  white: '#FFFFFF',
  bg: '#F5F8FB',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  // Status
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#2563EB',
  infoSoft: '#DBEAFE',
};

export const FONT = Platform.select({
  web: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  default: undefined,
});

export const TYPE = {
  display: { fontFamily: FONT, fontSize: 44, lineHeight: 52, fontWeight: '800', letterSpacing: -1, color: COLORS.gray900 },
  h1: { fontFamily: FONT, fontSize: 32, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5, color: COLORS.gray900 },
  h2: { fontFamily: FONT, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3, color: COLORS.gray900 },
  h3: { fontFamily: FONT, fontSize: 18, lineHeight: 26, fontWeight: '700', color: COLORS.gray900 },
  body: { fontFamily: FONT, fontSize: 15, lineHeight: 24, color: COLORS.gray700 },
  small: { fontFamily: FONT, fontSize: 13, lineHeight: 20, color: COLORS.gray500 },
  label: { fontFamily: FONT, fontSize: 14, lineHeight: 20, fontWeight: '600', color: COLORS.gray800 },
  overline: {
    fontFamily: FONT, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', color: COLORS.primaryLight,
  },
};

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 72 };

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const SHADOW = {
  sm: Platform.select({
    web: { boxShadow: '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.08)' },
    default: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  }),
  md: Platform.select({
    web: { boxShadow: '0 4px 12px rgba(15,23,42,0.08)' },
    default: { shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  }),
  lg: Platform.select({
    web: { boxShadow: '0 20px 40px rgba(6,50,92,0.16)' },
    default: { shadowColor: '#06325C', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  }),
};

export const LAYOUT = {
  maxWidth: 1200,
  gutter: 20,
  breakpoints: { sm: 640, md: 900, lg: 1100 },
};

// Gradient helper for web (react-native-web passes `backgroundImage` through).
export const gradient = (from, to, angle = 135) =>
  Platform.OS === 'web' ? { backgroundImage: `linear-gradient(${angle}deg, ${from}, ${to})` } : { backgroundColor: from };
