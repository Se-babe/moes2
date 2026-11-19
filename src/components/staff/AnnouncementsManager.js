import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge, TextField, Select, EmptyState, Loading, useBreakpoint } from '../ui';
import DateTimeField from '../DateTimeField';
import { COLORS, FONT, RADIUS, SHADOW, SPACE, TYPE } from '../../theme';
import { showAlert } from '../../utils/alert';
import {
  ANNOUNCEMENT_CATEGORIES, STATUS_META, categoryMeta, fetchAreas, fetchStaffAnnouncements,
  saveAnnouncement, reviewAnnouncement, fmtDate,
} from '../../services/announcements';
import { supabase } from '../../services/supabaseClient';

// <input type="datetime-local"> works in local time without a timezone.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

const EMPTY = { title: '', body: '', category: 'Service notice', areas: [], publish_at: '', expires_at: '', notify_sms: false, notify_email: true };

function Editor({ initial, areas, user, onClose, onSaved }) {
  const isReviewer = user.role === 'supervisor' || user.role === 'admin';
  const [form, setForm] = useState({
    ...EMPTY,
    ...initial,
    publish_at: toLocalInput(initial?.publish_at),
    expires_at: toLocalInput(initial?.expires_at),
  });
  const [busy, setBusy] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleArea = (a) => setForm((f) => ({ ...f, areas: f.areas.includes(a) ? f.areas.filter((x) => x !== a) : [...f.areas, a] }));
  const scheduled = form.publish_at && new Date(form.publish_at) > new Date();

  const persist = async (status, then) => {
    if (form.title.trim().length < 3) return showAlert('Title needed', 'Give the announcement a clear title.');
    if (!form.body.trim()) return showAlert('Details needed', 'Write the announcement text.');
    if (form.expires_at && form.publish_at && new Date(form.expires_at) <= new Date(form.publish_at)) {
      return showAlert('Check the dates', 'The expiry time must be after the publish time.');
    }
    setBusy(status);
    try {
      const id = await saveAnnouncement({
        ...form,
        status,
        publish_at: fromLocalInput(form.publish_at),
        expires_at: fromLocalInput(form.expires_at),
      }, user.id);
      if (then) await then(id);
      onSaved();
      onClose();
    } catch (e) {
      showAlert('Could not save', e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View>
      <Text style={[TYPE.h3, { marginBottom: SPACE.lg }]}>{initial?.id ? 'Edit announcement' : 'New announcement'}</Text>
      {initial?.status === 'rejected' && initial.review_note ? (
        <View style={styles.reject}>
          <Ionicons name="chatbox-ellipses-outline" size={16} color={COLORS.danger} />
          <Text style={[TYPE.small, { color: '#991B1B', flex: 1 }]}>Reviewer: {initial.review_note}</Text>
        </View>
      ) : null}
      <TextField label="Title" required value={form.title} onChangeText={set('title')} maxLength={160} placeholder="e.g. Water interruption in Walukuba on Saturday" />
      <TextField label="Details" required multiline value={form.body} onChangeText={set('body')} maxLength={5000}
        placeholder="What is happening, when, which streets, and what customers should do." />
      <Select label="Type" value={form.category} options={ANNOUNCEMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.value }))} onChange={set('category')} />
      <Text style={[TYPE.label, { marginBottom: 8 }]}>Affected areas <Text style={TYPE.small}>(none selected = all areas)</Text></Text>
      <View style={styles.areas}>
        {areas.map((a) => {
          const on = form.areas.includes(a);
          return (
            <Pressable key={a} onPress={() => toggleArea(a)} style={[styles.area, on && styles.areaOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <Text style={[styles.areaText, on && { color: COLORS.primary }]}>{a}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.dates}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={[TYPE.label, { marginBottom: 6 }]}>Publish at <Text style={TYPE.small}>(empty = when approved)</Text></Text>
          <DateTimeField mode="datetime" value={form.publish_at} onChangeText={set('publish_at')} />
        </View>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={[TYPE.label, { marginBottom: 6 }]}>Remove after <Text style={TYPE.small}>(optional)</Text></Text>
          <DateTimeField mode="datetime" value={form.expires_at} onChangeText={set('expires_at')} />
        </View>
      </View>
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={TYPE.label}>Send SMS to subscribers</Text>
          <Text style={TYPE.small}>Uses SMS credit — best for emergencies and interruptions.</Text>
        </View>
        <Switch value={form.notify_sms} onValueChange={set('notify_sms')} />
      </View>
      <View style={styles.switchRow}>
        <Text style={[TYPE.label, { flex: 1 }]}>Send email to subscribers</Text>
        <Switch value={form.notify_email} onValueChange={set('notify_email')} />
      </View>

      <View style={styles.actions}>
        <Button title="Cancel" variant="ghost" onPress={onClose} />
        <Button title="Save draft" variant="secondary" loading={busy === 'draft'} onPress={() => persist('draft')} />
        {user.role === 'admin' ? (
          <Button
            title={scheduled ? 'Schedule' : 'Publish now'}
            icon={scheduled ? 'time-outline' : 'send'}
            loading={busy === 'pending'}
            onPress={() => persist('pending', (id) => reviewAnnouncement(id, 'approve'))}
          />
        ) : (
          <Button title="Submit for approval" icon="send" loading={busy === 'pending'} onPress={() => persist('pending')} />
        )}
      </View>
      {isReviewer && user.role !== 'admin' && (
        <Text style={[TYPE.small, { textAlign: 'right', marginTop: 6 }]}>Your own announcements are approved by another supervisor or an administrator.</Text>
      )}
    </View>
  );
}

export default function AnnouncementsManager({ user }) {
  const { isDesktop } = useBreakpoint();
  const isReviewer = user.role === 'supervisor' || user.role === 'admin';
  const filters = [
    ...(isReviewer ? [['review', 'Awaiting approval']] : []),
    ['mine', 'My announcements'], ['scheduled', 'Scheduled'], ['published', 'Published'], ['all', 'All'],
  ];
  const [filter, setFilter] = useState(filters[0][0]);
  const [items, setItems] = useState(null);
  const [areas, setAreas] = useState([]);
  const [editing, setEditing] = useState(null);
  const [subscribers, setSubscribers] = useState(null);

  const load = useCallback(() => {
    setItems(null);
    fetchStaffAnnouncements(filter, user.id).then(setItems).catch((e) => { setItems([]); showAlert('Could not load', e.message); });
  }, [filter, user.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchAreas().then(setAreas);
    if (user.role === 'admin') {
      supabase.from('alert_subscriptions').select('id', { count: 'exact', head: true }).eq('is_active', true)
        .then(({ count }) => setSubscribers(count ?? 0));
    }
  }, [user.role]);

  const review = (a, decision) => {
    if (decision === 'reject') {
      const note = typeof window !== 'undefined' && window.prompt ? window.prompt('What should the author change?') : 'Please revise.';
      if (!note) return;
      reviewAnnouncement(a.id, 'reject', note).then(load).catch((e) => showAlert('Could not reject', e.message));
      return;
    }
    const verb = decision === 'approve' ? (a.publish_at && new Date(a.publish_at) > new Date() ? 'Schedule' : 'Publish') : 'Archive';
    showAlert(`${verb} "${a.title}"?`, decision === 'approve' && (a.notify_sms || a.notify_email)
      ? 'Subscribers in the selected areas will be alerted when it goes live.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: verb, onPress: () => reviewAnnouncement(a.id, decision).then(load).catch((e) => showAlert('Could not update', e.message)) },
    ]);
  };

  const remove = (a) => showAlert(`Delete "${a.title}"?`, 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      const { error } = await supabase.from('announcements').delete().eq('id', a.id);
      if (error) showAlert('Could not delete', error.message); else load();
    } },
  ]);

  return (
    <View style={{ gap: SPACE.lg }}>
      <View style={[styles.toolbar, !isDesktop && { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={styles.filters}>
          {filters.map(([k, label]) => (
            <Pressable key={k} onPress={() => setFilter(k)} style={[styles.chip, filter === k && styles.chipActive]}>
              <Text style={[styles.chipText, filter === k && { color: '#fff' }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Button title="New announcement" icon="add" onPress={() => setEditing({})} />
      </View>
      {subscribers !== null && (
        <Text style={TYPE.small}><Ionicons name="people-outline" size={13} /> {subscribers} active alert subscriber{subscribers === 1 ? '' : 's'}</Text>
      )}

      {items === null ? <Loading /> : items.length === 0 ? (
        <Card><EmptyState icon="megaphone-outline" title="Nothing here" message={filter === 'review' ? 'No announcements are waiting for approval.' : 'Create an announcement to inform customers.'} /></Card>
      ) : items.map((a) => {
        const st = STATUS_META[a.status];
        const meta = categoryMeta(a.category);
        const canEdit = (a.author_id === user.id && ['draft', 'pending', 'rejected'].includes(a.status)) || isReviewer;
        const canReview = isReviewer && a.status === 'pending' && (a.author_id !== user.id || user.role === 'admin');
        return (
          <Card key={a.id} style={{ gap: 6 }}>
            <View style={styles.rowTop}>
              <View style={styles.badges}>
                <Badge label={st.label} tone={st.tone} />
                <Badge label={a.category} tone={meta.tone} icon={meta.icon} />
                {a.notify_sms && <Badge label="SMS" icon="chatbubble-outline" />}
                {a.notify_email && <Badge label="Email" icon="mail-outline" />}
              </View>
              <Text style={TYPE.small}>by {a.author_name || 'NWSC staff'}</Text>
            </View>
            <Text style={TYPE.h3}>{a.title}</Text>
            <Text style={TYPE.body} numberOfLines={2}>{a.body}</Text>
            <Text style={TYPE.small}>
              {a.areas?.length ? a.areas.join(', ') : 'All areas'}
              {a.status === 'scheduled' ? ` · Goes live ${fmtDate(a.publish_at)}` : ''}
              {a.status === 'published' ? ` · Published ${fmtDate(a.published_at)}` : ''}
              {a.notified_at ? ` · Alerts sent to ${a.notify_count}` : ''}
              {a.expires_at ? ` · Removed after ${fmtDate(a.expires_at)}` : ''}
            </Text>
            {a.status === 'rejected' && a.review_note ? <Text style={[TYPE.small, { color: COLORS.danger }]}>Reviewer: {a.review_note}</Text> : null}
            <View style={styles.actionsRow}>
              {canReview && <Button title={a.publish_at && new Date(a.publish_at) > new Date() ? 'Approve & schedule' : 'Approve & publish'} icon="checkmark" size="sm" onPress={() => review(a, 'approve')} />}
              {canReview && <Button title="Request changes" icon="arrow-undo-outline" size="sm" variant="secondary" onPress={() => review(a, 'reject')} />}
              {canEdit && <Button title="Edit" icon="create-outline" size="sm" variant="secondary" onPress={() => setEditing(a)} />}
              {isReviewer && ['published', 'scheduled'].includes(a.status) && <Button title="Archive" icon="archive-outline" size="sm" variant="ghost" onPress={() => review(a, 'archive')} />}
              {(user.role === 'admin' || (a.author_id === user.id && ['draft', 'rejected'].includes(a.status))) && (
                <Button title="Delete" icon="trash-outline" size="sm" variant="ghost" onPress={() => remove(a)} />
              )}
            </View>
          </Card>
        );
      })}

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayInner}>
            <View style={[styles.modal, SHADOW.lg]}>
              {editing && <Editor initial={editing.id ? editing : null} areas={areas} user={user} onClose={() => setEditing(null)} onSaved={load} />}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: SPACE.sm },
  reject: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.dangerSoft, marginBottom: SPACE.lg },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACE.lg },
  area: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200 },
  areaOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  areaText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray700 },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: SPACE.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: SPACE.lg },
  overlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.45)' },
  overlayInner: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  modal: { width: '100%', maxWidth: 640, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl },
});
