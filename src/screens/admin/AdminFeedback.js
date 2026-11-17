import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import { supabase } from '../../services/supabaseClient';
import { ADMIN_COLORS as COLORS } from './adminTheme';

const STATUSES = ['Submitted', 'Assigned', 'In Progress', 'Escalated', 'Resolved', 'Closed'];

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setFeedback(data || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id);
    if (error) showAlert('Error', error.message);
    else setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
  };

  const filtered = filter === 'All' ? feedback : feedback.filter((f) => f.status === filter);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.category}>{item.request_type} · {item.category || 'General'}</Text>
      </View>
      <Text style={styles.meta}>Ref {item.reference_no || '—'} · {new Date(item.created_at).toLocaleString()}</Text>
      {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
      {item.location_text ? <Text style={styles.meta}>📍 {item.location_text}</Text> : null}
      <Text style={styles.meta}>
        👤 {item.contact_name || 'Anonymous'}{item.contact_phone ? ` · ${item.contact_phone}` : ''}{item.contact_email ? ` · ${item.contact_email}` : ''}
      </Text>
      <View style={styles.statusRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.statusChip, item.status === s && styles.statusChipActive]}
            onPress={() => updateStatus(item.id, s)}
          >
            <Text style={[styles.statusChipText, item.status === s && styles.statusChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Enquiries & Complaints ({filtered.length})</Text>
      <View style={styles.filterRow}>
        {['All', ...STATUSES].map((s) => (
          <TouchableOpacity key={s} style={[styles.filterChip, filter === s && styles.filterChipActive]} onPress={() => setFilter(s)}>
            <Text style={[styles.filterChipText, filter === s && styles.filterChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {filtered.length === 0 ? (
        <Text style={styles.emptyText}>No feedback in this filter.</Text>
      ) : (
        <FlatList data={filtered} renderItem={renderItem} keyExtractor={(item) => item.id} scrollEnabled={false} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, paddingVertical: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, color: COLORS.textMuted },
  filterChipTextActive: { color: '#fff' },
  card: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  category: { fontSize: 11, color: COLORS.textMuted },
  desc: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  meta: { fontSize: 11, color: COLORS.textDim, marginTop: 6 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  statusChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusChipText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  statusChipTextActive: { color: '#fff' },
});
