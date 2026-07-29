import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient';

// Only import the map on mobile (native)
let MapView, Heatmap, PROVIDER_GOOGLE;
if (Platform.OS !== 'web') {
  // We use dynamic imports to avoid web errors
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Heatmap = Maps.Heatmap;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

export default function HeatMapScreen() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHeatmapData();
  }, []);

  const fetchHeatmapData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('feedback')
      .select('latitude, longitude, category')
      .not('latitude', 'is', null);

    if (data && data.length > 0) {
      const heatmapData = data.map(item => ({
        latitude: item.latitude,
        longitude: item.longitude,
        weight: 1,
      }));
      setPoints(heatmapData);
    } else {
      // Mock data for demonstration
      const mockData = [
        { latitude: 1.3733, longitude: 32.2903, weight: 10 },
        { latitude: 0.3136, longitude: 32.5811, weight: 5 },
        { latitude: 0.5167, longitude: 33.2667, weight: 8 },
        { latitude: 0.3366, longitude: 32.5758, weight: 3 },
        { latitude: 0.6536, longitude: 33.5021, weight: 6 },
      ];
      setPoints(mockData);
    }
    setLoading(false);
  };

  // Web fallback – show a simple info card
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <Text style={styles.webTitle}>📍 Heatmap View</Text>
        <Text style={styles.webSub}>
          This feature shows incident density on a map. Open this app on your mobile device to see the interactive heatmap.
        </Text>
        <View style={styles.webMock}>
          <Text style={styles.webMockText}>🔥 {points.length} incidents reported</Text>
          <Text style={styles.webMockSub}>(Mock map – install Expo Go on your phone to view live)</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Loading heatmap data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: 1.3733,
          longitude: 32.2903,
          latitudeDelta: 2.0,
          longitudeDelta: 2.0,
        }}
      >
        <Heatmap
          points={points}
          radius={30}
          opacity={0.7}
          gradient={{
            colors: ['#00ff00', '#ffff00', '#ff0000'],
            start: { x: 0.1, y: 0.1 },
            end: { x: 0.9, y: 0.9 },
          }}
        />
      </MapView>
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>🔥 {points.length} incidents reported</Text>
        <Text style={styles.overlaySub}>Red = High density, Green = Low density</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#64748B' },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30, 58, 138, 0.9)',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  overlayText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  overlaySub: { color: '#CBD5E1', fontSize: 12, marginTop: 2 },
  // Web styles
  webContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F8FAFC',
  },
  webTitle: { fontSize: 28, fontWeight: 'bold', color: '#1E3A8A', marginBottom: 10 },
  webSub: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 30 },
  webMock: {
    backgroundColor: '#EFF6FF',
    padding: 30,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    width: '100%',
  },
  webMockText: { fontSize: 20, fontWeight: 'bold', color: '#1E3A8A' },
  webMockSub: { fontSize: 14, color: '#94A3B8', marginTop: 8 },
});