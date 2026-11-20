import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute } from '@react-navigation/native';
import { PageHeader, Container, Card, Button, TextField, EmptyState, useBreakpoint } from '../components/ui';
import Footer from '../components/Footer';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import { fetchAreas, subscribeAlerts, unsubscribeAlerts, ANNOUNCEMENT_CATEGORIES } from '../services/announcements';
import { showAlert } from '../utils/alert';
import { supabase } from '../services/supabaseClient';

function Toggle({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.opt, on && styles.optOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={16} color={on ? COLORS.primary : COLORS.gray400} />
      <Text style={[styles.optText, on && { color: COLORS.primary }]}>{label}</Text>
    </Pressable>
  );
}

export default function AlertsScreen() {
  const { params } = useRoute();
  const { isDesktop } = useBreakpoint();
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', email: '', areas: [], categories: [], language: 'en', whatsapp: false });
  const [social, setSocial] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [unsub, setUnsub] = useState(null); // null | 'working' | 'ok' | 'failed'

  useEffect(() => {
    fetchAreas().then(setAreas);
    supabase.from('social_links').select('id, name, icon_name, url').eq('enabled', true).order('display_order')
      .then(({ data }) => setSocial(data || []));
  }, []);

  // /alerts?unsubscribe=<token> from the link in every alert email
  useEffect(() => {
    if (!params?.unsubscribe) return;
    setUnsub('working');
    unsubscribeAlerts(params.unsubscribe).then((ok) => setUnsub(ok ? 'ok' : 'failed')).catch(() => setUnsub('failed'));
  }, [params?.unsubscribe]);

  const toggle = (key, value) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }));

  const save = async () => {
    if (!form.phone.trim() && !form.email.trim()) {
      showAlert('Contact needed', 'Give a phone number for SMS alerts, an email address, or both.');
      return;
    }
    setSaving(true);
    try {
      await subscribeAlerts(form);
      setDone(true);
    } catch (e) {
      showAlert('Could not subscribe', e.message);
    } finally {
      setSaving(false);
    }
  };

  let body;
  if (unsub) {
    body = (
      <EmptyState
        icon={unsub === 'ok' ? 'notifications-off-outline' : unsub === 'failed' ? 'warning-outline' : 'time-outline'}
        title={unsub === 'ok' ? 'You will no longer receive alerts' : unsub === 'failed' ? 'That link is not valid' : 'Updating…'}
        message={unsub === 'ok' ? 'You can subscribe again at any time.' : unsub === 'failed' ? 'It may already have been used.' : undefined}
        action={unsub !== 'working' ? <Button title="Subscribe again" variant="secondary" onPress={() => { setUnsub(null); setDone(false); }} /> : null}
      />
    );
  } else if (done) {
    body = (
      <EmptyState
        icon="checkmark-circle-outline"
        title="You're subscribed"
        message={`We'll send alerts for ${form.areas.length ? form.areas.join(', ') : 'all areas'}${form.phone ? (form.whatsapp ? ' on WhatsApp (or SMS if WhatsApp can’t reach you)' : ' by SMS') : ''}${form.email ? `${form.phone ? ' and' : ' by'} email` : ''}. Every email has a link to stop alerts.`}
      />
    );
  } else {
    body = (
      <View>
        <Text style={TYPE.h3}>Choose your alerts</Text>
        <Text style={[TYPE.body, { color: COLORS.gray600, marginTop: 4, marginBottom: SPACE.xl }]}>
          Emergencies are always sent for your areas. Leave areas or topics empty to get everything.
        </Text>
        <Text style={[TYPE.label, { marginBottom: 8 }]}>Areas</Text>
        <View style={styles.opts}>
          {areas.map((a) => <Toggle key={a} label={a} on={form.areas.includes(a)} onPress={() => toggle('areas', a)} />)}
        </View>
        <Text style={[TYPE.label, { marginBottom: 8, marginTop: SPACE.lg }]}>Topics</Text>
        <View style={styles.opts}>
          {ANNOUNCEMENT_CATEGORIES.filter((c) => c.value !== 'Emergency').map((c) => (
            <Toggle key={c.value} label={c.value} on={form.categories.includes(c.value)} onPress={() => toggle('categories', c.value)} />
          ))}
        </View>
        <View style={{ height: SPACE.xl }} />
        <TextField label="Name (optional)" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoComplete="name" />
        <View style={[{ flexDirection: 'row', gap: SPACE.lg }, !isDesktop && { flexDirection: 'column', gap: 0 }]}>
          <TextField style={{ flex: 1 }} label="Phone for SMS" placeholder="0772 123456" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} />
          <TextField style={{ flex: 1 }} label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} />
        </View>
        {form.phone.trim() ? (
          <View style={{ marginBottom: SPACE.lg, marginTop: -SPACE.sm }}>
            <Toggle label="Send my alerts on WhatsApp instead of SMS" on={form.whatsapp} onPress={() => setForm((f) => ({ ...f, whatsapp: !f.whatsapp }))} />
          </View>
        ) : null}
        <Text style={[TYPE.label, { marginBottom: 8 }]}>Message language</Text>
        <View style={styles.opts}>
          {[['en', 'English'], ['lg', 'Luganda'], ['xog', 'Lusoga']].map(([k, label]) => (
            <Toggle key={k} label={label} on={form.language === k} onPress={() => setForm((f) => ({ ...f, language: k }))} />
          ))}
        </View>
        <Button title="Subscribe" icon="notifications-outline" size="lg" loading={saving} onPress={save} style={{ marginTop: SPACE.xl }} />
        <Text style={[TYPE.small, { marginTop: SPACE.md }]}>
          Standard SMS is free to receive. We only use your contact details to send these alerts.
          Non-emergency texts are never sent between 9 pm and 7 am.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <PageHeader
        overline="Services"
        title="Service alerts"
        subtitle="Get planned interruptions, emergencies and restoration notices for your area by SMS, WhatsApp or email."
        icon="notifications-outline"
      />
      <Container narrow style={{ marginTop: -24 }}>
        <Card elevated>{body}</Card>
        {social.length > 0 && (
          <View style={styles.follow}>
            <Text style={[TYPE.small, { textAlign: 'center' }]}>Every notice is also posted on our official pages</Text>
            <View style={styles.followRow}>
              {social.map((l) => (
                <Pressable key={l.id} onPress={() => Linking.openURL(l.url).catch(() => {})} style={styles.followBtn} accessibilityRole="link" accessibilityLabel={`NWSC on ${l.name}`}>
                  <Ionicons name={l.icon_name || 'link-outline'} size={16} color={COLORS.primary} />
                  <Text style={styles.optText}>{l.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Container>
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  optOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  follow: { marginTop: SPACE.xl, gap: SPACE.sm, alignItems: 'center' },
  followRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  optText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray700 },
});
