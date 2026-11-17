import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import Footer from '../components/Footer';
import { showAlert } from '../utils/alert';

const { width } = Dimensions.get('window');

// ===== COLORS EMBEDDED =====
const COLORS = {
  primary: '#0B5FA5',
  primaryDark: '#0F172A',
  accent: '#FCD34D',
  gray50: '#F8FAFC',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const flatListRef = useRef(null);

  // State
  const [slides, setSlides] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [news, setNews] = useState([]);
  const [stats, setStats] = useState({ consultations: 0, feedback: 0, responseRate: 0, ideas: 0 });
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch data
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Slides
      const { data: slidesData } = await supabase
        .from('slides')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true });
      if (slidesData) setSlides(slidesData);

      // Consultations (active, limit 3)
      const { data: consData } = await supabase
        .from('consultations')
        .select('*')
        .eq('is_active', true)
        .order('closing_date', { ascending: true })
        .limit(3);
      if (consData) setConsultations(consData);

      // News (active, most recent 3)
      const { data: newsData } = await supabase
        .from('news')
        .select('*')
        .eq('is_active', true)
        .order('published_date', { ascending: false })
        .limit(3);
      if (newsData) setNews(newsData);

      // Stats
      const { count: consCount } = await supabase
        .from('consultations')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      const { count: feedbackCount } = await supabase
        .from('feedback')
        .select('*', { count: 'exact', head: true });
      setStats({
        consultations: consCount || 0,
        feedback: feedbackCount || 0,
        responseRate: 93,
        ideas: 456,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-slide for carousel
  useEffect(() => {
    if (slides.length === 0) return;
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % slides.length;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex, slides]);

  const goToSlide = (index) => {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  };

  const renderSlide = ({ item }) => (
    <View style={styles.slide}>
      <Image source={{ uri: item.image_url }} style={styles.slideImage} resizeMode="cover" />
      <View style={styles.slideOverlay}>
        <View style={styles.slideTextContainer}>
          <Text style={styles.slideTitle}>{item.title}</Text>
          {item.subtitle && <Text style={styles.slideSubtitle}>{item.subtitle}</Text>}
          {item.quote && (
            <View style={styles.quoteBox}>
              <Ionicons name="chatbubble-outline" size={16} color={COLORS.accent} />
              <Text style={styles.slideQuote}>{item.quote}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  // Quick action cards
  const quickActions = [
    { id: 'q1', icon: 'water-outline', title: 'Report a Problem', color: '#F87171', screen: 'Feedback' },
    { id: 'q2', icon: 'help-circle-outline', title: 'Make an Enquiry', color: '#3B82F6', screen: 'Feedback' },
    { id: 'q3', icon: 'search-outline', title: 'Track My Request', color: '#0EA5E9', screen: 'FeedbackList' },
    { id: 'q4', icon: 'megaphone-outline', title: 'Service Updates', color: '#818CF8', screen: 'Updates' },
    { id: 'q5', icon: 'document-text-outline', title: 'Consultations', color: '#A78BFA', screen: 'Consultations' },
    { id: 'q6', icon: 'stats-chart-outline', title: 'Take a Survey', color: '#34D399', screen: 'Surveys' },
    { id: 'q7', icon: 'bulb-outline', title: 'Suggestions', color: '#FBBF24', screen: 'Feedback' },
    { id: 'q8', icon: 'film-outline', title: 'Media Gallery', color: '#FB923C', screen: 'MediaGallery' },
    { id: 'q9', icon: 'help-buoy-outline', title: 'FAQs', color: '#EC4899', screen: 'FAQs' },
  ];

  // Participation cards
  const participationCards = [
    { icon: '📄', title: 'Public Consultations', desc: 'Give your views on proposed tariffs, projects, and service changes.', screen: 'Consultations' },
    { icon: '📊', title: 'Surveys & Polls', desc: 'Share your experience and help us improve services.', screen: 'Surveys' },
    { icon: '💬', title: 'Discussion Forums', desc: 'Join topics, ask questions, and share knowledge.', screen: 'Forum' },
    { icon: '🎬', title: 'Media Gallery', desc: 'Photos and short clips from NWSC projects and community events.', screen: 'MediaGallery' },
    { icon: '🏛️', title: 'Virtual Town Halls', desc: 'See scheduled community meetings with NWSC Jinja and how to join.', screen: 'TownHalls' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ===== CAROUSEL ===== */}
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={renderSlide}
          getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
          onScroll={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            if (index !== currentIndex) setCurrentIndex(index);
          }}
          scrollEventThrottle={16}
        />
        <TouchableOpacity style={[styles.arrow, styles.arrowLeft]} onPress={() => goToSlide(currentIndex - 1)}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.arrow, styles.arrowRight]} onPress={() => goToSlide(currentIndex + 1)}>
          <Ionicons name="chevron-forward" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.dotsContainer}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>
      </View>

      {/* ===== WELCOME ===== */}
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeTitle}>💧 NWSC Jinja e‑Participation</Text>
        <Text style={styles.welcomeSub}>
          Report water and sewer issues, track your requests, and stay informed about services in your area.
        </Text>
      </View>

      {/* ===== STATS CARDS ===== */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.consultations}</Text>
          <Text style={styles.statLabel}>Active Consultations</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.feedback}</Text>
          <Text style={styles.statLabel}>Feedback Submissions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.responseRate}%</Text>
          <Text style={styles.statLabel}>Response Rate</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.ideas}</Text>
          <Text style={styles.statLabel}>Ideas Submitted</Text>
        </View>
      </View>

      {/* ===== QUICK ACTION CARDS ===== */}
      <View style={styles.quickActions}>
        {quickActions.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.actionCard}
            onPress={() => navigation.navigate(item.screen, item.params)}
          >
            <View style={[styles.actionIcon, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon} size={24} color="#fff" />
            </View>
            <Text style={styles.actionTitle}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ===== ACTIVE CONSULTATIONS ===== */}
      {consultations.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📢 Active Consultations</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Consultations')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSubtitle}>
            Review and comment on draft policies that shape Uganda's future.
          </Text>
          {consultations.map((item) => (
            <View key={item.id} style={styles.consultCard}>
              <View style={styles.consultHeader}>
                <View style={styles.badgeOpen}>
                  <View style={styles.badgeDot} />
                  <Text style={styles.badgeOpenText}>Open</Text>
                </View>
                <Text style={styles.badgeClosing}>
                  Closes: {new Date(item.closing_date).toDateString()}
                </Text>
              </View>
              <Text style={styles.consultTitle}>{item.title}</Text>
              <Text style={styles.consultDesc}>{item.description}</Text>
              <TouchableOpacity
                style={styles.consultBtn}
                onPress={() => navigation.navigate('Consultations')}
              >
                <Text style={styles.consultBtnText}>View & Comment →</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ===== HOW YOU CAN PARTICIPATE ===== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚀 How You Can Participate</Text>
        <Text style={styles.sectionSubtitle}>
          Multiple ways to make your voice heard and shape national policies.
        </Text>
        <View style={styles.participationGrid}>
          {participationCards.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.participationCard}
              onPress={() =>
                item.screen
                  ? navigation.navigate(item.screen)
                  : showAlert('Coming Soon', `${item.title} isn't available yet — check back soon.`)
              }
              activeOpacity={0.7}
            >
              <Text style={styles.participationIcon}>{item.icon}</Text>
              <Text style={styles.participationTitle}>{item.title}</Text>
              <Text style={styles.participationDesc}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ===== NEWS & IMPACT ===== */}
      {news.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📰 News & Impact</Text>
            <TouchableOpacity onPress={() => navigation.navigate('News')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {news.map((item) => (
            <View key={item.id} style={styles.newsCard}>
              <Text style={styles.newsDate}>{new Date(item.published_date).toDateString()}</Text>
              <Text style={styles.newsTitle}>{item.title}</Text>
              {item.summary ? <Text style={styles.newsSummary} numberOfLines={2}>{item.summary}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {/* ===== FOOTER ===== */}
      <Footer />
    </ScrollView>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },

  // Carousel
  carouselContainer: { height: 350, width: '100%', position: 'relative' },
  slide: { width, height: 350, position: 'relative' },
  slideImage: { width: '100%', height: '100%' },
  slideOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  slideTextContainer: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    padding: 20,
  },
  slideTitle: { color: '#fff', fontSize: 28, fontWeight: '800', lineHeight: 34 },
  slideSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 16, marginTop: 4 },
  quoteBox: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  slideQuote: { color: COLORS.accent, fontSize: 14, fontStyle: 'italic', flexShrink: 1, marginLeft: 6 },
  arrow: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 8,
    zIndex: 5,
  },
  arrowLeft: { left: 10 },
  arrowRight: { right: 10 },
  dotsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 4 },
  dotActive: { backgroundColor: COLORS.accent, width: 12 },

  // Welcome
  welcomeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(30, 58, 138, 0.9)',
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  welcomeSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 4 },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    width: (width - 48) / 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 10, color: COLORS.gray500, textAlign: 'center', marginTop: 2 },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    width: (width - 48) / 3,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionTitle: { fontWeight: '700', fontSize: 11, textAlign: 'center', color: COLORS.gray700 },

  // Section
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.gray800 },
  sectionSubtitle: { fontSize: 14, color: COLORS.gray500, marginBottom: 16 },
  viewAll: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },

  // Consultations
  consultCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  consultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeOpen: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 4 },
  badgeOpenText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  badgeClosing: { color: COLORS.warning, fontSize: 12, fontWeight: '600' },
  consultTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginTop: 8 },
  consultDesc: { color: COLORS.gray500, fontSize: 14, marginTop: 4 },
  consultBtn: { marginTop: 10, alignSelf: 'flex-start' },
  consultBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },

  // Participation
  participationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  participationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: (width - 48) / 2,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  participationIcon: { fontSize: 32 },
  participationTitle: { fontWeight: '700', marginTop: 6, textAlign: 'center', color: COLORS.gray800 },
  participationDesc: { fontSize: 12, color: COLORS.gray500, textAlign: 'center', marginTop: 2 },

  // News
  newsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  newsDate: { fontSize: 12, color: COLORS.gray500, marginBottom: 4 },
  newsTitle: { fontSize: 15, fontWeight: '700', color: COLORS.gray800, marginBottom: 4 },
  newsSummary: { fontSize: 13, color: COLORS.gray600 },
});