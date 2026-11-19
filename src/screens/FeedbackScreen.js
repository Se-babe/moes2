import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../utils/alert';
import Footer from '../components/Footer';
import { PageHeader, Container, Card, Button, TextField, useBreakpoint } from '../components/ui';
import { usePreferences } from '../context/PreferencesContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_KEY = 'nwsc_feedback_draft';
import { COLORS, TYPE, SPACE, RADIUS, SHADOW, FONT } from '../theme';
import { ORG } from '../config/org';

const REQUEST_TYPES = [
  { value: 'Complaint', icon: 'alert-circle-outline', hint: 'Something is wrong with a service' },
  { value: 'Enquiry', icon: 'help-circle-outline', hint: 'You have a question' },
  { value: 'Suggestion', icon: 'bulb-outline', hint: 'An idea to improve services' },
  { value: 'Compliment', icon: 'heart-outline', hint: 'Something went well' },
];

const CATEGORIES = [
  { label: 'No Water / Supply', icon: 'water-outline' },
  { label: 'Leak / Burst Pipe', icon: 'warning-outline' },
  { label: 'Billing & Payments', icon: 'receipt-outline' },
  { label: 'Water Quality', icon: 'beaker-outline' },
  { label: 'Sewer & Sanitation', icon: 'construct-outline' },
  { label: 'New Connection', icon: 'git-branch-outline' },
  { label: 'General', icon: 'chatbubble-outline' },
];

const NEXT_STEPS = [
  ['Instant reference', 'You get a reference number on screen and by SMS/email.'],
  ['Sent to the right team', 'Your request goes to the department responsible.'],
  ['Progress updates', 'We notify you as it moves forward and when it’s resolved.'],
];

const MAX_TITLE = 100;
const MAX_DESC = 1000;

function Choice({ active, onPress, icon, label, hint, compact }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={hint ? `${label}: ${hint}` : label}
      style={({ hovered }) => [
        compact ? styles.chip : styles.typeCard,
        hovered && !active && { borderColor: COLORS.primaryLight },
        active && (compact ? styles.chipActive : styles.typeCardActive),
      ]}
    >
      <Ionicons name={icon} size={compact ? 16 : 22} color={active ? (compact ? COLORS.primary : '#fff') : COLORS.primary} />
      <View style={compact ? null : { marginTop: 8 }}>
        <Text style={[compact ? styles.chipText : styles.typeTitle, active && (compact ? { color: COLORS.primary } : { color: '#fff' })]}>{label}</Text>
        {hint && !compact ? <Text style={[styles.typeHint, active && { color: '#DBEAFE' }]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function FeedbackScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { isDesktop } = useBreakpoint();

  const [requestType, setRequestType] = useState('Complaint');
  const [category, setCategory] = useState('General');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [referenceNo, setReferenceNo] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const { t: tr, language } = usePreferences();
  const draftLoaded = React.useRef(false);

  // Save-and-resume: restore an unfinished report saved on this device…
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      draftLoaded.current = true;
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        if (!d.title && !d.description) return;
        if (d.requestType && !route.params?.type) setRequestType(d.requestType);
        if (d.category && !route.params?.category) setCategory(d.category);
        setTitle(d.title || '');
        setDescription(d.description || '');
        setLocationText(d.locationText || '');
        setDraftRestored(true);
      } catch {}
    }).catch(() => { draftLoaded.current = true; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // …and keep saving it as the person types (contact details are not stored).
  useEffect(() => {
    if (!draftLoaded.current) return undefined;
    const timer = setTimeout(() => {
      if (title.trim() || description.trim()) {
        AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ requestType, category, title, description, locationText, savedAt: Date.now() })).catch(() => {});
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [requestType, category, title, description, locationText]);

  const discardDraft = () => {
    AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    setTitle('');
    setDescription('');
    setLocationText('');
    setDraftRestored(false);
  };

  // Pre-select from links such as "Billing & payments" on the home page.
  useEffect(() => {
    const { type, category: cat } = route.params || {};
    if (type && REQUEST_TYPES.some((t) => t.value === type)) setRequestType(type);
    if (cat && CATEGORIES.some((c) => c.label === cat)) setCategory(cat);
  }, [route.params]);

  // Pre-fill contact details for signed-in users (still editable).
  useEffect(() => {
    if (!user) return;
    setContactName((v) => v || user.full_name || '');
    setContactPhone((v) => v || user.phone || '');
    setContactEmail((v) => v || user.email || '');
  }, [user]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Please allow access to your photos to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const validate = () => {
    const e = {};
    if (!title.trim()) e.title = 'Please give your request a short title.';
    if (!description.trim()) e.description = 'Please describe the issue.';
    if (!contactPhone.trim() && !contactEmail.trim()) e.contact = 'Give a phone number or email so we can send your reference number.';
    if (contactPhone.trim() && !/^(\+?256|0)?7\d{8}$|^(\+?256|0)?[23]\d{8}$/.test(contactPhone.replace(/[\s-]/g, ''))) {
      e.phone = 'Enter a valid Ugandan number, e.g. 0772 123456.';
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) e.email = 'Enter a valid email address.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      let imageUrl = null;
      if (image) {
        const blob = await fetch(image.uri).then((r) => r.blob());
        const fileName = `feedback_${Date.now()}.jpg`;
        const { error } = await supabase.storage.from('feedback_images').upload(fileName, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        imageUrl = supabase.storage.from('feedback_images').getPublicUrl(fileName).data.publicUrl;
      }

      const { data, error } = await supabase.functions.invoke('submit-feedback', {
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
          language,
        },
      });
      if (error) {
        // Surface the function's own message (e.g. rate limit) when there is one.
        const msg = await error.context?.json?.().then((b) => b?.error).catch(() => null);
        throw new Error(msg || error.message);
      }
      if (data?.error) throw new Error(data.error);
      setReferenceNo(data?.reference_no || '');
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      setDraftRestored(false);
    } catch (err) {
      showAlert('We couldn’t submit your request', err.message || 'Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTitle('');
    setDescription('');
    setLocationText('');
    setCategory('General');
    setImage(null);
    setErrors({});
    setReferenceNo(null);
  };

  const finish = (track) => {
    const ref = referenceNo;
    reset();
    if (track && ref) navigation.navigate('TrackRequest', { ref });
  };

  const sidePanel = (
    <View style={{ gap: SPACE.lg }}>
      <Card>
        <Text style={TYPE.h3}>{tr('form.next')}</Text>
        {NEXT_STEPS.map(([t, d], i) => (
          <View key={t} style={styles.nextRow}>
            <View style={styles.nextNum}><Text style={styles.nextNumText}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={TYPE.label}>{tr(`form.next${i + 1}`)}</Text>
              <Text style={[TYPE.small, { marginTop: 2 }]}>{tr(`form.next${i + 1}Desc`)}</Text>
            </View>
          </View>
        ))}
      </Card>
      <View style={styles.emergency}>
        <Ionicons name="alert-circle" size={22} color={COLORS.danger} />
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.label, { color: '#991B1B' }]}>{tr('form.emergency')}</Text>
          <Text style={[TYPE.small, { color: '#7F1D1D', marginTop: 2 }]}>
            For a burst pipe or major leak, call toll-free{' '}
            <Text style={{ fontWeight: '700' }} onPress={() => Linking.openURL(`tel:${ORG.phones[0].value.replace(/\D/g, '')}`)}>
              {ORG.phones[0].value}
            </Text>{' '}
            as well.
          </Text>
        </View>
      </View>
      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={18} color={COLORS.gray500} />
        <Text style={[TYPE.small, { flex: 1 }]}>
          {tr('form.privacy')}{' '}
          <Text style={{ color: COLORS.primary, fontWeight: '600' }} onPress={() => navigation.navigate('Privacy')}>Privacy notice</Text>
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.page} keyboardShouldPersistTaps="handled">
        <PageHeader
          overline="Customer service"
          title={tr('form.title')}
          subtitle={tr('form.sub')}
          icon="chatbox-ellipses-outline"
        />

        <Container style={[styles.layout, !isDesktop && { flexDirection: 'column' }]}>
          <Card elevated style={[styles.formCard, isDesktop && { flex: 2 }]}>
            {/* Step 1 */}
            {draftRestored && (
              <View style={styles.draft}>
                <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                <Text style={[TYPE.small, { flex: 1, color: COLORS.gray800 }]}>{tr('form.draftRestored')}</Text>
                <Button title={tr('form.discard')} variant="ghost" size="sm" onPress={discardDraft} />
              </View>
            )}
            <Text style={styles.stepLabel}>{tr('form.step1')}</Text>
            <View style={styles.typeGrid}>
              {REQUEST_TYPES.map((t) => (
                <Choice key={t.value} active={requestType === t.value} onPress={() => setRequestType(t.value)} icon={t.icon} label={tr(`form.type.${t.value}`)} hint={tr(`form.type.${t.value}Hint`)} />
              ))}
            </View>

            <Text style={[TYPE.label, { marginTop: SPACE.xl, marginBottom: 8 }]}>{tr('form.category')}</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <Choice key={c.label} compact active={category === c.label} onPress={() => setCategory(c.label)} icon={c.icon} label={tr(`cat.${c.label}`)} />
              ))}
            </View>

            {/* Step 2 */}
            <Text style={[styles.stepLabel, styles.stepGap]}>{tr('form.step2')}</Text>
            <TextField
              label={tr('form.titleLabel')}
              required
              placeholder={tr('form.titlePlaceholder')}
              value={title}
              onChangeText={setTitle}
              maxLength={MAX_TITLE}
              error={errors.title}
              hint={`${title.length}/${MAX_TITLE}`}
            />
            <TextField
              label={tr('form.description')}
              required
              multiline
              placeholder={tr('form.descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
              maxLength={MAX_DESC}
              error={errors.description}
              hint={`${description.length}/${MAX_DESC}`}
            />
            <TextField
              label={tr('form.location')}
              placeholder={tr('form.locationPlaceholder')}
              value={locationText}
              onChangeText={setLocationText}
              maxLength={200}
            />

            <Text style={[TYPE.label, { marginBottom: 8 }]}>Photo <Text style={TYPE.small}>(optional)</Text></Text>
            {image ? (
              <View style={styles.preview}>
                <Image source={{ uri: image.uri }} style={styles.previewImg} />
                <View style={{ flex: 1 }}>
                  <Text style={TYPE.label}>Photo attached</Text>
                  <Button title="Remove" variant="ghost" size="sm" icon="trash-outline" style={{ marginLeft: -14 }} onPress={() => setImage(null)} />
                </View>
              </View>
            ) : (
              <Pressable onPress={pickImage} style={({ hovered }) => [styles.drop, hovered && { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primarySoft }]}>
                <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                <Text style={[TYPE.label, { color: COLORS.primary }]}>{tr('form.addPhoto')}</Text>
                <Text style={TYPE.small}>{tr('form.photoHint')}</Text>
              </Pressable>
            )}

            {/* Step 3 */}
            <Text style={[styles.stepLabel, styles.stepGap]}>{tr('form.step3')}</Text>
            <Text style={[TYPE.small, { marginTop: -8, marginBottom: SPACE.lg }]}>
              We'll send your reference number and updates here. Give at least a phone number or an email.
            </Text>
            <TextField label={tr('form.name')} placeholder={tr('form.name')} value={contactName} onChangeText={setContactName} maxLength={120} autoComplete="name" />
            <View style={[styles.row, !isDesktop && { flexDirection: 'column', gap: 0 }]}>
              <TextField
                style={{ flex: 1 }}
                label={tr('form.phone')}
                placeholder="0772 123456"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={20}
                error={errors.phone}
              />
              <TextField
                style={{ flex: 1 }}
                label={tr('form.email')}
                placeholder="you@example.com"
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                maxLength={120}
                error={errors.email}
              />
            </View>
            {errors.contact ? (
              <View style={styles.inlineError}>
                <Ionicons name="information-circle" size={16} color={COLORS.danger} />
                <Text style={[TYPE.small, { color: COLORS.danger, flex: 1 }]}>{errors.contact}</Text>
              </View>
            ) : null}

            <View style={styles.submitRow}>
              <Button title={tr('form.submit')} icon="send" size="lg" loading={loading} onPress={handleSubmit} />
              <Button title={tr('form.trackExisting')} variant="ghost" onPress={() => navigation.navigate('TrackRequest')} />
            </View>
          </Card>

          <View style={isDesktop ? { flex: 1 } : null}>{sidePanel}</View>
        </Container>

        <Footer />
      </ScrollView>

      {/* Success dialog — stays open until dismissed so the reference can be noted. */}
      <Modal visible={referenceNo !== null} transparent animationType="fade" onRequestClose={() => finish(false)}>
        <View style={styles.overlay}>
          <View style={[styles.success, SHADOW.lg]}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </View>
            <Text style={[TYPE.h2, { textAlign: 'center', marginTop: SPACE.lg }]}>{tr('form.thanks')}</Text>
            <Text style={[TYPE.body, { textAlign: 'center', color: COLORS.gray500, marginTop: 6 }]}>
              {tr('form.received')}
            </Text>
            {referenceNo ? (
              <Text style={styles.ref} selectable accessibilityLabel={`Reference number ${referenceNo.split('').join(' ')}`}>{referenceNo}</Text>
            ) : null}
            <Text style={[TYPE.small, { textAlign: 'center' }]}>{tr('form.sentToo')}</Text>
            <View style={{ gap: 10, marginTop: SPACE.xl, alignSelf: 'stretch' }}>
              <Button title={tr('form.trackThis')} icon="search" full onPress={() => finish(true)} />
              <Button title={tr('form.done')} variant="secondary" full onPress={() => finish(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  draft: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.primarySoft, marginBottom: SPACE.lg },
  layout: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xl, marginTop: -24 },
  formCard: { width: '100%' },
  stepLabel: { fontFamily: FONT, fontSize: 17, fontWeight: '800', color: COLORS.primaryDark, marginBottom: SPACE.md },
  stepGap: { marginTop: SPACE.xxl, paddingTop: SPACE.xl, borderTopWidth: 1, borderTopColor: COLORS.gray200 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    flexGrow: 1, flexBasis: 130, padding: 14, borderRadius: RADIUS.md, borderWidth: 1.5,
    borderColor: COLORS.gray200, backgroundColor: COLORS.white,
  },
  typeCardActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '700', color: COLORS.gray900 },
  typeHint: { fontFamily: FONT, fontSize: 12.5, color: COLORS.gray500, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: COLORS.gray200, backgroundColor: COLORS.white,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  chipText: { fontFamily: FONT, fontSize: 13.5, fontWeight: '600', color: COLORS.gray700 },
  drop: {
    alignItems: 'center', gap: 4, padding: SPACE.xl, borderRadius: RADIUS.md, borderWidth: 1.5,
    borderStyle: 'dashed', borderColor: COLORS.gray300, backgroundColor: COLORS.gray50,
  },
  preview: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  previewImg: { width: 96, height: 96, borderRadius: RADIUS.md },
  row: { flexDirection: 'row', gap: SPACE.lg },
  inlineError: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: COLORS.dangerSoft, padding: 10, borderRadius: RADIUS.sm },
  submitRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: SPACE.xl },
  nextRow: { flexDirection: 'row', gap: 12, marginTop: SPACE.lg },
  nextNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  nextNumText: { fontFamily: FONT, fontWeight: '800', color: COLORS.primary, fontSize: 13 },
  emergency: {
    flexDirection: 'row', gap: 12, padding: SPACE.lg, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.dangerSoft, borderWidth: 1, borderColor: '#FECACA',
  },
  privacy: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.55)', alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  success: { width: '100%', maxWidth: 440, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACE.xxl, alignItems: 'center' },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  ref: {
    fontFamily: FONT, fontSize: 26, fontWeight: '800', color: COLORS.primary, letterSpacing: 2,
    marginVertical: SPACE.lg, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md,
  },
});
