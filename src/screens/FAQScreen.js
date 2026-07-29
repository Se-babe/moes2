import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';

const COLORS = {
  primary: '#1E3A8A',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray700: '#334155',
  gray800: '#1E293B',
  danger: '#EF4444',
};

export default function FAQScreen() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    setLoading(true);
    const { data } = await supabase.from('faqs').select('*').order('created_at', { ascending: false });
    if (data) setFaqs(data);
    setLoading(false);
  };

  const addFAQ = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      Alert.alert('Error', 'Please fill in both fields.');
      return;
    }
    const { error } = await supabase.from('faqs').insert([{ question: newQuestion, answer: newAnswer }]);
    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert('Success', 'FAQ added!');
      setNewQuestion('');
      setNewAnswer('');
      setModalVisible(false);
      fetchFAQs();
    }
  };

  const deleteFAQ = async (id) => {
    Alert.alert('Delete FAQ', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('faqs').delete().eq('id', id);
          fetchFAQs();
        },
      },
    ]);
  };

  const filteredFAQs = faqs.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading FAQs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={COLORS.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search FAQs..."
          placeholderTextColor={COLORS.gray400}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
        <Ionicons name="add-circle" size={24} color={COLORS.primary} />
        <Text style={styles.addBtnText}>Add FAQ</Text>
      </TouchableOpacity>

      <ScrollView style={styles.list}>
        {filteredFAQs.length === 0 ? (
          <Text style={styles.emptyText}>No FAQs found. Add one!</Text>
        ) : (
          filteredFAQs.map((item) => (
            <View key={item.id} style={styles.faqItem}>
              <TouchableOpacity
                style={styles.faqHeader}
                onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <View style={styles.faqActions}>
                  <TouchableOpacity onPress={() => deleteFAQ(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                  <Ionicons name={expandedId === item.id ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
              {expandedId === item.id && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{item.answer}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New FAQ</Text>
            <TextInput style={styles.modalInput} placeholder="Question" value={newQuestion} onChangeText={setNewQuestion} />
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Answer"
              value={newAnswer}
              onChangeText={setNewAnswer}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalSubmit]} onPress={addFAQ}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginBottom: 12,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: COLORS.gray800 },
  addBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginBottom: 12 },
  addBtnText: { color: COLORS.primary, fontWeight: '600', marginLeft: 4 },
  list: { flex: 1 },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  faqQuestion: { fontSize: 15, fontWeight: '600', color: COLORS.gray800, flex: 1, marginRight: 8 },
  faqActions: { flexDirection: 'row', alignItems: 'center' },
  deleteBtn: { marginRight: 10 },
  faqAnswer: { padding: 14, paddingTop: 0, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  faqAnswerText: { fontSize: 14, color: COLORS.gray500, lineHeight: 20 },
  emptyText: { textAlign: 'center', color: COLORS.gray400, paddingVertical: 40 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.gray800, marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12 },
  modalTextArea: { height: 100, paddingTop: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginLeft: 10 },
  modalCancel: { backgroundColor: COLORS.gray100 },
  modalSubmit: { backgroundColor: COLORS.primary },
  modalBtnText: { fontWeight: '600', color: COLORS.gray700 },
});