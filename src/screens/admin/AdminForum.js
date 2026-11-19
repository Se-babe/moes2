import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../services/supabaseClient';
import { ADMIN_COLORS as COLORS } from './adminTheme';

export default function AdminForum() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forum_topics')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTopics(data || []);
    } catch (error) {
      console.error('Error fetching forum topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTopic = (id) => {
    showAlert('Delete Topic', 'This also deletes all replies in this discussion. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('forum_topics').delete().eq('id', id);
          if (error) showAlert('Error', error.message);
          else fetchTopics();
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <View style={styles.cardHeader}>
          <Text style={styles.category}>{item.category || 'General'}</Text>
          <Text style={styles.replyCount}>{item.reply_count || 0} replies</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
        <Text style={styles.meta}>By {item.author_name || 'Community member'} · {new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTopic(item.id)}>
        <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
      </TouchableOpacity>
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
      <Text style={styles.heading}>Discussion Topics ({topics.length})</Text>
      {topics.length === 0 ? (
        <Text style={styles.emptyText}>No discussions yet.</Text>
      ) : (
        <FlatList data={topics} renderItem={renderItem} keyExtractor={(item) => item.id} scrollEnabled={false} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, paddingVertical: 8 },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'flex-start',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  category: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  replyCount: { fontSize: 11, color: COLORS.textDim },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  desc: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  meta: { fontSize: 11, color: COLORS.textDim, marginTop: 6 },
  deleteBtn: { padding: 6, marginLeft: 8 },
});
