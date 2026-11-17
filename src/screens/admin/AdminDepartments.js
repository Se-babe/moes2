import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { Card, Button, Badge, TextField, Loading, useBreakpoint } from '../../components/ui';
import { COLORS, FONT, RADIUS, SHADOW, SPACE, TYPE } from '../../theme';
import { showAlert } from '../../utils/alert';

// Categories citizens can choose on the complaint form (kept in sync with
// FeedbackScreen); anything in the admin-managed `categories` table is added.
const FORM_CATEGORIES = ['No Water / Supply', 'Leak / Burst Pipe', 'Billing & Payments', 'Water Quality', 'Sewer & Sanitation', 'New Connection', 'General'];
const EMPTY = { name: '', description: '', icon: 'business-outline', sla_hours: '72', email: '', categories: [], is_active: true, display_order: '0' };

function Editor({ initial, allCategories, onClose, onSaved }) {
  const [form, setForm] = useState({
    ...EMPTY,
    ...initial,
    sla_hours: String(initial?.sla_hours ?? 72),
    display_order: String(initial?.display_order ?? 0),
    categories: initial?.categories || [],
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleCat = (c) => setForm((f) => ({
    ...f,
    categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c],
  }));

  const save = async () => {
    const sla = parseInt(form.sla_hours, 10);
    if (!form.name.trim()) return showAlert('Name required', 'Give the department a name.');
    if (!(sla >= 1 && sla <= 2160)) return showAlert('Response target', 'Enter a response target between 1 and 2160 hours.');
    setSaving(true);
    const row = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      icon: form.icon.trim() || 'business-outline',
      sla_hours: sla,
      email: form.email.trim() || null,
      categories: form.categories,
      is_active: form.is_active,
      display_order: parseInt(form.display_order, 10) || 0,
    };
    const { error } = initial?.id
      ? await supabase.from('departments').update(row).eq('id', initial.id)
      : await supabase.from('departments').insert(row);
    setSaving(false);
    if (error) showAlert('Could not save', error.message);
    else { onSaved(); onClose(); }
  };

  return (
    <View>
      <Text style={[TYPE.h3, { marginBottom: SPACE.lg }]}>{initial?.id ? 'Edit department' : 'New department'}</Text>
      <TextField label="Name" required value={form.name} onChangeText={set('name')} placeholder="e.g. Water Distribution & Maintenance" />
      <TextField label="Description" multiline value={form.description || ''} onChangeText={set('description')} inputStyle={{ minHeight: 80 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TextField style={{ flex: 1 }} label="Response target (hours)" value={form.sla_hours} onChangeText={set('sla_hours')} keyboardType="number-pad" hint="High priority gets half, urgent a quarter" />
        <TextField style={{ flex: 1 }} label="Display order" value={form.display_order} onChangeText={set('display_order')} keyboardType="number-pad" />
      </View>
      <TextField label="Team email (optional)" value={form.email || ''} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Text style={[TYPE.label, { marginBottom: 8 }]}>Handles these request categories</Text>
      <View style={styles.cats}>
        {allCategories.map((c) => {
          const on = form.categories.includes(c);
          return (
            <Pressable key={c} onPress={() => toggleCat(c)} style={[styles.cat, on && styles.catOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={16} color={on ? COLORS.primary : COLORS.gray400} />
              <Text style={[styles.catText, on && { color: COLORS.primary }]}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={TYPE.label}>Active</Text>
          <Text style={TYPE.small}>Inactive departments receive no new requests.</Text>
        </View>
        <Switch value={form.is_active} onValueChange={set('is_active')} />
      </View>
      <View style={styles.actions}>
        <Button title="Cancel" variant="ghost" onPress={onClose} />
        <Button title="Save department" icon="checkmark" loading={saving} onPress={save} />
      </View>
    </View>
  );
}

export default function AdminDepartments() {
  const { isDesktop } = useBreakpoint();
  const [depts, setDepts] = useState(null);
  const [staffCount, setStaffCount] = useState({});
  const [extraCats, setExtraCats] = useState([]);
  const [editing, setEditing] = useState(null); // department object, or {} for new

  const load = useCallback(async () => {
    const [d, u, c] = await Promise.all([
      supabase.from('departments').select('*').order('display_order', { ascending: true }),
      supabase.from('users').select('department_id, role').in('role', ['officer', 'supervisor']).eq('is_active', true),
      supabase.from('categories').select('name'),
    ]);
    setDepts(d.data || []);
    const counts = {};
    (u.data || []).forEach((x) => {
      counts[x.department_id] = counts[x.department_id] || { officer: 0, supervisor: 0 };
      counts[x.department_id][x.role] += 1;
    });
    setStaffCount(counts);
    setExtraCats((c.data || []).map((x) => x.name));
  }, []);

  useEffect(() => { load(); }, [load]);

  const allCategories = useMemo(() => [...new Set([...FORM_CATEGORIES, ...extraCats])], [extraCats]);

  const coverage = useMemo(() => {
    if (!depts) return { missing: [], duplicate: [] };
    const active = depts.filter((d) => d.is_active);
    const owners = Object.fromEntries(allCategories.map((c) => [c, active.filter((d) => (d.categories || []).includes(c)).map((d) => d.name)]));
    return {
      missing: allCategories.filter((c) => owners[c].length === 0),
      duplicate: allCategories.filter((c) => owners[c].length > 1).map((c) => `${c} (${owners[c].join(', ')})`),
    };
  }, [depts, allCategories]);

  const remove = (d) => {
    showAlert(
      `Delete ${d.name}?`,
      'Requests and staff in this department will be left without a department. Consider marking it inactive instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('departments').delete().eq('id', d.id);
            if (error) showAlert('Could not delete', error.message);
            else load();
          },
        },
      ],
    );
  };

  if (!depts) return <Loading label="Loading departments…" />;

  return (
    <View style={{ gap: SPACE.lg }}>
      <View style={[styles.intro, !isDesktop && { flexDirection: 'column', alignItems: 'flex-start' }]}>
        <Text style={[TYPE.body, { flex: 1, color: COLORS.gray600 }]}>
          New requests are routed to the department that handles their category, then assigned to that
          department's least-busy active officer. Overdue requests escalate to the department's supervisor, then to administrators.
        </Text>
        <Button title="New department" icon="add" onPress={() => setEditing({})} />
      </View>

      {(coverage.missing.length > 0 || coverage.duplicate.length > 0) && (
        <Card style={styles.warn}>
          <Ionicons name="warning-outline" size={20} color={COLORS.warning} />
          <View style={{ flex: 1, gap: 4 }}>
            {coverage.missing.length > 0 && (
              <Text style={TYPE.body}><Text style={{ fontWeight: '700' }}>Not routed:</Text> {coverage.missing.join(', ')} — these go to Customer Service by default.</Text>
            )}
            {coverage.duplicate.length > 0 && (
              <Text style={TYPE.body}><Text style={{ fontWeight: '700' }}>Handled by more than one department:</Text> {coverage.duplicate.join('; ')} — the first in display order wins.</Text>
            )}
          </View>
        </Card>
      )}

      {depts.map((d) => {
        const sc = staffCount[d.id] || { officer: 0, supervisor: 0 };
        return (
          <Card key={d.id} style={[styles.dept, !d.is_active && { opacity: 0.65 }]}>
            <View style={[styles.deptHead, !isDesktop && { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <View style={styles.deptIcon}><Ionicons name={d.icon || 'business-outline'} size={22} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={TYPE.h3}>{d.name}</Text>
                  {!d.is_active && <Badge label="Inactive" />}
                </View>
                {d.description ? <Text style={TYPE.small}>{d.description}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button title="Edit" icon="create-outline" variant="secondary" size="sm" onPress={() => setEditing(d)} />
                <Button title="Delete" icon="trash-outline" variant="ghost" size="sm" onPress={() => remove(d)} />
              </View>
            </View>
            <View style={styles.meta}>
              <Badge label={`${d.sla_hours}h response target`} tone="brand" icon="time-outline" />
              <Badge label={`${sc.officer} officer${sc.officer === 1 ? '' : 's'}`} tone={sc.officer ? 'success' : 'danger'} icon="people-outline" />
              <Badge label={`${sc.supervisor} supervisor${sc.supervisor === 1 ? '' : 's'}`} tone={sc.supervisor ? 'success' : 'warning'} icon="shield-outline" />
              {d.email ? <Badge label={d.email} icon="mail-outline" /> : null}
            </View>
            <Text style={[TYPE.small, { marginTop: SPACE.md }]}>
              Categories: {(d.categories || []).length ? d.categories.join(', ') : 'none — this department receives no requests automatically'}
            </Text>
            {sc.officer === 0 && d.is_active && (d.categories || []).length > 0 && (
              <Text style={[TYPE.small, { color: COLORS.danger, marginTop: 4 }]}>
                No active officers — new requests here will wait unassigned. Add staff under "Staff & users".
              </Text>
            )}
          </Card>
        );
      })}

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayInner}>
            <View style={[styles.modal, SHADOW.lg]}>
              {editing && <Editor initial={editing.id ? editing : null} allCategories={allCategories} onClose={() => setEditing(null)} onSaved={load} />}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  warn: { flexDirection: 'row', gap: 12, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  dept: { gap: 4 },
  deptHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  deptIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACE.md },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACE.md },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200 },
  catOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  catText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray700 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: SPACE.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: SPACE.lg },
  overlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.45)' },
  overlayInner: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  modal: { width: '100%', maxWidth: 560, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl },
});
