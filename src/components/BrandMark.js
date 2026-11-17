import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORG } from '../config/org';

// Placeholder wordmark until the official NWSC logo asset is supplied.
// To use the real logo: add it to /assets and render an <Image> here instead.
export default function BrandMark({ size = 'large' }) {
  const small = size === 'small';
  return (
    <View style={styles.row}>
      <View style={[styles.drop, small && styles.dropSmall]}>
        <Ionicons name="water" size={small ? 16 : 24} color="#fff" />
      </View>
      {!small && (
        <View>
          <Text style={styles.short}>{ORG.shortName}</Text>
          <Text style={styles.area}>{ORG.area}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drop: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#38BDF8',
    alignItems: 'center', justifyContent: 'center',
  },
  dropSmall: { width: 28, height: 28, borderRadius: 14 },
  short: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  area: { color: '#BAE6FD', fontSize: 11, fontWeight: '600' },
});
