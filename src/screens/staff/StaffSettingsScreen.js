import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Switch } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import StaffGate from '../../components/staff/StaffGate';
import StaffNavbar, { staffSections } from '../../components/staff/StaffNavbar';
import { Segment } from '../../components/DisplaySettings';
import { Container, Card, Button, TextField, Avatar, Badge, useBreakpoint } from '../../components/ui';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../../theme';
import { showAlert } from '../../utils/alert';
import { pickAvatar, uploadAvatar, removeOldAvatars } from '../../services/profile';
import { fetchDepartments, fmtDateTime } from '../../services/staff';
import { LANGUAGES } from '../../i18n';

const TABS = [
  { key: 'profile', label: 'My profile', icon: 'person-circle-outline' },
  { key: 'security', label: 'Password & security', icon: 'lock-closed-outline' },
  { key: 'preferences', label: 'Preferences', icon: 'options-outline' },
];
const ROLE_LABEL = { officer: 'Officer', supervisor: 'Supervisor', admin: 'Administrator' };
const UG_PHONE = /^(\+?256|0)?7\d{8}$/;

function ReadOnly({ label, value, icon }) {
  return (
    <View style={styles.ro}>
      <Ionicons name={icon} size={18} color={COLORS.gray400} />
      <View style={{ flex: 1 }}>
        <Text style={TYPE.small}>{label}</Text>
        <Text style={[TYPE.label, { marginTop: 1 }]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

// ---------------- Profile ----------------
function ProfileTab() {
  const { user, updateProfile } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [fullName, setFullName] = useState(user.full_name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => { fetchDepartments().then(setDepartments).catch(() => {}); }, []);
  const dept = departments.find((d) => d.id === user.department_id);

  const changePhoto = async () => {
    try {
      const asset = await pickAvatar();
      if (!asset) return;
      setPhotoBusy(true);
      const url = await uploadAvatar(user.id, asset);
      await updateProfile({ avatar_url: url });
    } catch (e) {
      showAlert('Photo not saved', e.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await updateProfile({ avatar_url: null });
      await removeOldAvatars(user.id);
    } catch (e) {
      showAlert('Could not remove photo', e.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const cleanPhone = phone.replace(/[\s-]/g, '');
  const nameError = fullName.trim().length < 2 ? 'Enter your full name' : null;
  const phoneError = cleanPhone && !UG_PHONE.test(cleanPhone) ? 'Use a Ugandan mobile number, e.g. 0772 123456' : null;
  const dirty = fullName.trim() !== (user.full_name || '') || cleanPhone !== (user.phone || '');

  const save = async () => {
    if (nameError || phoneError) return;
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName.trim(), phone: cleanPhone || null });
      showAlert('Saved', 'Your profile has been updated.');
    } catch (e) {
      showAlert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: SPACE.xl }}>
      <Card>
        <Text style={TYPE.h3}>Profile picture</Text>
        <Text style={[TYPE.small, { marginTop: 4 }]}>Shown to your colleagues in the work queue, request timelines and team lists.</Text>
        <View style={styles.photoRow}>
          <Avatar name={user.full_name || user.email} url={user.avatar_url} size={96} />
          <View style={{ gap: 10, flex: 1, minWidth: 200 }}>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button title={user.avatar_url ? 'Change photo' : 'Upload photo'} icon="camera-outline" size="sm" loading={photoBusy} onPress={changePhoto} />
              {user.avatar_url && !photoBusy && <Button title="Remove" icon="trash-outline" variant="ghost" size="sm" onPress={removePhoto} />}
            </View>
            <Text style={TYPE.small}>JPG, PNG or WebP. We crop it to a square automatically.</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={[TYPE.h3, { marginBottom: SPACE.lg }]}>Personal details</Text>
        <TextField label="Full name" required value={fullName} onChangeText={setFullName} maxLength={80} error={fullName ? nameError : null} />
        <TextField
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="0772 123456"
          hint="Used by colleagues and supervisors to reach you about urgent requests."
          error={phoneError}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button title="Save changes" icon="checkmark" loading={saving} disabled={!dirty || !!nameError || !!phoneError} onPress={save} />
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACE.md, flexWrap: 'wrap' }}>
          <Text style={TYPE.h3}>Work account</Text>
          <Badge label="Managed by your administrator" tone="neutral" icon="shield-checkmark-outline" />
        </View>
        <ReadOnly icon="mail-outline" label="Email (sign-in)" value={user.email} />
        <ReadOnly icon="ribbon-outline" label="Role" value={ROLE_LABEL[user.role] || user.role} />
        <ReadOnly icon="business-outline" label="Department" value={dept?.name || (user.role === 'admin' ? 'All departments' : 'Not assigned')} />
        <ReadOnly icon="briefcase-outline" label="Job title" value={user.job_title} />
        <Text style={[TYPE.small, { marginTop: SPACE.md }]}>To change any of these, ask an administrator.</Text>
      </Card>
    </View>
  );
}

// ---------------- Security ----------------
function SecurityTab() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const rules = [
    { ok: next.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(next) && /\d/.test(next), label: 'Letters and numbers' },
    { ok: next && next === confirm, label: 'Both new passwords match' },
    { ok: next && next !== current, label: 'Different from your current password' },
  ];
  const valid = current && rules.every((r) => r.ok);

  const change = async () => {
    setSaving(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (authErr) throw new Error('Your current password is not correct.');
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setCurrent(''); setNext(''); setConfirm('');
      showAlert('Password changed', 'Use your new password next time you sign in.');
    } catch (e) {
      showAlert('Password not changed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const signOutOthers = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    setSigningOut(false);
    if (error) showAlert('Could not sign out other devices', error.message);
    else showAlert('Done', 'You have been signed out everywhere except this device.');
  };

  return (
    <View style={{ gap: SPACE.xl }}>
      <Card>
        <Text style={[TYPE.h3, { marginBottom: SPACE.lg }]}>Change password</Text>
        <TextField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry={!show} autoComplete="current-password" />
        <TextField label="New password" value={next} onChangeText={setNext} secureTextEntry={!show} autoComplete="new-password" />
        <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry={!show} autoComplete="new-password" />
        <View style={styles.switchRow}>
          <Switch value={show} onValueChange={setShow} accessibilityLabel="Show passwords" />
          <Text style={TYPE.body}>Show passwords</Text>
        </View>
        <View style={styles.rules}>
          {rules.map((r) => (
            <View key={r.label} style={styles.rule}>
              <Ionicons name={r.ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={r.ok ? COLORS.success : COLORS.gray400} />
              <Text style={[TYPE.small, r.ok && { color: COLORS.gray700 }]}>{r.label}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACE.lg }}>
          <Button title="Update password" icon="key-outline" loading={saving} disabled={!valid} onPress={change} />
        </View>
      </Card>

      <Card>
        <Text style={TYPE.h3}>Sessions</Text>
        <ReadOnly icon="time-outline" label="Last sign-in" value={user.last_sign_in_at ? fmtDateTime(user.last_sign_in_at) : null} />
        <Text style={[TYPE.body, { marginTop: SPACE.md }]}>
          Lost a phone or used a shared computer? Sign out everywhere else. You stay signed in here.
        </Text>
        <View style={{ flexDirection: 'row', marginTop: SPACE.lg }}>
          <Button title="Sign out other devices" icon="phone-portrait-outline" variant="secondary" loading={signingOut} onPress={signOutOthers} />
        </View>
      </Card>
    </View>
  );
}

// ---------------- Preferences ----------------
function PreferencesTab() {
  const { user, updateProfile } = useAuth();
  const p = usePreferences();
  const prefs = user.preferences || {};
  const supervisor = user.role === 'supervisor' || user.role === 'admin';

  const save = async (patch) => {
    try {
      await updateProfile({ preferences: { ...prefs, ...patch } });
    } catch (e) {
      showAlert('Could not save', e.message);
    }
  };

  const startOptions = staffSections(user.role).filter((s) => s.key !== 'settings').map((s) => ({ value: s.key, label: s.label }));
  const queueOptions = supervisor
    ? [{ value: 'department', label: 'My department' }, { value: 'unassigned', label: 'Unassigned' }, { value: 'mine', label: 'Assigned to me' }]
    : [{ value: 'mine', label: 'Assigned to me' }, { value: 'department', label: 'My department' }, { value: 'unassigned', label: 'Unassigned' }];

  return (
    <View style={{ gap: SPACE.xl }}>
      {user.role !== 'hr' && (
      <Card>
        <Text style={TYPE.h3}>Workspace</Text>
        <Text style={[TYPE.small, { marginTop: 4 }]}>Saved to your account, so they follow you to any device.</Text>
        <Text style={styles.label}>Open the staff portal on</Text>
        <Segment label="Start page" value={prefs.start_section || 'queue'} onChange={(v) => save({ start_section: v })} options={startOptions} />
        <Text style={styles.label}>Work queue shows first</Text>
        <Segment label="Default queue" value={prefs.default_queue || queueOptions[0].value} onChange={(v) => save({ default_queue: v })} options={queueOptions} />
      </Card>
      )}

      <Card>
        <Text style={TYPE.h3}>Display</Text>
        <Text style={[TYPE.small, { marginTop: 4 }]}>Saved on this device.</Text>
        <Text style={styles.label}>Language</Text>
        <Segment label="Language" value={p.language} onChange={(v) => p.update({ language: v })} options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
        <Text style={styles.label}>Text size</Text>
        <Segment
          label="Text size"
          value={p.textScale}
          onChange={(v) => p.update({ textScale: v })}
          options={[{ value: 1, label: 'Normal' }, { value: 1.15, label: 'Large' }, { value: 1.3, label: 'Larger' }]}
        />
        <View style={styles.switchRow}>
          <Text style={[TYPE.label, { flex: 1 }]}>High contrast</Text>
          <Switch value={p.highContrast} onValueChange={(v) => p.update({ highContrast: v })} accessibilityLabel="High contrast" />
        </View>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={TYPE.label}>Lite mode</Text>
            <Text style={TYPE.small}>Fewer images, for slow or expensive connections.</Text>
          </View>
          <Switch value={p.lite} onValueChange={(v) => p.update({ lite: v })} accessibilityLabel="Lite mode" />
        </View>
      </Card>
    </View>
  );
}

function Settings() {
  const navigation = useNavigation();
  const route = useRoute();
  const { isDesktop } = useBreakpoint();
  const tab = TABS.some((t) => t.key === route.params?.tab) ? route.params.tab : 'profile';
  const go = (key) => navigation.setParams({ tab: key });

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: SPACE.xxl }}>
      <Container>
        <Text style={[TYPE.h1, { fontSize: isDesktop ? 28 : 22 }]} accessibilityRole="header">Settings</Text>
        <Text style={[TYPE.body, { marginTop: 4 }]}>Your profile, password and how the staff portal works for you.</Text>
        <View style={[styles.cols, !isDesktop && { flexDirection: 'column' }]}>
          <View style={[styles.side, !isDesktop && styles.sideMobile]} accessibilityRole="tablist">
            {TABS.map((t) => {
              const on = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => go(t.key)}
                  style={({ hovered }) => [styles.tab, !isDesktop && styles.tabMobile, on && styles.tabOn, hovered && !on && { backgroundColor: COLORS.gray100 }]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={t.icon} size={18} color={on ? COLORS.primary : COLORS.gray500} />
                  <Text style={[styles.tabText, on && { color: COLORS.primary }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flex: 1, width: '100%' }}>
            {tab === 'profile' && <ProfileTab />}
            {tab === 'security' && <SecurityTab />}
            {tab === 'preferences' && <PreferencesTab />}
          </View>
        </View>
      </Container>
    </ScrollView>
  );
}

export default function StaffSettingsScreen() {
  return (
    <StaffGate roles={['officer', 'supervisor', 'admin', 'hr']}>
      <StaffNavbar active="settings">
        <Settings />
      </StaffNavbar>
    </StaffGate>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: SPACE.xl, marginTop: SPACE.xl, alignItems: 'flex-start' },
  side: { width: 240, gap: 4 },
  sideMobile: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: RADIUS.md },
  tabMobile: { paddingVertical: 8, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.pill, backgroundColor: COLORS.white },
  tabOn: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primarySoft },
  tabText: { fontFamily: FONT, fontSize: 14.5, fontWeight: '600', color: COLORS.gray700 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xl, marginTop: SPACE.lg, flexWrap: 'wrap' },
  ro: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  label: { ...TYPE.label, marginTop: SPACE.lg, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: SPACE.lg },
  rules: { marginTop: SPACE.lg, gap: 6 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
