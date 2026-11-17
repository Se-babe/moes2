import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT } from '../theme';
import { PageHeader, Container } from '../components/ui';
import Footer from '../components/Footer';


const SECTIONS = [
  {
    heading: 'Main',
    icon: 'home-outline',
    links: [
      { label: 'Home', screen: 'Home' },
      { label: 'Search', screen: 'SearchResults', params: { query: '' } },
    ],
  },
  {
    heading: 'About',
    icon: 'information-circle-outline',
    links: [
      { label: 'About NWSC', screen: 'About' },
      { label: 'Contact Us', screen: 'Contact' },
    ],
  },
  {
    heading: 'Participation',
    icon: 'people-outline',
    links: [
      { label: 'Public Consultations', screen: 'Consultations' },
      { label: 'Propose a Consultation', screen: 'ProposeConsultation' },
      { label: 'Surveys & Polls', screen: 'Surveys' },
      { label: 'Submit an Enquiry or Complaint', screen: 'Feedback' },
      { label: 'Track My Request', screen: 'TrackRequest' },
      { label: 'Discussion Forums', screen: 'Forum' },
      { label: 'Virtual Town Halls', screen: 'TownHalls' },
    ],
  },
  {
    heading: 'Information',
    icon: 'book-outline',
    links: [
      { label: 'News & Announcements', screen: 'News' },
      { label: 'FAQs', screen: 'FAQs' },
      { label: 'Media Gallery', screen: 'MediaGallery' },
      { label: 'Service Updates', screen: 'Updates' },
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
    <ScrollView style={styles.container}>
      <PageHeader title="Sitemap" subtitle="Every section of the NWSC e-Participation platform in one place." icon="map-outline" overline="Help" />
      <Container style={styles.content}>

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
      </Container>
      <Footer />
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
