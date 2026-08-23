import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Native fallback: this app is currently deployed as a web build only (see
// LocationMap.web.js for the real embedded map used there). Opens the
// device's own maps app instead of embedding an iframe.
export default function LocationMap({ address }) {
  const openMaps = () => {
    Linking.openURL(`https://www.google.com/maps?q=${encodeURIComponent(address)}`);
  };
  return (
    <TouchableOpacity style={styles.btn} onPress={openMaps}>
      <Ionicons name="map-outline" size={18} color="#1E3A8A" />
      <Text style={styles.text}>View on Google Maps</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 14,
  },
  text: { color: '#1E3A8A', fontWeight: '600', fontSize: 14 },
});
