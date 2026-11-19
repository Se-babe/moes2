import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Switch } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePreferences } from '../context/PreferencesContext';
import { LANGUAGES } from '../i18n';
import { COLORS, FONT, RADIUS, SHADOW, SPACE, TYPE } from '../theme';

export function Segment({ options, value, onChange, label }) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.segBtn, on && styles.segOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
            <Text style={[styles.segText, on && { color: COLORS.primary }, o.style]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Display" button + panel: language, text size, contrast, lite mode. */
export default function DisplaySettings({ tone = 'dark' }) {
  const p = usePreferences();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === p.language)?.label || 'English';

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.trigger} accessibilityRole="button" accessibilityLabel={`${p.t('a11y.title')}: ${current}`}>
        <Ionicons name="text" size={14} color={tone === 'dark' ? '#E2E8F0' : COLORS.primary} />
        <Text style={[styles.triggerText, tone !== 'dark' && { color: COLORS.primary }]}>{current}</Text>
        <Ionicons name="chevron-down" size={12} color={tone === 'dark' ? '#94A3B8' : COLORS.primary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <View style={[styles.panel, SHADOW.lg]}>
            <View style={styles.head}>
              <Text style={TYPE.h3}>{p.t('a11y.title')}</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close"><Ionicons name="close" size={22} color={COLORS.gray600} /></Pressable>
            </View>
            <Text style={styles.label}>{p.t('a11y.language')}</Text>
            <Segment label={p.t('a11y.language')} value={p.language} onChange={(v) => p.update({ language: v })}
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
            <Text style={styles.label}>{p.t('a11y.textSize')}</Text>
            <Segment label={p.t('a11y.textSize')} value={p.textScale} onChange={(v) => p.update({ textScale: v })}
              options={[
                { value: 1, label: 'A', style: { fontSize: 14 } },
                { value: 1.15, label: 'A', style: { fontSize: 18 } },
                { value: 1.3, label: 'A', style: { fontSize: 22 } },
              ]} />
            <View style={styles.switchRow}>
              <Text style={[TYPE.label, { flex: 1 }]}>{p.t('a11y.contrast')}</Text>
              <Switch value={p.highContrast} onValueChange={(v) => p.update({ highContrast: v })} accessibilityLabel={p.t('a11y.contrast')} />
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={TYPE.label}>{p.t('a11y.lite')}</Text>
                <Text style={TYPE.small}>{p.t('a11y.liteHint')}</Text>
              </View>
              <Switch value={p.lite} onValueChange={(v) => p.update({ lite: v })} accessibilityLabel={p.t('a11y.lite')} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 2 },
  triggerText: { fontFamily: FONT, color: '#E2E8F0', fontSize: 12.5, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.4)', alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  panel: { width: '100%', maxWidth: 420, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.sm },
  label: { ...TYPE.label, marginTop: SPACE.lg, marginBottom: 8 },
  segment: { flexDirection: 'row', backgroundColor: COLORS.gray100, borderRadius: RADIUS.md, padding: 4, gap: 4 },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: RADIUS.sm, minHeight: 40 },
  segOn: { backgroundColor: COLORS.white, boxShadow: '0 1px 2px rgba(15,23,42,0.15)' },
  segText: { fontFamily: FONT, fontSize: 14, fontWeight: '700', color: COLORS.gray600 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: SPACE.lg },
});
