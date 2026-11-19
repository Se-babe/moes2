import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { showAlert } from '../utils/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONT } from '../theme';
import { PageHeader, Container } from '../components/ui';
import Footer from '../components/Footer';


// ----- Categories -----
const CATEGORIES = ['Water Supply', 'Tariffs & Billing', 'Sewerage', 'Infrastructure Projects', 'Customer Service', 'General'];

// ----- Generate date options (7, 14, 21, 30, 45, 60 days from now) -----
const generateDateOptions = () => {
  const today = new Date();
  return [7, 14, 21, 30, 45, 60].map((days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return {
      label: `${days} days (${d.toDateString()})`,
      value: d.toISOString().split('T')[0],
    };
  });
};
const DATE_OPTIONS = generateDateOptions();

export default function ProposeConsultationScreen() {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [closingDate, setClosingDate] = useState(DATE_OPTIONS[0].value);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  // ----- Helper: create notification for admin -----
  const createNotification = async (_userId, title, message, type, targetScreen, targetId = null) => {
    await supabase.rpc('notify_admins', {
      p_title: title, p_message: message, p_type: type, p_screen: targetScreen, p_target: targetId,
    });
  };

  // Admin notifications go through notify_admins() (users are private now).
  const getAdminUser = async () => ({ id: 'admins' });

  // ----- Image picker (new Expo API) -----
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Needed', 'Please grant camera roll permissions.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const removeImage = () => setImage(null);

  // ----- Submit proposal -----
  const handleSubmit = async () => {
    // --- Validations ---
    if (!title.trim()) {
      showAlert('Error', 'Please enter a title.');
      return;
    }
    if (!description.trim()) {
      showAlert('Error', 'Please enter a description.');
      return;
    }
    if (!email.trim() || !phone.trim()) {
      showAlert('Error', 'Please provide your email and phone.');
      return;
    }

    setLoading(true);
    try {
      // 1. Upload image if present
      let imageUrl = null;
      if (image) {
        const blob = await fetch(image.uri).then(r => r.blob());
        const fileName = `proposal_${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
          .from('consultation_images')
          .upload(fileName, blob, { contentType: 'image/jpeg' });
        if (error) throw new Error(`Image upload failed: ${error.message}`);
        const { data: { publicUrl } } = supabase.storage
          .from('consultation_images')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      // 2. Insert into consultations table via the protected Edge Function
      // (writes with the service role key — see supabase/functions/propose-consultation)
      const { data: fnData, error } = await supabase.functions.invoke('propose-consultation', {
        body: {
          title: title.trim(),
          description: description.trim(),
          category,
          closing_date: closingDate,
          proposer_email: email.trim(),
          proposer_phone: phone.trim(),
          image_url: imageUrl,
        },
      });

      if (error) {
        console.error('❌ propose-consultation error:', error);
        throw new Error(error.message || 'Could not submit your proposal');
      }
      if (fnData?.error) throw new Error(fnData.error);

      // 3. Notify admin
      const admin = await getAdminUser();
      if (admin) {
        await createNotification(
          admin.id,
          'New Consultation Proposal',
          `User proposed: "${title}" (Email: ${email}, Phone: ${phone})`,
          'consultation',
          'Consultations',
          fnData.id
        );
      }

      // 4. Success
      showAlert(
        '✅ Proposal Submitted',
        'Thank you! The admin will review your proposal and activate it soon.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      showAlert('Submission Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  // ----- Render -----
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <PageHeader title="Propose a consultation" subtitle="Suggest a topic you think NWSC should consult the public on. Our team reviews every proposal." icon="add-circle-outline" overline="Participate" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📢 Suggest a Topic</Text>
          <Text style={styles.cardSub}>
            Share an idea that you think should be discussed publicly. The admin will review and activate it.
          </Text>

          {/* Title */}
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Extend piped water to Mpumudde"
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the topic, why it matters, and what you'd like to see discussed."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          {/* Category */}
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryContainer}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, category === cat && styles.categoryPillActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Closing Date */}
          <Text style={styles.label}>Closing Date</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={closingDate}
              onValueChange={(itemValue) => setClosingDate(itemValue)}
              style={styles.picker}
            >
              {DATE_OPTIONS.map((opt) => (
                <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
              ))}
            </Picker>
          </View>

          {/* Email */}
          <Text style={styles.label}>Your Email (for contact) *</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Phone */}
          <Text style={styles.label}>Your Phone Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 0772000000"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          {/* Image Attachment */}
          <Text style={styles.label}>Attach Image (Optional)</Text>
          <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={24} color={COLORS.primary} />
            <Text style={styles.attachText}>
              {image ? 'Change Image' : 'Tap to attach an image'}
            </Text>
          </TouchableOpacity>
          {image && (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: image.uri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.removeImageBtn} onPress={removeImage}>
                <Ionicons name="close-circle" size={28} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Proposal</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  cardSub: { fontSize: 14, color: COLORS.gray600, marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 15, fontWeight: '600', color: COLORS.gray700, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.gray800,
    backgroundColor: '#fff',
  },
  textArea: { height: 150, textAlignVertical: 'top' },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.gray100,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryPillActive: { backgroundColor: COLORS.primary },
  categoryText: { fontSize: 14, color: COLORS.gray700 },
  categoryTextActive: { color: '#fff' },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  picker: { height: 50, width: '100%' },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderStyle: 'dashed',
  },
  attachText: { marginLeft: 10, fontSize: 15, color: COLORS.primary, fontWeight: '500' },
  imagePreviewContainer: { position: 'relative', marginVertical: 8, alignSelf: 'center' },
  imagePreview: { width: 120, height: 120, borderRadius: 12, borderWidth: 1, borderColor: COLORS.gray200 },
  removeImageBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: '#fff', borderRadius: 16 },
  submitBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 40,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});