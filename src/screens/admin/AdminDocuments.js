import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Switch, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Button, Badge, Select, TextField, Loading, EmptyState } from '../../components/ui';
import { COLORS, RADIUS, SHADOW, SPACE, TYPE } from '../../theme';
import { showAlert } from '../../utils/alert';
import { useAuth } from '../../context/AuthContext';
import { STAKEHOLDER_GROUPS, INTERESTS } from '../../services/announcements';
import {
  DOC_CATEGORIES, fetchDocuments, saveDocument, pickDocumentFile, addVersionFromFile, addVersionFromLink, fmtSize,
} from '../../services/documents';

function Editor({ initial, onClose, onSaved }) {
  const { user } = useAuth();
  const [d, setD] = useState({ category: 'Policy', institution: 'NWSC Jinja', is_published: true, audiences: [], notify_subscribers: true, ...initial });
  const toggleAudience = (g) => setD((x) => ({ ...x, audiences: (x.audiences || []).includes(g) ? x.audiences.filter((y) => y !== g) : [...(x.audiences || []), g] }));
  const [file, setFile] = useState(null);
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!d.title?.trim() || d.title.trim().length < 3) return showAlert('Title needed', 'Give the document a clear title.');
    if (d.document_date && !/^\d{4}-\d{2}-\d{2}$/.test(d.document_date)) return showAlert('Check the date', 'Use the format YYYY-MM-DD.');
    if (link && !/^https:\/\//.test(link.trim())) return showAlert('Check the link', 'Links must start with https://');
    setBusy(true);
    try {
      const id = await saveDocument(d, user.id);
      if (file) await addVersionFromFile(id, file, notes || (initial?.id ? 'Revised' : 'First published'));
      else if (link.trim()) await addVersionFromLink(id, link.trim(), null, null, notes || (initial?.id ? 'Revised' : 'First published'));
      onSaved();
      onClose();
    } catch (e) {
      showAlert('Could not save', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={[TYPE.h3, { marginBottom: SPACE.lg }]}>{initial?.id ? 'Edit document' : 'Publish a document'}</Text>
      <TextField label="Title" required value={d.title || ''} onChangeText={set('title')} />
      <View style={styles.row}>
        <Select style={{ flex: 1 }} label="Category" value={d.category} onChange={set('category')} options={DOC_CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <TextField style={{ flex: 1 }} label="Institution" value={d.institution || ''} onChangeText={set('institution')} />
      </View>
      <View style={styles.row}>
        <TextField style={{ flex: 1 }} label="Subject" value={d.subject || ''} onChangeText={set('subject')} placeholder="e.g. Water tariffs" />
        <TextField style={{ flex: 1 }} label="Document date" value={d.document_date || ''} onChangeText={set('document_date')} placeholder="YYYY-MM-DD" />
      </View>
      <TextField label="Summary" multiline value={d.summary || ''} onChangeText={set('summary')} placeholder="What it is and who it affects, in plain language." />

      <View style={styles.box}>
        <Text style={TYPE.label}>Who should hear about it</Text>
        <Select label="Topic" value={d.topic || null} onChange={set('topic')}
          options={[{ value: null, label: 'Any topic (everyone who wants policy updates)' }, ...INTERESTS.map((i) => ({ value: i, label: i }))]} />
        <Text style={[TYPE.small, { marginBottom: 6 }]}>Customer groups (none selected = all)</Text>
        <View style={styles.row}>
          {STAKEHOLDER_GROUPS.map((g) => {
            const on = (d.audiences || []).includes(g.value);
            return (
              <Pressable key={g.value} onPress={() => toggleAudience(g.value)} style={[styles.pill, on && styles.pillOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <Text style={[TYPE.small, { fontWeight: '600', color: on ? COLORS.primary : COLORS.gray700 }]}>{g.value}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={TYPE.label}>Notify matching subscribers</Text>
            <Text style={TYPE.small}>By SMS and email when it is published, and again for each new version.</Text>
          </View>
          <Switch value={d.notify_subscribers !== false} onValueChange={set('notify_subscribers')} />
        </View>
      </View>

      <View style={styles.box}>
        <Text style={TYPE.label}>{initial?.id ? `Upload a new version (now version ${initial.current_version || 0})` : 'File'}</Text>
        <Text style={TYPE.small}>PDF, Word, Excel, PowerPoint, CSV, ZIP or image, up to 25 MB. Earlier versions stay available to the public.</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button title={file ? 'Choose another file' : 'Choose file'} icon="attach-outline" size="sm" variant="secondary"
            onPress={async () => { try { const f = await pickDocumentFile(); if (f) { setFile(f); setLink(''); } } catch (e) { showAlert('Could not open file', e.message); } }} />
          {file ? <Text style={TYPE.small}>{file.name} {fmtSize(file.size)}</Text> : null}
        </View>
        <TextField label="…or link to where it is published" value={link} onChangeText={(v) => { setLink(v); if (v) setFile(null); }} placeholder="https://ulii.org/…" autoCapitalize="none" />
        <TextField label="What changed in this version" value={notes} onChangeText={setNotes} placeholder="e.g. Revised tariff schedule for 2027" />
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={TYPE.label}>Published</Text>
          <Text style={TYPE.small}>Turn off to keep a draft private.</Text>
        </View>
        <Switch value={d.is_published !== false} onValueChange={set('is_published')} />
      </View>
      <View style={styles.actions}>
        <Button title="Cancel" variant="ghost" onPress={onClose} />
        <Button title="Save" icon="checkmark" loading={busy} onPress={save} />
      </View>
    </View>
  );
}

/** Admin/HR: publish documents and upload revised versions. */
export default function AdminDocuments() {
  const [docs, setDocs] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => { fetchDocuments().then(setDocs).catch((e) => { setDocs([]); showAlert('Could not load', e.message); }); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ gap: SPACE.lg }}>
      <View style={styles.rowBetween}>
        <Text style={[TYPE.small, { flex: 1 }]}>Everything here appears on the public "Documents" page. Uploading a revision keeps the earlier versions.</Text>
        <Button title="Publish a document" icon="add" onPress={() => setEditing({})} />
      </View>
      {docs === null ? <Loading /> : docs.length === 0 ? (
        <Card><EmptyState icon="library-outline" title="No documents yet" message="Publish policies, decisions, tariffs and reports so the public can find them." /></Card>
      ) : (
        <Card padded={false}>
          {docs.map((d, i) => (
            <Pressable key={d.id} onPress={() => setEditing(d)} style={({ hovered }) => [styles.item, i > 0 && styles.border, hovered && { backgroundColor: COLORS.gray50 }]}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={TYPE.label}>{d.title}</Text>
                <Text style={TYPE.small}>{d.category} · {d.institution}{d.document_date ? ` · ${d.document_date}` : ''} · {d.current_version ? `version ${d.current_version}` : 'no file yet'}</Text>
              </View>
              {!d.is_published && <Badge label="Draft" />}
              {d.versions[0] ? (
                <Pressable onPress={() => Linking.openURL(d.versions[0].file_url)} accessibilityRole="link" accessibilityLabel="Open file">
                  <Ionicons name="open-outline" size={18} color={COLORS.gray500} />
                </Pressable>
              ) : null}
              <Ionicons name="create-outline" size={18} color={COLORS.gray400} />
            </Pressable>
          ))}
        </Card>
      )}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayInner}>
            <View style={[styles.modal, SHADOW.lg]}>
              {editing && <Editor initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACE.md, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  pillOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, flexWrap: 'wrap' },
  box: { padding: SPACE.md, borderRadius: RADIUS.md, backgroundColor: COLORS.gray50, gap: 8, marginBottom: SPACE.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: SPACE.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: SPACE.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACE.lg, paddingVertical: 12 },
  border: { borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  overlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.45)' },
  overlayInner: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  modal: { width: '100%', maxWidth: 640, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl },
});
