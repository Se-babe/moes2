import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { sendEmail } from '../../services/email';
import { ADMIN_COLORS as COLORS } from './adminTheme';

const emptyPollForm = () => ({ consultationId: null, question: '', options: ['', ''] });

export default function AdminConsultations() {
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pollModalVisible, setPollModalVisible] = useState(false);
  const [pollForm, setPollForm] = useState(emptyPollForm());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select('*, polls (id, question, poll_options (id, option_text, vote_count))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPending((data || []).filter((c) => !c.is_active));
      setActive((data || []).filter((c) => c.is_active));
    } catch (error) {
      console.error('Error fetching consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (item) => {
    const { error } = await supabase.from('consultations').update({ is_active: true }).eq('id', item.id);
    if (error) {
      showAlert('Error', error.message);
      return;
    }
    fetchData();
    sendEmail(
      item.proposer_email,
      'Your consultation proposal was approved',
      `<p>Good news — your proposed consultation "<strong>${item.title}</strong>" has been approved and is now live for citizens to engage with on the NWSC e-Participation platform.</p>`
    );
  };

  const deactivate = async (id) => {
    const { error } = await supabase.from('consultations').update({ is_active: false }).eq('id', id);
    if (error) showAlert('Error', error.message);
    else fetchData();
  };

  const reject = (item) => {
    showAlert('Reject Proposal', 'This permanently deletes the proposed consultation. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('consultations').delete().eq('id', item.id);
          if (error) {
            showAlert('Error', error.message);
            return;
          }
          fetchData();
          sendEmail(
            item.proposer_email,
            'Update on your consultation proposal',
            `<p>Thank you for proposing "<strong>${item.title}</strong>" on the NWSC e-Participation platform. After review, we won't be moving forward with this proposal at this time. We appreciate you taking the time to contribute.</p>`
          );
        },
      },
    ]);
  };

  const openAddPoll = (consultationId) => {
    setPollForm({ ...emptyPollForm(), consultationId });
    setPollModalVisible(true);
  };

  const updatePollOption = (index, text) => {
    setPollForm((prev) => {
      const options = [...prev.options];
      options[index] = text;
      return { ...prev, options };
    });
  };

  const addOptionField = () => {
    setPollForm((prev) => (prev.options.length >= 6 ? prev : { ...prev, options: [...prev.options, ''] }));
  };

  const removeOptionField = (index) => {
    setPollForm((prev) => (prev.options.length <= 2 ? prev : { ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };

  const savePoll = async () => {
    const question = pollForm.question.trim();
    const options = pollForm.options.map((o) => o.trim()).filter(Boolean);
    if (!question) {
      showAlert('Error', 'Poll question is required.');
      return;
    }
    if (options.length < 2) {
      showAlert('Error', 'A poll needs at least 2 options.');
      return;
    }
    try {
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .insert([{ consultation_id: pollForm.consultationId, question }])
        .select()
        .single();
      if (pollError) throw pollError;

      const { error: optionsError } = await supabase
        .from('poll_options')
        .insert(options.map((option_text) => ({ poll_id: poll.id, option_text })));
      if (optionsError) throw optionsError;

      setPollModalVisible(false);
      setPollForm(emptyPollForm());
      fetchData();
    } catch (error) {
      showAlert('Error', error.message);
    }
  };

  const deletePoll = (pollId) => {
    showAlert('Delete Poll', 'This also deletes all options and votes for this poll. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('polls').delete().eq('id', pollId);
          if (error) showAlert('Error', error.message);
          else fetchData();
        },
      },
    ]);
  };

  const renderPending = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
      <Text style={styles.meta}>Proposed by: {item.proposer_email || 'Unknown'} {item.proposer_phone ? `· ${item.proposer_phone}` : ''}</Text>
      {item.closing_date && <Text style={styles.meta}>Closing date: {item.closing_date}</Text>}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => approve(item)}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Approve & Activate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => reject(item)}>
          <Ionicons name="close-circle-outline" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderActive = ({ item }) => {
    const poll = item.polls && item.polls[0];
    return (
      <View style={styles.card}>
        <View style={styles.activeHeader}>
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>Live</Text></View>
        </View>
        <Text style={styles.meta}>Closes: {item.closing_date ? new Date(item.closing_date).toDateString() : 'No date set'}</Text>

        {poll ? (
          <View style={styles.pollBox}>
            <View style={styles.pollBoxHeader}>
              <Ionicons name="stats-chart-outline" size={14} color={COLORS.info} />
              <Text style={styles.pollBoxQuestion}>{poll.question}</Text>
            </View>
            {poll.poll_options.map((opt) => (
              <Text key={opt.id} style={styles.pollOptionRow}>• {opt.option_text} — {opt.vote_count || 0} votes</Text>
            ))}
            <TouchableOpacity style={styles.deletePollBtn} onPress={() => deletePoll(poll.id)}>
              <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
              <Text style={styles.deletePollBtnText}>Delete Poll</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addPollBtn} onPress={() => openAddPoll(item.id)}>
            <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.addPollBtnText}>Add Poll</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.actionBtn, styles.deactivateBtn]} onPress={() => deactivate(item.id)}>
          <Ionicons name="pause-circle-outline" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Deactivate</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Pending Proposals ({pending.length})</Text>
      {pending.length === 0 ? (
        <Text style={styles.emptyText}>No proposals waiting for review.</Text>
      ) : (
        <FlatList data={pending} renderItem={renderPending} keyExtractor={(item) => item.id} scrollEnabled={false} />
      )}

      <Text style={[styles.heading, { marginTop: 24 }]}>Active Consultations ({active.length})</Text>
      {active.length === 0 ? (
        <Text style={styles.emptyText}>No active consultations.</Text>
      ) : (
        <FlatList data={active} renderItem={renderActive} keyExtractor={(item) => item.id} scrollEnabled={false} />
      )}

      <Modal visible={pollModalVisible} animationType="slide" transparent onRequestClose={() => setPollModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Poll</Text>
            <TextInput
              style={styles.input}
              placeholder="Poll question *"
              placeholderTextColor={COLORS.textDim}
              value={pollForm.question}
              onChangeText={(text) => setPollForm({ ...pollForm, question: text })}
            />
            {pollForm.options.map((opt, i) => (
              <View key={i} style={styles.optionInputRow}>
                <TextInput
                  style={[styles.input, styles.optionInput]}
                  placeholder={`Option ${i + 1}`}
                  placeholderTextColor={COLORS.textDim}
                  value={opt}
                  onChangeText={(text) => updatePollOption(i, text)}
                />
                {pollForm.options.length > 2 && (
                  <TouchableOpacity style={styles.removeOptionBtn} onPress={() => removeOptionField(i)}>
                    <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {pollForm.options.length < 6 && (
              <TouchableOpacity style={styles.addOptionBtn} onPress={addOptionField}>
                <Ionicons name="add" size={16} color={COLORS.primary} />
                <Text style={styles.addOptionBtnText}>Add Option</Text>
              </TouchableOpacity>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => { setPollModalVisible(false); setPollForm(emptyPollForm()); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={savePoll}>
                <Text style={styles.submitBtnText}>Create Poll</Text>
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
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, paddingVertical: 8 },
  card: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveBadge: { backgroundColor: COLORS.success, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  liveBadgeText: { color: '#06281a', fontSize: 11, fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  desc: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  meta: { fontSize: 12, color: COLORS.textDim, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flex: 1 },
  approveBtn: { backgroundColor: COLORS.success },
  rejectBtn: { backgroundColor: COLORS.danger },
  deactivateBtn: { backgroundColor: COLORS.warning, marginTop: 10, alignSelf: 'flex-start', flex: 0, paddingHorizontal: 16 },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  pollBox: {
    marginTop: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pollBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  pollBoxQuestion: { fontSize: 13, fontWeight: '700', color: COLORS.text, flex: 1 },
  pollOptionRow: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  deletePollBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  deletePollBtnText: { color: COLORS.danger, fontSize: 12, fontWeight: '600' },
  addPollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: COLORS.infoSoft,
  },
  addPollBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, width: '90%', maxHeight: '85%', borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.surfaceAlt },
  optionInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionInput: { flex: 1 },
  removeOptionBtn: { marginBottom: 10 },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12, alignSelf: 'flex-start' },
  addOptionBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginLeft: 8 },
  cancelBtn: { backgroundColor: COLORS.surfaceAlt },
  cancelBtnText: { color: COLORS.textMuted },
  submitBtn: { backgroundColor: COLORS.primary },
  submitBtnText: { color: '#fff', fontWeight: '600' },
});
