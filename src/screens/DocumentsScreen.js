import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Linking, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PageHeader, Container, Card, Button, Badge, EmptyState, Loading, Select, useBreakpoint } from '../components/ui';
import Footer from '../components/Footer';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import { DOC_CATEGORIES, EXTERNAL_REPOSITORIES, fetchDocuments, fmtSize } from '../services/documents';
import { downloadZip, csvText } from '../utils/exportFile';

const fmtDay = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const CAT_ICON = { Law: 'hammer-outline', Regulation: 'reader-outline', Policy: 'document-text-outline', Guideline: 'map-outline', Decision: 'checkmark-done-outline', Report: 'bar-chart-outline', Tariff: 'cash-outline', Plan: 'calendar-outline', Other: 'document-outline' };

function DocCard({ d }) {
  const [open, setOpen] = useState(false);
  const latest = d.versions[0];
  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.top}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          <Badge label={d.category} icon={CAT_ICON[d.category]} tone="brand" />
          <Badge label={d.institution} icon="business-outline" />
          {d.current_version > 1 ? <Badge label={`Version ${d.current_version}`} icon="git-branch-outline" tone="info" /> : null}
        </View>
        {d.document_date ? <Text style={TYPE.small}>{fmtDay(d.document_date)}</Text> : null}
      </View>
      <Text style={TYPE.h3}>{d.title}</Text>
      {d.subject ? <Text style={[TYPE.small, { color: COLORS.gray700 }]}>Subject: {d.subject}</Text> : null}
      {d.summary ? <Text style={TYPE.body}>{d.summary}</Text> : null}
      <View style={styles.actions}>
        {latest ? (
          <Button title={`Open${latest.file_size ? ` (${fmtSize(latest.file_size)})` : ''}`} icon="download-outline" size="sm" onPress={() => Linking.openURL(latest.file_url)} />
        ) : <Text style={TYPE.small}>File coming soon</Text>}
        {d.versions.length > 1 && (
          <Button title={open ? 'Hide earlier versions' : `Earlier versions (${d.versions.length - 1})`} icon="time-outline" size="sm" variant="ghost" onPress={() => setOpen((v) => !v)} />
        )}
      </View>
      {latest ? <Text style={TYPE.small}>Last updated {fmtDay(latest.created_at)}{latest.notes ? ` — ${latest.notes}` : ''}</Text> : null}
      {open && d.versions.slice(1).map((v) => (
        <Pressable key={v.version} onPress={() => Linking.openURL(v.file_url)} style={styles.version} accessibilityRole="link">
          <Ionicons name="document-outline" size={16} color={COLORS.gray500} />
          <Text style={[TYPE.small, { flex: 1 }]}>Version {v.version} · {fmtDay(v.created_at)}{v.notes ? ` — ${v.notes}` : ''}</Text>
          <Ionicons name="open-outline" size={14} color={COLORS.primary} />
        </Pressable>
      ))}
    </Card>
  );
}

export default function DocumentsScreen() {
  const { isDesktop } = useBreakpoint();
  const [f, setF] = useState({ q: '', category: null, institution: null, subject: '', from: '', to: '' });
  const [docs, setDocs] = useState(null);
  const [institutions, setInstitutions] = useState([]);

  const load = useCallback(() => {
    setDocs(null);
    fetchDocuments(f).then(setDocs).catch(() => setDocs([]));
  }, [f]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => {
    fetchDocuments().then((all) => setInstitutions([...new Set(all.map((d) => d.institution))].sort())).catch(() => {});
  }, []);

  const exportList = () => downloadZip('nwsc-documents.zip', {
    'documents.csv': csvText(docs || [], [
      { label: 'Title', key: 'title' }, { label: 'Category', key: 'category' }, { label: 'Institution', key: 'institution' },
      { label: 'Subject', key: 'subject' }, { label: 'Date', key: 'document_date' }, { label: 'Version', key: 'current_version' },
      { label: 'Link', value: (d) => d.versions[0]?.file_url || '' }, { label: 'Summary', key: 'summary' },
    ]),
  });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <PageHeader overline="Transparency" title="Documents, policies and decisions"
        subtitle="Laws, regulations, policies, guidelines, board decisions, tariffs and reports — with every earlier version kept." icon="library-outline" />
      <Container style={{ marginTop: -24, gap: SPACE.xl }}>
        <Card elevated style={{ gap: SPACE.md }}>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={COLORS.gray400} />
            <TextInput style={styles.searchInput} value={f.q} onChangeText={set('q')} placeholder="Search by title, subject or institution" placeholderTextColor={COLORS.gray400} accessibilityLabel="Search documents" />
          </View>
          <View style={[styles.filters, !isDesktop && { flexDirection: 'column' }]}>
            <Select style={styles.filter} label="Category" value={f.category} onChange={set('category')} options={[{ value: null, label: 'All categories' }, ...DOC_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
            <Select style={styles.filter} label="Institution" value={f.institution} onChange={set('institution')} options={[{ value: null, label: 'All institutions' }, ...institutions.map((i) => ({ value: i, label: i }))]} />
            <View style={styles.filter}>
              <Text style={[TYPE.label, { marginBottom: 6 }]}>Subject</Text>
              <TextInput style={styles.input} value={f.subject} onChangeText={set('subject')} placeholder="e.g. tariffs" placeholderTextColor={COLORS.gray400} />
            </View>
            <View style={styles.filter}>
              <Text style={[TYPE.label, { marginBottom: 6 }]}>Dated from / to</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TextInput style={[styles.input, { flex: 1, width: undefined }]} value={f.from} onChangeText={set('from')} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.gray400} accessibilityLabel="From date" />
                <TextInput style={[styles.input, { flex: 1, width: undefined }]} value={f.to} onChangeText={set('to')} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.gray400} accessibilityLabel="To date" />
              </View>
            </View>
          </View>
        </Card>

        <View style={styles.top}>
          <Text style={TYPE.small}>{docs ? `${docs.length} document${docs.length === 1 ? '' : 's'}` : 'Searching…'}</Text>
          {docs?.length ? <Button title="Download list (ZIP)" icon="archive-outline" size="sm" variant="secondary" onPress={exportList} /> : null}
        </View>
        {docs === null ? <Loading /> : docs.length === 0 ? (
          <Card><EmptyState icon="library-outline" title="No documents found" message="Try other words or clear the filters. National laws and policies are also in the repositories below." /></Card>
        ) : docs.map((d) => <DocCard key={d.id} d={d} />)}

        <View style={{ gap: SPACE.md }}>
          <Text style={TYPE.h2}>National repositories</Text>
          <Text style={[TYPE.body, { color: COLORS.gray600 }]}>Laws, regulations and government policies are published centrally by these institutions.</Text>
          {EXTERNAL_REPOSITORIES.map((r) => (
            <Pressable key={r.url} onPress={() => Linking.openURL(r.url)} accessibilityRole="link" style={({ hovered }) => [styles.repo, hovered && { borderColor: COLORS.primaryLight }]}>
              <Ionicons name="globe-outline" size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={TYPE.label}>{r.name}</Text>
                <Text style={TYPE.small}>{r.desc}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={COLORS.gray400} />
            </Pressable>
          ))}
        </View>
      </Container>
      <View style={{ height: SPACE.xxl }} />
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 },
  version: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: 46, backgroundColor: COLORS.white },
  searchInput: { flex: 1, fontFamily: FONT, fontSize: 15, color: COLORS.gray900, paddingVertical: 10 },
  filters: { flexDirection: 'row', gap: SPACE.md, flexWrap: 'wrap' },
  filter: { flex: 1, minWidth: 180 },
  input: { fontFamily: FONT, fontSize: 14, color: COLORS.gray900, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: COLORS.white, minWidth: 0, width: '100%' },
  repo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACE.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
});
