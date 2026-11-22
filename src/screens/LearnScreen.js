import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { PageHeader, Container, Card, Button, Badge, Grid, Loading, useBreakpoint } from '../components/ui';
import Footer from '../components/Footer';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import { useAuth } from '../context/AuthContext';
import { fetchModules } from '../services/training';
import { STAFF_ROLES } from '../services/staff';

// A step-by-step tour of the platform. "Show me" opens the real page.
const TOUR = [
  { icon: 'water-outline', title: 'Report a problem', text: 'Tell us about a leak, no water, a sewer issue or a billing question. Three short steps, with a photo or your voice if you like.', screen: 'Feedback', params: { type: 'Complaint' } },
  { icon: 'search-outline', title: 'Track it with your reference', text: 'You get a reference number by SMS or email straight away. Enter it on "Track my request" to see every step until it is fixed.', screen: 'TrackRequest' },
  { icon: 'notifications-outline', title: 'Get alerts that matter to you', text: 'Create a free profile with your area, topics and language. We send planned interruptions, emergencies and restorations for your area.', screen: 'Alerts' },
  { icon: 'person-circle-outline', title: 'Your personal page', text: 'My NWSC shows notices for your area, consultations and surveys picked for you, and your requests in one place.', screen: 'Me' },
  { icon: 'chatbubbles-outline', title: 'Have your say', text: 'Read proposals before decisions are made, answer surveys, vote in polls and ask questions in the forums.', screen: 'Consultations' },
  { icon: 'library-outline', title: 'See decisions and reports', text: 'Policies, decisions, tariffs and performance reports are published in the document library and on the performance dashboard.', screen: 'Documents' },
  { icon: 'accessibility-outline', title: 'Make it work for you', text: 'Switch to Luganda or Lusoga, enlarge the text, turn on high contrast, or use Lite mode to save data. Look for "Display" at the top of the page.', screen: null },
];

const PRACTICE = [
  { kind: 'report', icon: 'water-outline', title: 'Practise reporting a leak', text: 'Fill in a pretend report with tips at every step. Nothing is sent.' },
  { kind: 'track', icon: 'search-outline', title: 'Practise tracking a request', text: 'Use a sample reference number and read its progress.' },
  { kind: 'consult', icon: 'document-text-outline', title: 'Practise taking part in a consultation', text: 'Read a sample proposal, vote and comment.' },
];

export default function LearnScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isDesktop } = useBreakpoint();
  const [step, setStep] = useState(0);
  const [guides, setGuides] = useState(null);
  const isStaff = STAFF_ROLES.includes(user?.role);
  useEffect(() => { fetchModules('public').then(setGuides).catch(() => setGuides([])); }, []);
  const s = TOUR[step];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <PageHeader overline="Help & learning" title="Learn how to use the platform"
        subtitle="A quick tour, practice exercises, short guides and videos. Everything works on a phone." icon="school-outline" />
      <Container style={{ marginTop: -24, gap: SPACE.xxl }}>
        {/* Interactive tour */}
        <Card elevated style={{ gap: SPACE.lg }}>
          <View style={styles.rowBetween}>
            <Text style={TYPE.h3}>Take the tour</Text>
            <Text style={TYPE.small}>Step {step + 1} of {TOUR.length}</Text>
          </View>
          <View style={styles.progress}>
            {TOUR.map((_, i) => (
              <Pressable key={i} onPress={() => setStep(i)} style={[styles.dot, i <= step && styles.dotOn]} accessibilityRole="button" accessibilityLabel={`Go to step ${i + 1}`} />
            ))}
          </View>
          <View style={[styles.tourBody, !isDesktop && { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <View style={styles.tourIcon}><Ionicons name={s.icon} size={40} color={COLORS.primary} /></View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[TYPE.h2, { fontSize: 22 }]} accessibilityLiveRegion="polite">{s.title}</Text>
              <Text style={[TYPE.body, { color: COLORS.gray700 }]}>{s.text}</Text>
            </View>
          </View>
          <View style={[styles.rowBetween, { flexWrap: 'wrap', gap: 8 }]}>
            <Button title="Back" icon="arrow-back" variant="ghost" disabled={step === 0} onPress={() => setStep((x) => x - 1)} />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {s.screen ? <Button title="Show me" icon="open-outline" variant="secondary" onPress={() => navigation.navigate(s.screen, s.params)} /> : null}
              {step < TOUR.length - 1
                ? <Button title="Next" iconRight="arrow-forward" onPress={() => setStep((x) => x + 1)} />
                : <Button title="Start again" icon="refresh" onPress={() => setStep(0)} />}
            </View>
          </View>
        </Card>

        {/* Practice */}
        <View style={{ gap: SPACE.md }}>
          <Text style={TYPE.h2}>Practise first</Text>
          <Text style={[TYPE.body, { color: COLORS.gray600 }]}>Try the common tasks with pretend data. Nothing you enter is saved or sent.</Text>
          <Grid columns={3} minItemWidth={240} gap={SPACE.lg}>
            {PRACTICE.map((p) => (
              <Pressable key={p.kind} onPress={() => navigation.navigate('Practice', { kind: p.kind })} style={{ height: '100%' }} accessibilityRole="link">
                {({ hovered }) => (
                  <Card style={[{ gap: 8, height: '100%' }, hovered && { borderColor: COLORS.primaryLight }]}>
                    <Ionicons name={p.icon} size={24} color={COLORS.primary} />
                    <Text style={TYPE.label}>{p.title}</Text>
                    <Text style={TYPE.small}>{p.text}</Text>
                    <Text style={styles.link}>Start →</Text>
                  </Card>
                )}
              </Pressable>
            ))}
          </Grid>
        </View>

        {/* Guides */}
        <View style={{ gap: SPACE.md }}>
          <Text style={TYPE.h2}>Guides and videos</Text>
          {guides === null ? <Loading /> : (
            <Grid columns={2} minItemWidth={280} gap={SPACE.lg}>
              {guides.map((g) => (
                <Pressable key={g.id} onPress={() => navigation.navigate('Lesson', { slug: g.slug })} style={{ height: '100%' }} accessibilityRole="link">
                  {({ hovered }) => (
                    <Card style={[{ gap: 8, height: '100%' }, hovered && { borderColor: COLORS.primaryLight }]}>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        <Badge label={`${g.minutes} min`} icon="time-outline" />
                        {g.video_url ? <Badge label="Video" icon="play-circle-outline" tone="brand" /> : null}
                      </View>
                      <Text style={TYPE.h3}>{g.title}</Text>
                      <Text style={TYPE.small}>{g.summary}</Text>
                      <Text style={styles.link}>Read the guide →</Text>
                    </Card>
                  )}
                </Pressable>
              ))}
            </Grid>
          )}
        </View>

        {/* Officials */}
        <Card style={[styles.staff, !isDesktop && { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <Ionicons name="ribbon-outline" size={32} color={COLORS.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={TYPE.h3}>For NWSC staff and public officials</Text>
            <Text style={TYPE.small}>
              Training on collecting, entering, storing, processing and managing data, and on using the platform — with assessments
              and a record of completion. Sign in with your staff account to take the modules.
            </Text>
          </View>
          <Button title={isStaff ? 'Open my training' : 'Staff sign in'} icon={isStaff ? 'school-outline' : 'log-in-outline'}
            onPress={() => navigation.navigate(isStaff ? 'StaffPortal' : 'Login', isStaff ? { tab: 'training' } : undefined)} />
        </Card>
      </Container>
      <View style={{ height: SPACE.xxl }} />
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { flexDirection: 'row', gap: 6 },
  dot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.gray200 },
  dotOn: { backgroundColor: COLORS.primary },
  tourBody: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xl, paddingVertical: SPACE.md },
  tourIcon: { width: 88, height: 88, borderRadius: 24, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  link: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 'auto' },
  staff: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, backgroundColor: COLORS.primarySoft, borderColor: COLORS.primaryLight },
});
