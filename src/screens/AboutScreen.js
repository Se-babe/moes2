import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Linking } from 'react-native';
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';

const COLORS = {
  primary: '#0B5FA5',
  gray50: '#F8FAFC',
  gray200: '#E2E8F0',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  accent: '#FCD34D',
};

export default function AboutScreen() {
  const navigation = useNavigation();
  const [leadership, setLeadership] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: lead }, { data: dept }] = await Promise.all([
        supabase.from('leadership').select('*').order('display_order', { ascending: true }),
        supabase.from('departments').select('*').order('display_order', { ascending: true }),
      ]);
      setLeadership(lead || []);
      setDepartments(dept || []);
    } catch (error) {
      console.error('Error fetching about content:', error);
    } finally {
      setLoading(false);
    }
  };

  const openLink = (url) => {
    if (url && url !== '#') {
      Linking.openURL(url).catch(() => showAlert('Error', 'Could not open the link.'));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏛️ About NWSC</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {leadership.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leadership</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {leadership.map((p) => (
                <View key={p.id} style={styles.leaderCard}>
                  {p.photo_url ? (
                    <Image source={{ uri: p.photo_url }} style={styles.leaderPhoto} />
                  ) : (
                    <View style={[styles.leaderPhoto, styles.leaderPhotoPlaceholder]}>
                      <Ionicons name="person" size={32} color={COLORS.gray500} />
                    </View>
                  )}
                  <Text style={styles.leaderName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.leaderTitle} numberOfLines={2}>{p.title}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {departments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Departments</Text>
            {departments.map((d) => (
              <View key={d.id} style={styles.rowCard}>
                <View style={styles.rowIcon}>
                  <Ionicons name={d.icon || 'business-outline'} size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{d.name}</Text>
                  {d.description ? <Text style={styles.rowDesc}>{d.description}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}


        {leadership.length === 0 && departments.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="information-circle-outline" size={60} color={COLORS.gray500} />
            <Text style={styles.emptyText}>About content hasn't been added yet.</Text>
          </View>
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
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.gray800, marginBottom: 12 },
  leaderCard: { width: 130, marginRight: 12, alignItems: 'center' },
  leaderPhoto: { width: 90, height: 90, borderRadius: 45, marginBottom: 8, backgroundColor: COLORS.gray200 },
  leaderPhotoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  leaderName: { fontSize: 13, fontWeight: '700', color: COLORS.gray800, textAlign: 'center' },
  leaderTitle: { fontSize: 11, color: COLORS.gray500, textAlign: 'center', marginTop: 2 },
  rowCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12,
    padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gray50, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: COLORS.gray800 },
  rowDesc: { fontSize: 13, color: COLORS.gray600, marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: COLORS.gray500, marginTop: 12 },
});
