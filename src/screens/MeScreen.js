import React, { useState, useEffect, useCallback } from 'react';
import { isCitizen, myProfileToken, claimProfile, mySignedInRequests, deleteMyAccount } from '../services/citizen';
import { useAuth } from '../context/AuthContext';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { PageHeader, Container, Card, Button, Badge, EmptyState, Loading, Grid, STATUS_TONE, useBreakpoint } from '../components/ui';
import Footer from '../components/Footer';
import AnnouncementCard from '../components/AnnouncementCard';
import ProfileFields, { EMPTY_PROFILE } from '../components/ProfileFields';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import { showAlert } from '../utils/alert';
import { supabase } from '../services/supabaseClient';
import {
  fetchAreas, fetchPublished, getProfile, updateProfile, loadProfileToken, saveProfileToken, forgetProfileToken, myRequests,
} from '../services/announcements';
import { usePreferences } from '../context/PreferencesContext';

const today = () => new Date().toISOString().slice(0, 10);

/** Does this announcement concern this person? */
function matches(a, p) {
  if (!p) return true;
  const area = !a.areas?.length || !p.areas?.length || a.areas.some((x) => p.areas.includes(x));
  const cat = a.category === 'Emergency' || !p.categories?.length || p.categories.includes(a.category);
  const who = a.category === 'Emergency' || !a.audiences?.length || a.audiences.includes(p.stakeholder_group);
  return area && cat && who;
}
const interested = (category, p) => !p?.interests?.length || !category || p.interests.includes(category);

function Activity({ icon, kind, title, sub, recommended, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ hovered }) => [styles.activity, hovered && { borderColor: COLORS.primaryLight }]}>
      <View style={styles.activityIcon}><Ionicons name={icon} size={20} color={COLORS.primary} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={styles.kind}>{kind}</Text>
          {recommended ? <Badge label="Picked for you" tone="success" icon="sparkles-outline" /> : null}
        </View>
        <Text style={TYPE.label}>{title}</Text>
        {sub ? <Text style={TYPE.small}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />
    </Pressable>
  );
}

export default function MeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { isDesktop } = useBreakpoint();
  const { update: updatePrefs } = usePreferences();
  const [token, setToken] = useState(undefined); // undefined = loading, null = none
  const [profile, setProfile] = useState(null);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState([]);
  const [notices, setNotices] = useState(null);
  const [activities, setActivities] = useState(null);
  const [requests, setRequests] = useState([]);
  const [docs, setDocs] = useState([]);

  const { user, signOut } = useAuth();
  const signedIn = isCitizen(user);

  // Signed-in citizen: their account's profile. Otherwise ?token=… (from the
  // link in our emails) or this device's saved profile.
  useEffect(() => {
    (async () => {
      let t = signedIn ? await myProfileToken() : null;
      if (!t) t = route.params?.token || (await loadProfileToken());
      if (route.params?.token) saveProfileToken(route.params.token);
      if (t && signedIn) claimProfile(t);
      setToken(t || null);
    })();
  }, [route.params?.token, signedIn]);

  const load = useCallback(async () => {
    fetchAreas().then(setAreas);
    let p = null;
    if (token) {
      try { p = await getProfile(token); } catch { p = null; }
      if (!p) { await forgetProfileToken(); setToken(null); }
    }
    setProfile(p);
    const [ann, cons, surv, refs, docRes] = await Promise.all([
      fetchPublished({ limit: 60 }).catch(() => []),
      supabase.from('consultations').select('id, title, description, closing_date, category').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('surveys').select('id, title, description, end_date, start_date, category').eq('is_active', true).order('created_at', { ascending: false }),
      myRequests(),
      supabase.from('documents').select('id, title, category, subject, document_date, updated_at').order('updated_at', { ascending: false }).limit(30),
    ]);
    // Policy updates and decisions: ones on the person's topics first.
    const words = (p?.interests || []).flatMap((i) => i.toLowerCase().split(/[^a-z]+/)).filter((w) => w.length > 3);
    const relevant = (d) => words.some((w) => `${d.title} ${d.subject || ''}`.toLowerCase().includes(w));
    setDocs((docRes.data || []).map((d) => ({ ...d, recommended: !!p && relevant(d) }))
      .sort((a, b) => Number(b.recommended) - Number(a.recommended)).slice(0, 4));
    setNotices(ann.filter((a) => matches(a, p)).slice(0, 5));
    const open = [
      ...(cons.data || []).filter((c) => !c.closing_date || c.closing_date >= today())
        .map((c) => ({ id: `c-${c.id}`, icon: 'document-text-outline', kind: 'Consultation', title: c.title, category: c.category,
          sub: c.closing_date ? `Closes ${new Date(c.closing_date).toDateString()}` : 'Open now', go: () => navigation.navigate('Consultations') })),
      ...(surv.data || []).filter((s) => (!s.end_date || s.end_date >= today()) && (!s.start_date || s.start_date <= today()))
        .map((s) => ({ id: `s-${s.id}`, icon: 'clipboard-outline', kind: 'Survey', title: s.title, category: s.category,
          sub: s.end_date ? `Open until ${new Date(s.end_date).toDateString()}` : 'A few minutes', go: () => navigation.navigate('SurveyDetail', { id: s.id }) })),
    ].map((x) => ({ ...x, recommended: !!p && interested(x.category, p) && p.interests?.length > 0 }))
      .sort((a, b) => Number(b.recommended) - Number(a.recommended));
    setActivities(open);
    const tracked = await Promise.all(refs.slice(0, 8).map((r) => supabase.rpc('track_request', { p_reference: r }).then(({ data }) => data).catch(() => null)));
    // Signed in: every request linked to the account, plus any tracked here.
    const mine = signedIn ? await mySignedInRequests() : [];
    const all = [...mine, ...tracked.filter(Boolean)];
    setRequests(all.filter((r, i) => all.findIndex((x) => x.reference_no === r.reference_no) === i).slice(0, 12));
  }, [token, navigation, signedIn]);

  useEffect(() => { if (token !== undefined) load(); }, [token, load]);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(token, edit);
      if (edit.language) updatePrefs({ language: edit.language });
      setEdit(null);
      await load();
      showAlert('Saved', 'Your preferences are updated.');
    } catch (e) {
      showAlert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  const stopAll = () => showAlert('Stop all alerts?', 'You will no longer get SMS, WhatsApp or email from us. You can turn them back on here.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Stop alerts', style: 'destructive', onPress: async () => { await updateProfile(token, { ...profile, is_active: false }); load(); } },
  ]);

  const confirmDelete = () => showAlert('Delete your account?',
    'Your account and alert profile are removed and you stop receiving messages. Requests you made stay on record for NWSC, without your name. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteMyAccount(); await forgetProfileToken(); setToken(null); showAlert('Account deleted', 'You can still use everything as a guest.'); }
        catch (e) { showAlert('Could not delete', e.message); }
      } },
    ]);

  if (token === undefined) return <Loading />;

  const name = profile?.name?.split(' ')[0];
  const recommended = (activities || []).filter((a) => a.recommended).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <PageHeader
        overline="My NWSC"
        title={profile ? `Hello${name ? `, ${name}` : ''}` : 'Your personal page'}
        subtitle={profile
          ? 'Notices for your area, consultations and surveys on your topics, and the progress of your requests — all in one place.'
          : 'See notices that affect you, ways to have your say, and the progress of your requests.'}
        icon="person-circle-outline"
      />
      <Container style={{ marginTop: -24, gap: SPACE.xl }}>
        {!profile && (
          <Card elevated>
            <EmptyState
              icon="sparkles-outline"
              title="Make this page yours"
              message={signedIn
                ? 'You are signed in. Create your profile to choose your area, topics and language, and get alerts.'
                : 'Create a free profile to get notices for your area, suggestions on your topics, and alerts in your language. Already have one? Sign in with your phone to see it on this device.'}
              action={(
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button title="Create my profile" icon="person-add-outline" onPress={() => navigation.navigate('Alerts')} />
                  {!signedIn && <Button title="Sign in with my phone" icon="phone-portrait-outline" variant="secondary" onPress={() => navigation.navigate('SignIn')} />}
                </View>
              )}
            />
          </Card>
        )}

        {profile && (
          <Grid columns={4} minItemWidth={150} gap={SPACE.md}>
            {[
              ['people-outline', 'I am a', profile.stakeholder_group],
              ['location-outline', 'My areas', profile.areas?.length ? profile.areas.join(', ') : 'All areas'],
              ['heart-outline', 'My topics', profile.interests?.length ? profile.interests.join(', ') : 'Everything'],
              ['notifications-outline', 'Alerts', profile.is_active ? `${profile.whatsapp ? 'WhatsApp' : profile.phone ? 'SMS' : ''}${profile.phone && profile.email ? ' + ' : ''}${profile.email ? 'email' : ''} · ${{ en: 'English', lg: 'Luganda', xog: 'Lusoga' }[profile.language] || 'English'}` : 'Stopped'],
            ].map(([icon, label, value]) => (
              <Card key={label} style={{ gap: 4, height: '100%' }}>
                <Ionicons name={icon} size={18} color={COLORS.primary} />
                <Text style={TYPE.small}>{label}</Text>
                <Text style={TYPE.label} numberOfLines={3}>{value}</Text>
              </Card>
            ))}
          </Grid>
        )}

        <View style={[styles.cols, !isDesktop && { flexDirection: 'column' }]}>
          <View style={{ flex: 3, gap: SPACE.lg, width: '100%' }}>
            <Text style={TYPE.h3}>{profile ? 'Notices for you' : 'Latest notices'}</Text>
            {notices === null ? <Loading /> : notices.length === 0 ? (
              <Card><EmptyState icon="checkmark-done-outline" title="Nothing affecting you right now" message="We'll alert you as soon as something changes in your area." /></Card>
            ) : notices.map((a) => <AnnouncementCard key={a.id} item={a} onOpen={(id) => navigation.navigate('UpdateDetail', { id })} />)}
            <Button title="All service updates" variant="ghost" iconRight="chevron-forward" style={{ alignSelf: 'flex-start' }} onPress={() => navigation.navigate('Updates')} />
          </View>

          <View style={{ flex: 2, gap: SPACE.lg, width: '100%' }}>
            <Card style={{ gap: SPACE.md }}>
              <Text style={TYPE.h3}>Have your say</Text>
              <Text style={TYPE.small}>
                {recommended ? `${recommended} open ${recommended === 1 ? 'activity matches' : 'activities match'} your topics.` : 'Open consultations and surveys.'}
              </Text>
              {activities === null ? <Loading /> : activities.length === 0 ? (
                <Text style={TYPE.small}>Nothing open right now. We'll invite you when there is.</Text>
              ) : activities.slice(0, 6).map((a) => (
                <Activity key={a.id} icon={a.icon} kind={a.kind} title={a.title} sub={a.sub} recommended={a.recommended} onPress={a.go} />
              ))}
            </Card>

            <Card style={{ gap: SPACE.md }}>
              <Text style={TYPE.h3}>My requests</Text>
              {requests.length === 0 ? (
                <Text style={TYPE.small}>Requests you submit or track on this device appear here.</Text>
              ) : requests.map((r) => (
                <Pressable key={r.reference_no} onPress={() => navigation.navigate('TrackRequest', { ref: r.reference_no })} style={styles.req} accessibilityRole="link">
                  <View style={{ flex: 1 }}>
                    <Text style={TYPE.label} numberOfLines={1}>{r.title}</Text>
                    <Text style={TYPE.small}>{r.reference_no} · {r.request_type}</Text>
                  </View>
                  <Badge label={r.status} tone={STATUS_TONE[r.status]} />
                </Pressable>
              ))}
              <Button title="Report a problem" icon="water-outline" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => navigation.navigate('Feedback', { type: 'Complaint' })} />
            </Card>

            {docs.length > 0 && (
              <Card style={{ gap: SPACE.md }}>
                <Text style={TYPE.h3}>Policies and decisions</Text>
                {docs.map((d) => (
                  <Activity key={d.id} icon="library-outline" kind={d.category} title={d.title} recommended={d.recommended}
                    sub={d.subject || (d.document_date ? new Date(d.document_date).toDateString() : '')} onPress={() => navigation.navigate('Documents')} />
                ))}
              </Card>
            )}

            <Card style={{ gap: 6 }}>
              <Text style={TYPE.h3}>Learn how it works</Text>
              <Text style={TYPE.small}>Short guides, videos and practice runs for reporting, tracking and taking part.</Text>
              <Button title="Help & learning centre" icon="school-outline" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => navigation.navigate('Learn')} />
            </Card>
          </View>
        </View>

        {profile && (
          <Card style={{ gap: SPACE.md }}>
            <View style={styles.rowBetween}>
              <Text style={TYPE.h3}>My preferences</Text>
              {!edit && <Button title="Edit" icon="create-outline" size="sm" variant="secondary" onPress={() => setEdit({ ...EMPTY_PROFILE, ...profile })} />}
            </View>
            {edit ? (
              <View>
                <ProfileFields value={edit} onChange={setEdit} areas={areas} hasPhone={!!profile.phone} />
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  <Button title="Save" icon="checkmark" loading={saving} onPress={save} />
                  <Button title="Cancel" variant="ghost" onPress={() => setEdit(null)} />
                </View>
              </View>
            ) : (
              <Text style={TYPE.small}>
                Contact: {[profile.phone, profile.email].filter(Boolean).join(' · ')}. To change your phone number or email, sign up again with the new one.
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {profile.is_active
                ? <Button title="Stop all alerts" icon="notifications-off-outline" size="sm" variant="ghost" onPress={stopAll} />
                : <Button title="Turn alerts back on" icon="notifications-outline" size="sm" onPress={async () => { await updateProfile(token, { ...profile, is_active: true }); load(); }} />}
              {!signedIn && <Button title="Forget me on this device" icon="log-out-outline" size="sm" variant="ghost" onPress={async () => { await forgetProfileToken(); setToken(null); }} />}
            </View>
          </Card>
        )}

        {signedIn ? (
          <Card style={{ gap: SPACE.sm }}>
            <Text style={TYPE.h3}>My account</Text>
            <Text style={TYPE.small}>Signed in with {user.phone}. Your profile and requests follow you to any phone or computer where you sign in.</Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button title="Sign out" icon="log-out-outline" size="sm" variant="secondary" onPress={async () => { await signOut(); await forgetProfileToken(); setToken(null); }} />
              <Button title="Delete my account" icon="trash-outline" size="sm" variant="ghost" onPress={confirmDelete} />
            </View>
          </Card>
        ) : profile ? (
          <Card style={{ gap: 6 }}>
            <Text style={TYPE.h3}>Use My NWSC on any device</Text>
            <Text style={TYPE.small}>Optional: sign in with your phone number and a code by SMS. No password.</Text>
            <Button title="Sign in with my phone" icon="phone-portrait-outline" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => navigation.navigate('SignIn')} />
          </Card>
        ) : null}
      </Container>
      <View style={{ height: SPACE.xxl }} />
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: SPACE.xl, alignItems: 'flex-start' },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  activityIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  kind: { fontFamily: FONT, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: COLORS.gray500 },
  req: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
