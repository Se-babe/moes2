import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { ADMIN_COLORS as COLORS } from './adminTheme';

export default function AdminOverview({ onNavigateTab }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const count = async (table, filters = {}) => {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    Object.entries(filters).forEach(([k, v]) => { q = q.eq(k, v); });
    const { count: c } = await q;
    return c || 0;
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [pendingConsultations, newFeedback, newApplications, unreadNotifications, forumTopics] = await Promise.all([
        count('consultations', { is_active: false }),
        count('feedback', { status: 'Submitted' }),
        count('opportunity_applications', { status: 'New' }),
        count('notifications', { read: false }),
        count('forum_topics'),
      ]);
      setStats({ pendingConsultations, newFeedback, newApplications, unreadNotifications, forumTopics });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const cards = [
    { key: 'notifications', label: 'Unread Notifications', value: stats.unreadNotifications, icon: 'notifications-outline', color: COLORS.info },
    { key: 'consultations', label: 'Pending Proposals', value: stats.pendingConsultations, icon: 'document-text-outline', color: COLORS.warning },
    { key: 'feedback', label: 'New Feedback', value: stats.newFeedback, icon: 'chatbox-outline', color: COLORS.danger },
    { key: 'opportunities', label: 'New Applications', value: stats.newApplications, icon: 'briefcase-outline', color: COLORS.success },
    { key: 'forum', label: 'Discussion Topics', value: stats.forumTopics, icon: 'chatbubbles-outline', color: COLORS.primary },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>At a Glance</Text>
      <View style={styles.grid}>
        {cards.map((c) => (
          <TouchableOpacity key={c.key} style={styles.card} onPress={() => onNavigateTab?.(c.key)} activeOpacity={0.7}>
            <Ionicons name={c.icon} size={22} color={c.color} />
            <Text style={styles.cardValue}>{c.value}</Text>
            <Text style={styles.cardLabel}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '31%',
    minWidth: 140,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardValue: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  cardLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});
