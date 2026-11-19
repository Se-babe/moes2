import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONT, RADIUS, SHADOW, TYPE } from '../../theme';
import { EmptyState } from '../ui';
import { fetchMyNotifications, markNotificationsRead, fmtDateTime } from '../../services/staff';

const TYPE_ICON = { assignment: 'person-add-outline', escalation: 'alert-circle-outline', reminder: 'alarm-outline' };

/** Bell with unread count; opens a panel. Tapping an item opens its request. */
export default function NotificationBell({ onOpenRequest, tone = 'light' }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    fetchMyNotifications().then(setItems).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // poll every minute
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((n) => !n.read);

  const openPanel = () => {
    setOpen(true);
    if (unread.length) {
      markNotificationsRead(unread.map((n) => n.id));
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  return (
    <>
      <Pressable onPress={openPanel} style={[styles.bell, tone === 'light' && styles.bellLight]} accessibilityLabel={`Notifications, ${unread.length} unread`}>
        <Ionicons name="notifications-outline" size={20} color={tone === 'light' ? '#fff' : COLORS.gray700} />
        {unread.length > 0 && (
          <View style={styles.dot}><Text style={styles.dotText}>{unread.length > 9 ? '9+' : unread.length}</Text></View>
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.panel, SHADOW.lg]}>
            <View style={styles.head}>
              <Text style={TYPE.h3}>Notifications</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close"><Ionicons name="close" size={22} color={COLORS.gray600} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              {items.length === 0 ? (
                <EmptyState icon="notifications-off-outline" title="You're all caught up" />
              ) : items.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => { setOpen(false); if (n.target_id && n.target_screen === 'StaffRequest') onOpenRequest(n.target_id); }}
                  style={({ hovered }) => [styles.item, hovered && { backgroundColor: COLORS.gray50 }]}
                >
                  <View style={[styles.icon, n.type === 'escalation' && { backgroundColor: COLORS.dangerSoft }]}>
                    <Ionicons name={TYPE_ICON[n.type] || 'notifications-outline'} size={18} color={n.type === 'escalation' ? COLORS.danger : COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{n.title}</Text>
                    {n.message ? <Text style={TYPE.small} numberOfLines={2}>{n.message}</Text> : null}
                    <Text style={[TYPE.small, { fontSize: 12 }]}>{fmtDateTime(n.created_at)}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bell: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gray100 },
  bellLight: { backgroundColor: 'rgba(255,255,255,0.12)' },
  dot: {
    position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center',
  },
  dotText: { fontFamily: FONT, color: '#fff', fontSize: 10.5, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.35)', alignItems: 'flex-end', paddingTop: 80, paddingHorizontal: 16 },
  panel: { width: '100%', maxWidth: 400, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: 'hidden' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  item: { flexDirection: 'row', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT, fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
});
