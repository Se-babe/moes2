import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Button, Badge, Grid } from '../../components/ui';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../../theme';
import { showAlert } from '../../utils/alert';
import { supabase } from '../../services/supabaseClient';
import { downloadZip, csvText } from '../../utils/exportFile';

const API = 'https://sjsavaijgoazitnrjtab.supabase.co/rest/v1';

// Tables in the full export. Personal data stays in this admin-only download.
const EXPORTS = [
  ['requests', 'feedback', 'reference_no, request_type, category, title, description, status, priority, source, department_id, assigned_to, contact_name, contact_phone, contact_email, location_text, created_at, first_response_at, resolved_at, due_at, escalation_level, satisfaction_rating, satisfaction_comment'],
  ['request-updates', 'request_updates', 'request_id, status, message, is_public, created_at'],
  ['announcements', 'announcements', 'title, category, areas, audiences, status, publish_at, published_at, expires_at, notify_count, author_name'],
  ['subscribers', 'alert_subscriptions', 'name, phone, email, areas, categories, stakeholder_group, interests, language, whatsapp, is_active, created_at'],
  ['consultations', 'consultations', 'title, category, closing_date, is_active, poll_votes_count, comments_count, outcome, outcome_at, created_at'],
  ['surveys', 'surveys', 'title, category, start_date, end_date, is_active, total_participants, average_rating'],
  ['staff', 'users', 'full_name, email, role, department_id, job_title, is_active, created_at'],
  ['departments', 'departments', 'id, name, sla_hours, is_active'],
  ['documents', 'documents', 'title, category, institution, subject, document_date, current_version, is_published'],
  ['training-progress', 'training_progress', 'user_id, module_id, attempts, best_score, passed, completed_at'],
];

const FEEDS = [
  ['Published service notices', `${API}/announcements?status=eq.published&select=id,title,body,category,areas,published_at,updated_at`],
  ['Documents and versions', `${API}/documents?select=title,category,institution,subject,document_date,document_versions(version,file_url,created_at)`],
  ['Open consultations', `${API}/consultations?is_active=eq.true&select=id,title,description,closing_date,category`],
  ['Performance figures (POST)', `${API}/rpc/public_performance`],
];

export default function AdminData() {
  const [counts, setCounts] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    EXPORTS.forEach(([name, table]) => {
      supabase.from(table).select('*', { count: 'exact', head: true }).then(({ count }) => setCounts((c) => ({ ...c, [name]: count ?? 0 })));
    });
  }, []);

  const exportAll = async () => {
    setBusy(true);
    try {
      const files = {};
      for (const [name, table, cols] of EXPORTS) {
        const rows = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from(table).select(cols).range(from, from + 999);
          if (error) throw new Error(`${name}: ${error.message}`);
          rows.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        const columns = cols.split(',').map((c) => c.trim()).map((c) => ({ label: c, key: c }));
        files[`${name}.csv`] = csvText(rows, columns);
      }
      files['README.txt'] = `NWSC Jinja e-Participation — full export\nCreated ${new Date().toISOString()}\nContains personal data: store securely and share only as the Data Protection and Privacy Act, 2019 allows.\n`;
      await downloadZip(`nwsc-export-${new Date().toISOString().slice(0, 10)}.zip`, files);
    } catch (e) {
      showAlert('Export failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: SPACE.xl }}>
      <Card style={{ gap: SPACE.md }}>
        <View style={styles.head}>
          <Ionicons name="server-outline" size={22} color={COLORS.primary} />
          <Text style={TYPE.h3}>Central data store</Text>
        </View>
        <Text style={TYPE.small}>
          Requests, announcements, profiles, consultations, surveys, training and documents all live in one database, shared by the website,
          staff portal, admin console and HR dashboard. Records:
        </Text>
        <Grid columns={5} minItemWidth={130} gap={SPACE.sm}>
          {EXPORTS.map(([name]) => (
            <View key={name} style={styles.count}>
              <Text style={styles.countNum}>{counts[name] ?? '…'}</Text>
              <Text style={TYPE.small}>{name.replace('-', ' ')}</Text>
            </View>
          ))}
        </Grid>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button title="Download full export (ZIP of CSV files)" icon="archive-outline" loading={busy} onPress={exportAll} />
          <Badge label="Contains personal data" icon="lock-closed-outline" tone="warning" />
        </View>
      </Card>

      <Card style={{ gap: SPACE.md }}>
        <View style={styles.head}>
          <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.primary} />
          <Text style={TYPE.h3}>Backups and recovery</Text>
        </View>
        {[
          'Every night at 04:00 a full copy of the database (structure, data and roles) is made, encrypted with AES-256, and kept for 30 days.',
          'To switch it on, add two GitHub secrets (SUPABASE_DB_URL and BACKUP_PASSPHRASE) — one time. Until then the job skips.',
          'Restore steps, and how to recover onto a new project, are in docs/BACKUP.md in the code repository.',
          'Application code is versioned in GitHub; both public addresses rebuild from it automatically.',
        ].map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
            <Ionicons name="checkmark" size={16} color={COLORS.primary} style={{ marginTop: 2 }} />
            <Text style={[TYPE.small, { flex: 1 }]}>{t}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button title="Backup runs" icon="open-outline" size="sm" variant="secondary" onPress={() => Linking.openURL('https://github.com/Se-babe/moes2/actions/workflows/backup.yml')} />
          <Button title="Recovery guide" icon="document-text-outline" size="sm" variant="ghost" onPress={() => Linking.openURL('https://github.com/Se-babe/moes2/blob/main/docs/BACKUP.md')} />
        </View>
      </Card>

      <Card style={{ gap: SPACE.md }}>
        <View style={styles.head}>
          <Ionicons name="git-network-outline" size={22} color={COLORS.primary} />
          <Text style={TYPE.h3}>Integration with other systems</Text>
        </View>
        <Text style={TYPE.small}>
          Other NWSC systems (billing, GIS, call centre, the corporate website) can read public data through these feeds using the
          publishable key, or connect with a dedicated staff account for internal data. Access follows the same rules as the app.
        </Text>
        {FEEDS.map(([label, url]) => (
          <View key={label} style={styles.feed}>
            <Text style={TYPE.label}>{label}</Text>
            <Text style={styles.code} selectable>{url}</Text>
          </View>
        ))}
        <Text style={TYPE.small}>
          Send the header <Text style={styles.codeInline}>apikey: &lt;publishable key&gt;</Text>. Requests from other channels can be
          logged through the submit-feedback service with a staff token and a source such as "Phone call", so they get reference numbers.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  count: { padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.gray50 },
  countNum: { fontFamily: FONT, fontSize: 20, fontWeight: '800', color: COLORS.gray900 },
  feed: { gap: 4, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.gray50 },
  code: { fontFamily: 'monospace', fontSize: 12, color: COLORS.gray800 },
  codeInline: { fontFamily: 'monospace', fontSize: 12 },
});
