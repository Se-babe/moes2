import { COLORS } from '../../theme';

// Admin console palette — mapped onto the site-wide design tokens so the
// console matches the public site and staff portal. The key names are kept
// so every existing admin screen picks up the new look automatically.
export const ADMIN_COLORS = {
  bg: COLORS.bg,
  surface: COLORS.white,
  surfaceAlt: COLORS.gray100,
  border: COLORS.gray200,
  primary: COLORS.primary,
  primaryDark: COLORS.primaryDark,
  accent: COLORS.accent,
  text: COLORS.gray900,
  textMuted: COLORS.gray600,
  textDim: COLORS.gray400,
  danger: COLORS.danger,
  dangerSoft: COLORS.dangerSoft,
  success: COLORS.success,
  successSoft: COLORS.successSoft,
  warning: COLORS.warning,
  warningSoft: COLORS.warningSoft,
  info: COLORS.info,
  infoSoft: COLORS.infoSoft,
};
