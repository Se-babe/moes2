import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import * as DocumentPicker from 'expo-document-picker';
import { ADMIN_COLORS as COLORS } from './adminTheme';

const CATEGORIES = ['Policies', 'Circulars', 'Reports', 'Publications', 'Training', 'Admissions (JAB)', 'Examination Timetables (UNEB)'];

const emptyForm = () => ({ title: '', description: '', category: CATEGORIES[0], file_url: '', file_name: '' });

export default function AdminResources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    setLoading(true);
    const { data } = await supabase.from('resources').select('*').order('created_at', { ascending: false });
    if (data) setResources(data);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingItem(null);
    setForm(emptyForm());
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      title: item.title || '',
      description: item.description || '',
      category: item.category || CATEGORIES[0],
      file_url: item.file_url || '',
      file_name: item.file_url ? item.file_url.split('/').pop() : '',
    });
    setModalVisible(true);
  };

  const pickAndUploadFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const blob = await fetch(asset.uri).then((r) => r.blob());
      const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from('resources').upload(fileName, blob, {
        contentType: asset.mimeType || 'application/octet-stream',
      });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('resources').getPublicUrl(fileName);
      setForm((prev) => ({ ...prev, file_url: publicUrl, file_name: asset.name }));
      showAlert('Success', 'File uploaded successfully.');
    } catch (error) {
      showAlert('Upload Failed', error.message);
    } finally {
      setUploading(false);
    }
  };

  const saveResource = async () => {
    if (!form.title.trim()) {
      showAlert('Error', 'Title is required.');
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      file_url: form.file_url.trim() || null,
    };
    try {
      const { error } = editingItem
        ? await supabase.from('resources').update(payload).eq('id', editingItem.id)
        : await supabase.from('resources').insert([payload]);
      if (error) throw error;
      setModalVisible(false);
      setForm(emptyForm());
      setEditingItem(null);
      fetchResources();
    } catch (error) {
      showAlert('Error', error.message);
    }
  };

  const deleteResource = (id) => {
    showAlert('Delete Resource', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('resources').delete().eq('id', id);
          if (error) showAlert('Error', error.message);
          else fetchResources();
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.listItem}>
      <View style={styles.fileIcon}>
        <Ionicons name="document-text-outline" size={24} color={COLORS.info} />
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <View style={styles.metaRow}>
          {item.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          ) : null}
          <Text style={styles.fileStatus}>{item.file_url ? 'File attached' : 'No file attached'}</Text>
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
          <Ionicons name="pencil-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteResource(item.id)}>
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Resources ({resources.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add-circle" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {resources.length === 0 ? (
        <Text style={styles.emptyText}>Nothing here yet — tap + to upload a circular, policy, or report.</Text>
      ) : (
        <FlatList data={resources} renderItem={renderItem} keyExtractor={(item) => item.id} scrollEnabled={false} />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit Resource' : 'Add Resource'}</Text>

            <View style={styles.uploadSection}>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickAndUploadFile} disabled={uploading}>
                <Ionicons name="cloud-upload-outline" size={24} color={COLORS.primary} />
                <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : 'Choose File (PDF, DOCX, etc.)'}</Text>
              </TouchableOpacity>
              {form.file_name ? (
                <View style={styles.previewRow}>
                  <Ionicons name="document-attach-outline" size={18} color={COLORS.textMuted} />
                  <Text style={styles.previewText} numberOfLines={1}>{form.file_name}</Text>
                </View>
              ) : null}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Title *"
              placeholderTextColor={COLORS.textDim}
              value={form.title}
              onChangeText={(text) => setForm({ ...form, title: text })}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              placeholderTextColor={COLORS.textDim}
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
              multiline
            />
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.selectRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.selectChip, form.category === cat && styles.selectChipActive]}
                  onPress={() => setForm({ ...form, category: cat })}
                >
                  <Text style={[styles.selectChipText, form.category === cat && styles.selectChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => { setModalVisible(false); setEditingItem(null); setForm(emptyForm()); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={saveResource}>
                <Text style={styles.submitBtnText}>{editingItem ? 'Update' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  addBtn: { padding: 2 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, paddingVertical: 8 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fileIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  categoryBadge: { backgroundColor: COLORS.infoSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  categoryText: { fontSize: 11, color: COLORS.info, fontWeight: '600' },
  fileStatus: { fontSize: 12, color: COLORS.textDim },
  itemActions: { flexDirection: 'row' },
  editBtn: { padding: 4, marginRight: 8 },
  deleteBtn: { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, width: '90%', maxHeight: '85%', borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surfaceAlt },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6 },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  selectChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  selectChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  selectChipText: { fontSize: 13, color: COLORS.textMuted },
  selectChipTextActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginLeft: 8 },
  cancelBtn: { backgroundColor: COLORS.surfaceAlt },
  cancelBtnText: { color: COLORS.textMuted },
  submitBtn: { backgroundColor: COLORS.primary },
  submitBtnText: { color: '#fff', fontWeight: '600' },
  uploadSection: { marginBottom: 12 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  uploadBtnText: { marginLeft: 8, fontSize: 15, color: COLORS.primary, fontWeight: '500' },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  previewText: { fontSize: 14, color: COLORS.textMuted, flex: 1 },
});
