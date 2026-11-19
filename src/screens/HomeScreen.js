import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Pressable,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import Footer from '../components/Footer';
import { Container, Button, Card, Badge, SectionTitle, Grid, useBreakpoint } from '../components/ui';
import { COLORS, TYPE, SPACE, RADIUS, SHADOW, FONT, gradient } from '../theme';
import { ORG } from '../config/org';
import { usePreferences } from '../context/PreferencesContext';

const SERVICES = [
  { icon: 'water', k: 'nav.report', dk: 'home.reportDesc', title: 'Report a problem', desc: 'Leaks, bursts, no water, low pressure or sewer overflows.', screen: 'Feedback', params: { type: 'Complaint' }, tone: '#DC2626' },
  { icon: 'help-circle', k: 'nav.enquiry', dk: 'home.enquiryDesc', title: 'Make an enquiry', desc: 'Ask about bills, accounts, connections or anything else.', screen: 'Feedback', params: { type: 'Enquiry' }, tone: '#2563EB' },
  { icon: 'search', k: 'nav.track', dk: 'home.trackDesc', title: 'Track my request', desc: 'Follow progress with the reference number we sent you.', screen: 'TrackRequest', tone: '#0891B2' },
  { icon: 'megaphone', k: 'nav.updates', dk: 'home.updatesDesc', title: 'Service updates', desc: 'Planned interruptions, repairs and restorations near you.', screen: 'Updates', tone: '#7C3AED' },
  { icon: 'receipt', k: 'home.billing', dk: 'home.billingDesc', title: 'Billing & payments', desc: 'Query a bill, report a meter issue or a payment problem.', screen: 'Feedback', params: { type: 'Enquiry', category: 'Billing & Payments' }, tone: '#D97706' },
  { icon: 'git-branch', k: 'home.connection', dk: 'home.connectionDesc', title: 'New connection', desc: 'Apply for a new water or sewer connection.', screen: 'Feedback', params: { type: 'Enquiry', category: 'New Connection' }, tone: '#16A34A' },
];

const STEPS = [
  { icon: 'create-outline', k: 'home.step1', title: 'Tell us', desc: 'Describe the issue, where it is, and how to reach you. Add a photo if you can.' },
  { icon: 'chatbox-ellipses-outline', k: 'home.step2', title: 'Get a reference', desc: 'You instantly receive a reference number by SMS and email.' },
  { icon: 'people-outline', k: 'home.step3', title: 'We act', desc: 'Your request goes straight to the responsible team, with escalation if it’s delayed.' },
  { icon: 'checkmark-done-outline', k: 'home.step4', title: 'Stay informed', desc: 'Track progress online and get notified when it’s resolved.' },
];

const PARTICIPATE = [
  { icon: 'document-text-outline', title: 'Public consultations', desc: 'Give your views on proposed projects and service changes.', screen: 'Consultations' },
  { icon: 'stats-chart-outline', title: 'Surveys & polls', desc: 'Rate our services and tell us what to improve.', screen: 'Surveys' },
  { icon: 'chatbubbles-outline', title: 'Discussion forums', desc: 'Ask questions and share solutions with your community.', screen: 'Forum' },
  { icon: 'people-outline', title: 'Community meetings', desc: 'Join town halls with NWSC Jinja in your area.', screen: 'TownHalls' },
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function ServiceCard({ item, onPress, t }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={{ height: '100%' }}>
      {({ hovered }) => (
        <View style={[styles.serviceCard, hovered ? SHADOW.lg : SHADOW.sm, hovered && { borderColor: COLORS.primaryLight, transform: [{ translateY: -2 }] }]}>
          <View style={[styles.serviceIcon, { backgroundColor: item.tone + '14' }]}>
            <Ionicons name={item.icon} size={24} color={item.tone} />
          </View>
          <Text style={[TYPE.h3, { marginTop: SPACE.lg }]}>{t(item.k)}</Text>
          <Text style={[TYPE.body, { color: COLORS.gray500, marginTop: 6, flex: 1 }]}>{t(item.dk)}</Text>
          <View style={styles.cardLink}>
            <Text style={styles.cardLinkText}>{t('home.getStarted')}</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { isDesktop, isMobile } = useBreakpoint();
  const { t, lite } = usePreferences();
  const [slides, setSlides] = useState([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [news, setNews] = useState([]);
  const [stats, setStats] = useState(null);
  const [ref, setRef] = useState('');

  const load = useCallback(async () => {
    const [slidesRes, updateRes, consRes, newsRes, statsRes, consCount] = await Promise.all([
      supabase.from('slides').select('*').eq('active', true).order('display_order', { ascending: true }),
      supabase.from('announcements').select('id, title, category, published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(1),
      supabase.from('consultations').select('*').eq('is_active', true).order('closing_date', { ascending: true }).limit(3),
      supabase.from('news').select('*').eq('is_active', true).order('published_date', { ascending: false }).limit(3),
      supabase.rpc('public_request_stats'),
      supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    setSlides(slidesRes.data || []);
    setLatestUpdate(updateRes.data?.[0] || null);
    setConsultations(consRes.data || []);
    setNews(newsRes.data || []);
    setStats({ ...(statsRes.data || { total: 0, resolved: 0, open: 0 }), consultations: consCount.count || 0 });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Gentle rotation through hero images.
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setSlideIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  const go = (screen, params) => navigation.navigate(screen, params);
  const track = () => ref.trim() && go('TrackRequest', { ref: ref.trim().toUpperCase() });
  const slide = slides[slideIndex];
  const resolutionRate = stats && stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : null;

  return (
    <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
      {/* ================= HERO ================= */}
      <View style={[styles.hero, gradient(COLORS.primaryDarker, COLORS.primary, 120)]}>
        <Container style={[styles.heroInner, !isDesktop && { flexDirection: 'column' }]}>
          <View style={[styles.heroText, !isDesktop && { maxWidth: '100%' }]}>
            <View style={styles.heroPill}>
              <Ionicons name="water" size={13} color={COLORS.accent} />
              <Text style={styles.heroPillText}>{ORG.name} · {ORG.area}</Text>
            </View>
            <Text style={[TYPE.display, styles.heroTitle, isMobile && { fontSize: 32, lineHeight: 40 }]} accessibilityRole="header">
              {t('home.title')}
            </Text>
            <Text style={styles.heroSub}>
              {t('home.sub')}
            </Text>
            <View style={styles.heroCtas}>
              <Button title={t('nav.report')} icon="water" size="lg" variant="light" onPress={() => go('Feedback', { type: 'Complaint' })} />
              <Button title={t('nav.enquiry')} size="lg" variant="outlineLight" onPress={() => go('Feedback', { type: 'Enquiry' })} />
            </View>

            <View style={[styles.trackBox, SHADOW.lg]}>
              <Text style={styles.trackLabel}>{t('home.trackLabel')}</Text>
              <View style={styles.trackRow}>
                <View style={styles.trackInputWrap}>
                  <Ionicons name="search" size={18} color={COLORS.gray400} />
                  <TextInput
                    style={styles.trackInput}
                    value={ref}
                    onChangeText={setRef}
                    placeholder={t('home.trackPlaceholder')}
                    placeholderTextColor={COLORS.gray400}
                    autoCapitalize="characters"
                    onSubmitEditing={track}
                    returnKeyType="search"
                    accessibilityLabel="Reference number"
                  />
                </View>
                <Button title={t('home.track')} onPress={track} />
              </View>
            </View>
          </View>

          {isDesktop && !lite && (
            <View style={styles.heroVisual}>
              <View style={[styles.heroImageWrap, SHADOW.lg]}>
                {slide?.image_url ? (
                  <Image source={{ uri: slide.image_url }} style={styles.heroImage} resizeMode="cover" accessibilityLabel={slide.title} />
                ) : (
                  <View style={[styles.heroImage, { backgroundColor: COLORS.primaryLight }]} />
                )}
                {slide ? (
                  <View style={styles.heroCaption}>
                    <Text style={styles.heroCaptionTitle}>{slide.title}</Text>
                    {slide.subtitle ? <Text style={styles.heroCaptionSub}>{slide.subtitle}</Text> : null}
                  </View>
                ) : null}
              </View>
              <View style={[styles.floatCard, SHADOW.lg]}>
                <View style={[styles.floatIcon, { backgroundColor: COLORS.successSoft }]}>
                  <Ionicons name={stats?.resolved > 0 ? 'checkmark-circle' : 'time'} size={22} color={COLORS.success} />
                </View>
                <View>
                  <Text style={styles.floatValue}>{stats?.resolved > 0 ? stats.resolved.toLocaleString() : '24/7'}</Text>
                  <Text style={styles.floatLabel}>{stats?.resolved > 0 ? 'requests resolved' : 'online reporting'}</Text>
                </View>
              </View>
            </View>
          )}
        </Container>
      </View>

      {/* ================= SERVICE STATUS ================= */}
      <Container style={{ marginTop: -28 }}>
        <Pressable onPress={() => go(latestUpdate ? 'UpdateDetail' : 'Updates', latestUpdate ? { id: latestUpdate.id } : undefined)} accessibilityRole="link">
          {({ hovered }) => (
            <View style={[styles.statusBar, SHADOW.md, hovered && { borderColor: COLORS.primaryLight }]}>
              <View style={styles.statusIcon}>
                <Ionicons name="megaphone" size={20} color={COLORS.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusOverline}>{latestUpdate ? `${latestUpdate.category} · ${fmtDate(latestUpdate.published_at)}` : t('home.latest')}</Text>
                <Text style={styles.statusText} numberOfLines={2}>
                  {latestUpdate ? latestUpdate.title : t('home.noUpdates')}
                </Text>
              </View>
              {!isMobile && (
                <View style={[styles.cardLink, { marginTop: 0 }]}>
                  <Text style={styles.cardLinkText}>{t('home.allUpdates')}</Text>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
                </View>
              )}
            </View>
          )}
        </Pressable>
      </Container>

      {/* ================= SERVICES ================= */}
      <Container style={styles.section}>
        <SectionTitle overline={t('home.servicesOverline')} title={t('home.servicesTitle')} subtitle={t('home.servicesSub')} />
        <Grid columns={3} minItemWidth={280}>
          {SERVICES.map((s) => (
            <ServiceCard key={s.title} item={s} t={t} onPress={() => go(s.screen, s.params)} />
          ))}
        </Grid>
      </Container>

      {/* ================= HOW IT WORKS ================= */}
      <View style={styles.band}>
        <Container style={styles.sectionTight}>
          <SectionTitle overline={t('home.howOverline')} title={t('home.howTitle')} align="center" />
          <Grid columns={4} minItemWidth={220}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <View style={styles.stepNum}>
                  <Ionicons name={s.icon} size={22} color={COLORS.primary} />
                  <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{i + 1}</Text></View>
                </View>
                <Text style={[TYPE.h3, { textAlign: 'center', marginTop: SPACE.md }]}>{t(s.k)}</Text>
                <Text style={[TYPE.body, { textAlign: 'center', color: COLORS.gray500, marginTop: 4 }]}>{t(`${s.k}Desc`)}</Text>
              </View>
            ))}
          </Grid>
        </Container>
      </View>

      {/* ================= STATS (shown once there is real activity) ================= */}
      {stats?.total > 0 && (
      <Container style={styles.section}>
        <View style={[styles.statsWrap, gradient(COLORS.primary, COLORS.primaryDark, 120), isMobile && { flexDirection: 'column' }]}>
          {[
            { value: stats ? stats.total.toLocaleString() : '—', label: 'Requests received' },
            { value: stats ? stats.resolved.toLocaleString() : '—', label: 'Requests resolved' },
            { value: resolutionRate !== null ? `${resolutionRate}%` : '—', label: 'Resolution rate' },
            { value: stats ? String(stats.consultations) : '—', label: 'Open consultations' },
          ].map((s, i) => (
            <View key={s.label} style={[styles.stat, i > 0 && !isMobile && styles.statDivider]}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
        <Text style={[TYPE.small, { textAlign: 'center', marginTop: SPACE.md }]}>Live figures from this platform.</Text>
      </Container>
      )}

      {/* ================= PARTICIPATE ================= */}
      <Container style={styles.section}>
        <SectionTitle
          overline="Have your say"
          title="Help shape water services in Jinja"
          action={<Button title="All consultations" variant="secondary" size="sm" iconRight="arrow-forward" onPress={() => go('Consultations')} />}
        />
        {consultations.length > 0 && (
          <Grid columns={3} minItemWidth={280} style={{ marginBottom: SPACE.lg }}>
            {consultations.map((c) => (
              <Card key={c.id} style={{ height: '100%' }}>
                <View style={styles.consultMeta}>
                  <Badge label="Open" tone="success" icon="ellipse" />
                  {c.closing_date ? <Text style={TYPE.small}>Closes {fmtDate(c.closing_date)}</Text> : null}
                </View>
                <Text style={[TYPE.h3, { marginTop: SPACE.md }]} numberOfLines={2}>{c.title}</Text>
                {c.description ? <Text style={[TYPE.body, { color: COLORS.gray500, marginTop: 6, flex: 1 }]} numberOfLines={3}>{c.description}</Text> : <View style={{ flex: 1 }} />}
                <Button title="Read & respond" variant="ghost" size="sm" iconRight="arrow-forward" style={{ marginTop: SPACE.md, marginLeft: -14 }} onPress={() => go('Consultations')} />
              </Card>
            ))}
          </Grid>
        )}
        <Grid columns={4} minItemWidth={230}>
          {PARTICIPATE.map((p) => (
            <Pressable key={p.title} onPress={() => go(p.screen)} accessibilityRole="link" style={{ height: '100%' }}>
              {({ hovered }) => (
                <View style={[styles.partCard, hovered && { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primarySoft }]}>
                  <Ionicons name={p.icon} size={22} color={COLORS.primary} />
                  <Text style={[TYPE.label, { marginTop: SPACE.md, fontSize: 15 }]}>{p.title}</Text>
                  <Text style={[TYPE.small, { marginTop: 4 }]}>{p.desc}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </Grid>
      </Container>

      {/* ================= NEWS ================= */}
      {news.length > 0 && (
        <Container style={styles.section}>
          <SectionTitle
            overline="Newsroom"
            title="News & announcements"
            action={<Button title="All news" variant="secondary" size="sm" iconRight="arrow-forward" onPress={() => go('News')} />}
          />
          <Grid columns={3} minItemWidth={280}>
            {news.map((n) => (
              <Card key={n.id} padded={false} style={{ overflow: 'hidden', height: '100%' }}>
                {n.image_url && !lite ? <Image source={{ uri: n.image_url }} style={styles.newsImage} resizeMode="cover" /> : null}
                <View style={{ padding: SPACE.xl }}>
                  <Text style={TYPE.small}>{fmtDate(n.published_date)}</Text>
                  <Text style={[TYPE.h3, { marginTop: 6 }]} numberOfLines={2}>{n.title}</Text>
                  {n.summary ? <Text style={[TYPE.body, { color: COLORS.gray500, marginTop: 6 }]} numberOfLines={3}>{n.summary}</Text> : null}
                </View>
              </Card>
            ))}
          </Grid>
        </Container>
      )}

      {/* ================= EMERGENCY CTA ================= */}
      <Container style={styles.section}>
        <View style={[styles.cta, isMobile && { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <View style={styles.ctaIcon}>
            <Ionicons name="alert-circle" size={28} color={COLORS.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={TYPE.h3}>{t('home.emergencyTitle')}</Text>
            <Text style={[TYPE.body, { color: COLORS.gray600, marginTop: 4 }]}>
              {t('home.emergencyText')}
            </Text>
          </View>
          <Button
            title={t('home.call', { phone: ORG.phones[0].value })}
            icon="call"
            variant="danger"
            onPress={() => Linking.openURL(`tel:${ORG.phones[0].value.replace(/\D/g, '')}`)}
          />
        </View>
      </Container>

      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  hero: { backgroundColor: COLORS.primaryDark, paddingTop: 56, paddingBottom: 88, overflow: 'hidden' },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 56 },
  heroText: { flex: 1, maxWidth: 620 },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.pill, backgroundColor: 'rgba(56,189,248,0.14)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.35)',
  },
  heroPillText: { fontFamily: FONT, color: '#E0F2FE', fontSize: 13, fontWeight: '600' },
  heroTitle: { color: COLORS.white, marginTop: SPACE.lg },
  heroSub: { fontFamily: FONT, color: '#CFE6FA', fontSize: 17, lineHeight: 27, marginTop: SPACE.lg, maxWidth: 560 },
  heroCtas: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: SPACE.xxl },
  trackBox: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.lg, marginTop: SPACE.xxl, maxWidth: 560 },
  trackLabel: { ...TYPE.label, marginBottom: 10 },
  trackRow: { flexDirection: 'row', gap: 10 },
  trackInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: COLORS.gray200,
    borderRadius: RADIUS.md, paddingHorizontal: 12,
  },
  trackInput: { fontFamily: FONT, flex: 1, minWidth: 0, fontSize: 15, color: COLORS.gray900, paddingVertical: 11, letterSpacing: 0.5 },
  heroVisual: { flex: 1, maxWidth: 500, position: 'relative' },
  heroImageWrap: { borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 6, borderColor: 'rgba(255,255,255,0.12)' },
  heroImage: { width: '100%', height: 420 },
  heroCaption: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACE.xl,
    ...(Platform.OS === 'web' ? { backgroundImage: 'linear-gradient(transparent, rgba(4,31,58,0.85))' } : { backgroundColor: 'rgba(4,31,58,0.6)' }),
  },
  heroCaptionTitle: { fontFamily: FONT, color: '#fff', fontSize: 20, fontWeight: '800' },
  heroCaptionSub: { fontFamily: FONT, color: '#CFE6FA', fontSize: 14, marginTop: 4 },
  floatCard: {
    position: 'absolute', left: -36, top: 36, backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACE.lg, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  floatIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  floatValue: { fontFamily: FONT, fontSize: 22, fontWeight: '800', color: COLORS.gray900 },
  floatLabel: { fontFamily: FONT, fontSize: 13, color: COLORS.gray500 },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, padding: SPACE.lg, paddingHorizontal: SPACE.xl, borderWidth: 1, borderColor: COLORS.gray200,
  },
  statusIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.warningSoft, alignItems: 'center', justifyContent: 'center' },
  statusOverline: { fontFamily: FONT, fontSize: 12, fontWeight: '700', color: COLORS.warning, textTransform: 'uppercase', letterSpacing: 0.8 },
  statusText: { fontFamily: FONT, fontSize: 15.5, fontWeight: '600', color: COLORS.gray900, marginTop: 2 },
  section: { marginTop: 72 },
  sectionTight: { paddingVertical: 64 },
  serviceCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl, borderWidth: 1,
    borderColor: COLORS.gray200, height: '100%',
    ...(Platform.OS === 'web' ? { transitionDuration: '180ms' } : null),
  },
  serviceIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACE.lg },
  cardLinkText: { fontFamily: FONT, color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  band: { backgroundColor: COLORS.white, marginTop: 72, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.gray200 },
  step: { alignItems: 'center', paddingHorizontal: SPACE.md },
  stepNum: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  stepBadge: {
    position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white,
  },
  stepBadgeText: { fontFamily: FONT, color: '#fff', fontSize: 11, fontWeight: '800' },
  statsWrap: { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, flexDirection: 'row', paddingVertical: SPACE.xxl },
  stat: { flex: 1, alignItems: 'center', paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg },
  statDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)' },
  statValue: { fontFamily: FONT, color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontFamily: FONT, color: '#BAE6FD', fontSize: 14, marginTop: 4, fontWeight: '500' },
  consultMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partCard: { borderRadius: RADIUS.lg, padding: SPACE.xl, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white, height: '100%' },
  newsImage: { width: '100%', height: 170 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xl, backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.xl, padding: SPACE.xxl, borderWidth: 1, borderColor: '#FECACA',
  },
  ctaIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
});
