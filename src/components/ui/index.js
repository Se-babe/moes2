import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, TYPE, SPACE, RADIUS, SHADOW, LAYOUT, FONT, gradient } from '../../theme';

// ------------------------------------------------------------------
// Shared UI kit. Screens compose these instead of styling from scratch.
// ------------------------------------------------------------------

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  return {
    width,
    isMobile: width < LAYOUT.breakpoints.sm,
    isTablet: width >= LAYOUT.breakpoints.sm && width < LAYOUT.breakpoints.md,
    isDesktop: width >= LAYOUT.breakpoints.md,
  };
}

/** Centres content at the site's max width with consistent side gutters. */
export function Container({ children, style, narrow }) {
  return (
    <View style={[styles.container, narrow && { maxWidth: 860 }, style]}>{children}</View>
  );
}

/** Coloured band at the top of an inner page: breadcrumb, title, subtitle. */
export function PageHeader({ title, subtitle, icon, overline, children, back = true }) {
  const navigation = useNavigation();
  const { isMobile } = useBreakpoint();
  return (
    <View style={[styles.pageHeader, gradient(COLORS.primaryDark, COLORS.primary), isMobile && styles.pageHeaderMobile]}>
      <Container>
        {back && (
          <Pressable
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
            style={styles.backLink}
            accessibilityRole="link"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={16} color="#BAE6FD" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        )}
        <View style={styles.pageHeaderRow}>
          {icon && !isMobile && (
            <View style={styles.pageHeaderIcon}>
              <Ionicons name={icon} size={28} color={COLORS.white} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            {overline ? <Text style={[TYPE.overline, { color: '#7DD3FC' }]}>{overline}</Text> : null}
            <Text style={[TYPE.h1, styles.pageTitle, isMobile && { fontSize: 26, lineHeight: 32 }]} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {children}
      </Container>
    </View>
  );
}

export function Card({ children, style, padded = true, elevated = false }) {
  return (
    <View style={[styles.card, padded && { padding: SPACE.xl }, elevated ? SHADOW.md : SHADOW.sm, style]}>
      {children}
    </View>
  );
}

const BUTTON_VARIANTS = {
  primary: { bg: COLORS.primary, fg: COLORS.white, border: COLORS.primary, hover: COLORS.primaryDark },
  secondary: { bg: COLORS.white, fg: COLORS.primary, border: COLORS.gray300, hover: COLORS.gray50 },
  ghost: { bg: 'transparent', fg: COLORS.primary, border: 'transparent', hover: COLORS.primarySoft },
  light: { bg: COLORS.white, fg: COLORS.primaryDark, border: COLORS.white, hover: '#E0F2FE' },
  outlineLight: { bg: 'transparent', fg: COLORS.white, border: 'rgba(255,255,255,0.5)', hover: 'rgba(255,255,255,0.1)' },
  danger: { bg: COLORS.danger, fg: COLORS.white, border: COLORS.danger, hover: '#B91C1C' },
};

export function Button({
  title, onPress, variant = 'primary', icon, iconRight, loading, disabled, size = 'md', style, full, accessibilityLabel,
}) {
  const v = BUTTON_VARIANTS[variant];
  const pad = size === 'lg' ? { paddingVertical: 15, paddingHorizontal: 26 } : size === 'sm' ? { paddingVertical: 8, paddingHorizontal: 14 } : { paddingVertical: 12, paddingHorizontal: 20 };
  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 13 : 15;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: isDisabled }}
      style={({ hovered, pressed }) => [
        styles.button,
        pad,
        { backgroundColor: hovered || pressed ? v.hover : v.bg, borderColor: v.border },
        full && { alignSelf: 'stretch' },
        isDisabled && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={fontSize + 3} color={v.fg} /> : null}
          <Text style={[styles.buttonText, { color: v.fg, fontSize }]}>{title}</Text>
          {iconRight ? <Ionicons name={iconRight} size={fontSize + 2} color={v.fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

const BADGE_TONES = {
  neutral: [COLORS.gray100, COLORS.gray700],
  info: [COLORS.infoSoft, COLORS.info],
  success: [COLORS.successSoft, COLORS.success],
  warning: [COLORS.warningSoft, COLORS.warning],
  danger: [COLORS.dangerSoft, COLORS.danger],
  brand: [COLORS.primarySoft, COLORS.primary],
};

export function Badge({ label, tone = 'neutral', icon, style }) {
  const [bg, fg] = BADGE_TONES[tone] || BADGE_TONES.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export const STATUS_TONE = {
  Submitted: 'info',
  Assigned: 'brand',
  'In Progress': 'warning',
  Escalated: 'danger',
  Resolved: 'success',
  Closed: 'neutral',
};

export function SectionTitle({ overline, title, subtitle, action, align = 'left', style }) {
  return (
    <View style={[styles.sectionTitleRow, align === 'center' && { justifyContent: 'center' }, style]}>
      <View style={[{ flex: 1 }, align === 'center' && { alignItems: 'center' }]}>
        {overline ? <Text style={TYPE.overline}>{overline}</Text> : null}
        <Text style={[TYPE.h2, { marginTop: overline ? 6 : 0 }, align === 'center' && { textAlign: 'center' }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={[TYPE.body, { color: COLORS.gray500, marginTop: 6, maxWidth: 640 }, align === 'center' && { textAlign: 'center' }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action || null}
    </View>
  );
}

export function TextField({ label, hint, error, required, multiline, style, inputStyle, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: SPACE.lg }, style]}>
      {label ? (
        <Text style={[TYPE.label, { marginBottom: 6 }]}>
          {label}{required ? <Text style={{ color: COLORS.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={COLORS.gray400}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && { minHeight: 130, paddingTop: 12 },
          focused && styles.inputFocused,
          error && { borderColor: COLORS.danger },
          inputStyle,
        ]}
        {...props}
      />
      {error ? <Text style={[TYPE.small, { color: COLORS.danger, marginTop: 4 }]}>{error}</Text> : null}
      {!error && hint ? <Text style={[TYPE.small, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon = 'file-tray-outline', title, message, action }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={COLORS.primary} />
      </View>
      <Text style={[TYPE.h3, { textAlign: 'center' }]}>{title}</Text>
      {message ? <Text style={[TYPE.body, { textAlign: 'center', color: COLORS.gray500, marginTop: 6, maxWidth: 420 }]}>{message}</Text> : null}
      {action ? <View style={{ marginTop: SPACE.lg }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={[TYPE.small, { marginTop: 10 }]}>{label}</Text>
    </View>
  );
}

/** A responsive grid: `columns` on desktop, fewer on smaller screens. */
export function Grid({ children, columns = 3, gap = SPACE.lg, minItemWidth = 260, style }) {
  const { width } = useWindowDimensions();
  const usable = Math.min(width, LAYOUT.maxWidth) - LAYOUT.gutter * 2;
  const fit = Math.max(1, Math.min(columns, Math.floor((usable + gap) / (minItemWidth + gap))));
  const items = React.Children.toArray(children);
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }, style]}>
      {items.map((child, i) => (
        <View key={i} style={{ width: `${100 / fit}%`, paddingHorizontal: gap / 2, marginBottom: gap }}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: LAYOUT.maxWidth, alignSelf: 'center', paddingHorizontal: LAYOUT.gutter },
  pageHeader: { backgroundColor: COLORS.primaryDark, paddingTop: SPACE.xl, paddingBottom: SPACE.xxxl },
  pageHeaderMobile: { paddingTop: SPACE.lg, paddingBottom: SPACE.xxl },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: SPACE.lg },
  backText: { fontFamily: FONT, color: '#BAE6FD', fontSize: 14, fontWeight: '600' },
  pageHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  pageHeaderIcon: {
    width: 60, height: 60, borderRadius: RADIUS.lg, backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { color: COLORS.white, marginTop: 4 },
  pageSubtitle: { fontFamily: FONT, color: '#CFE6FA', fontSize: 16, lineHeight: 24, marginTop: 8, maxWidth: 720 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray200 },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: RADIUS.md, borderWidth: 1.5, alignSelf: 'flex-start',
    ...(Platform.OS === 'web' ? { transitionDuration: '150ms', cursor: 'pointer' } : null),
  },
  buttonText: { fontFamily: FONT, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.lg, marginBottom: SPACE.xl, flexWrap: 'wrap' },
  input: {
    fontFamily: FONT, borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.gray900, backgroundColor: COLORS.white,
  },
  inputFocused: { borderColor: COLORS.primaryLight, ...(Platform.OS === 'web' ? { boxShadow: '0 0 0 4px rgba(26,115,201,0.15)' } : null) },
  empty: { alignItems: 'center', paddingVertical: SPACE.xxxl, paddingHorizontal: SPACE.xl },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.huge },
});
