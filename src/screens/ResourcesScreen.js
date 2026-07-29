import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';

// ============================================================
// EMBEDDED COLORS – No external import
// ============================================================
const COLORS = {
  primary: '#1E3A8A',
  primaryLight: '#3B82F6',
  primaryDark: '#0F172A',
  accent: '#FCD34D',
  white: '#FFFFFF',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};

// ============================================================
// STATIC FALLBACK DATA (if table is empty or not created)
// ============================================================
const STATIC_RESOURCES = [
  { id: '1', title: 'Circular 05/2026 – School Fees Guidelines', description: 'Official circular on school fees structure for 2026.', category: 'Circulars' },
  { id: '2', title: 'Education Sector Performance Report 2025', description: 'Annual report on education sector performance.', category: 'Reports' },
  { id: '3', title: 'Uganda National Education Act (2024)', description: 'Full text of the Uganda National Education Act 2024.', category: 'Policies' },
  { id: '4', title: 'Sports Development Strategy 2025-2030', description: 'Strategic plan for sports development in Uganda.', category: 'Policies' },
  { id: '5', title: 'Teacher Training Manual', description: 'Comprehensive manual for teacher professional development.', category: 'Training' },
];

export default function ResourcesScreen() {
  const navigation = useNavigation();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Get unique categories
  const categories = ['All', ...new Set(resources.map(r => r.category).filter(Boolean))];

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    setLoading(true);
    try {
      // Try to fetch from Supabase
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setResources(data);
      } else {
        // Fallback to static data
        setResources(STATIC_RESOURCES);
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
      // Fallback to static data
      setResources(STATIC_RESOURCES);
    } finally {
      setLoading(false);
    }
  };

  const filteredResources = selectedCategory === 'All'
    ? resources
    : resources.filter(r => r.category === selectedCategory);

  const handleDownload = (item) => {
    if (item.file_url) {
      Linking.openURL(item.file_url).catch(() =>
        Alert.alert('Error', 'Could not open the file.')
      );
    } else {
      Alert.alert('Info', 'No file attached to this resource.');
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
        <Text style={styles.cardTitle}>{item.title}</Text>
      </View>
      <Text style={styles.cardDesc}>{item.description}</Text>
      <View style={styles.cardFooter}>
        {item.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload(item)}>
          <Ionicons name="download-outline" size={18} color={COLORS.primary} />
          <Text style={styles.downloadText}>Download</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading resources...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📚 Resources</Text>
        <TouchableOpacity onPress={fetchResources}>
          <Ionicons name="refresh-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              selectedCategory === cat && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat && styles.categoryChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Resources List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredResources.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={60} color={COLORS.gray400} />
            <Text style={styles.emptyText}>No resources found</Text>
          </View>
        ) : (
          filteredResources.map((item, index) => (
            <View key={item.id || index} style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
                <Text style={styles.cardTitle}>{item.title}</Text>
              </View>
              <Text style={styles.cardDesc}>{item.description}</Text>
              <View style={styles.cardFooter}>
                {item.category && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload(item)}>
                  <Ionicons name="download-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.downloadText}>Download</Text>
                </TouchableOpacity>
              </View>
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
  categoryScroll: { flexGrow: 0, backgroundColor: '#fff' },
  categoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.gray100,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: COLORS.gray700,
  },
  categoryChipTextActive: {
    color: '#fff',
  },
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginLeft: 8, flex: 1 },
  cardDesc: { fontSize: 14, color: COLORS.gray600, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryBadge: {
    backgroundColor: COLORS.gray100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: { fontSize: 12, color: COLORS.gray600 },
  downloadBtn: { flexDirection: 'row', alignItems: 'center' },
  downloadText: { fontSize: 14, color: COLORS.primary, marginLeft: 4 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 16, color: COLORS.gray500, marginTop: 12 },
});