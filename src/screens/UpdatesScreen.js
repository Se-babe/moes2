import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';

const COLORS = {
  primary: '#1E3A8A',
  gray50: '#F8FAFC',
  gray200: '#E2E8F0',
  gray500: '#64748B',
  gray800: '#1E293B',
};

const CATEGORY_STYLE = {
  Announcement: { color: '#1E3A8A', bg: '#EEF2FF', icon: 'megaphone-outline' },
  Feature: { color: '#0F766E', bg: '#ECFDF5', icon: 'sparkles-outline' },
  Policy: { color: '#B45309', bg: '#FFFBEB', icon: 'document-text-outline' },
  Maintenance: { color: '#B91C1C', bg: '#FEF2F2', icon: 'construct-outline' },
};

const timeAgo = (dateStr) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return new Date(dateStr).toDateString();
};

export default function UpdatesScreen() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    setLoading(true);
    const { data } = await supabase.from('updates').select('*').order('created_at', { ascending: false });
    if (data) setUpdates(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading updates...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🕘 Platform Updates</Text>
      <Text style={styles.sub}>What's new from the Ministry and this platform.</Text>

      {updates.length === 0 ? (
        <Text style={styles.emptyText}>No updates posted yet.</Text>
      ) : (
        <View style={styles.timeline}>
          {updates.map((item, index) => {
            const style = CATEGORY_STYLE[item.category] || CATEGORY_STYLE.Announcement;
            return (
              <View key={item.id} style={styles.entry}>
                <View style={styles.dotColumn}>
                  <View style={[styles.dot, { backgroundColor: style.color }]} />
                  {index < updates.length - 1 && <View style={styles.line} />}
                </View>
                <View style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <View style={[styles.categoryBadge, { backgroundColor: style.bg }]}>
                      <Ionicons name={style.icon} size={12} color={style.color} />
                      <Text style={[styles.categoryText, { color: style.color }]}>{item.category || 'Announcement'}</Text>
                    </View>
                    <Text style={styles.entryDate}>{timeAgo(item.created_at)}</Text>
                  </View>
                  <Text style={styles.entryTitle}>{item.title}</Text>
                  {item.description ? <Text style={styles.entryDesc}>{item.description}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  content: { padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary },
  sub: { fontSize: 16, color: COLORS.gray500, marginTop: 10, marginBottom: 20 },
  emptyText: { color: COLORS.gray500, fontSize: 14, paddingVertical: 8 },
  timeline: { marginTop: 4 },
  entry: { flexDirection: 'row' },
  dotColumn: { width: 20, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 6 },
  line: { flex: 1, width: 2, backgroundColor: COLORS.gray200, marginTop: 2, marginBottom: -8 },
  entryCard: { flex: 1, paddingBottom: 24, paddingLeft: 12 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  categoryText: { fontSize: 11, fontWeight: '700' },
  entryDate: { fontSize: 12, color: COLORS.gray500 },
  entryTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800 },
  entryDesc: { fontSize: 14, color: COLORS.gray500, marginTop: 4 },
});
