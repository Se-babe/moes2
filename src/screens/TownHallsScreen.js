import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { COLORS, FONT } from '../theme';
import { PageHeader, Container, EmptyState } from '../components/ui';
import Footer from '../components/Footer';


const formatTime = (timeStr) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${period}`;
};

export default function TownHallsScreen() {
  const [townHalls, setTownHalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTownHalls();
  }, []);

  const fetchTownHalls = async () => {
    setLoading(true);
    const { data } = await supabase.from('town_halls').select('*').order('event_date', { ascending: true });
    if (data) setTownHalls(data);
    setLoading(false);
  };

  const joinMeeting = (item) => {
    Linking.openURL(item.meeting_link).catch(() => showAlert('Error', 'Could not open the meeting link.'));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading town halls...</Text>
      </View>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = townHalls.filter((t) => !t.event_date || t.event_date >= todayStr);
  const past = townHalls.filter((t) => t.event_date && t.event_date < todayStr).reverse();

  const renderCard = (item, isUpcoming) => {
    const isToday = item.event_date === todayStr;
    return (
      <View key={item.id} style={[styles.card, !isUpcoming && styles.cardPast]}>
        {isUpcoming && (
          <View style={styles.upcomingBadge}>
            <Ionicons name="radio-outline" size={12} color={COLORS.success} />
            <Text style={styles.upcomingBadgeText}>{isToday ? 'Today' : 'Upcoming'}</Text>
          </View>
        )}
        <Text style={styles.cardTopic}>{item.topic}</Text>
        {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
        <View style={styles.metaRow}>
          {item.event_date && (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.gray500} />
              <Text style={styles.metaText}>{new Date(item.event_date).toDateString()}</Text>
            </View>
          )}
          {item.event_time && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={COLORS.gray500} />
              <Text style={styles.metaText}>{formatTime(item.event_time)}</Text>
            </View>
          )}
          {item.location && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color={COLORS.gray500} />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          )}
        </View>
        {isUpcoming && item.meeting_link ? (
          <TouchableOpacity
            style={[styles.joinBtn, isToday && styles.joinBtnToday]}
            onPress={() => joinMeeting(item)}
          >
            <Ionicons name="videocam" size={14} color="#fff" />
            <Text style={styles.joinBtnText}>{isToday ? 'Join Now' : 'Join Meeting'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <PageHeader title="Community meetings" subtitle="Scheduled town halls with NWSC Jinja. Join in person or online, ask questions and stay informed." icon="people-outline" overline="Participate" />
      <Container style={styles.content}>

      <Text style={styles.sectionHeading}>Upcoming</Text>
      {upcoming.length === 0 ? (
        <EmptyState icon="people-outline" title="No meetings scheduled" message="Upcoming community meetings with NWSC Jinja will be listed here." />
      ) : (
        upcoming.map((item) => renderCard(item, true))
      )}

      {past.length > 0 && (
        <>
          <Text style={styles.sectionHeading}>Past Sessions</Text>
          {past.map((item) => renderCard(item, false))}
        </>
      )}
      </Container>
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  content: { padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary },
  sub: { fontSize: 16, color: COLORS.gray500, marginTop: 10, marginBottom: 20 },
  sectionHeading: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginTop: 12, marginBottom: 10 },
  emptyText: { color: COLORS.gray500, fontSize: 14, paddingVertical: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  cardPast: { opacity: 0.7 },
  upcomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.successSoft,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 8,
  },
  upcomingBadgeText: { fontSize: 11, color: COLORS.success, fontWeight: '700' },
  cardTopic: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginBottom: 4 },
  cardDesc: { fontSize: 14, color: COLORS.gray500, marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, color: COLORS.gray500 },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  joinBtnToday: { backgroundColor: COLORS.success },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
