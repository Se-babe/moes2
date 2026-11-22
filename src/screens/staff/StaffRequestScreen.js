import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { hasAdminPowers } from '../../services/staff';
import { View, Text, ScrollView, StyleSheet, Image, Linking, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import StaffGate from '../../components/staff/StaffGate';
import StaffNavbar from '../../components/staff/StaffNavbar';
import { Container, Card, Button, Badge, TextField, Select, EmptyState, Loading, STATUS_TONE, Avatar, useBreakpoint } from '../../components/ui';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../../theme';
import { showAlert } from '../../utils/alert';
import {
  fetchRequest, fetchTimeline, fetchDepartments, fetchStaff, performRequestAction,
  PRIORITIES, PRIORITY_TONE, dueInfo, fmtDateTime, OPEN_STATUSES,
} from '../../services/staff';

const REPLY_STATUSES = [
  { value: '', label: 'Keep current status' },
  { value: 'In Progress', label: 'In Progress', hint: 'Work has started' },
  { value: 'Resolved', label: 'Resolved', hint: 'The issue is fixed — explain the outcome' },
  { value: 'Closed', label: 'Closed', hint: 'No further action (e.g. duplicate, not NWSC)' },
];

const REPLY_TEMPLATES = [
  'Thank you for reporting this. A team has been scheduled to inspect the site.',
  'Our crew has repaired the problem. Please let us know if the issue continues.',
  'We have reviewed your account and corrected the bill. The adjustment will appear on your next statement.',
  'We need more information to help you. Please call 0800-200-977 and quote your reference number.',
];

function InfoRow({ icon, label, children }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={COLORS.gray500} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.small, { fontSize: 12 }]}>{label}</Text>
        <View>{typeof children === 'string' ? <Text style={TYPE.label}>{children}</Text> : children}</View>
      </View>
    </View>
  );
}

function Detail() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { isDesktop } = useBreakpoint();
  const id = route.params?.id;

  const [req, setReq] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [mode, setMode] = useState('reply'); // reply | note
  const [message, setMessage] = useState('');
  const [replyStatus, setReplyStatus] = useState('');
  const [sending, setSending] = useState(false);

  const [assign, setAssign] = useState({});
  const [savingAssign, setSavingAssign] = useState(false);

  const canMoveDepartment = user.role === 'supervisor' || hasAdminPowers(user.role);

  const load = useCallback(async () => {
    try {
      const [r, t] = await Promise.all([fetchRequest(id), fetchTimeline(id)]);
      if (!r) { setNotFound(true); return; }
      setReq(r);
      setTimeline(t);
      setAssign({ department_id: r.department_id, assigned_to: r.assigned_to, priority: r.priority });
    } catch (e) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    fetchDepartments().then(setDepartments).catch(() => {});
    fetchStaff().then(setStaff).catch(() => {});
  }, [load]);

  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);
  const dept = departments.find((d) => d.id === req?.department_id);

  const run = async (payload, okMsg) => {
    const result = await performRequestAction({ request_id: id, ...payload });
    await load();
    if (okMsg) showAlert(okMsg, result?.citizen_notified ? 'The customer has been notified by SMS/email.' : undefined);
    return result;
  };

  const send = async () => {
    if (!message.trim()) {
      showAlert('Message needed', mode === 'reply' ? 'Write a reply to the customer.' : 'Write a note for your colleagues.');
      return;
    }
    setSending(true);
    try {
      if (mode === 'reply') {
        await run({ public_message: message, ...(replyStatus ? { status: replyStatus } : {}) }, 'Reply sent');
      } else {
        await run({ internal_note: message }, 'Note added');
      }
      setMessage('');
      setReplyStatus('');
    } catch (e) {
      showAlert('Could not save', e.message);
    } finally {
      setSending(false);
    }
  };

  const quickStatus = async (status) => {
    if (status === 'Resolved' || status === 'Closed') {
      setMode('reply');
      setReplyStatus(status);
      showAlert('Add an outcome', `Write a short message to the customer explaining the outcome, then press "Send reply" to mark it ${status.toLowerCase()}.`);
      return;
    }
    try {
      await run({ status }, `Marked ${status}`);
    } catch (e) {
      showAlert('Could not update', e.message);
    }
  };

  const saveAssignment = async () => {
    setSavingAssign(true);
    try {
      const payload = { priority: assign.priority, assigned_to: assign.assigned_to || null };
      if (canMoveDepartment && assign.department_id !== req.department_id) payload.department_id = assign.department_id;
      await run(payload, 'Assignment saved');
    } catch (e) {
      showAlert('Could not save', e.message);
    } finally {
      setSavingAssign(false);
    }
  };

  if (loading) return <Loading label="Loading request…" />;
  if (notFound || !req) {
    return (
      <Container narrow style={{ marginTop: 64 }}>
        <Card>
          <EmptyState
            icon="search-outline"
            title="Request not found"
            message="It may have moved to another department, or you may not have access to it."
            action={<Button title="Back to work queue" onPress={() => navigation.navigate('StaffPortal')} />}
          />
        </Card>
      </Container>
    );
  }

  const due = dueInfo(req.due_at, req.status);
  const isOpen = OPEN_STATUSES.includes(req.status);
  // Officers can hand a request to a teammate; only supervisors and admins
  // can leave it unassigned (the database enforces the same rule).
  // Supervisors and admins can pick anyone: their own department's staff
  // first, then other teams (picking one also moves the request there).
  const deptNameOf = (id) => departments.find((d) => d.id === id)?.name || 'No department';
  const activeStaff = staff.filter((s) => s.is_active !== false && ['officer', 'supervisor'].includes(s.role) && s.department_id);
  const inTeam = activeStaff.filter((s) => s.department_id === assign.department_id);
  const otherTeams = canMoveDepartment ? activeStaff.filter((s) => s.department_id !== assign.department_id) : [];
  const assigneeOptions = [
    ...(canMoveDepartment || !req?.assigned_to ? [{ value: null, label: 'Unassigned' }] : []),
    ...inTeam.map((s) => ({ value: s.id, label: s.full_name || s.email, hint: `${s.role}${s.job_title ? ` · ${s.job_title}` : ''}` })),
    ...otherTeams.map((s) => ({ value: s.id, label: s.full_name || s.email, hint: `${s.role} · ${deptNameOf(s.department_id)} (moves the request)` })),
  ];
  const pickAssignee = (v) => {
    const person = activeStaff.find((s) => s.id === v);
    setAssign((a) => ({ ...a, assigned_to: v, ...(person && person.department_id !== a.department_id ? { department_id: person.department_id } : {}) }));
  };
  const noTeam = inTeam.length === 0;
  const authorName = (u) => {
    if (!u.author_id) return 'System';
    if (u.author_id === user.id) return 'You';
    return staffById[u.author_id]?.full_name || 'NWSC staff';
  };

  return (
    <ScrollView style={styles.page}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <Container style={styles.topbarRow}>
          <Pressable onPress={() => navigation.navigate('StaffPortal')} style={styles.back} accessibilityRole="link">
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backText}>Work queue</Text>
          </Pressable>
          <Text style={TYPE.small} selectable>{req.reference_no}</Text>
        </Container>
      </View>

      <Container style={[styles.cols, !isDesktop && { flexDirection: 'column' }]}>
        {/* ===== Main column ===== */}
        <View style={{ flex: 2, gap: SPACE.lg, width: '100%' }}>
          <Card>
            <View style={styles.refRow}>
              <Text style={styles.ref} selectable>{req.reference_no}</Text>
              <View style={styles.badges}>
                <Badge label={req.status} tone={STATUS_TONE[req.status]} />
                <Badge label={`${req.priority} priority`} tone={PRIORITY_TONE[req.priority]} />
                {req.escalation_level > 0 && <Badge label={`Escalation L${req.escalation_level}`} tone="danger" icon="alert-circle" />}
                {due && <Badge label={due.text} tone={due.tone} icon="time-outline" />}
              </View>
            </View>
            <Text style={[TYPE.h2, { marginTop: SPACE.md }]}>{req.title}</Text>
            <Text style={[TYPE.small, { marginTop: 4 }]}>
              {req.request_type} · {req.category} · {req.source && req.source !== 'Online' ? `Received by ${req.source.toLowerCase()}` : 'Submitted online'} {fmtDateTime(req.created_at)}
            </Text>
            {req.description ? <Text style={[TYPE.body, { marginTop: SPACE.lg, color: COLORS.gray800 }]}>{req.description}</Text> : null}
            {req.location_text ? (
              <View style={styles.location}>
                <Ionicons name="location-outline" size={16} color={COLORS.primary} />
                <Text style={[TYPE.body, { flex: 1 }]}>{req.location_text}</Text>
              </View>
            ) : null}
            {req.image_url ? (
              <Pressable onPress={() => Linking.openURL(req.image_url)} accessibilityLabel="Open attached photo">
                <Image source={{ uri: req.image_url }} style={styles.photo} resizeMode="cover" />
              </Pressable>
            ) : null}

            {isOpen && (
              <View style={styles.quick}>
                {req.status !== 'In Progress' && <Button title="Start work" icon="play" size="sm" variant="secondary" onPress={() => quickStatus('In Progress')} />}
                <Button title="Mark resolved" icon="checkmark-circle" size="sm" variant="secondary" onPress={() => quickStatus('Resolved')} />
                <Button title="Close" icon="close-circle" size="sm" variant="ghost" onPress={() => quickStatus('Closed')} />
              </View>
            )}
          </Card>

          {/* Composer */}
          <Card>
            <View style={styles.tabs}>
              {[['reply', 'Reply to customer', 'chatbubble-outline'], ['note', 'Internal note', 'lock-closed-outline']].map(([k, label, icon]) => (
                <Pressable key={k} onPress={() => setMode(k)} style={[styles.tab, mode === k && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: mode === k }}>
                  <Ionicons name={icon} size={15} color={mode === k ? COLORS.primary : COLORS.gray500} />
                  <Text style={[styles.tabText, mode === k && { color: COLORS.primary }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[TYPE.small, { marginBottom: SPACE.md }]}>
              {mode === 'reply'
                ? `Visible on the tracking page and sent to the customer${req.contact_phone ? ' by SMS' : ''}${req.contact_email ? `${req.contact_phone ? ' and' : ' by'} email` : ''}.`
                : 'Only visible to NWSC staff. Use it for handover details, findings or job numbers.'}
            </Text>
            {mode === 'reply' && (
              <View style={styles.templates}>
                {REPLY_TEMPLATES.map((t) => (
                  <Pressable key={t} onPress={() => setMessage(t)} style={({ hovered }) => [styles.template, hovered && { borderColor: COLORS.primaryLight }]}>
                    <Text style={[TYPE.small, { color: COLORS.gray700 }]} numberOfLines={1}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <TextField
              multiline
              value={message}
              onChangeText={setMessage}
              maxLength={mode === 'reply' ? 1000 : 2000}
              placeholder={mode === 'reply' ? 'Write a clear update for the customer…' : 'Write a note for colleagues…'}
              hint={mode === 'reply' ? `${message.length}/1000 · SMS shows the first 280 characters` : undefined}
            />
            <View style={[styles.sendRow, !isDesktop && { flexDirection: 'column', alignItems: 'stretch' }]}>
              {mode === 'reply' && (
                <Select style={{ flex: 1, marginBottom: 0 }} value={replyStatus} options={REPLY_STATUSES} onChange={setReplyStatus} />
              )}
              <Button
                title={mode === 'reply' ? 'Send reply' : 'Add note'}
                icon={mode === 'reply' ? 'send' : 'add'}
                loading={sending}
                onPress={send}
              />
            </View>
          </Card>

          {/* Timeline */}
          <Card>
            <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>Activity</Text>
            {timeline.slice().reverse().map((u) => (
              <View key={u.id} style={[styles.event, !u.is_public && styles.eventInternal]}>
                {u.author_id ? (
                  <Avatar
                    name={u.author_id === user.id ? user.full_name : staffById[u.author_id]?.full_name}
                    url={u.author_id === user.id ? user.avatar_url : staffById[u.author_id]?.avatar_url}
                    size={28}
                  />
                ) : (
                  <View style={[styles.eventIcon, !u.is_public && { backgroundColor: COLORS.warningSoft }]}>
                    <Ionicons name={!u.is_public ? 'lock-closed' : 'flash'} size={13} color={!u.is_public ? COLORS.warning : COLORS.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.eventHead}>
                    <Text style={TYPE.label}>{authorName(u)}</Text>
                    {!u.is_public && <Badge label="Internal" tone="warning" />}
                    {u.status && <Badge label={u.status} tone={STATUS_TONE[u.status]} />}
                    <Text style={[TYPE.small, { marginLeft: 'auto' }]}>{fmtDateTime(u.created_at)}</Text>
                  </View>
                  <Text style={[TYPE.body, { marginTop: 4 }]}>{u.message}</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>

        {/* ===== Side column ===== */}
        <View style={{ flex: 1, gap: SPACE.lg, width: '100%' }}>
          <Card>
            <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>Customer</Text>
            <InfoRow icon="person-outline" label="Name">{req.contact_name || 'Not given'}</InfoRow>
            <InfoRow icon="call-outline" label="Phone">
              {req.contact_phone ? (
                <Text style={[TYPE.label, styles.link]} onPress={() => Linking.openURL(`tel:${req.contact_phone.replace(/\s/g, '')}`)}>{req.contact_phone}</Text>
              ) : <Text style={TYPE.label}>Not given</Text>}
            </InfoRow>
            <InfoRow icon="mail-outline" label="Email">
              {req.contact_email ? (
                <Text style={[TYPE.label, styles.link]} onPress={() => Linking.openURL(`mailto:${req.contact_email}?subject=${encodeURIComponent(`Your NWSC request ${req.reference_no}`)}`)}>{req.contact_email}</Text>
              ) : <Text style={TYPE.label}>Not given</Text>}
            </InfoRow>
            <InfoRow icon="person-circle-outline" label="Account">{req.user_id && req.user_id !== 'anonymous' ? 'Registered user' : 'Guest submission'}</InfoRow>
          </Card>

          <Card>
            <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>Assignment</Text>
            <Select
              label="Department"
              value={assign.department_id}
              disabled={!canMoveDepartment}
              options={departments.map((d) => ({ value: d.id, label: d.name, hint: `${d.sla_hours}h target` }))}
              onChange={(v) => setAssign((a) => ({ ...a, department_id: v, assigned_to: v === req.department_id ? req.assigned_to : null }))}
            />
            <Select label="Assigned officer" value={assign.assigned_to} options={assigneeOptions} onChange={pickAssignee} />
            {noTeam && (
              <Text style={[TYPE.small, { marginTop: -8, marginBottom: SPACE.md, color: COLORS.warning }]}>
                {canMoveDepartment
                  ? `No active staff in ${deptNameOf(assign.department_id)} yet — pick someone from another team, or add staff under Admin → Staff & users.`
                  : 'No other active staff in this department.'}
              </Text>
            )}
            {assign.department_id !== req.department_id && (
              <Text style={[TYPE.small, { marginTop: -8, marginBottom: SPACE.md }]}>Saving moves this request to {deptNameOf(assign.department_id)}.</Text>
            )}
            <Select label="Priority" value={assign.priority} options={PRIORITIES.map((p) => ({ value: p, label: p }))} onChange={(v) => setAssign((a) => ({ ...a, priority: v }))} />
            {!canMoveDepartment && <Text style={[TYPE.small, { marginTop: -8, marginBottom: SPACE.md }]}>Ask a supervisor to move this to another department.</Text>}
            <Button
              title="Save assignment"
              icon="save-outline"
              variant="secondary"
              full
              loading={savingAssign}
              disabled={assign.department_id === req.department_id && assign.assigned_to === req.assigned_to && assign.priority === req.priority}
              onPress={saveAssignment}
            />
          </Card>

          <Card>
            <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>Service level</Text>
            <InfoRow icon="business-outline" label="Department">{dept?.name || 'None'}</InfoRow>
            <InfoRow icon="flag-outline" label="Response target">{dept ? `${dept.sla_hours} hours` : '—'}</InfoRow>
            <InfoRow icon="time-outline" label="Due">{fmtDateTime(req.due_at)}</InfoRow>
            <InfoRow icon="chatbubble-ellipses-outline" label="First response">{req.first_response_at ? fmtDateTime(req.first_response_at) : 'Not yet'}</InfoRow>
            {req.resolved_at ? <InfoRow icon="checkmark-done-outline" label="Resolved">{fmtDateTime(req.resolved_at)}</InfoRow> : null}
            <InfoRow icon="trending-up-outline" label="Escalation">{req.escalation_level > 0 ? `Level ${req.escalation_level} (${fmtDateTime(req.escalated_at)})` : 'None'}</InfoRow>
          </Card>
        </View>
      </Container>
      <View style={{ height: 64 }} />
    </ScrollView>
  );
}

export default function StaffRequestScreen() {
  return (
    <StaffGate roles={['officer', 'supervisor', 'admin', 'hr']}>
      <StaffNavbar active="queue">
        <Detail />
      </StaffNavbar>
    </StaffGate>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  topbar: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  topbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  backText: { fontFamily: FONT, fontSize: 14.5, fontWeight: '700', color: COLORS.primary },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xl, marginTop: SPACE.xl },
  refRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  ref: { fontFamily: FONT, fontSize: 20, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  location: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: SPACE.md, backgroundColor: COLORS.primarySoft, padding: 12, borderRadius: RADIUS.md },
  photo: { width: '100%', height: 260, borderRadius: RADIUS.md, marginTop: SPACE.lg, backgroundColor: COLORS.gray100 },
  quick: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: SPACE.xl, paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  tabs: { flexDirection: 'row', gap: 4, borderBottomWidth: 1, borderBottomColor: COLORS.gray200, marginBottom: SPACE.md },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontFamily: FONT, fontSize: 14, fontWeight: '700', color: COLORS.gray500 },
  templates: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACE.md },
  template: { maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.gray50 },
  sendRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  event: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  eventInternal: { backgroundColor: '#FFFBEB', marginHorizontal: -SPACE.xl, paddingHorizontal: SPACE.xl },
  eventIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  infoRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  link: { color: COLORS.primary, textDecorationLine: 'underline' },
});
