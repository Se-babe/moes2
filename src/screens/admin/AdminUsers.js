import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView, Switch } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase, passwordSetupUrl } from '../../services/supabaseClient';
import { Card, Button, Badge, Select, TextField, EmptyState, Loading, Avatar, useBreakpoint } from '../../components/ui';
import { pickAvatar, uploadAvatar, removeOldAvatars } from '../../services/profile';
import { COLORS, FONT, RADIUS, SHADOW, SPACE, TYPE } from '../../theme';
import { showAlert } from '../../utils/alert';
import { fetchDepartments, WORKFORCE_ROLES as STAFF_ROLES } from '../../services/staff';

const ROLE_OPTIONS = [
  { value: 'citizen', label: 'Citizen', hint: 'Public user' },
  { value: 'business', label: 'Business / institution', hint: 'Public user' },
  { value: 'community_leader', label: 'Community leader', hint: 'Public user' },
  { value: 'officer', label: 'Officer', hint: 'Handles requests in their department' },
  { value: 'supervisor', label: 'Supervisor', hint: 'Oversees a department, receives escalations' },
  { value: 'hr', label: 'Human Resources', hint: 'Manages staff accounts, departments and team performance' },
  { value: 'admin', label: 'Administrator', hint: 'Full control of the system' },
];
const ROLE_TONE = { admin: 'danger', supervisor: 'warning', officer: 'brand', hr: 'info' };
// HR can do everything an administrator can except manage administrator
// accounts: it can't edit an administrator or give anyone that role.
const roleOptionsFor = (mode) => ROLE_OPTIONS.filter((r) => mode !== 'hr' || r.value !== 'admin');
const FILTERS = [['staff', 'Staff'], ['citizens', 'Public users'], ['inactive', 'Deactivated'], ['all', 'Everyone']];
const deptOptional = (role) => role === 'admin' || role === 'hr';

function UserEditor({ target, departments, currentUserId, mode, onClose, onSaved }) {
  const [form, setForm] = useState({
    role: target.role || 'citizen',
    department_id: target.department_id || null,
    job_title: target.job_title || '',
    is_active: target.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(target.avatar_url || null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const isSelf = target.id === currentUserId;

  // Administrators can set or remove anyone's profile picture (e.g. an
  // unsuitable photo, or a staff ID photo supplied by HR).
  const setPhoto = async (remove) => {
    try {
      let url = null;
      if (!remove) {
        const asset = await pickAvatar();
        if (!asset) return;
        setPhotoBusy(true);
        url = await uploadAvatar(target.id, asset);
      } else {
        setPhotoBusy(true);
      }
      const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', target.id);
      if (error) throw error;
      if (remove) await removeOldAvatars(target.id);
      setAvatarUrl(url);
      onSaved();
    } catch (e) {
      showAlert('Photo not saved', e.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  // For staff whose invitation expired or who forgot their password.
  const sendSetupLink = async () => {
    setSendingLink(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target.email, { redirectTo: passwordSetupUrl() });
    setSendingLink(false);
    if (error) showAlert('Could not send link', error.message);
    else showAlert('Link sent', `${target.email} will receive an email with a link to set a new password.`);
  };
  const isStaff = STAFF_ROLES.includes(form.role);

  const save = async () => {
    if (isSelf && (form.role !== target.role || !form.is_active)) {
      showAlert('Not allowed', 'You cannot change your own role or deactivate your own account. Ask another administrator.');
      return;
    }
    if (['officer', 'supervisor'].includes(form.role) && !form.department_id) {
      showAlert('Department required', 'Officers and supervisors must belong to a department so requests can be routed to them.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({
        role: form.role,
        department_id: isStaff ? form.department_id : null,
        job_title: isStaff ? form.job_title.trim() || null : null,
        is_active: form.is_active,
      })
      .eq('id', target.id);
    setSaving(false);
    if (error) showAlert('Could not save', error.message);
    else { onSaved(); onClose(); }
  };

  return (
    <View>
      <View style={styles.editorHead}>
        <Avatar name={target.full_name || target.email} url={avatarUrl} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={TYPE.h3}>{target.full_name || 'Unnamed user'}</Text>
          <Text style={TYPE.small}>{target.email}{target.phone ? ` · ${target.phone}` : ''}</Text>
          {STAFF_ROLES.includes(target.role) && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <Button title={avatarUrl ? 'Change photo' : 'Add photo'} icon="camera-outline" size="sm" variant="secondary" loading={photoBusy} onPress={() => setPhoto(false)} />
              {avatarUrl && !photoBusy && <Button title="Remove photo" icon="trash-outline" size="sm" variant="ghost" onPress={() => setPhoto(true)} />}
            </View>
          )}
        </View>
      </View>
      <Select label="Role" value={form.role} options={roleOptionsFor(mode)} onChange={(v) => setForm((f) => ({ ...f, role: v }))} />
      {isStaff && (
        <>
          <Select
            label={deptOptional(form.role) ? 'Department (optional)' : 'Department'}
            value={form.department_id}
            options={[{ value: null, label: 'No department' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
            onChange={(v) => setForm((f) => ({ ...f, department_id: v }))}
          />
          <TextField label="Job title" value={form.job_title} onChangeText={(v) => setForm((f) => ({ ...f, job_title: v }))} placeholder="e.g. Customer Care Officer" maxLength={80} />
        </>
      )}
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={TYPE.label}>Account active</Text>
          <Text style={TYPE.small}>Deactivated staff can't sign in to the staff portal or receive new requests.</Text>
        </View>
        <Switch value={form.is_active} onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))} disabled={isSelf} />
      </View>
      {target.email ? (
        <Button
          title="Send password setup link"
          icon="key-outline"
          variant="secondary"
          size="sm"
          loading={sendingLink}
          onPress={sendSetupLink}
          style={{ marginTop: SPACE.sm }}
        />
      ) : null}
      <View style={styles.modalActions}>
        <Button title="Cancel" variant="ghost" onPress={onClose} />
        <Button title="Save changes" icon="checkmark" loading={saving} onPress={save} />
      </View>
    </View>
  );
}

function InviteForm({ departments, mode, onClose, onSaved }) {
  const [form, setForm] = useState({ email: '', full_name: '', role: 'officer', department_id: null, job_title: '' });
  const [saving, setSaving] = useState(false);

  const invite = async () => {
    setSaving(true);
    const redirect_to = passwordSetupUrl();
    const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'invite', ...form, redirect_to } });
    setSaving(false);
    let message = data?.error;
    if (error) message = (await error.context?.json?.().then((b) => b?.error).catch(() => null)) || error.message;
    if (message) {
      showAlert('Could not add staff member', message);
      return;
    }
    showAlert(
      data.invited ? 'Invitation sent' : 'Staff access granted',
      data.invited
        ? `${form.email} will receive an email to set a password and sign in.`
        : `${form.email} already had an account and now has ${form.role} access.`,
    );
    onSaved();
    onClose();
  };

  return (
    <View>
      <Text style={TYPE.h3}>Add a staff member</Text>
      <Text style={[TYPE.small, { marginBottom: SPACE.lg }]}>
        They'll get an email invitation to set their password. If they already have an account, it's upgraded to staff.
      </Text>
      <TextField label="Work email" required value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="name@nwsc.co.ug" />
      <TextField label="Full name" value={form.full_name} onChangeText={(v) => setForm((f) => ({ ...f, full_name: v }))} placeholder="e.g. Grace Namutebi" />
      <Select label="Role" value={form.role} options={roleOptionsFor(mode).filter((r) => STAFF_ROLES.includes(r.value))} onChange={(v) => setForm((f) => ({ ...f, role: v }))} />
      <Select
        label={deptOptional(form.role) ? 'Department (optional)' : 'Department'}
        value={form.department_id}
        options={[{ value: null, label: 'Choose a department' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
        onChange={(v) => setForm((f) => ({ ...f, department_id: v }))}
      />
      <TextField label="Job title" value={form.job_title} onChangeText={(v) => setForm((f) => ({ ...f, job_title: v }))} placeholder="e.g. Customer Care Officer" />
      <View style={styles.modalActions}>
        <Button title="Cancel" variant="ghost" onPress={onClose} />
        <Button title="Send invitation" icon="send" loading={saving} onPress={invite} />
      </View>
    </View>
  );
}

export default function AdminUsers({ currentUserId, mode = 'admin' }) {
  const { isDesktop } = useBreakpoint();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('staff');
  const [editing, setEditing] = useState(null);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone, role, department_id, job_title, is_active, avatar_url, created_at')
      .order('created_at', { ascending: false });
    if (error) showAlert('Could not load users', error.message);
    setUsers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetchDepartments().then(setDepartments).catch(() => {});
  }, [load]);

  const deptName = useMemo(() => Object.fromEntries(departments.map((d) => [d.id, d.name])), [departments]);

  const open = (u) => {
    if (mode === 'hr' && u.role === 'admin') {
      showAlert('Managed by administrators', 'Administrator accounts can only be changed by another administrator.');
      return;
    }
    setEditing(u);
  };
  const shown = users.filter((u) => {
    const staff = STAFF_ROLES.includes(u.role);
    if (filter === 'staff' && (!staff || u.is_active === false)) return false;
    if (filter === 'citizens' && staff) return false;
    if (filter === 'inactive' && u.is_active !== false) return false;
    const q = search.trim().toLowerCase();
    return !q || [u.full_name, u.email, u.phone].some((v) => (v || '').toLowerCase().includes(q));
  });

  if (loading) return <Loading label="Loading users…" />;

  return (
    <View style={{ gap: SPACE.lg }}>
      <View style={[styles.toolbar, !isDesktop && { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={COLORS.gray400} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search name, email or phone" placeholderTextColor={COLORS.gray400} />
        </View>
        <Button title="Add staff member" icon="person-add-outline" onPress={() => setInviting(true)} />
      </View>
      <View style={styles.filters}>
        {FILTERS.map(([k, label]) => (
          <Pressable key={k} onPress={() => setFilter(k)} style={[styles.chip, filter === k && styles.chipActive]}>
            <Text style={[styles.chipText, filter === k && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Card padded={false}>
        {shown.length === 0 ? (
          <EmptyState icon="people-outline" title="No users found" message={filter === 'staff' ? 'Add your first staff member to start routing requests to them.' : 'Try another filter.'} />
        ) : shown.map((u, i) => (
          <Pressable
            key={u.id}
            onPress={() => open(u)}
            style={({ hovered }) => [styles.row, i > 0 && styles.rowBorder, hovered && { backgroundColor: COLORS.gray50 }, u.is_active === false && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${u.full_name || u.email}`}
          >
            <Avatar name={u.full_name || u.email} url={u.avatar_url} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={TYPE.label}>
                {u.full_name || 'Unnamed'}{u.id === currentUserId ? <Text style={TYPE.small}>  (you)</Text> : null}
              </Text>
              <Text style={TYPE.small} numberOfLines={1}>{u.email}{u.phone && isDesktop ? ` · ${u.phone}` : ''}</Text>
            </View>
            {isDesktop && (
              <Text style={[TYPE.small, { width: 220 }]} numberOfLines={1}>
                {STAFF_ROLES.includes(u.role) ? `${deptName[u.department_id] || 'No department'}${u.job_title ? ` · ${u.job_title}` : ''}` : ''}
              </Text>
            )}
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge label={(ROLE_OPTIONS.find((r) => r.value === u.role) || { label: u.role || 'citizen' }).label} tone={ROLE_TONE[u.role] || 'neutral'} />
              {u.is_active === false && <Badge label="Deactivated" tone="neutral" />}
            </View>
            <Ionicons name={mode === 'hr' && u.role === 'admin' ? 'lock-closed-outline' : 'create-outline'} size={18} color={COLORS.gray400} />
          </Pressable>
        ))}
      </Card>
      <Text style={TYPE.small}>{shown.length} of {users.length} accounts</Text>

      <Modal visible={!!editing || inviting} transparent animationType="fade" onRequestClose={() => { setEditing(null); setInviting(false); }}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayInner}>
            <View style={[styles.modal, SHADOW.lg]}>
              {editing && (
                <UserEditor target={editing} departments={departments} currentUserId={currentUserId} mode={mode} onClose={() => setEditing(null)} onSaved={load} />
              )}
              {inviting && <InviteForm departments={departments} mode={mode} onClose={() => setInviting(false)} onSaved={load} />}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  editorHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, marginBottom: SPACE.lg },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: 44,
  },
  searchInput: { fontFamily: FONT, flex: 1, fontSize: 14, color: COLORS.gray900, paddingVertical: 10 },
  filters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACE.lg, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONT, fontWeight: '800', color: COLORS.primary, fontSize: 13 },
  overlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.45)' },
  overlayInner: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  modal: { width: '100%', maxWidth: 480, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: SPACE.md },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: SPACE.lg },
});
