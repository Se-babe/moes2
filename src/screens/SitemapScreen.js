import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const COLORS = {
  primary: '#1E3A8A',
  gray50: '#F8FAFC',
  gray200: '#E2E8F0',
  gray500: '#64748B',
  gray800: '#1E293B',
};

const SECTIONS = [
  {
    heading: 'Main',
    icon: 'home-outline',
    links: [
      { label: 'Home', screen: 'Home' },
      { label: 'Performance Dashboard', screen: 'Dashboard' },
      { label: 'Search', screen: 'SearchResults', params: { query: '' } },
    ],
  },
  {
    heading: 'About',
    icon: 'information-circle-outline',
    links: [
      { label: 'About MoES', screen: 'About' },
      { label: 'Projects', screen: 'Projects' },
      { label: 'Information Systems', screen: 'InfoSystems' },
      { label: 'Opportunities (Jobs, Scholarships, Tenders)', screen: 'Opportunities' },
    ],
  },
  {
    heading: 'Participation',
    icon: 'people-outline',
    links: [
      { label: 'Draft Policies (Consultations)', screen: 'Consultations' },
      { label: 'Propose a Consultation', screen: 'ProposeConsultation' },
      { label: 'Surveys & Polls', screen: 'Surveys' },
      { label: 'Submit Feedback', screen: 'Feedback' },
      { label: 'View All Feedback', screen: 'FeedbackList' },
      { label: 'Discussion Forums', screen: 'Forum' },
      { label: 'Virtual Town Halls', screen: 'TownHalls' },
    ],
  },
  {
    heading: 'Resources',
    icon: 'book-outline',
    links: [
      { label: 'Resources & Downloads', screen: 'Resources' },
      { label: 'News & Impact', screen: 'News' },
      { label: 'FAQs', screen: 'FAQs' },
      { label: 'Media Gallery', screen: 'MediaGallery' },
      { label: 'Platform Updates', screen: 'Updates' },
    ],
  },
  {
    heading: 'Account',
    icon: 'person-outline',
    links: [
      { label: 'Log In', screen: 'Login' },
      { label: 'Sign Up', screen: 'SignUp' },
    ],
  },
  {
    heading: 'Contact',
    icon: 'call-outline',
    links: [
      { label: 'Contact Us', screen: 'Contact' },
    ],
  },
];

export default function SitemapScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🗺️ Sitemap</Text>
      <Text style={styles.sub}>Every section of the MoES e-Participation platform, in one place.</Text>

      {SECTIONS.map((section) => (
        <View key={section.heading} style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name={section.icon} size={18} color={COLORS.primary} />
            <Text style={styles.cardHeading}>{section.heading}</Text>
          </View>
          {section.links.map((link) => (
            <TouchableOpacity
              key={link.label}
              style={styles.linkRow}
              onPress={() => navigation.navigate(link.screen, link.params)}
            >
              <Text style={styles.linkText}>{link.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.gray500} />
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary },
  sub: { fontSize: 16, color: COLORS.gray500, marginTop: 10, marginBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.gray50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  cardHeading: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  linkText: { fontSize: 14, color: COLORS.gray800, fontWeight: '500' },
});
