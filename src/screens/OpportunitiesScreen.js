import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';

const COLORS = {
  primary: '#1E3A8A',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

const TYPE_META = {
  Job: { icon: 'briefcase-outline', color: '#3B82F6' },
  Scholarship: { icon: 'school-outline', color: '#8B5CF6' },
  Tender: { icon: 'document-text-outline', color: '#F59E0B' },
  Loan: { icon: 'cash-outline', color: '#22C55E' },
  Admission: { icon: 'people-outline', color: '#EC4899' },
  TVET: { icon: 'construct-outline', color: '#0EA5E9' },
};

const TYPES = ['All', 'Job', 'Scholarship', 'Tender', 'Loan', 'Admission', 'TVET'];

export default function OpportunitiesScreen() {
  const navigation = useNavigation();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('All');
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [applyTarget, setApplyTarget] = useState(null);
  const [applyForm, setApplyForm] = useState({ full_name: '', email: '', phone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('is_active', true)
        .order('deadline', { ascending: true });
      if (error) throw error;
      setOpportunities(data || []);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = selectedType === 'All' ? opportunities : opportunities.filter((o) => o.type === selectedType);

  const daysLeft = (deadline) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const openExternalLink = (item) => {
    const url = item.apply_url || item.file_url;
    if (url && url !== '#') {
      Linking.openURL(url).catch(() => showAlert('Error', 'Could not open the link.'));
    }
  };

  const openApplyModal = (item) => {
    setApplyTarget(item);
    setApplyForm({ full_name: '', email: '', phone: '', message: '' });
    setApplyModalVisible(true);
  };

  const getAdminUser = async () => {
    const { data } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
    return data?.[0];
  };

  const submitApplication = async () => {
    if (!applyForm.full_name.trim() || !applyForm.email.trim()) {
      showAlert('Error', 'Please enter your name and email.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('opportunity_applications').insert([
        {
          opportunity_id: applyTarget.id,
          full_name: applyForm.full_name.trim(),
          email: applyForm.email.trim(),
          phone: applyForm.phone.trim() || null,
          message: applyForm.message.trim() || null,
        },
      ]);
      if (error) throw error;

      try {
        const admin = await getAdminUser();
        if (admin) {
          await supabase.from('notifications').insert([{
            user_id: admin.id,
            title: 'New Application',
            message: `${applyForm.full_name.trim()} applied for: ${applyTarget.title}`,
            type: 'opportunity',
            target_screen: 'Opportunities',
            target_id: applyTarget.id,
            read: false,
          }]);
        }
      } catch (e) {
        console.error('Failed to create notification:', e);
      }

      setApplyModalVisible(false);
      showAlert('Application Sent', `Thanks, ${applyForm.full_name.trim()}! MoES has received your application for "${applyTarget.title}" and will contact you at ${applyForm.email.trim()}.`);
    } catch (error) {
      showAlert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading opportunities...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🎓 Opportunities</Text>
        <TouchableOpacity onPress={fetchOpportunities}>
          <Ionicons name="refresh-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll} contentContainerStyle={styles.typeContainer}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeChip, selectedType === t && styles.typeChipActive]}
            onPress={() => setSelectedType(t)}
          >
            <Text style={[styles.typeChipText, selectedType === t && styles.typeChipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={60} color={COLORS.gray400} />
            <Text style={styles.emptyText}>No opportunities in this category right now</Text>
          </View>
        ) : (
          filtered.map((item) => {
            const meta = TYPE_META[item.type] || TYPE_META.Job;
            const left = daysLeft(item.deadline);
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: meta.color }]}>
                    <Ionicons name={meta.icon} size={14} color="#fff" />
                    <Text style={styles.typeBadgeText}>{item.type}</Text>
                  </View>
                  {left !== null && (
                    <Text style={[styles.deadlineText, left <= 7 && left >= 0 && { color: COLORS.danger }]}>
                      {left < 0 ? 'Closed' : left === 0 ? 'Closes today' : `${left}d left`}
                    </Text>
                  )}
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.organization && <Text style={styles.cardOrg}>{item.organization}</Text>}
                {item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
                <View style={styles.cardFooter}>
                  {(item.apply_url || item.file_url) ? (
                    <TouchableOpacity style={styles.externalLinkBtn} onPress={() => openExternalLink(item)}>
                      <Text style={styles.externalLinkText}>View original</Text>
                      <Ionicons name="open-outline" size={13} color={COLORS.gray500} />
                    </TouchableOpacity>
                  ) : <View />}
                  <TouchableOpacity style={styles.applyBtn} onPress={() => openApplyModal(item)}>
                    <Text style={styles.applyBtnText}>Apply Now</Text>
                    <Ionicons name="arrow-forward" size={13} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={applyModalVisible} animationType="slide" transparent onRequestClose={() => setApplyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply: {applyTarget?.title}</Text>
              <TouchableOpacity onPress={() => setApplyModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray500} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Full Name *"
              value={applyForm.full_name}
              onChangeText={(text) => setApplyForm({ ...applyForm, full_name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Email *"
              value={applyForm.email}
              onChangeText={(text) => setApplyForm({ ...applyForm, email: text })}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Phone"
              value={applyForm.phone}
              onChangeText={(text) => setApplyForm({ ...applyForm, phone: text })}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Why are you a good fit? (optional)"
              value={applyForm.message}
              onChangeText={(text) => setApplyForm({ ...applyForm, message: text })}
              multiline
            />
            <TouchableOpacity style={styles.submitBtn} onPress={submitApplication} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Application</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.gray800 },
  typeScroll: { flexGrow: 0, backgroundColor: '#fff' },
  typeContainer: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 8 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.gray100, marginRight: 8 },
  typeChipActive: { backgroundColor: COLORS.primary },
  typeChipText: { fontSize: 14, color: COLORS.gray700 },
  typeChipTextActive: { color: '#fff' },
  list: { flex: 1 },
  listContent: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4 },
  typeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  deadlineText: { fontSize: 12, color: COLORS.gray500, fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginBottom: 2 },
  cardOrg: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginBottom: 6 },
  cardDesc: { fontSize: 14, color: COLORS.gray600, marginBottom: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 4,
  },
  applyBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: COLORS.gray500, marginTop: 12, textAlign: 'center', paddingHorizontal: 40 },
  externalLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  externalLinkText: { fontSize: 12, color: COLORS.gray500 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '90%', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray800, flex: 1 },
  input: { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 30, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
