import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { PageHeader, Container, Card, Button, EmptyState, Loading, useBreakpoint } from '../components/ui';
import Footer from '../components/Footer';
import AnnouncementCard from '../components/AnnouncementCard';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import { fetchPublished, fetchAreas, ANNOUNCEMENT_CATEGORIES } from '../services/announcements';

function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export default function UpdatesScreen() {
  const navigation = useNavigation();
  const { isDesktop } = useBreakpoint();
  const [items, setItems] = useState(null);
  const [areas, setAreas] = useState([]);
  const [area, setArea] = useState(null);
  const [category, setCategory] = useState(null);

  const load = useCallback(() => {
    setItems(null);
    fetchPublished({ area, category }).then(setItems).catch(() => setItems([]));
  }, [area, category]);

  useEffect(() => { fetchAreas().then(setAreas); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={styles.page}>
      <PageHeader
        overline="Services"
        title="Service updates"
        subtitle="Official NWSC Jinja announcements: planned interruptions, emergencies, restorations and service notices."
        icon="megaphone-outline"
      />
      <Container style={[styles.layout, !isDesktop && { flexDirection: 'column' }]}>
        <View style={{ flex: 2, width: '100%', gap: SPACE.lg }}>
          <Card style={{ gap: SPACE.md }}>
            <Text style={TYPE.label}>Area</Text>
            <View style={styles.chips}>
              <Chip label="All areas" active={!area} onPress={() => setArea(null)} />
              {areas.map((a) => <Chip key={a} label={a} active={area === a} onPress={() => setArea(a)} />)}
            </View>
            <Text style={TYPE.label}>Topic</Text>
            <View style={styles.chips}>
              <Chip label="All topics" active={!category} onPress={() => setCategory(null)} />
              {ANNOUNCEMENT_CATEGORIES.map((c) => (
                <Chip key={c.value} label={c.value} active={category === c.value} onPress={() => setCategory(c.value)} />
              ))}
            </View>
          </Card>

          {items === null ? (
            <Loading label="Loading updates…" />
          ) : items.length === 0 ? (
            <Card>
              <EmptyState
                icon="megaphone-outline"
                title="No updates right now"
                message="There are no announcements for this selection. For an urgent problem call 0800-200-977."
              />
            </Card>
          ) : (
            items.map((item) => (
              <AnnouncementCard key={item.id} item={item} onOpen={(id) => navigation.navigate('UpdateDetail', { id })} />
            ))
          )}
        </View>

        <View style={{ flex: 1, width: '100%' }}>
          <Card style={styles.alertCard}>
            <View style={styles.alertIcon}><Ionicons name="notifications" size={22} color="#fff" /></View>
            <Text style={[TYPE.h3, { marginTop: SPACE.md }]}>Get alerts for your area</Text>
            <Text style={[TYPE.body, { color: COLORS.gray600, marginTop: 4 }]}>
              Receive interruptions, emergencies and restoration notices by SMS or email — only for the areas you choose.
            </Text>
            <Button title="Subscribe to alerts" icon="add-circle-outline" style={{ marginTop: SPACE.lg }} onPress={() => navigation.navigate('Alerts')} />
          </Card>
        </View>
      </Container>
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  layout: { flexDirection: 'row', gap: SPACE.xl, alignItems: 'flex-start', marginTop: -24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray700 },
  alertCard: { backgroundColor: COLORS.primarySoft, borderColor: '#BFDBFE' },
  alertIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
});
