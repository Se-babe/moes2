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
} from 'react-native';
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';

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
  accent: '#FCD34D',
};

const CATEGORIES = ['General', 'Education', 'Sports', 'Health', 'Innovation'];

export default function ForumScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forum_topics')
        .select('*, users(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTopics(data || []);
    } catch (error) {
      console.error('Error fetching forum topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const openNewTopic = () => {
    if (!user) {
      showAlert('Please login', 'You need to be logged in to start a discussion.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    setModalVisible(true);
  };

  const submitTopic = async () => {
    if (!newTitle.trim()) {
      showAlert('Error', 'Please enter a title for your topic.');
      return;
    }
    setPosting(true);
    try {
      const { error } = await supabase.from('forum_topics').insert([
        {
          title: newTitle.trim(),
          description: newDescription.trim(),
          category: newCategory,
          user_id: user.id,
        },
      ]);
      if (error) throw error;
      setNewTitle('');
      setNewDescription('');
      setModalVisible(false);
      showAlert('Thank You!', 'Your discussion topic has been posted.');
      fetchTopics();
    } catch (error) {
      showAlert('Error', error.message);
    } finally {
      setPosting(false);
    }
  };

  const timeAgo = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading discussions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💬 Discussion Forums</Text>
        <TouchableOpacity onPress={fetchTopics}>
          <Ionicons name="refresh-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.newTopicBtn} onPress={openNewTopic}>
          <Ionicons name="add-circle-outline" size={22} color="#fff" />
          <Text style={styles.newTopicBtnText}>Start a Discussion</Text>
        </TouchableOpacity>

        {topics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color={COLORS.gray400} />
            <Text style={styles.emptyText}>No discussions yet — be the first to start one!</Text>
          </View>
        ) : (
          topics.map((topic) => (
            <TouchableOpacity
              key={topic.id}
              style={styles.card}
              onPress={() => navigation.navigate('ForumThread', { topicId: topic.id, topicTitle: topic.title })}
            >
              <View style={styles.cardHeader}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{topic.category || 'General'}</Text>
                </View>
                <Text style={styles.timeText}>{timeAgo(topic.created_at)}</Text>
              </View>
              <Text style={styles.cardTitle}>{topic.title}</Text>
              {topic.description ? <Text style={styles.cardDesc} numberOfLines={2}>{topic.description}</Text> : null}
              <View style={styles.cardFooter}>
                <Text style={styles.authorText}>By {topic.users?.full_name || 'A citizen'}</Text>
                <View style={styles.replyCountRow}>
                  <Ionicons name="chatbubble-outline" size={14} color={COLORS.gray500} />
                  <Text style={styles.replyCountText}>{topic.reply_count || 0} replies</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Start a Discussion</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray500} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, newCategory === cat && styles.catChipActive]}
                  onPress={() => setNewCategory(cat)}
                >
                  <Text style={[styles.catChipText, newCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput style={styles.input} placeholder="Topic title" value={newTitle} onChangeText={setNewTitle} />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What would you like to discuss?"
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
            />
            <TouchableOpacity style={styles.submitBtn} onPress={submitTopic} disabled={posting}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Post Topic</Text>}
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
  list: { flex: 1 },
  listContent: { padding: 16 },
  newTopicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 30,
    marginBottom: 16,
    gap: 8,
  },
  newTopicBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  categoryBadge: { backgroundColor: COLORS.gray100, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  categoryText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  timeText: { fontSize: 12, color: COLORS.gray500 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginBottom: 4 },
  cardDesc: { fontSize: 14, color: COLORS.gray600, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  authorText: { fontSize: 12, color: COLORS.gray500 },
  replyCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyCountText: { fontSize: 12, color: COLORS.gray500 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: COLORS.gray500, marginTop: 12, textAlign: 'center', paddingHorizontal: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '90%', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray800 },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.gray100, marginRight: 8 },
  catChipActive: { backgroundColor: COLORS.primary },
  catChipText: { fontSize: 13, color: COLORS.gray700 },
  catChipTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 30, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
