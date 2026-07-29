import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function HomeConsultations() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>📄 Consultations</Text>
      <Text style={styles.sub}>Browse all active consultations here.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A8A' },
  sub: { fontSize: 16, color: '#64748B', marginTop: 8 },
});