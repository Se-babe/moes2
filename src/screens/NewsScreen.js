import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { COLORS, FONT } from '../theme';
import { PageHeader, Container, EmptyState } from '../components/ui';
import Footer from '../components/Footer';
import { usePreferences } from '../context/PreferencesContext';


export default function NewsScreen() {
  const { lite } = usePreferences();
  const navigation = useNavigation();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('is_active', true)
        .order('published_date', { ascending: false });
      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading news...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PageHeader title="News & announcements" subtitle="Official news, project updates and announcements from NWSC Jinja." icon="newspaper-outline" overline="Newsroom" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {news.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState icon="newspaper-outline" title="No news yet" message="News and announcements from NWSC Jinja will appear here." />
          </View>
        ) : (
          news.map((item) => (
            <View key={item.id} style={styles.card}>
              {item.image_url && !lite ? <Image source={{ uri: item.image_url }} style={styles.cardImage} /> : null}
              <Text style={styles.cardDate}>{new Date(item.published_date).toDateString()}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.summary ? <Text style={styles.cardSummary}>{item.summary}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: COLORS.gray200,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.gray800 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardImage: { width: '100%', height: 160, borderRadius: 8, marginBottom: 10, backgroundColor: COLORS.gray200 },
  cardDate: { fontSize: 12, color: COLORS.gray500, marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginBottom: 6 },
  cardSummary: { fontSize: 14, color: COLORS.gray600 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: COLORS.gray500, marginTop: 12 },
});
