import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';

const COLORS = {
  primary: '#1E3A8A',
  gray50: '#F8FAFC',
  gray200: '#E2E8F0',
  gray500: '#64748B',
  gray600: '#475569',
  gray800: '#1E293B',
};

export default function InfoSystemsScreen() {
  const navigation = useNavigation();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystems();
  }, []);

  const fetchSystems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('info_systems').select('*').order('display_order', { ascending: true });
      if (error) throw error;
      setSystems(data || []);
    } catch (error) {
      console.error('Error fetching info systems:', error);
    } finally {
      setLoading(false);
    }
  };

  const openSystem = (url) => {
    if (url && url !== '#') {
      Linking.openURL(url).catch(() => showAlert('Error', 'Could not open this system.'));
    } else {
      showAlert('Coming Soon', 'This system link has not been published yet.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading information systems...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🖥️ Information Systems</Text>
        <TouchableOpacity onPress={fetchSystems}>
          <Ionicons name="refresh-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Official MoES digital platforms and portals.</Text>
        {systems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="server-outline" size={60} color={COLORS.gray500} />
            <Text style={styles.emptyText}>No systems listed yet</Text>
          </View>
        ) : (
          systems.map((s) => (
            <TouchableOpacity key={s.id} style={styles.card} onPress={() => openSystem(s.url)}>
              <View style={styles.iconWrap}>
                <Ionicons name={s.icon || 'apps-outline'} size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{s.name}</Text>
                {s.description ? <Text style={styles.cardDesc}>{s.description}</Text> : null}
              </View>
              <Ionicons name="open-outline" size={20} color={COLORS.gray500} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: COLORS.gray200,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.gray800 },
  content: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 14, color: COLORS.gray600, marginBottom: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12,
    padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.gray50, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.gray800 },
  cardDesc: { fontSize: 13, color: COLORS.gray600, marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: COLORS.gray500, marginTop: 12 },
});
