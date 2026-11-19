import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { Card, Button, Badge, TextField, Select, EmptyState, Loading } from '../../components/ui';
import DateTimeField from '../../components/DateTimeField';
import BarList from '../../components/BarList';
import { COLORS, FONT, RADIUS, SHADOW, SPACE, TYPE } from '../../theme';
import { showAlert } from '../../utils/alert';
import { downloadCsv } from '../../utils/exportFile';

const KINDS = [
  { value: 'rating', label: 'Rating 1–5' },
  { value: 'single', label: 'Single choice' },
  { value: 'multi', label: 'Multiple choice' },
  { value: 'text', label: 'Free text' },
];
const newQuestion = () => ({ key: Math.random().toString(36).slice(2), kind: 'rating', prompt: '', options: [], required: true });

function SurveyEditor({ survey, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: survey?.title || '',
    description: survey?.description || '',
    end_date: survey?.end_date || '',
    is_active: survey?.is_active ?? true,
    thank_you: survey?.thank_you || '',
  });
  const [questions, setQuestions] = useState(null);
  const [saving, setSaving] = useState(false);
  const hasResponses = (survey?.survey_responses?.[0]?.count || 0) > 0;

  useEffect(() => {
    if (!survey?.id) { setQuestions([newQuestion()]); return; }
    supabase.from('survey_questions').select('*').eq('survey_id', survey.id).order('position')
      .then(({ data }) => setQuestions((data || []).map((q) => ({ ...q, key: q.id, optionsText: q.options.join('\n') }))));
  }, [survey?.id]);

  const updateQ = (key, patch) => setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const move = (i, d) => setQuestions((qs) => {
    const next = [...qs]; const j = i + d;
    if (j < 0 || j >= next.length) return qs;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const save = async () => {
    if (form.title.trim().length < 3) return showAlert('Title needed', 'Give the survey a title.');
    const qs = questions.map((q, i) => ({
      ...q,
      position: i,
      prompt: q.prompt.trim(),
      options: ['single', 'multi'].includes(q.kind)
        ? (q.optionsText || '').split('\n').map((o) => o.trim()).filter(Boolean)
        : [],
    }));
    const bad = qs.find((q) => q.prompt.length < 3 || (['single', 'multi'].includes(q.kind) && q.options.length < 2));
    if (!qs.length) return showAlert('Questions needed', 'Add at least one question.');
    if (bad) return showAlert('Check your questions', 'Every question needs text, and choice questions need at least two options (one per line).');
    setSaving(true);
    try {
      const row = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        end_date: form.end_date || null,
        is_active: form.is_active,
        thank_you: form.thank_you.trim() || null,
      };
      let id = survey?.id;
      if (id) {
        const { error } = await supabase.from('surveys').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('surveys').insert(row).select('id').single();
        if (error) throw error;
        id = data.id;
      }
      // Questions are replaced only while there are no answers (answers refer to question ids).
      if (!hasResponses) {
        await supabase.from('survey_questions').delete().eq('survey_id', id);
        const { error } = await supabase.from('survey_questions').insert(
          qs.map((q) => ({ survey_id: id, position: q.position, kind: q.kind, prompt: q.prompt, options: q.options, required: q.required })),
        );
        if (error) throw error;
      }
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
      <Text style={[TYPE.h3, { marginBottom: SPACE.lg }]}>{survey?.id ? 'Edit survey' : 'New survey'}</Text>
      <TextField label="Title" required value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="e.g. How satisfied are you with our customer care?" />
      <TextField label="Introduction" multiline value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} inputStyle={{ minHeight: 70 }} />
      <View style={{ flexDirection: 'row', gap: SPACE.lg, flexWrap: 'wrap', alignItems: 'center' }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={[TYPE.label, { marginBottom: 6 }]}>Closes on <Text style={TYPE.small}>(optional)</Text></Text>
          <DateTimeField mode="date" value={form.end_date} onChangeText={(v) => setForm((f) => ({ ...f, end_date: v }))} />
        </View>
        <View style={[styles.switchRow, { flex: 1, minWidth: 200 }]}>
          <Text style={[TYPE.label, { flex: 1 }]}>Open to the public</Text>
          <Switch value={form.is_active} onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
        </View>
      </View>
      <TextField label="Thank-you message" value={form.thank_you} onChangeText={(v) => setForm((f) => ({ ...f, thank_you: v }))} placeholder="Shown after someone submits" />

      <Text style={[TYPE.h3, { marginTop: SPACE.md, marginBottom: SPACE.sm }]}>Questions</Text>
      {hasResponses && (
        <Text style={[TYPE.small, { color: COLORS.warning, marginBottom: SPACE.md }]}>
          This survey already has answers, so its questions are locked. Create a new survey to ask different questions.
        </Text>
      )}
      {questions === null ? <Loading /> : questions.map((q, i) => (
        <View key={q.key} style={styles.question}>
          <View style={styles.qHead}>
            <Text style={TYPE.label}>Question {i + 1}</Text>
            {!hasResponses && (
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable onPress={() => move(i, -1)} style={styles.iconBtn} accessibilityLabel="Move up"><Ionicons name="arrow-up" size={16} color={COLORS.gray600} /></Pressable>
                <Pressable onPress={() => move(i, 1)} style={styles.iconBtn} accessibilityLabel="Move down"><Ionicons name="arrow-down" size={16} color={COLORS.gray600} /></Pressable>
                <Pressable onPress={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))} style={styles.iconBtn} accessibilityLabel="Remove question"><Ionicons name="trash-outline" size={16} color={COLORS.danger} /></Pressable>
              </View>
            )}
          </View>
          <TextField value={q.prompt} onChangeText={(v) => updateQ(q.key, { prompt: v })} placeholder="Question text" editable={!hasResponses} />
          <View style={{ flexDirection: 'row', gap: SPACE.lg, flexWrap: 'wrap', alignItems: 'center' }}>
            <Select style={{ flex: 1, minWidth: 180 }} value={q.kind} options={KINDS} onChange={(v) => updateQ(q.key, { kind: v })} disabled={hasResponses} />
            <View style={[styles.switchRow, { marginBottom: SPACE.lg }]}>
              <Text style={TYPE.small}>Required</Text>
              <Switch value={q.required} onValueChange={(v) => updateQ(q.key, { required: v })} disabled={hasResponses} />
            </View>
          </View>
          {['single', 'multi'].includes(q.kind) && (
            <TextField multiline label="Options (one per line)" value={q.optionsText || ''} onChangeText={(v) => updateQ(q.key, { optionsText: v })} inputStyle={{ minHeight: 80 }} editable={!hasResponses} />
          )}
        </View>
      ))}
      {!hasResponses && <Button title="Add question" icon="add" variant="secondary" size="sm" onPress={() => setQuestions((qs) => [...qs, newQuestion()])} />}

      <View style={styles.actions}>
        <Button title="Cancel" variant="ghost" onPress={onClose} />
        <Button title="Save survey" icon="checkmark" loading={saving} onPress={save} />
      </View>
    </View>
  );
}

function Results({ survey, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    Promise.all([
      supabase.from('survey_questions').select('*').eq('survey_id', survey.id).order('position'),
      supabase.from('survey_responses').select('answers, area, created_at').eq('survey_id', survey.id).order('created_at', { ascending: false }).limit(5000),
    ]).then(([q, r]) => setData({ questions: q.data || [], responses: r.data || [] }));
  }, [survey.id]);

  if (!data) return <Loading label="Loading results…" />;
  const { questions, responses } = data;

  const exportCsv = () => downloadCsv(
    `survey-${survey.title.replace(/\W+/g, '-').toLowerCase()}.csv`,
    responses,
    [
      { label: 'Submitted', value: (r) => new Date(r.created_at).toISOString() },
      { label: 'Area', key: 'area' },
      ...questions.map((q) => ({ label: q.prompt, value: (r) => r.answers?.[q.id] })),
    ],
  );

  return (
    <View style={{ gap: SPACE.lg }}>
      <View style={styles.qHead}>
        <View>
          <Text style={TYPE.h3}>{survey.title}</Text>
          <Text style={TYPE.small}>{responses.length} response{responses.length === 1 ? '' : 's'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Export CSV" icon="download-outline" size="sm" variant="secondary" onPress={exportCsv} disabled={!responses.length} />
          <Button title="Close" size="sm" variant="ghost" onPress={onClose} />
        </View>
      </View>
      {responses.length === 0 ? <EmptyState icon="bar-chart-outline" title="No responses yet" /> : questions.map((q, i) => {
        const vals = responses.map((r) => r.answers?.[q.id]).filter((v) => v !== undefined && v !== null && v !== '');
        let content;
        if (q.kind === 'rating') {
          const avg = vals.length ? vals.reduce((s, v) => s + Number(v), 0) / vals.length : 0;
          content = (
            <>
              <Text style={TYPE.body}>Average <Text style={{ fontWeight: '800' }}>{avg.toFixed(1)} / 5</Text> from {vals.length} answers</Text>
              <BarList rows={[5, 4, 3, 2, 1].map((n) => ({ label: `${n} star${n === 1 ? '' : 's'}`, value: vals.filter((v) => Number(v) === n).length }))} />
            </>
          );
        } else if (q.kind === 'single' || q.kind === 'multi') {
          const flat = vals.flat();
          content = <BarList rows={q.options.map((o) => ({ label: o, value: flat.filter((v) => v === o).length, note: vals.length ? `(${Math.round((flat.filter((v) => v === o).length / vals.length) * 100)}%)` : '' }))} />;
        } else {
          content = (
            <View style={{ gap: 6 }}>
              {vals.slice(0, 20).map((v, k) => <Text key={k} style={[TYPE.body, styles.quote]}>“{v}”</Text>)}
              {vals.length > 20 && <Text style={TYPE.small}>+ {vals.length - 20} more in the CSV export</Text>}
            </View>
          );
        }
        return (
          <Card key={q.id} style={{ gap: SPACE.md }}>
            <Text style={TYPE.label}>{i + 1}. {q.prompt}</Text>
            {content}
          </Card>
        );
      })}
    </View>
  );
}

export default function AdminSurveys() {
  const [surveys, setSurveys] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(() => {
    supabase.from('surveys').select('*, survey_questions(count), survey_responses(count)').order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) showAlert('Could not load surveys', error.message); setSurveys(data || []); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = (s) => showAlert(`Delete "${s.title}"?`, 'Its questions and all answers will be deleted.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      const { error } = await supabase.from('surveys').delete().eq('id', s.id);
      if (error) showAlert('Could not delete', error.message); else load();
    } },
  ]);

  if (viewing) return <Results survey={viewing} onClose={() => setViewing(null)} />;
  if (!surveys) return <Loading />;

  return (
    <View style={{ gap: SPACE.lg }}>
      <View style={styles.qHead}>
        <Text style={[TYPE.body, { color: COLORS.gray600, flex: 1 }]}>Create surveys, share them on the Surveys & polls page, and see the results here.</Text>
        <Button title="New survey" icon="add" onPress={() => setEditing({})} />
      </View>
      {surveys.length === 0 ? <Card><EmptyState icon="clipboard-outline" title="No surveys yet" message="Create your first survey to collect customers' views." /></Card> : surveys.map((s) => {
        const closed = !s.is_active || (s.end_date && s.end_date < new Date().toISOString().slice(0, 10));
        return (
          <Card key={s.id} style={{ gap: 6 }}>
            <View style={styles.qHead}>
              <Text style={[TYPE.h3, { flex: 1 }]}>{s.title}</Text>
              <Badge label={closed ? 'Closed' : 'Open'} tone={closed ? 'neutral' : 'success'} />
            </View>
            <Text style={TYPE.small}>
              {s.survey_questions?.[0]?.count || 0} questions · {s.survey_responses?.[0]?.count || 0} responses
              {s.end_date ? ` · closes ${new Date(s.end_date).toDateString()}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: SPACE.sm }}>
              <Button title="Results" icon="bar-chart-outline" size="sm" onPress={() => setViewing(s)} />
              <Button title="Edit" icon="create-outline" size="sm" variant="secondary" onPress={() => setEditing(s)} />
              <Button title="Delete" icon="trash-outline" size="sm" variant="ghost" onPress={() => remove(s)} />
            </View>
          </Card>
        );
      })}

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayInner}>
            <View style={[styles.modal, SHADOW.lg]}>
              {editing && <SurveyEditor survey={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  qHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  question: { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.md, backgroundColor: COLORS.gray50 },
  iconBtn: { padding: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray200 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: SPACE.xl },
  quote: { color: COLORS.gray700, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: COLORS.gray200 },
  overlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.45)' },
  overlayInner: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  modal: { width: '100%', maxWidth: 720, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl },
});
