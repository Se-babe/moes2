import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ORG } from '../config/org';
import { COLORS, FONT, gradient } from '../theme';

// Placeholder wordmark until the official NWSC logo asset is supplied.
// To use the real logo: add it to /assets and render an <Image> here instead.
export default function BrandMark({ size = 'large', tone = 'dark' }) {
  const small = size === 'small';
  const onDark = tone === 'light';
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel={`${ORG.name} — ${ORG.area}`}>
      <View style={[styles.drop, small && styles.dropSmall, gradient(COLORS.accent, COLORS.primaryLight)]}>
        <Ionicons name="water" size={small ? 18 : 22} color="#fff" />
      </View>
      <View>
        <Text style={[styles.short, small && { fontSize: 16 }, { color: onDark ? '#fff' : COLORS.primaryDark }]}>
          {ORG.shortName}
        </Text>
        <Text style={[styles.area, { color: onDark ? '#BAE6FD' : COLORS.gray500 }]}>
          {small ? ORG.area : `${ORG.area} · e-Participation`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  drop: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  dropSmall: { width: 36, height: 36, borderRadius: 10 },
  short: { fontFamily: FONT, fontSize: 19, fontWeight: '800', letterSpacing: 0.5, lineHeight: 22 },
  area: { fontFamily: FONT, fontSize: 11.5, fontWeight: '600', lineHeight: 15 },
});
