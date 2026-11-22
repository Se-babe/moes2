import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabaseClient';

export const DOC_CATEGORIES = ['Law', 'Regulation', 'Policy', 'Guideline', 'Decision', 'Report', 'Tariff', 'Plan', 'Other'];

// National repositories the library links to.
export const EXTERNAL_REPOSITORIES = [
  { name: 'Uganda Legal Information Institute (ULII)', desc: 'Acts of Parliament, statutory instruments and court decisions', url: 'https://ulii.org' },
  { name: 'Parliament of Uganda', desc: 'Bills, Acts and Hansard', url: 'https://www.parliament.go.ug' },
  { name: 'Ministry of Water and Environment', desc: 'National water policies, strategies and guidelines', url: 'https://www.mwe.go.ug' },
  { name: 'National Water and Sewerage Corporation', desc: 'Corporate publications, tariffs and reports', url: 'https://www.nwsc.co.ug' },
];

/** Published documents matching a search and filters. */
export async function fetchDocuments({ q, category, institution, subject, from, to } = {}) {
  let query = supabase.from('documents')
    .select('id, title, category, institution, subject, summary, document_date, current_version, is_published, updated_at, topic, audiences, notify_subscribers, document_versions(version, file_url, file_name, file_size, notes, created_at, uploaded_by_name)')
    .order('document_date', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(300);
  if (category) query = query.eq('category', category);
  if (institution) query = query.eq('institution', institution);
  if (subject) query = query.ilike('subject', `%${subject}%`);
  if (from) query = query.gte('document_date', from);
  if (to) query = query.lte('document_date', to);
  if (q?.trim()) {
    const t = q.trim().replace(/[%,()]/g, ' ');
    query = query.or(`title.ilike.%${t}%,subject.ilike.%${t}%,summary.ilike.%${t}%,institution.ilike.%${t}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((d) => ({ ...d, versions: (d.document_versions || []).sort((a, b) => b.version - a.version) }));
}

export async function saveDocument(doc, userId) {
  const row = {
    title: doc.title.trim(), category: doc.category, institution: doc.institution?.trim() || 'NWSC Jinja',
    subject: doc.subject?.trim() || null, summary: doc.summary?.trim() || null,
    document_date: doc.document_date || null, is_published: doc.is_published !== false, updated_at: new Date().toISOString(),
    topic: doc.topic || null, audiences: doc.audiences || [], notify_subscribers: doc.notify_subscribers !== false,
  };
  const res = doc.id
    ? await supabase.from('documents').update(row).eq('id', doc.id).select('id').single()
    : await supabase.from('documents').insert({ ...row, created_by: userId }).select('id').single();
  if (res.error) throw res.error;
  return res.data.id;
}

export async function pickDocumentFile() {
  const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.length) return null;
  return r.assets[0];
}

/** Upload a file as the next version (earlier versions are kept). */
export async function addVersionFromFile(documentId, asset, notes) {
  if (asset.size && asset.size > 25 * 1024 * 1024) throw new Error('Files must be 25 MB or smaller.');
  const blob = Platform.OS === 'web' && asset.file ? asset.file : await fetch(asset.uri).then((r) => r.blob());
  const safe = (asset.name || 'document').replace(/[^\w.\-]+/g, '_');
  const path = `${documentId}/${Date.now()}-${safe}`;
  const up = await supabase.storage.from('documents').upload(path, blob, { contentType: asset.mimeType || blob.type || 'application/octet-stream', cacheControl: '31536000' });
  if (up.error) throw up.error;
  const url = supabase.storage.from('documents').getPublicUrl(path).data.publicUrl;
  return addVersionFromLink(documentId, url, asset.name, asset.size || blob.size, notes);
}

/** A version that lives elsewhere (e.g. on ULII or the NWSC website). */
export async function addVersionFromLink(documentId, url, name, size, notes) {
  const { data, error } = await supabase.rpc('add_document_version', { p_document: documentId, p_url: url, p_name: name || null, p_size: size || null, p_notes: notes || null });
  if (error) throw error;
  return data;
}

export const fmtSize = (b) => (!b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
