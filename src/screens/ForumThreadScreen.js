import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONT } from '../theme';
import { PageHeader, Container } from '../components/ui';
import Footer from '../components/Footer';


export default function ForumThreadScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { topicId, topicTitle } = route.params || {};
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, [topicId]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forum_posts')
        .select('*, users(full_name)')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async () => {
    if (!user) {
      showAlert('Please login', 'You need to be logged in to reply.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from('forum_posts').insert([
        { topic_id: topicId, user_id: user.id, text: replyText.trim() },
      ]);
      if (error) throw error;

      const { data: topic } = await supabase.from('forum_topics').select('reply_count').eq('id', topicId).single();
      await supabase.from('forum_topics').update({ reply_count: (topic?.reply_count || 0) + 1 }).eq('id', topicId);

      setReplyText('');
      fetchPosts();
    } catch (error) {
      showAlert('Error', error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageHeader title={topicTitle || 'Discussion'} icon="chatbubble-ellipses-outline" overline="Discussion forums" />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={50} color={COLORS.gray400} />
              <Text style={styles.emptyText}>No replies yet — start the conversation.</Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <Text style={styles.postAuthor}>{post.users?.full_name || 'A citizen'}</Text>
                <Text style={styles.postText}>{post.text}</Text>
                <Text style={styles.postTime}>{new Date(post.created_at).toLocaleString()}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <View style={styles.replyBar}>
        <TextInput
          style={styles.replyInput}
          placeholder="Write a reply..."
          value={replyText}
          onChangeText={setReplyText}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendReply} disabled={sending}>
          {sending ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="send" size={22} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray800, flex: 1, marginHorizontal: 12, textAlign: 'center' },
  list: { flex: 1 },
  listContent: { padding: 16 },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  postAuthor: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  postText: { fontSize: 15, color: COLORS.gray800, marginBottom: 6 },
  postTime: { fontSize: 11, color: COLORS.gray500 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: COLORS.gray500, marginTop: 12, textAlign: 'center' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: { padding: 8 },
});
