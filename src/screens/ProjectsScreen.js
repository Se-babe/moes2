import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';

const COLORS = {
  primary: '#1E3A8A',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  success: '#22C55E',
  warning: '#F59E0B',
  info: '#3B82F6',
};

const STATUS_META = {
  Upcoming: { color: COLORS.info, icon: 'time-outline' },
  Ongoing: { color: COLORS.warning, icon: 'sync-outline' },
  Completed: { color: COLORS.success, icon: 'checkmark-circle-outline' },
};
const STATUSES = ['All', 'Upcoming', 'Ongoing', 'Completed'];

export default function ProjectsScreen() {
  const navigation = useNavigation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('All');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = selectedStatus === 'All' ? projects : projects.filter((p) => p.status === selectedStatus);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading projects...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏗️ Projects</Text>
        <TouchableOpacity onPress={fetchProjects}>
          <Ionicons name="refresh-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScroll} contentContainerStyle={styles.statusContainer}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.statusChip, selectedStatus === s && styles.statusChipActive]}
            onPress={() => setSelectedStatus(s)}
          >
            <Text style={[styles.statusChipText, selectedStatus === s && styles.statusChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="construct-outline" size={60} color={COLORS.gray400} />
            <Text style={styles.emptyText}>No projects in this category</Text>
          </View>
        ) : (
          filtered.map((item) => {
            const meta = STATUS_META[item.status] || STATUS_META.Upcoming;
            return (
              <View key={item.id} style={styles.card}>
                <View style={[styles.statusBadge, { backgroundColor: meta.color }]}>
                  <Ionicons name={meta.icon} size={14} color="#fff" />
                  <Text style={styles.statusBadgeText}>{item.status}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
              </View>
            );
          })
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
  statusScroll: { flexGrow: 0, backgroundColor: '#fff' },
  statusContainer: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 8 },
  statusChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.gray100, marginRight: 8 },
  statusChipActive: { backgroundColor: COLORS.primary },
  statusChipText: { fontSize: 14, color: COLORS.gray700 },
  statusChipTextActive: { color: '#fff' },
  list: { flex: 1 },
  listContent: { padding: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4, marginBottom: 8 },
  statusBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginBottom: 6 },
  cardDesc: { fontSize: 14, color: COLORS.gray600 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: COLORS.gray500, marginTop: 12 },
});
