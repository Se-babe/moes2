import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Footer from '../components/Footer';
import { PageHeader, Container, Button, Badge, STATUS_TONE } from '../components/ui';
import { COLORS, FONT, SHADOW } from '../theme';


// Citizen-facing progress steps. 'Escalated' is shown as part of "In Progress".
const STEPS = ['Submitted', 'Assigned', 'In Progress', 'Resolved'];
const STATUS_COLORS = {
  Submitted: '#3B82F6',
  Assigned: '#8B5CF6',
  'In Progress': '#F59E0B',
  Escalated: '#F97316',
  Resolved: '#22C55E',
  Closed: '#64748B',
};

const stepIndex = (status) => {
  if (status === 'Escalated') return 2;
  if (status === 'Closed') return 3;
  return Math.max(0, STEPS.indexOf(status));
};

const fmt = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

function StatusBadge({ status }) {
  return <Badge label={status} tone={STATUS_TONE[status] || 'neutral'} />;
}

export default function TrackRequestScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const [ref, setRef] = useState(route.params?.ref || '');
  const [result, setResult] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  const lookup = useCallback(async (value) => {
    const q = (value ?? ref).trim().toUpperCase();
    if (!q) return;
    setLoading(true);
    setNotFound(false);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc('track_request', { p_reference: q });
      if (error) throw error;
      if (data) setResult(data);
      else setNotFound(true);
    } catch (e) {
      console.error('track_request failed:', e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [ref]);

  // Deep link: /track?ref=NW-2611-ABC123
  useEffect(() => {
    if (route.params?.ref) {
      setRef(route.params.ref);
      lookup(route.params.ref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.ref]);

  useEffect(() => {
    if (!user) { setMyRequests([]); return; }
    supabase
      .from('feedback')
      .select('id, reference_no, request_type, title, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMyRequests(data || []));
  }, [user]);

  const current = result ? stepIndex(result.status) : -1;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <PageHeader
        overline="Customer service"
        title="Track my request"
        subtitle="Enter the reference number we sent you to see the latest progress on your enquiry or complaint."
        icon="search-outline"
      />
      <Container narrow style={styles.content}>
        <View style={[styles.card, SHADOW.md]}>
          <Text style={styles.label}>Reference number</Text>
          <Text style={styles.helper}>You received it by SMS/email when you submitted, e.g. NW-2611-7KQ4XP.</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              value={ref}
              onChangeText={setRef}
              placeholder="NW-YYMM-XXXXXX"
              placeholderTextColor={COLORS.gray400}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={() => lookup()}
              returnKeyType="search"
              accessibilityLabel="Reference number"
            />
            <Button title="Track" icon="search" loading={loading} onPress={() => lookup()} />
          </View>
        </View>

        {notFound && (
          <View style={[styles.card, styles.notFound]}>
            <Ionicons name="search-outline" size={28} color={COLORS.danger} />
            <Text style={styles.notFoundText}>
              We couldn't find that reference number. Check it and try again, or call toll-free 0800-200-977.
            </Text>
          </View>
        )}

        {result && (
          <View style={styles.card}>
            <View style={styles.resultHeader}>
              <Text style={styles.refBig}>{result.reference_no}</Text>
              <StatusBadge status={result.status} />
            </View>
            <Text style={styles.resultTitle}>{result.title}</Text>
            <Text style={styles.meta}>
              {result.request_type} · {result.category || 'General'} · Submitted {fmt(result.created_at)}
            </Text>
            {result.status === 'Escalated' && (
              <Text style={styles.escalated}>This request has been escalated to a supervisor for faster action.</Text>
            )}

            {/* Progress stepper */}
            <View style={styles.stepper} accessibilityLabel={`Progress: step ${current + 1} of ${STEPS.length}, ${result.status}`}>
              {STEPS.map((s, i) => {
                const done = i <= current;
                return (
                  <View key={s} style={styles.step}>
                    <View style={[styles.stepDot, done && styles.stepDotDone]}>
                      {done && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{s}</Text>
                    {i < STEPS.length - 1 && <View style={[styles.stepLine, i < current && styles.stepLineDone]} />}
                  </View>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Updates</Text>
            {(result.timeline || []).slice().reverse().map((u, i) => (
              <View key={i} style={styles.update}>
                <View style={styles.updateRail}>
                  <View style={[styles.updateDot, { backgroundColor: STATUS_COLORS[u.status] || COLORS.gray400 }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.updateMsg}>{u.message}</Text>
                  <Text style={styles.updateTime}>{fmt(u.created_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {user && myRequests.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>My requests</Text>
            {myRequests.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.myRow}
                onPress={() => { setRef(r.reference_no); lookup(r.reference_no); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.myTitle} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.meta}>{r.reference_no} · {r.request_type} · {fmt(r.created_at)}</Text>
                </View>
                <StatusBadge status={r.status} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Button
          title="Submit a new enquiry or complaint"
          icon="add-circle-outline"
          variant="ghost"
          style={{ alignSelf: 'center' }}
          onPress={() => navigation.navigate('Feedback')}
        />
      </Container>
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { gap: 16, marginTop: -24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.gray200 },
  label: { fontFamily: FONT, fontSize: 16, fontWeight: '700', color: COLORS.gray800 },
  helper: { fontSize: 13, color: COLORS.gray500, marginTop: 4, marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 17, letterSpacing: 1, color: COLORS.gray800, backgroundColor: '#fff',
  },
  searchBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 22, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  notFound: { flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  notFoundText: { flex: 1, color: COLORS.gray800, fontSize: 14 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  refBig: { fontSize: 20, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
  resultTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray800, marginTop: 10 },
  meta: { fontSize: 13, color: COLORS.gray500, marginTop: 4 },
  escalated: { marginTop: 10, color: '#C2410C', fontSize: 13, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  stepper: { flexDirection: 'row', marginTop: 22, marginBottom: 6 },
  step: { flex: 1, alignItems: 'center', position: 'relative' },
  stepDot: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.gray200,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  stepDotDone: { backgroundColor: '#22C55E' },
  stepLabel: { fontSize: 12, color: COLORS.gray500, marginTop: 6, textAlign: 'center' },
  stepLabelDone: { color: COLORS.gray800, fontWeight: '700' },
  stepLine: { position: 'absolute', top: 12, left: '50%', right: '-50%', height: 2, backgroundColor: COLORS.gray200 },
  stepLineDone: { backgroundColor: '#22C55E' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginTop: 18, marginBottom: 10 },
  update: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  updateRail: { width: 12, alignItems: 'center', paddingTop: 5 },
  updateDot: { width: 10, height: 10, borderRadius: 5 },
  updateMsg: { fontSize: 14, color: COLORS.gray800 },
  updateTime: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  myRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: COLORS.gray200,
  },
  myTitle: { fontSize: 15, fontWeight: '600', color: COLORS.gray800 },
  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  newBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
});
