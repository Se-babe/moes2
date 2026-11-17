import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabaseClient';
import TurnstileWidget from '../components/TurnstileWidget';

const COLORS = {
  primary: '#0B5FA5',
  primaryLight: '#3B82F6',
  primaryDark: '#0F172A',
  accent: '#FCD34D',
  white: '#FFFFFF',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};

const CATEGORIES = [
  { label: 'No Water / Supply', icon: 'water-outline', color: '#0EA5E9' },
  { label: 'Leak / Burst Pipe', icon: 'warning-outline', color: '#EF4444' },
  { label: 'Billing & Payments', icon: 'receipt-outline', color: '#F59E0B' },
  { label: 'Water Quality', icon: 'beaker-outline', color: '#22C55E' },
  { label: 'Sewer & Sanitation', icon: 'construct-outline', color: '#8B5CF6' },
  { label: 'New Connection', icon: 'git-branch-outline', color: '#3B82F6' },
  { label: 'General', icon: 'chatbubble-outline', color: COLORS.gray500 },
];

const REQUEST_TYPES = [
  { value: 'Complaint', icon: 'alert-circle-outline', hint: 'Something is wrong with a service' },
  { value: 'Enquiry', icon: 'help-circle-outline', hint: 'You have a question' },
  { value: 'Suggestion', icon: 'bulb-outline', hint: 'An idea to improve services' },
  { value: 'Compliment', icon: 'heart-outline', hint: 'Something went well' },
];

export default function FeedbackScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const initialType = REQUEST_TYPES.some((t) => t.value === route.params?.type) ? route.params.type : 'Complaint';
  const [requestType, setRequestType] = useState(initialType);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [locationText, setLocationText] = useState('');
  const [referenceNo, setReferenceNo] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Pre-fill contact details for signed-in users (still editable).
  useEffect(() => {
    if (!user) return;
    setContactName((v) => v || user.full_name || '');
    setContactPhone((v) => v || user.phone || '');
    setContactEmail((v) => v || user.email || '');
  }, [user]);

  useEffect(() => {
    if (route.params?.type && REQUEST_TYPES.some((t) => t.value === route.params.type)) {
      setRequestType(route.params.type);
    }
  }, [route.params?.type]);

  const maxTitleChars = 100;
  const maxDescChars = 500;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Needed', 'Please grant camera roll permissions.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const removeImage = () => setImage(null);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      showAlert('Missing details', 'Please fill in both the title and the description.');
      return;
    }
    if (!contactPhone.trim() && !contactEmail.trim()) {
      showAlert('Contact needed', 'Please give a phone number or email so we can send your reference number and updates.');
      return;
    }
    if (!turnstileToken) {
      showAlert('Error', 'Please complete the verification below before submitting.');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = null;
      if (image) {
        const blob = await fetch(image.uri).then(r => r.blob());
        const fileName = `feedback_${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
          .from('feedback_images')
          .upload(fileName, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage
          .from('feedback_images')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const { data: fnData, error } = await supabase.functions.invoke('submit-feedback', {
        body: {
          request_type: requestType,
          title: title.trim(),
          description: description.trim(),
          category,
          image_url: imageUrl,
          location_text: locationText.trim() || null,
          contact_name: contactName.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
          turnstileToken,
        },
      });
      if (error) throw error;
      if (fnData?.error) throw new Error(fnData.error);

      // Keep the success dialog open until the citizen dismisses it — they
      // need time to note the reference number.
      setReferenceNo(fnData?.reference_no || null);
      setShowSuccess(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      setTurnstileToken(null);
      showAlert('Submission Failed', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('General');
    setLocationText('');
    setImage(null);
    setTurnstileToken(null);
    setShowSuccess(false);
    fadeAnim.setValue(0);
  };

  const closeSuccess = (goTrack) => {
    const ref = referenceNo;
    resetForm();
    if (goTrack && ref) navigation.navigate('TrackRequest', { ref });
  };

  const renderTypeSelector = () => (
    <View style={styles.typeGrid}>
      {REQUEST_TYPES.map((t) => {
        const active = requestType === t.value;
        return (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeCard, active && styles.typeCardActive]}
            onPress={() => setRequestType(t.value)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${t.value}: ${t.hint}`}
          >
            <Ionicons name={t.icon} size={22} color={active ? '#fff' : COLORS.primary} />
            <Text style={[styles.typeTitle, active && { color: '#fff' }]}>{t.value}</Text>
            <Text style={[styles.typeHint, active && { color: '#E0F2FE' }]}>{t.hint}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderCategoryPills = () => (
    <View style={styles.categoryContainer}>
      {CATEGORIES.map((cat) => {
        const isActive = category === cat.label;
        return (
          <TouchableOpacity
            key={cat.label}
            style={[
              styles.categoryPill,
              isActive && styles.categoryPillActive,
              { borderColor: isActive ? cat.color : COLORS.gray200 },
            ]}
            onPress={() => setCategory(cat.label)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={cat.icon}
              size={18}
              color={isActive ? cat.color : COLORS.gray500}
              style={styles.categoryIcon}
            />
            <Text
              style={[
                styles.categoryLabel,
                isActive && { color: cat.color, fontWeight: '700' },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Enquiries & Complaints</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💧 How can we help?</Text>
          <Text style={styles.cardSub}>
            Report a water or sewer problem, ask a question, or share a suggestion. You'll get a reference number to track it.
            For emergencies such as a burst pipe, also call toll-free 0800-200-977.
          </Text>

          <Text style={styles.label}>What would you like to do?</Text>
          {renderTypeSelector()}

          <Text style={styles.label}>Category</Text>
          {renderCategoryPills()}

          <Text style={styles.label}>Title</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Enter a short, descriptive title"
              placeholderTextColor={COLORS.gray400}
              value={title}
              onChangeText={setTitle}
              maxLength={maxTitleChars}
            />
            <Text style={styles.charCounter}>
              {title.length}/{maxTitleChars}
            </Text>
          </View>

          <Text style={styles.label}>Description</Text>
          <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the issue: what happened, where (area, street, landmark), and since when..."
              placeholderTextColor={COLORS.gray400}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              maxLength={maxDescChars}
              textAlignVertical="top"
            />
            <Text style={[styles.charCounter, styles.charCounterBottom]}>
              {description.length}/{maxDescChars}
            </Text>
          </View>

          <Text style={styles.label}>Location (area, street or landmark)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Walukuba, near the market"
            placeholderTextColor={COLORS.gray400}
            value={locationText}
            onChangeText={setLocationText}
            maxLength={200}
          />

          <Text style={styles.sectionHeading}>Your contact details</Text>
          <Text style={styles.helper}>We'll send your reference number and progress updates here. Give at least a phone number or an email.</Text>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={COLORS.gray400}
            value={contactName}
            onChangeText={setContactName}
            maxLength={120}
            autoComplete="name"
          />
          <Text style={styles.label}>Phone number (for SMS updates)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 0772 123456"
            placeholderTextColor={COLORS.gray400}
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={20}
          />
          <Text style={styles.label}>Email (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={COLORS.gray400}
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            maxLength={120}
          />

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

          <TurnstileWidget onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />

          <TouchableOpacity
            style={[styles.submitBtn, (loading || !turnstileToken) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading || !turnstileToken}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Submit</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => navigation.navigate('TrackRequest')}
          >
            <Text style={styles.viewAllText}>🔎 Track an existing request</Text>
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            Your contact details are only visible to NWSC staff handling your request.
          </Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={showSuccess}
        transparent
        animationType="fade"
        onRequestClose={() => closeSuccess(false)}
      >
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successModal, { opacity: fadeAnim }]}>
            <Ionicons name="checkmark-circle" size={60} color={COLORS.success} />
            <Text style={styles.successTitle}>Thank you!</Text>
            <Text style={styles.successSub}>
              Your {requestType.toLowerCase()} has been received. Keep this reference number to track it:
            </Text>
            {referenceNo ? (
              <Text style={styles.refText} selectable accessibilityLabel={`Reference number ${referenceNo.split('').join(' ')}`}>
                {referenceNo}
              </Text>
            ) : null}
            <Text style={styles.successNote}>We've also sent it to you by SMS/email.</Text>
            <TouchableOpacity style={styles.successPrimary} onPress={() => closeSuccess(true)}>
              <Text style={styles.successPrimaryText}>Track this request</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.successSecondary} onPress={() => closeSuccess(false)}>
              <Text style={styles.successSecondaryText}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(12px)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  cardSub: { fontSize: 14, color: COLORS.gray600, marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 15, fontWeight: '600', color: COLORS.gray700, marginBottom: 8, marginTop: 16 },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4, gap: 8 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1.5,
    backgroundColor: '#fff',
    marginRight: 6,
    marginBottom: 6,
  },
  categoryPillActive: { backgroundColor: 'rgba(30, 58, 138, 0.05)', borderWidth: 2 },
  categoryIcon: { marginRight: 6 },
  categoryLabel: { fontSize: 14, fontWeight: '500', color: COLORS.gray600 },
  inputWrapper: { position: 'relative', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: COLORS.gray800,
    backgroundColor: '#fff',
    paddingRight: 50,
  },
  textArea: { height: 150, paddingTop: 14, textAlignVertical: 'top' },
  textAreaWrapper: { height: 150 },
  charCounter: { position: 'absolute', right: 14, top: 14, fontSize: 12, color: COLORS.gray400 },
  charCounterBottom: { top: 'auto', bottom: 10 },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    padding: 14,
    borderRadius: 14,
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
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  viewAllBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: COLORS.gray100, borderRadius: 30 },
  viewAllText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  footerNote: { marginTop: 16, fontSize: 13, color: COLORS.gray500, textAlign: 'center' },
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  successModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    maxWidth: 440,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 10,
    width: '80%',
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: COLORS.gray800, marginTop: 12 },
  successSub: { fontSize: 16, color: COLORS.gray500, textAlign: 'center', marginTop: 8 },
  refText: {
    fontSize: 26, fontWeight: '800', color: COLORS.primary, letterSpacing: 2, marginTop: 16,
    paddingVertical: 10, paddingHorizontal: 18, backgroundColor: '#E0F2FE', borderRadius: 12,
  },
  successNote: { fontSize: 13, color: COLORS.gray500, marginTop: 10, textAlign: 'center' },
  successPrimary: { marginTop: 20, backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 30 },
  successPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  successSecondary: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 20 },
  successSecondaryText: { color: COLORS.gray600, fontWeight: '600' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    flexGrow: 1, flexBasis: 140, padding: 12, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.gray200, backgroundColor: '#fff',
  },
  typeCardActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeTitle: { fontSize: 15, fontWeight: '700', color: COLORS.gray800, marginTop: 6 },
  typeHint: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  sectionHeading: { fontSize: 17, fontWeight: '700', color: COLORS.primary, marginTop: 28 },
  helper: { fontSize: 13, color: COLORS.gray500, marginTop: 4 },
});