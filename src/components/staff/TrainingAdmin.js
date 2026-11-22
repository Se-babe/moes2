import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Switch } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Button, Badge, Select, TextField, Loading, EmptyState, Avatar, useBreakpoint } from '../ui';
import { COLORS, FONT, RADIUS, SHADOW, SPACE, TYPE } from '../../theme';
import { showAlert } from '../../utils/alert';
import { downloadCsv } from '../../utils/exportFile';
import { trainingReport, fetchModules, fetchQuestions, saveModule } from '../../services/training';

const blankQuestion = () => ({ prompt: '', options: ['', '', '', ''], answer: 0, explanation: '' });

function ModuleEditor({ initial, onClose, onSaved }) {
  const [m, setM] = useState({ audience: 'staff', topic: 'Data management', minutes: 10, pass_mark: 70, position: 10, is_published: true, body: '', ...initial });
  const [qs, setQs] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setM((x) => ({ ...x, [k]: v }));
  useEffect(() => {
    if (initial?.id) fetchQuestions(initial.id).then((r) => setQs(r.map((q) => ({ ...q, options: [...q.options, '', '', '', ''].slice(0, Math.max(4, q.options.length)) })))).catch(() => setQs([]));
    else setQs([blankQuestion()]);
  }, [initial?.id]);
  const setQ = (i, patch) => setQs((list) => list.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const save = async () => {
    if (!m.title?.trim()) return showAlert('Title needed', 'Give the module a title.');
    setSaving(true);
    try {
      await saveModule(m, qs);
      onSaved();
      onClose();
    } catch (e) {
      showAlert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <Text style={[TYPE.h3, { marginBottom: SPACE.lg }]}>{initial?.id ? 'Edit module' : 'New module'}</Text>
      <TextField label="Title" required value={m.title || ''} onChangeText={set('title')} />
      <TextField label="Summary" value={m.summary || ''} onChangeText={set('summary')} />
      <View style={styles.row}>
        <Select style={{ flex: 1 }} label="For" value={m.audience} onChange={set('audience')} options={[{ value: 'staff', label: 'Staff (recorded, with pass mark)' }, { value: 'public', label: 'Public (help & learning centre)' }]} />
        <TextField style={{ flex: 1 }} label="Topic" value={m.topic || ''} onChangeText={set('topic')} />
      </View>
      <View style={styles.row}>
        <TextField style={{ flex: 1 }} label="Minutes" keyboardType="numeric" value={String(m.minutes ?? '')} onChangeText={set('minutes')} />
        <TextField style={{ flex: 1 }} label="Pass mark %" keyboardType="numeric" value={String(m.pass_mark ?? '')} onChangeText={set('pass_mark')} />
        <TextField style={{ flex: 1 }} label="Order" keyboardType="numeric" value={String(m.position ?? '')} onChangeText={set('position')} />
      </View>
      <TextField label="Video link (optional)" value={m.video_url || ''} onChangeText={set('video_url')} placeholder="https://www.youtube.com/watch?v=…" autoCapitalize="none" />
      <TextField label="Lesson" multiline value={m.body} onChangeText={set('body')} inputStyle={{ minHeight: 200 }}
        hint={'Start a line with "## " for a heading and "- " for a bullet. Leave a blank line between paragraphs.'} />
      <View style={styles.switchRow}>
        <Text style={[TYPE.label, { flex: 1 }]}>Published</Text>
        <Switch value={m.is_published !== false} onValueChange={set('is_published')} />
      </View>

      <Text style={[TYPE.h3, { marginTop: SPACE.lg, marginBottom: SPACE.sm }]}>Assessment questions</Text>
      {qs === null ? <Loading /> : qs.map((q, i) => (
        <View key={i} style={styles.question}>
          <View style={styles.rowBetween}>
            <Text style={TYPE.label}>Question {i + 1}</Text>
            <Button title="Remove" size="sm" variant="ghost" icon="trash-outline" onPress={() => setQs((l) => l.filter((_, j) => j !== i))} />
          </View>
          <TextField label="Question" value={q.prompt} onChangeText={(v) => setQ(i, { prompt: v })} />
          {q.options.map((o, k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable onPress={() => setQ(i, { answer: k })} accessibilityRole="radio" accessibilityState={{ checked: q.answer === k }} accessibilityLabel={`Mark option ${k + 1} as the right answer`}>
                <Ionicons name={q.answer === k ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={q.answer === k ? COLORS.success : COLORS.gray400} />
              </Pressable>
              <TextField style={{ flex: 1, marginBottom: 6 }} value={o} placeholder={`Option ${k + 1}${k > 1 ? ' (optional)' : ''}`}
                onChangeText={(v) => setQ(i, { options: q.options.map((x, j) => (j === k ? v : x)) })} />
            </View>
          ))}
          <TextField label="Explanation shown after answering" value={q.explanation || ''} onChangeText={(v) => setQ(i, { explanation: v })} />
        </View>
      ))}
      <Button title="Add question" icon="add" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => setQs((l) => [...(l || []), blankQuestion()])} />
      <Text style={[TYPE.small, { marginTop: 6 }]}>Tap the circle next to the right answer.</Text>

      <View style={styles.actions}>
        <Button title="Cancel" variant="ghost" onPress={onClose} />
        <Button title="Save module" icon="checkmark" loading={saving} onPress={save} />
      </View>
    </View>
  );
}

/** Training records for HR/administrators, and the module library. */
export default function TrainingAdmin() {
  const { isDesktop } = useBreakpoint();
  const [view, setView] = useState('people');
  const [rows, setRows] = useState(null);
  const [mods, setMods] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    trainingReport().then(setRows).catch((e) => { setRows([]); showAlert('Could not load', e.message); });
    fetchModules().then(setMods).catch(() => setMods([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const people = useMemo(() => {
    const by = {};
    for (const r of rows || []) {
      const p = (by[r.user_id] ||= { ...r, total: 0, done: 0, scores: [], last: null });
      p.total += 1;
      if (r.status === 'Completed') p.done += 1;
      if (r.best_score != null) p.scores.push(r.best_score);
      if (r.completed_at && (!p.last || r.completed_at > p.last)) p.last = r.completed_at;
    }
    return Object.values(by).filter((p) => p.is_active !== false);
  }, [rows]);

  const depts = useMemo(() => {
    const by = {};
    for (const p of people) {
      const d = (by[p.department || 'No department'] ||= { name: p.department || 'No department', staff: 0, done: 0, total: 0, scores: [] });
      d.staff += 1; d.done += p.done; d.total += p.total; d.scores.push(...p.scores);
    }
    return Object.values(by).sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);

  const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

  if (rows === null) return <Loading />;

  return (
    <View style={{ gap: SPACE.lg }}>
      <View style={styles.rowBetween}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[['people', 'By person'], ['departments', 'By department'], ['modules', 'Modules']].map(([k, label]) => (
            <Pressable key={k} onPress={() => setView(k)} style={[styles.chip, view === k && styles.chipActive]}>
              <Text style={[styles.chipText, view === k && { color: '#fff' }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {view === 'modules'
          ? <Button title="New module" icon="add" size="sm" onPress={() => setEditing({})} />
          : <Button title="Export CSV" icon="download-outline" size="sm" variant="secondary" onPress={() => downloadCsv('nwsc-training-records.csv', rows, [
              { label: 'Name', key: 'full_name' }, { label: 'Role', key: 'role' }, { label: 'Department', key: 'department' },
              { label: 'Module', key: 'module_title' }, { label: 'Status', key: 'status' }, { label: 'Best score %', key: 'best_score' },
              { label: 'Attempts', key: 'attempts' }, { label: 'Completed', key: 'completed_at' },
            ])} />}
      </View>

      {view === 'people' && (people.length === 0
        ? <Card><EmptyState icon="school-outline" title="No staff yet" message="Training records appear once staff accounts exist." /></Card>
        : (
          <Card padded={false}>
            {people.map((p, i) => {
              const pct = p.total ? Math.round((100 * p.done) / p.total) : 0;
              return (
                <View key={p.user_id} style={[styles.person, i > 0 && styles.border]}>
                  <Avatar name={p.full_name} size={34} />
                  <View style={{ flex: 2, minWidth: 160 }}>
                    <Text style={TYPE.label}>{p.full_name || 'Unnamed'}</Text>
                    <Text style={TYPE.small}>{p.role} · {p.department || 'No department'}</Text>
                  </View>
                  <View style={{ flex: 2, minWidth: 140, gap: 4 }}>
                    <View style={styles.bar}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
                    <Text style={TYPE.small}>{p.done} of {p.total} modules · {pct}%</Text>
                  </View>
                  {isDesktop && <Text style={[TYPE.small, { width: 120 }]}>Avg score {avg(p.scores) ?? '—'}{avg(p.scores) != null ? '%' : ''}</Text>}
                  <Badge label={pct === 100 ? 'Complete' : pct ? 'In progress' : 'Not started'} tone={pct === 100 ? 'success' : pct ? 'warning' : 'neutral'} />
                </View>
              );
            })}
          </Card>
        ))}

      {view === 'departments' && (
        <Card padded={false}>
          <View style={[styles.tr, styles.th]}>
            <Text style={[styles.thText, { flex: 3 }]}>Department</Text>
            <Text style={styles.thText}>Staff</Text>
            <Text style={styles.thText}>Completion</Text>
            <Text style={styles.thText}>Avg score</Text>
          </View>
          {depts.map((d) => {
            const pct = d.total ? Math.round((100 * d.done) / d.total) : 0;
            return (
              <View key={d.name} style={[styles.tr, styles.border]}>
                <Text style={[TYPE.label, { flex: 3 }]}>{d.name}</Text>
                <Text style={styles.td}>{d.staff}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.bar}><View style={[styles.fill, { width: `${pct}%`, backgroundColor: pct >= 80 ? COLORS.success : pct >= 40 ? COLORS.warning : COLORS.danger }]} /></View>
                  <Text style={TYPE.small}>{pct}%</Text>
                </View>
                <Text style={styles.td}>{avg(d.scores) != null ? `${avg(d.scores)}%` : '—'}</Text>
              </View>
            );
          })}
          <Text style={[TYPE.small, { padding: SPACE.lg }]}>Data management capacity: the share of staff training modules completed in each department.</Text>
        </Card>
      )}

      {view === 'modules' && (mods === null ? <Loading /> : (
        <Card padded={false}>
          {mods.map((m, i) => (
            <Pressable key={m.id} onPress={() => setEditing(m)} style={({ hovered }) => [styles.person, i > 0 && styles.border, hovered && { backgroundColor: COLORS.gray50 }]}>
              <Ionicons name={m.audience === 'staff' ? 'ribbon-outline' : 'people-outline'} size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={TYPE.label}>{m.title}</Text>
                <Text style={TYPE.small}>{m.audience === 'staff' ? 'Staff' : 'Public'} · {m.topic} · {m.minutes} min{m.video_url ? ' · video' : ''}</Text>
              </View>
              {!m.is_published && <Badge label="Hidden" />}
              <Ionicons name="create-outline" size={18} color={COLORS.gray400} />
            </Pressable>
          ))}
        </Card>
      ))}

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayInner}>
            <View style={[styles.modal, SHADOW.lg]}>
              {editing && <ModuleEditor initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACE.md, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.sm },
  question: { padding: SPACE.md, borderRadius: RADIUS.md, backgroundColor: COLORS.gray50, marginBottom: SPACE.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: SPACE.lg },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACE.lg, paddingVertical: 12, flexWrap: 'wrap' },
  border: { borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  bar: { height: 8, borderRadius: 4, backgroundColor: COLORS.gray100, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.success },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg, paddingVertical: 12, gap: 8 },
  th: { backgroundColor: COLORS.gray50 },
  thText: { flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: '700', color: COLORS.gray500, textTransform: 'uppercase' },
  td: { flex: 1, fontFamily: FONT, fontSize: 14, color: COLORS.gray800 },
  overlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.45)' },
  overlayInner: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  modal: { width: '100%', maxWidth: 720, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl },
});
