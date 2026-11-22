import React from 'react';
import { siteUrl } from '../config/base';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Badge } from './ui';
import ShareBar from './ShareBar';
import { COLORS, FONT, SPACE, TYPE } from '../theme';
import { categoryMeta, fmtDate, localizeAnnouncement } from '../services/announcements';
import { usePreferences } from '../context/PreferencesContext';

export const announcementUrl = (id) =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? siteUrl(`/updates/${id}`) : `https://www.nwsc.co.ug/updates/${id}`;

/** One official service update, as shown to the public. */
export default function AnnouncementCard({ item: raw, full = false, onOpen }) {
  const { language } = usePreferences();
  const item = localizeAnnouncement(raw, language);
  const meta = categoryMeta(item.category);
  const edited = item.updated_at && item.published_at && new Date(item.updated_at) - new Date(item.published_at) > 60_000;
  const content = (
    <Card style={[styles.card, item.category === 'Emergency' && styles.emergency]}>
      <View style={styles.top}>
        <Badge label={item.category} tone={meta.tone} icon={meta.icon} />
        <View style={styles.verified} accessibilityLabel="Official NWSC information">
          <Ionicons name="shield-checkmark" size={14} color={COLORS.success} />
          <Text style={styles.verifiedText}>Official NWSC</Text>
        </View>
      </View>
      <Text style={[TYPE.h3, { marginTop: SPACE.md }]} accessibilityRole="header">{item.title}</Text>
      <Text style={[TYPE.small, { marginTop: 4 }]}>
        Posted {fmtDate(item.published_at)}{edited ? ` · Last updated ${fmtDate(item.updated_at)}` : ''}
      </Text>
      {item.areas?.length ? (
        <View style={styles.areas}>
          <Ionicons name="location-outline" size={14} color={COLORS.primary} />
          <Text style={[TYPE.small, { color: COLORS.gray700, flex: 1 }]}>{item.areas.join(', ')}</Text>
        </View>
      ) : (
        <View style={styles.areas}>
          <Ionicons name="globe-outline" size={14} color={COLORS.primary} />
          <Text style={[TYPE.small, { color: COLORS.gray700 }]}>All areas served by NWSC Jinja</Text>
        </View>
      )}
      <Text style={[TYPE.body, { marginTop: SPACE.md, color: COLORS.gray800 }]} numberOfLines={full ? undefined : 4}>
        {item.body}
      </Text>
      {item.expires_at ? (
        <Text style={[TYPE.small, { marginTop: SPACE.sm }]}>Valid until {fmtDate(item.expires_at)}</Text>
      ) : null}
      {item.audiences?.length ? (
        <Text style={[TYPE.small, { marginTop: SPACE.sm }]}>For: {item.audiences.join(', ')}</Text>
      ) : null}
      <View style={styles.footer}>
        <ShareBar title={item.title} url={announcementUrl(item.id)} />
        {!full && onOpen ? <Text style={styles.more}>Read more →</Text> : null}
      </View>
    </Card>
  );
  if (full || !onOpen) return content;
  return (
    <Pressable onPress={() => onOpen(item.id)} accessibilityRole="link">
      {({ hovered }) => <View style={hovered ? { opacity: 0.96 } : null}>{content}</View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 0 },
  emergency: { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontFamily: FONT, fontSize: 12, fontWeight: '700', color: COLORS.success },
  areas: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACE.sm },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
    marginTop: SPACE.lg, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: COLORS.gray100,
  },
  more: { fontFamily: FONT, color: COLORS.primary, fontWeight: '700', fontSize: 14 },
});
