import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function HomeDashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 Dashboard</Text>
      <Text style={styles.sub}>Track your participation activity.</Text>

      {/* Floating Chart Button (just a demo) */}
      <TouchableOpacity style={styles.floatingBtn} onPress={() => alert('Chart View')}>
        <Ionicons name="analytics-outline" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A8A' },
  sub: { fontSize: 16, color: '#64748B', marginTop: 8 },
  floatingBtn: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#1E3A8A',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});