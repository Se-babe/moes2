import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';

const COLORS = {
  primary: '#0B5FA5',
  gray50: '#F8FAFC',
  gray200: '#E2E8F0',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray800: '#1E293B',
};

const SECTIONS = [
  { key: 'consultations', label: 'Consultations', icon: 'document-text-outline', table: 'consultations', field: 'title', screen: 'Consultations' },
  { key: 'news', label: 'News', icon: 'newspaper-outline', table: 'news', field: 'title', screen: 'News' },
  { key: 'forum_topics', label: 'Discussion Forums', icon: 'chatbubbles-outline', table: 'forum_topics', field: 'title', screen: 'Forum', detailScreen: 'ForumThread', detailParam: 'topicId' },
  { key: 'faqs', label: 'FAQs', icon: 'help-circle-outline', table: 'faqs', field: 'question', screen: 'FAQs' },
];

export default function SearchResultsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const initialQuery = route.params?.query || '';
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState({});

  useEffect(() => {
    runSearch(initialQuery);
  }, [initialQuery]);

  const runSearch = async (q) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const entries = await Promise.all(
      SECTIONS.map(async (section) => {
        const { data } = await supabase
          .from(section.table)
          .select('*')
          .ilike(section.field, `%${trimmed}%`)
          .limit(8);
        return [section.key, data || []];
      })
    );
    setResults(Object.fromEntries(entries));
    setLoading(false);
  };

  const submitSearch = () => {
    navigation.setParams({ query });
    runSearch(query);
  };

  const openResult = (section, item) => {
    if (section.detailScreen) {
      navigation.navigate(section.detailScreen, { [section.detailParam]: item.id });
    } else {
      navigation.navigate(section.screen);
    }
  };

  const totalCount = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🔎 Search</Text>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={COLORS.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search consultations, news, FAQs, forums..."
          placeholderTextColor={COLORS.gray400}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={submitSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : !query.trim() ? (
        <Text style={styles.emptyText}>Type something above and press Search.</Text>
      ) : totalCount === 0 ? (
        <Text style={styles.emptyText}>No results for "{query.trim()}".</Text>
      ) : (
        SECTIONS.map((section) => {
          const items = results[section.key] || [];
          if (items.length === 0) return null;
          return (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name={section.icon} size={16} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>{section.label}</Text>
              </View>
              {items.map((item) => (
                <TouchableOpacity key={item.id} style={styles.resultCard} onPress={() => openResult(section, item)}>
                  <Text style={styles.resultText} numberOfLines={2}>{item[section.field]}</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.gray400} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary, marginBottom: 16 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.gray200,
    marginBottom: 20, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.gray800 },
  searchBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { color: COLORS.gray500, fontSize: 14, paddingVertical: 8 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.gray200,
  },
  resultText: { flex: 1, fontSize: 14, color: COLORS.gray800, marginRight: 8 },
});
