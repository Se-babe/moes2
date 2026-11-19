import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal, Image, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../services/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { ADMIN_COLORS as COLORS } from './adminTheme';

const emptyItemForm = () => ({ title: '', description: '', media_type: null, media_url: '', display_order: 0 });

export default function AdminMediaGallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItemForm());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase.from('media_gallery').select('*').order('display_order', { ascending: true });
    if (data) setItems(data);
    setLoading(false);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setItemForm(emptyItemForm());
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setItemForm({
      title: item.title || '',
      description: item.description || '',
      media_type: item.media_type,
      media_url: item.media_url || '',
      display_order: item.display_order || 0,
    });
    setModalVisible(true);
  };

  const pickAndUploadMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Needed', 'Please grant media library permissions to upload.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.7,
      videoMaxDuration: 120,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mediaType = asset.type === 'video' ? 'video' : 'image';
    setUploading(true);
    try {
      const blob = await fetch(asset.uri).then((r) => r.blob());
      const fileExt = asset.uri.split('.').pop().split('?')[0] || (mediaType === 'video' ? 'mp4' : 'jpg');
      const fileName = `${mediaType}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('media_gallery').upload(fileName, blob, {
        contentType: mediaType === 'video' ? `video/${fileExt}` : `image/${fileExt}`,
      });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('media_gallery').getPublicUrl(fileName);
      setItemForm((prev) => ({ ...prev, media_url: publicUrl, media_type: mediaType }));
      showAlert('Success', `${mediaType === 'video' ? 'Video' : 'Image'} uploaded successfully.`);
    } catch (error) {
      showAlert('Upload Failed', error.message);
    } finally {
      setUploading(false);
    }
  };

  const saveItem = async () => {
    if (!itemForm.media_url.trim() || !itemForm.media_type) {
      showAlert('Error', 'Please upload a photo or video first.');
      return;
    }
    const payload = {
      title: itemForm.title.trim(),
      description: itemForm.description.trim(),
      media_type: itemForm.media_type,
      media_url: itemForm.media_url.trim(),
      display_order: parseInt(itemForm.display_order) || 0,
    };
    try {
      const { error } = editingItem
        ? await supabase.from('media_gallery').update(payload).eq('id', editingItem.id)
        : await supabase.from('media_gallery').insert([payload]);
      if (error) throw error;
      setModalVisible(false);
      setItemForm(emptyItemForm());
      setEditingItem(null);
      fetchItems();
    } catch (error) {
      showAlert('Error', error.message);
    }
  };

  const deleteItem = (id) => {
    showAlert('Delete Media', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('media_gallery').delete().eq('id', id);
          if (error) showAlert('Error', error.message);
          else fetchItems();
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.listItem}>
      {item.media_type === 'video' ? (
        <View style={styles.videoThumbnail}>
          <Ionicons name="videocam" size={24} color={COLORS.textMuted} />
        </View>
      ) : (
        <Image source={{ uri: item.media_url }} style={styles.thumbnail} />
      )}
      <View style={styles.itemInfo}>
        <View style={styles.typeRow}>
          <Ionicons name={item.media_type === 'video' ? 'videocam-outline' : 'image-outline'} size={13} color={COLORS.info} />
          <Text style={styles.typeText}>{item.media_type === 'video' ? 'Video' : 'Image'}</Text>
        </View>
        <Text style={styles.itemTitle}>{item.title || 'Untitled'}</Text>
        <Text style={styles.itemOrder}>Order: {item.display_order}</Text>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
          <Ionicons name="pencil-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteItem(item.id)}>
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
        <Text style={styles.heading}>Media Gallery ({items.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Ionicons name="add-circle" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>Nothing here yet — tap + to upload a photo or short video.</Text>
      ) : (
        <FlatList data={items} renderItem={renderItem} keyExtractor={(item) => item.id} scrollEnabled={false} />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit Media' : 'Add Media'}</Text>
            <View style={styles.uploadSection}>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickAndUploadMedia} disabled={uploading}>
                <Ionicons name="cloud-upload-outline" size={24} color={COLORS.primary} />
                <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : 'Choose Photo or Video'}</Text>
              </TouchableOpacity>
              {itemForm.media_url ? (
                <View style={styles.previewRow}>
                  {itemForm.media_type === 'video' ? (
                    <View style={styles.previewVideoBox}>
                      <Ionicons name="videocam" size={20} color={COLORS.textMuted} />
                    </View>
                  ) : (
                    <Image source={{ uri: itemForm.media_url }} style={styles.previewImage} />
                  )}
                  <Text style={styles.previewText}>{itemForm.media_type === 'video' ? 'Video' : 'Image'} selected</Text>
                </View>
              ) : null}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor={COLORS.textDim}
              value={itemForm.title}
              onChangeText={(text) => setItemForm({ ...itemForm, title: text })}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              placeholderTextColor={COLORS.textDim}
              value={itemForm.description}
              onChangeText={(text) => setItemForm({ ...itemForm, description: text })}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder="Display Order (number, lower = first)"
              placeholderTextColor={COLORS.textDim}
              value={String(itemForm.display_order)}
              onChangeText={(text) => setItemForm({ ...itemForm, display_order: parseInt(text) || 0 })}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setModalVisible(false);
                  setEditingItem(null);
                  setItemForm(emptyItemForm());
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={saveItem}>
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
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  thumbnail: { width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: COLORS.surfaceAlt },
  videoThumbnail: { width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  typeText: { fontSize: 11, color: COLORS.info, fontWeight: '600' },
  itemTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  itemOrder: { fontSize: 12, color: COLORS.textDim, marginTop: 2 },
  itemActions: { flexDirection: 'row' },
  editBtn: { padding: 4, marginRight: 8 },
  deleteBtn: { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, width: '90%', maxHeight: '85%', borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surfaceAlt },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
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
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  previewImage: { width: 50, height: 50, borderRadius: 8, marginRight: 8 },
  previewVideoBox: { width: 50, height: 50, borderRadius: 8, marginRight: 8, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  previewText: { fontSize: 14, color: COLORS.textMuted },
});
