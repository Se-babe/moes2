import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Button, Badge, Grid, Loading } from '../../components/ui';
import { COLORS, FONT, SPACE, TYPE } from '../../theme';
import { showAlert } from '../../utils/alert';
import {
  CHANNELS, fetchNotificationSummary, fetchChannelStatus, sendTestAlert, retryFailedAlerts, fetchRecentProblems, fmtDate,
} from '../../services/announcements';

// What each channel is for, and the secrets that switch it on
// (set with `supabase secrets set NAME=value`).
const SETUP = {
  sms: { provider: 'UgSMS', use: 'Texts to subscribers and request updates', secrets: 'UGSMS_API_KEY, UGSMS_SENDER_ID' },
  whatsapp: { provider: 'WhatsApp Cloud API', use: 'Alerts to subscribers who chose WhatsApp', secrets: 'WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE' },
  email: { provider: 'Resend', use: 'Emails to subscribers and request updates', secrets: 'RESEND_API_KEY, RESEND_FROM' },
  telegram: { provider: 'Telegram bot', use: 'Posts to the NWSC Telegram channel', secrets: 'TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID' },
  facebook: { provider: 'Facebook page', use: 'Posts to the NWSC Facebook page', secrets: 'FACEBOOK_PAGE_ID, FACEBOOK_PAGE_TOKEN' },
  x: { provider: 'X API', use: 'Posts to the NWSC X account', secrets: 'X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET' },
};
const TESTABLE = ['sms', 'whatsapp', 'email'];

function Stat({ icon, label, value, hint, tone = COLORS.primary }) {
  return (
    <Card style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: tone + '18' }]}>
        <Ionicons name={icon} size={20} color={tone} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={TYPE.label}>{label}</Text>
      {hint ? <Text style={TYPE.small}>{hint}</Text> : null}
    </Card>
  );
}

export default function AdminAlerts() {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState(null); // null loading | { channels } | { error }
  const [problems, setProblems] = useState([]);
  const [testing, setTesting] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(() => {
    fetchNotificationSummary(7).then(setSummary).catch((e) => showAlert('Could not load', e.message));
    fetchRecentProblems().then(setProblems).catch(() => setProblems([]));
    fetchChannelStatus().then(setStatus).catch((e) => setStatus({ error: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = (channel) => {
    const rows = (summary?.log || []).filter((r) => r.channel === channel);
    const get = (s) => rows.find((r) => r.status === s)?.count || 0;
    return { sent: get('sent'), failed: get('failed'), skipped: get('skipped') };
  };

  const test = async (channel) => {
    setTesting(channel);
    try {
      const r = await sendTestAlert(channel);
      showAlert(
        r.status === 'sent' ? 'Test sent' : r.status === 'skipped' ? 'Not set up yet' : 'Test failed',
        r.status === 'sent' ? `Check your ${channel === 'email' ? 'inbox' : 'phone'}.` : r.detail || 'The provider did not accept the message.',
      );
      load();
    } catch (e) {
      showAlert('Could not send a test', e.message);
    } finally {
      setTesting(null);
    }
  };

  const retry = async () => {
    setRetrying(true);
    try {
      const n = await retryFailedAlerts();
      showAlert(n ? `Retrying ${n} message${n === 1 ? '' : 's'}` : 'Nothing to retry');
      load();
    } catch (e) {
      showAlert('Could not retry', e.message);
    } finally {
      setRetrying(false);
    }
  };

  if (!summary) return <Loading />;
  const q = summary.queue || {};
  const subs = summary.subscribers || {};
  const sentWeek = (summary.log || []).filter((r) => r.status === 'sent').reduce((n, r) => n + r.count, 0);

  return (
    <View style={{ gap: SPACE.xl }}>
      <View>
        <Text style={[TYPE.body, { color: COLORS.gray600 }]}>
          Customers are told automatically when an announcement goes live, before a planned interruption starts,
          and whenever their request moves forward. Failed messages are retried three times.
        </Text>
      </View>

      <Grid columns={4} minItemWidth={150} gap={SPACE.md}>
        <Stat icon="people-outline" label="Subscribers" value={subs.total ?? 0}
          hint={`${subs.sms ?? 0} SMS · ${subs.whatsapp ?? 0} WhatsApp · ${subs.email ?? 0} email`} />
        <Stat icon="paper-plane-outline" label="Delivered, last 7 days" value={sentWeek} tone={COLORS.success} />
        <Stat icon="time-outline" label="Waiting to send" value={q.queued ?? 0} tone={COLORS.info}
          hint={q.next_at && new Date(q.next_at) > new Date() ? `Next at ${fmtDate(q.next_at)}` : q.queued ? 'Sending now' : 'Queue is empty'} />
        <Stat icon="alert-circle-outline" label="Gave up after retries" value={q.failed ?? 0} tone={q.failed ? COLORS.danger : COLORS.gray400} />
      </Grid>

      <Card padded={false}>
        <View style={styles.headRow}>
          <Text style={TYPE.h3}>Channels</Text>
          <Button title="Refresh" icon="refresh" size="sm" variant="ghost" onPress={load} />
        </View>
        {status?.error ? (
          <Text style={[TYPE.small, { color: COLORS.danger, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.md }]}>
            Could not check the channels: {status.error}
          </Text>
        ) : null}
        {Object.keys(CHANNELS).map((ch) => {
          const on = status?.channels?.[ch];
          const c = counts(ch);
          return (
            <View key={ch} style={styles.channel}>
              <View style={styles.channelIcon}>
                <Ionicons name={CHANNELS[ch].icon} size={20} color={on ? COLORS.primary : COLORS.gray400} />
              </View>
              <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={TYPE.label}>{CHANNELS[ch].label}</Text>
                  {status === null ? null : on
                    ? <Badge label="Connected" tone="success" icon="checkmark-circle" />
                    : <Badge label="Not set up" tone="neutral" />}
                </View>
                <Text style={TYPE.small}>{SETUP[ch].use} · {SETUP[ch].provider}</Text>
                {status && !on && !status.error ? <Text style={[TYPE.small, styles.mono]}>Secrets: {SETUP[ch].secrets}</Text> : null}
              </View>
              <Text style={[TYPE.small, { minWidth: 150 }]}>
                7 days: {c.sent} sent{c.failed ? ` · ${c.failed} failed` : ''}{c.skipped ? ` · ${c.skipped} skipped` : ''}
              </Text>
              {TESTABLE.includes(ch) ? (
                <Button title="Send me a test" size="sm" variant="secondary" icon="flask-outline"
                  loading={testing === ch} disabled={!on} onPress={() => test(ch)} />
              ) : <View style={{ width: 0 }} />}
            </View>
          );
        })}
      </Card>

      <Card padded={false}>
        <View style={styles.headRow}>
          <Text style={TYPE.h3}>Recent problems</Text>
          {q.failed ? <Button title={`Retry ${q.failed} failed`} icon="refresh" size="sm" loading={retrying} onPress={retry} /> : null}
        </View>
        {problems.length === 0 ? (
          <Text style={[TYPE.small, { padding: SPACE.lg, paddingTop: 0 }]}>No failed or skipped messages.</Text>
        ) : problems.map((p) => (
          <View key={p.id} style={styles.problem}>
            <Badge label={p.status === 'failed' ? 'Failed' : 'Skipped'} tone={p.status === 'failed' ? 'danger' : 'neutral'} />
            <Text style={[TYPE.small, { width: 90 }]}>{CHANNELS[p.channel]?.label || p.channel}</Text>
            <Text style={[TYPE.small, { flex: 1, minWidth: 180 }]} numberOfLines={2}>
              {p.recipient || 'Official page'} · {p.purpose} · {p.last_error || '—'}
            </Text>
            <Text style={TYPE.small}>{fmtDate(p.updated_at)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={TYPE.label}>How the timing works</Text>
        <View style={{ gap: 6, marginTop: SPACE.sm }}>
          {[
            'Emergencies go out at once on every channel, day or night, and reviewers get an SMS when one is waiting for approval.',
            'Other SMS and WhatsApp messages that would arrive between 9 pm and 7 am wait until 7 am. Email and social posts are not held.',
            'Planned interruptions with a start time get a reminder about 2 hours before (8 pm the evening before for early-morning starts).',
            'If WhatsApp can’t reach someone, they get an SMS instead. Unsubscribing or archiving a notice stops anything still waiting.',
          ].map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
              <Ionicons name="checkmark" size={14} color={COLORS.primary} style={{ marginTop: 3 }} />
              <Text style={[TYPE.small, { flex: 1 }]}>{t}</Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { gap: 4, height: '100%' },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontFamily: FONT, fontSize: 26, fontWeight: '800', color: COLORS.gray900 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACE.lg },
  channel: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.md,
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderTopWidth: 1, borderTopColor: COLORS.gray100,
  },
  channelIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: 'monospace', fontSize: 11 },
  problem: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.md,
    paddingHorizontal: SPACE.lg, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.gray100,
  },
});
