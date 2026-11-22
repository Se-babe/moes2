import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePreferences, ACCENTS } from '../context/PreferencesContext';
import { COLORS, FONT, RADIUS, SHADOW, SPACE, TYPE } from '../theme';

const MODES = [
  { value: 'light', icon: 'sunny-outline' },
  { value: 'dark', icon: 'moon-outline' },
  { value: 'system', icon: 'phone-portrait-outline' },
];

/** Appearance controls: light/dark/device, and the colour theme. */
export function AppearanceOptions() {
  const p = usePreferences();
  return (
    <View>
      <Text style={styles.label}>{p.t('look.mode')}</Text>
      <View style={styles.modes} accessibilityRole="radiogroup" accessibilityLabel={p.t('look.mode')}>
        {MODES.map((m) => {
          const on = (p.appearance || 'light') === m.value;
          return (
            <Pressable key={m.value} onPress={() => p.update({ appearance: m.value })} style={[styles.mode, on && styles.modeOn]}
              accessibilityRole="radio" accessibilityState={{ checked: on }}>
              <Ionicons name={m.icon} size={20} color={on ? COLORS.primary : COLORS.gray600} />
              <Text style={[styles.modeText, on && { color: COLORS.primary }]}>{p.t(`look.${m.value}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.label}>{p.t('look.colour')}</Text>
      <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel={p.t('look.colour')}>
        {ACCENTS.map((a) => {
          const on = (p.accent || 'blue') === a.value;
          return (
            <Pressable key={a.value} onPress={() => p.update({ accent: a.value })} style={[styles.swatchBtn, on && styles.swatchOn]}
              accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={a.label}>
              {/* The swatch is shown in its real colour, whatever theme is active. */}
              <View style={[styles.swatch, { backgroundColor: a.swatch }]} dataSet={{ keepColors: 'true' }}>
                {on ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
              </View>
              <Text style={[styles.swatchText, on && { color: COLORS.primary }]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[TYPE.small, { marginTop: SPACE.md }]}>{p.t('look.note')}</Text>
    </View>
  );
}

/** Palette icon that opens the appearance panel. `tone`: 'dark' bar or 'light' bar. */
export default function AppearancePicker({ tone = 'dark', size = 18 }) {
  const p = usePreferences();
  const [open, setOpen] = useState(false);
  const color = tone === 'dark' ? '#E2E8F0' : COLORS.gray600;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ hovered }) => [styles.trigger, hovered && { opacity: 0.8 }]}
        accessibilityRole="button" accessibilityLabel={p.t('look.title')}>
        <Ionicons name="color-palette-outline" size={size} color={color} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <View style={[styles.panel, SHADOW.lg]}>
            <View style={styles.head}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="color-palette" size={20} color={COLORS.primary} />
                <Text style={TYPE.h3}>{p.t('look.title')}</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close"><Ionicons name="close" size={22} color={COLORS.gray600} /></Pressable>
            </View>
            <AppearanceOptions />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { padding: 6, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.4)', alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  panel: { width: '100%', maxWidth: 420, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...TYPE.label, marginTop: SPACE.lg, marginBottom: 8 },
  modes: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white, minHeight: 64, justifyContent: 'center' },
  modeOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  modeText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray700, textAlign: 'center' },
  swatches: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  swatchBtn: { alignItems: 'center', gap: 6, padding: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'transparent', minWidth: 76 },
  swatchOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  swatchText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: COLORS.gray700 },
});
