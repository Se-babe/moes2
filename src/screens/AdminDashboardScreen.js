import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';

const COLORS = {
  primary: '#1E3A8A',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  success: '#22C55E',
  danger: '#EF4444',
};

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const { signOut } = useAuth();
  const [socialLinks, setSocialLinks] = useState([]);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSlide, setEditingSlide] = useState(null);
  const [slideForm, setSlideForm] = useState({
    image_url: '',
    title: '',
    subtitle: '',
    quote: '',
    display_order: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [editingLink, setEditingLink] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [socialRes, slidesRes] = await Promise.all([
        supabase.from('social_links').select('*').order('display_order', { ascending: true }),
        supabase.from('slides').select('*').order('display_order', { ascending: true }),
      ]);
      if (socialRes.data) setSocialLinks(socialRes.data);
      if (slidesRes.data) setSlides(slidesRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ----- Social Links -----
  const toggleSocialLink = async (id, enabled) => {
    const { error } = await supabase
      .from('social_links')
      .update({ enabled: !enabled })
      .eq('id', id);
    if (error) Alert.alert('Error', error.message);
    else fetchData();
  };

  const updateSocialLink = async (id, updates) => {
    const { error } = await supabase
      .from('social_links')
      .update(updates)
      .eq('id', id);
    if (error) Alert.alert('Error', error.message);
    else {
      fetchData();
      setEditingLink(null);
    }
  };

  // ----- Slides -----
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

  // ----- Image Picker & Upload -----
  const pickAndUploadImage = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please grant camera roll permissions to upload images.');
      return;
    }

    // Open image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setUploading(true);

    try {
      // Convert to blob
      const blob = await fetch(asset.uri).then(r => r.blob());
      const fileExt = asset.uri.split('.').pop() || 'jpg';
      const fileName = `slide_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('slides')
        .upload(fileName, blob, { contentType: `image/${fileExt}` });

      if (error) throw error;

      // Get public URL
      const { publicURL } = supabase.storage
        .from('slides')
        .getPublicUrl(fileName);

      // Update form with the image URL
      setSlideForm({ ...slideForm, image_url: publicURL });
      Alert.alert('Success', 'Image uploaded successfully.');
    } catch (error) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setUploading(false);
    }
  };

  const saveSlide = async () => {
    if (!slideForm.image_url.trim()) {
      Alert.alert('Error', 'Image URL is required. Please upload an image or enter a URL.');
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
      let error;
      if (editingSlide) {
        const { error: updateError } = await supabase
          .from('slides')
          .update(payload)
          .eq('id', editingSlide.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('slides')
          .insert([{ ...payload, active: true }]);
        error = insertError;
      }

      if (error) throw error;

      setModalVisible(false);
      setSlideForm({ image_url: '', title: '', subtitle: '', quote: '', display_order: 0 });
      setEditingSlide(null);
      fetchData();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const deleteSlide = async (id) => {
    Alert.alert('Delete Slide', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('slides').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else fetchData();
        },
      },
    ]);
  };

  // ----- Render -----
  const renderSocialItem = ({ item }) => (
    <View style={styles.listItem}>
      <View style={styles.socialRow}>
        <Ionicons name={item.icon_name} size={24} color={item.color} />
        <Text style={styles.socialName}>{item.name}</Text>
        <Switch
          value={item.enabled}
          onValueChange={() => toggleSocialLink(item.id, item.enabled)}
          trackColor={{ false: COLORS.gray200, true: COLORS.primary }}
        />
      </View>
      <TouchableOpacity style={styles.editBtn} onPress={() => setEditingLink(item)}>
        <Text style={styles.editBtnText}>Edit</Text>
      </TouchableOpacity>
      {editingLink && editingLink.id === item.id && (
        <View style={styles.editForm}>
          <TextInput
            style={styles.inputSmall}
            placeholder="URL"
            value={editingLink.url}
            onChangeText={(text) => setEditingLink({ ...editingLink, url: text })}
          />
          <TextInput
            style={styles.inputSmall}
            placeholder="Icon name"
            value={editingLink.icon_name}
            onChangeText={(text) => setEditingLink({ ...editingLink, icon_name: text })}
          />
          <TextInput
            style={styles.inputSmall}
            placeholder="Color (hex)"
            value={editingLink.color}
            onChangeText={(text) => setEditingLink({ ...editingLink, color: text })}
          />
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => updateSocialLink(item.id, { url: editingLink.url, icon_name: editingLink.icon_name, color: editingLink.color })}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderSlideItem = ({ item }) => (
    <View style={styles.listItem}>
      <Image source={{ uri: item.image_url }} style={styles.slideThumbnail} />
      <View style={styles.slideInfo}>
        <Text style={styles.slideTitle}>{item.title || 'Untitled'}</Text>
        <Text style={styles.slideSub}>{item.subtitle}</Text>
        <Text style={styles.slideQuote}>{item.quote}</Text>
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Social Links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Social Links</Text>
        <FlatList
          data={socialLinks}
          renderItem={renderSocialItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      </View>

      {/* Slides Management */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Slides (Carousel)</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAddSlideModal}>
            <Ionicons name="add-circle" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={slides}
          renderItem={renderSlideItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      </View>

      {/* Slide Modal (Add / Edit) */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingSlide ? 'Edit Slide' : 'Add New Slide'}
            </Text>

            {/* Image Upload Section */}
            <View style={styles.imageUploadSection}>
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={pickAndUploadImage}
                disabled={uploading}
              >
                <Ionicons name="cloud-upload-outline" size={24} color={COLORS.primary} />
                <Text style={styles.uploadBtnText}>
                  {uploading ? 'Uploading...' : 'Choose Image from Device'}
                </Text>
              </TouchableOpacity>
              {slideForm.image_url ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: slideForm.image_url }} style={styles.previewImage} />
                  <Text style={styles.previewText}>Image selected</Text>
                </View>
              ) : null}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Image URL * (or upload above)"
              value={slideForm.image_url}
              onChangeText={(text) => setSlideForm({ ...slideForm, image_url: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Title"
              value={slideForm.title}
              onChangeText={(text) => setSlideForm({ ...slideForm, title: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Subtitle"
              value={slideForm.subtitle}
              onChangeText={(text) => setSlideForm({ ...slideForm, subtitle: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Quote"
              value={slideForm.quote}
              onChangeText={(text) => setSlideForm({ ...slideForm, quote: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Display Order (number, lower = first)"
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center' },
  logoutText: { color: COLORS.danger, marginLeft: 4 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray800, marginBottom: 8 },
  addBtn: { padding: 4 },
  listItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  slideThumbnail: { width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: COLORS.gray100 },
  slideInfo: { flex: 1 },
  slideTitle: { fontSize: 16, fontWeight: '600', color: COLORS.gray800 },
  slideSub: { fontSize: 14, color: COLORS.gray600 },
  slideQuote: { fontSize: 13, color: COLORS.gray500, fontStyle: 'italic' },
  slideOrder: { fontSize: 12, color: COLORS.gray500, marginTop: 4 },
  slideActions: { flexDirection: 'row' },
  editSlideBtn: { padding: 4, marginRight: 8 },
  deleteBtn: { padding: 4 },
  socialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  socialName: { flex: 1, marginLeft: 8, fontSize: 16, color: COLORS.gray700 },
  editBtn: { marginTop: 6, alignSelf: 'flex-start' },
  editBtnText: { color: COLORS.primary, fontWeight: '600' },
  editForm: { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.gray200, paddingTop: 8 },
  inputSmall: {
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    marginBottom: 6,
  },
  saveBtn: { backgroundColor: COLORS.primary, padding: 8, borderRadius: 6, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.gray800, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginLeft: 8 },
  cancelBtn: { backgroundColor: COLORS.gray100 },
  cancelBtnText: { color: COLORS.gray700 },
  submitBtn: { backgroundColor: COLORS.primary },
  submitBtnText: { color: '#fff', fontWeight: '600' },
  imageUploadSection: { marginBottom: 12 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderStyle: 'dashed',
  },
  uploadBtnText: { marginLeft: 8, fontSize: 15, color: COLORS.primary, fontWeight: '500' },
  previewContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  previewImage: { width: 50, height: 50, borderRadius: 8, marginRight: 8 },
  previewText: { fontSize: 14, color: COLORS.gray600 },
});