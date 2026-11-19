import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_COLORS as COLORS } from './adminTheme';

const TYPE_ICON = {
  info: 'information-circle-outline',
  chat: 'chatbubbles-outline',
  consultation: 'document-text-outline',
  opportunity: 'briefcase-outline',
};

export default function AdminNotifications() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (item) => {
    if (!item.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', item.id);
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    }
    if (item.target_screen) {
      navigation.navigate(item.target_screen);
    }
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const timeAgo = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={[styles.card, !item.read && styles.cardUnread]} onPress={() => markAsRead(item)}>
      {!item.read && <View style={styles.unreadDot} />}
      <Ionicons name={TYPE_ICON[item.type] || 'notifications-outline'} size={22} color={COLORS.primary} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Notifications {unreadCount > 0 ? `(${unreadCount} unread)` : ''}</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      {notifications.length === 0 ? (
        <Text style={styles.emptyText}>No notifications yet.</Text>
      ) : (
        <FlatList data={notifications} renderItem={renderItem} keyExtractor={(item) => item.id} scrollEnabled={false} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  markAllText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, paddingVertical: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardUnread: { backgroundColor: COLORS.infoSoft, borderColor: 'rgba(96,165,250,0.35)' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.info, position: 'absolute', top: 14, right: 14 },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  message: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  time: { fontSize: 11, color: COLORS.textDim, marginTop: 4 },
});
