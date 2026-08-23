import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, FlatList, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { sendEmail } from '../../services/email';
import { ADMIN_COLORS as COLORS } from './adminTheme';

const OPPORTUNITY_TYPES = ['Job', 'Scholarship', 'Tender', 'Loan', 'Admission', 'TVET'];
const emptyOpportunityForm = { title: '', type: 'Job', organization: '', description: '', deadline: '', apply_url: '', is_active: true };

export default function AdminOpportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [oppModalVisible, setOppModalVisible] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  const [oppForm, setOppForm] = useState(emptyOpportunityForm);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [oppRes, appsRes] = await Promise.all([
        supabase.from('opportunities').select('*').order('created_at', { ascending: false }),
        supabase.from('opportunity_applications').select('*, opportunities(title)').order('created_at', { ascending: false }),
      ]);
      if (oppRes.data) setOpportunities(oppRes.data);
      if (appsRes.data) setApplications(appsRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openAddOpportunityModal = () => {
    setEditingOpportunity(null);
    setOppForm(emptyOpportunityForm);
    setOppModalVisible(true);
  };

  const openEditOpportunityModal = (opp) => {
    setEditingOpportunity(opp);
    setOppForm({
      title: opp.title || '',
      type: opp.type || 'Job',
      organization: opp.organization || '',
      description: opp.description || '',
      deadline: opp.deadline || '',
      apply_url: opp.apply_url || '',
      is_active: opp.is_active,
    });
    setOppModalVisible(true);
  };

  const saveOpportunity = async () => {
    if (!oppForm.title.trim()) {
      showAlert('Error', 'Title is required.');
      return;
    }
    const payload = {
      title: oppForm.title.trim(),
      type: oppForm.type,
      organization: oppForm.organization.trim() || null,
      description: oppForm.description.trim() || null,
      deadline: oppForm.deadline.trim() || null,
      apply_url: oppForm.apply_url.trim() || null,
      is_active: oppForm.is_active,
    };
    try {
      const { error } = editingOpportunity
        ? await supabase.from('opportunities').update(payload).eq('id', editingOpportunity.id)
        : await supabase.from('opportunities').insert([payload]);
      if (error) throw error;
      setOppModalVisible(false);
      setEditingOpportunity(null);
      setOppForm(emptyOpportunityForm);
      fetchData();
    } catch (error) {
      showAlert('Error', error.message);
    }
  };

  const deleteOpportunity = (id) => {
    showAlert('Delete Opportunity', 'Are you sure? This also removes any applications received for it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('opportunities').delete().eq('id', id);
          if (error) showAlert('Error', error.message);
          else fetchData();
        },
      },
    ]);
  };

  const updateApplicationStatus = async (item, status) => {
    const { error } = await supabase.from('opportunity_applications').update({ status }).eq('id', item.id);
    if (error) {
      showAlert('Error', error.message);
      return;
    }
    fetchData();
    if (status === 'Contacted') {
      sendEmail(
        item.email,
        `Update on your application: ${item.opportunities?.title || 'MoES Opportunity'}`,
        `<p>Hi ${item.full_name},</p><p>The Ministry of Education and Sports has reviewed your application for "<strong>${item.opportunities?.title || 'this opportunity'}</strong>" and would like to get in touch. Please expect contact from us soon, or reach out using the contact details on the platform.</p>`
      );
    }
  };

  const renderOpportunityItem = ({ item }) => (
    <View style={styles.listItem}>
      <View style={styles.itemInfo}>
        <View style={styles.oppTitleRow}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          {!item.is_active && <Text style={styles.inactiveBadge}>Inactive</Text>}
        </View>
        <Text style={styles.itemSub}>{item.type} · {item.organization || 'MoES'}</Text>
        {item.deadline && <Text style={styles.itemMeta}>Deadline: {item.deadline}</Text>}
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => openEditOpportunityModal(item)}>
          <Ionicons name="pencil-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => deleteOpportunity(item.id)}>
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderApplicationItem = ({ item }) => (
    <View style={styles.listItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.full_name}</Text>
        <Text style={styles.itemSub}>Applied to: {item.opportunities?.title || 'Deleted opportunity'}</Text>
        <Text style={styles.itemSub}>{item.email} {item.phone ? `· ${item.phone}` : ''}</Text>
        {item.message ? <Text style={styles.itemQuote}>"{item.message}"</Text> : null}
        <Text style={styles.itemMeta}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
      <View style={styles.statusPicker}>
        {['New', 'Reviewed', 'Contacted'].map((s) => (
          <TouchableOpacity key={s} style={[styles.statusChip, item.status === s && styles.statusChipActive]} onPress={() => updateApplicationStatus(item, s)}>
            <Text style={[styles.statusChipText, item.status === s && styles.statusChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
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
        <Text style={styles.heading}>Opportunities ({opportunities.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddOpportunityModal}>
          <Ionicons name="add-circle" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {opportunities.length === 0 ? (
        <Text style={styles.emptyText}>No opportunities posted yet.</Text>
      ) : (
        <FlatList data={opportunities} renderItem={renderOpportunityItem} keyExtractor={(item) => item.id} scrollEnabled={false} />
      )}

      <Text style={[styles.heading, { marginTop: 24 }]}>Applications Received ({applications.length})</Text>
      {applications.length === 0 ? (
        <Text style={styles.emptyText}>No one has applied yet.</Text>
      ) : (
        <FlatList data={applications} renderItem={renderApplicationItem} keyExtractor={(item) => item.id} scrollEnabled={false} />
      )}

      <Modal visible={oppModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingOpportunity ? 'Edit Opportunity' : 'Add New Opportunity'}</Text>
            <TextInput style={styles.input} placeholder="Title *" placeholderTextColor={COLORS.textDim} value={oppForm.title} onChangeText={(text) => setOppForm({ ...oppForm, title: text })} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {OPPORTUNITY_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.typeChip, oppForm.type === t && styles.typeChipActive]} onPress={() => setOppForm({ ...oppForm, type: t })}>
                  <Text style={[styles.typeChipText, oppForm.type === t && styles.typeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput style={styles.input} placeholder="Organization (e.g. Ministry of Education and Sports)" placeholderTextColor={COLORS.textDim} value={oppForm.organization} onChangeText={(text) => setOppForm({ ...oppForm, organization: text })} />
            <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Description" placeholderTextColor={COLORS.textDim} value={oppForm.description} onChangeText={(text) => setOppForm({ ...oppForm, description: text })} multiline />
            <TextInput style={styles.input} placeholder="Deadline (YYYY-MM-DD)" placeholderTextColor={COLORS.textDim} value={oppForm.deadline} onChangeText={(text) => setOppForm({ ...oppForm, deadline: text })} />
            <TextInput style={styles.input} placeholder="External apply link (optional)" placeholderTextColor={COLORS.textDim} value={oppForm.apply_url} onChangeText={(text) => setOppForm({ ...oppForm, apply_url: text })} autoCapitalize="none" />
            <View style={styles.activeRow}>
              <Text style={styles.activeLabel}>Active (visible to citizens)</Text>
              <Switch value={oppForm.is_active} onValueChange={(v) => setOppForm({ ...oppForm, is_active: v })} trackColor={{ false: COLORS.border, true: COLORS.primary }} />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setOppModalVisible(false);
                  setEditingOpportunity(null);
                  setOppForm(emptyOpportunityForm);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={saveOpportunity}>
                <Text style={styles.submitBtnText}>{editingOpportunity ? 'Update' : 'Post'}</Text>
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
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  itemSub: { fontSize: 13, color: COLORS.textMuted },
  itemQuote: { fontSize: 12, color: COLORS.textDim, fontStyle: 'italic', marginTop: 2 },
  itemMeta: { fontSize: 11, color: COLORS.textDim, marginTop: 4 },
  itemActions: { flexDirection: 'row' },
  iconBtn: { padding: 4, marginLeft: 8 },
  oppTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inactiveBadge: { fontSize: 10, fontWeight: '700', color: COLORS.danger, backgroundColor: COLORS.dangerSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  statusPicker: { flexDirection: 'row', gap: 6, marginLeft: 8, flexWrap: 'wrap' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  statusChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusChipText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  statusChipTextActive: { color: '#fff' },
  typeChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.surfaceAlt, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 13, color: COLORS.textMuted },
  typeChipTextActive: { color: '#fff' },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  activeLabel: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
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
});
