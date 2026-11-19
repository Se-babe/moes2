import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT } from '../theme';

// Single-series horizontal bars: a label, a proportional bar and the value as
// text, so every figure is readable without relying on the bar alone.
export const SERIES = ['#2a78d6', '#eb6834']; // validated categorical pair (light surface)

export default function BarList({ rows, color = SERIES[0], format = (v) => String(v), max }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: 10 }} accessibilityRole="list">
      {rows.map((r) => (
        <View key={r.label} style={styles.row} accessibilityLabel={`${r.label}: ${format(r.value)}${r.note ? `, ${r.note}` : ''}`}>
          <Text style={styles.label} numberOfLines={1}>{r.label}</Text>
          <View style={styles.track}>
            {r.value > 0 ? <View style={[styles.bar, { width: `${(r.value / top) * 100}%`, backgroundColor: color }]} /> : null}
          </View>
          <Text style={styles.value}>{format(r.value)}{r.note ? <Text style={styles.note}> {r.note}</Text> : null}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: FONT, width: 150, fontSize: 13, color: COLORS.gray700 },
  track: { flex: 1, height: 12, justifyContent: 'center' },
  bar: { height: 10, minWidth: 2, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  value: { fontFamily: FONT, minWidth: 64, textAlign: 'right', fontSize: 13, fontWeight: '700', color: COLORS.gray900 },
  note: { fontWeight: '500', color: COLORS.gray500 },
});
