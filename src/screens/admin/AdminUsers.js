import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { ADMIN_COLORS as COLORS } from './adminTheme';

const ROLES = ['citizen', 'student', 'teacher', 'parent', 'innovator', 'health_worker', 'admin'];

export default function AdminUsers({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeRole = (targetUser, role) => {
    const applyChange = async () => {
      const { error } = await supabase.from('users').update({ role }).eq('id', targetUser.id);
      if (error) showAlert('Error', error.message);
      else setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role } : u)));
    };

    if (targetUser.id === currentUserId && role !== 'admin') {
      showAlert(
        'Remove your own admin access?',
        "You're changing your own role away from admin — you'll lose access to this panel immediately.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: applyChange },
        ]
      );
      return;
    }
    applyChange();
  };

  const filtered = users.filter(
    (u) =>
      (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }) => {
    const isExpanded = expandedId === item.id;
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => setExpandedId(isExpanded ? null : item.id)}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{item.full_name || 'Unnamed'}</Text>
              {item.id === currentUserId && <Text style={styles.youTag}>(you)</Text>}
            </View>
            <Text style={styles.email}>{item.email}</Text>
            <Text style={styles.meta}>{item.phone || 'No phone on file'}</Text>
          </View>
          <View style={[styles.roleBadge, item.role === 'admin' && styles.roleBadgeAdmin]}>
            <Text style={[styles.roleBadgeText, item.role === 'admin' && styles.roleBadgeTextAdmin]}>{item.role || 'citizen'}</Text>
          </View>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.roleRow}>
            <Text style={styles.roleRowLabel}>Set role:</Text>
            <View style={styles.chipWrap}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, item.role === r && styles.chipActive, r === 'admin' && styles.chipAdmin]}
                  onPress={() => changeRole(item, r)}
                >
                  <Text style={[styles.chipText, item.role === r && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Users ({filtered.length})</Text>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={COLORS.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          placeholderTextColor={COLORS.textDim}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {filtered.length === 0 ? (
        <Text style={styles.emptyText}>No users found.</Text>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  youTag: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  email: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  meta: { fontSize: 12, color: COLORS.textDim, marginTop: 2 },
  roleBadge: { backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleBadgeAdmin: { backgroundColor: COLORS.infoSoft },
  roleBadgeText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  roleBadgeTextAdmin: { color: COLORS.info },
  roleRow: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: 12 },
  roleRowLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8, fontWeight: '600' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipAdmin: { borderWidth: 1, borderColor: COLORS.danger },
  chipText: { fontSize: 12, color: COLORS.textMuted },
  chipTextActive: { color: '#fff' },
});
