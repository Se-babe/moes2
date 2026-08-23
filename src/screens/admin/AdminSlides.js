import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal, Image, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { ADMIN_COLORS as COLORS } from './adminTheme';

export default function AdminSlides() {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSlide, setEditingSlide] = useState(null);
  const [slideForm, setSlideForm] = useState({ image_url: '', title: '', subtitle: '', quote: '', display_order: 0 });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    setLoading(true);
    const { data } = await supabase.from('slides').select('*').order('display_order', { ascending: true });
    if (data) setSlides(data);
    setLoading(false);
  };

  const openAddSlideModal = () => {
    setEditingSlide(null);
    setSlideForm({ image_url: '', title: '', subtitle: '', quote: '', display_order: 0 });
    setModalVisible(true);
  };

  const openEditSlideModal = (slide) => {
    setEditingSlide(slide);
    setSlideForm({
      image_url: slide.image_url || '',
      title: slide.title || '',
      subtitle: slide.subtitle || '',
      quote: slide.quote || '',
      display_order: slide.display_order || 0,
    });
    setModalVisible(true);
  };

  const pickAndUploadImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Needed', 'Please grant camera roll permissions to upload images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const blob = await fetch(asset.uri).then((r) => r.blob());
      const fileExt = asset.uri.split('.').pop() || 'jpg';
      const fileName = `slide_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('slides').upload(fileName, blob, { contentType: `image/${fileExt}` });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('slides').getPublicUrl(fileName);
      setSlideForm({ ...slideForm, image_url: publicUrl });
      showAlert('Success', 'Image uploaded successfully.');
    } catch (error) {
      showAlert('Upload Failed', error.message);
    } finally {
      setUploading(false);
    }
  };

  const saveSlide = async () => {
    if (!slideForm.image_url.trim()) {
      showAlert('Error', 'Image URL is required. Please upload an image or enter a URL.');
      return;
    }
    const payload = {
      image_url: slideForm.image_url.trim(),
      title: slideForm.title.trim(),
      subtitle: slideForm.subtitle.trim(),
      quote: slideForm.quote.trim(),
      display_order: parseInt(slideForm.display_order) || 0,
    };
    try {
      const { error } = editingSlide
        ? await supabase.from('slides').update(payload).eq('id', editingSlide.id)
        : await supabase.from('slides').insert([{ ...payload, active: true }]);
      if (error) throw error;
      setModalVisible(false);
      setSlideForm({ image_url: '', title: '', subtitle: '', quote: '', display_order: 0 });
      setEditingSlide(null);
      fetchSlides();
    } catch (error) {
      showAlert('Error', error.message);
    }
  };

  const deleteSlide = (id) => {
    showAlert('Delete Slide', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('slides').delete().eq('id', id);
          if (error) showAlert('Error', error.message);
          else fetchSlides();
        },
      },
    ]);
  };

  const renderSlideItem = ({ item }) => (
    <View style={styles.listItem}>
      <Image source={{ uri: item.image_url }} style={styles.slideThumbnail} />
      <View style={styles.slideInfo}>
        <Text style={styles.slideTitle}>{item.title || 'Untitled'}</Text>
        <Text style={styles.slideSub}>{item.subtitle}</Text>
        <Text style={styles.slideOrder}>Order: {item.display_order}</Text>
      </View>
      <View style={styles.slideActions}>
        <TouchableOpacity style={styles.editSlideBtn} onPress={() => openEditSlideModal(item)}>
          <Ionicons name="pencil-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteSlide(item.id)}>
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
        <Text style={styles.heading}>Slides / Carousel ({slides.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddSlideModal}>
          <Ionicons name="add-circle" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      <FlatList data={slides} renderItem={renderSlideItem} keyExtractor={(item) => item.id} scrollEnabled={false} />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingSlide ? 'Edit Slide' : 'Add New Slide'}</Text>
            <View style={styles.imageUploadSection}>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickAndUploadImage} disabled={uploading}>
                <Ionicons name="cloud-upload-outline" size={24} color={COLORS.primary} />
                <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : 'Choose Image from Device'}</Text>
              </TouchableOpacity>
              {slideForm.image_url ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: slideForm.image_url }} style={styles.previewImage} />
                  <Text style={styles.previewText}>Image selected</Text>
                </View>
              ) : null}
            </View>
            <TextInput style={styles.input} placeholder="Image URL * (or upload above)" placeholderTextColor={COLORS.textDim} value={slideForm.image_url} onChangeText={(text) => setSlideForm({ ...slideForm, image_url: text })} />
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor={COLORS.textDim} value={slideForm.title} onChangeText={(text) => setSlideForm({ ...slideForm, title: text })} />
            <TextInput style={styles.input} placeholder="Subtitle" placeholderTextColor={COLORS.textDim} value={slideForm.subtitle} onChangeText={(text) => setSlideForm({ ...slideForm, subtitle: text })} />
            <TextInput style={styles.input} placeholder="Quote" placeholderTextColor={COLORS.textDim} value={slideForm.quote} onChangeText={(text) => setSlideForm({ ...slideForm, quote: text })} />
            <TextInput
              style={styles.input}
              placeholder="Display Order (number, lower = first)"
              placeholderTextColor={COLORS.textDim}
              value={String(slideForm.display_order)}
              onChangeText={(text) => setSlideForm({ ...slideForm, display_order: parseInt(text) || 0 })}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setModalVisible(false);
                  setEditingSlide(null);
                  setSlideForm({ image_url: '', title: '', subtitle: '', quote: '', display_order: 0 });
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={saveSlide}>
                <Text style={styles.submitBtnText}>{editingSlide ? 'Update' : 'Add'}</Text>
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
  slideThumbnail: { width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: COLORS.surfaceAlt },
  slideInfo: { flex: 1 },
  slideTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  slideSub: { fontSize: 14, color: COLORS.textMuted },
  slideOrder: { fontSize: 12, color: COLORS.textDim, marginTop: 4 },
  slideActions: { flexDirection: 'row' },
  editSlideBtn: { padding: 4, marginRight: 8 },
  deleteBtn: { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, width: '90%', maxHeight: '85%', borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surfaceAlt },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginLeft: 8 },
  cancelBtn: { backgroundColor: COLORS.surfaceAlt },
  cancelBtnText: { color: COLORS.textMuted },
  submitBtn: { backgroundColor: COLORS.primary },
  submitBtnText: { color: '#fff', fontWeight: '600' },
  imageUploadSection: { marginBottom: 12 },
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
  previewContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  previewImage: { width: 50, height: 50, borderRadius: 8, marginRight: 8 },
  previewText: { fontSize: 14, color: COLORS.textMuted },
});
