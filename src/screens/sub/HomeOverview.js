import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const COLORS = { primary: '#1E3A8A', gray500: '#64748B' };

export default function HomeOverview() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Overview</Text>
      <Text style={styles.sub}>Welcome to the Home overview.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  sub: { fontSize: 16, color: COLORS.gray500, marginTop: 8 },
});