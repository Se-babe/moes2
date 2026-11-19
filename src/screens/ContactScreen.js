import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { showAlert } from '../utils/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import LocationMap from '../components/LocationMap';
import { COLORS, FONT } from '../theme';
import { PageHeader, Container } from '../components/ui';
import Footer from '../components/Footer';


const DEFAULTS = {
  phone1: 'Toll Free: 0800-200-977',
  phone2: 'Customer Care: +256 (0)313-315-000',
  phone3: '',
  email: 'info@nwsc.co.ug',
  address: 'NWSC Jinja Area Office, Jinja, Uganda',
  office_hours: 'Monday – Friday, 8:00 AM – 5:00 PM',
};

export default function ContactScreen() {
  const navigation = useNavigation();
  const [info, setInfo] = useState(DEFAULTS);
  const [socialLinks, setSocialLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: settingsData }, { data: socialData }] = await Promise.all([
      supabase.from('settings').select('key, value'),
      supabase.from('social_links').select('*').eq('enabled', true).order('display_order', { ascending: true }),
    ]);
    if (settingsData) {
      const map = {};
      settingsData.forEach((row) => { map[row.key] = row.value; });
      setInfo((prev) => ({ ...prev, ...map }));
    }
    if (socialData) setSocialLinks(socialData);
    setLoading(false);
  };

  const call = (phone) => {
    const digits = phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${digits}`).catch(() => showAlert('Error', 'Could not start a call.'));
  };

  const email = () => {
    Linking.openURL(`mailto:${info.email}`).catch(() => showAlert('Error', 'Could not open your email app.'));
  };

  const openSocial = (url) => {
    Linking.openURL(url).catch(() => showAlert('Error', 'Could not open the link.'));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading contact info...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <PageHeader title="Contact us" subtitle="Reach NWSC Jinja customer care by phone, email or in person." icon="call-outline" overline="Help" />
      <Container style={styles.content}>

      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={() => call(info.phone1)}>
          <View style={styles.iconBox}><Ionicons name="call-outline" size={20} color={COLORS.primary} /></View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Primary Phone</Text>
            <Text style={styles.rowValue}>{info.phone1}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => call(info.phone2)}>
          <View style={styles.iconBox}><Ionicons name="call-outline" size={20} color={COLORS.primary} /></View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Toll Free</Text>
            <Text style={styles.rowValue}>{info.phone2}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => call(info.phone3)}>
          <View style={styles.iconBox}><Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} /></View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>TELA / SMS Line</Text>
            <Text style={styles.rowValue}>{info.phone3}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={email}>
          <View style={styles.iconBox}><Ionicons name="mail-outline" size={20} color={COLORS.primary} /></View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{info.email}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.iconBox}><Ionicons name="location-outline" size={20} color={COLORS.primary} /></View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Address</Text>
            <Text style={styles.rowValue}>{info.address}</Text>
          </View>
        </View>

        <View style={[styles.row, styles.rowLast]}>
          <View style={styles.iconBox}><Ionicons name="time-outline" size={20} color={COLORS.primary} /></View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Office Hours</Text>
            <Text style={styles.rowValue}>{info.office_hours}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionHeading}>Find Us</Text>
      <View style={styles.mapCard}>
        <LocationMap address={info.address} />
      </View>

      {socialLinks.length > 0 && (
        <>
          <Text style={styles.sectionHeading}>Follow Us</Text>
          <View style={styles.socialRow}>
            {socialLinks.map((item) => (
              <TouchableOpacity key={item.id} style={styles.socialBtn} onPress={() => openSocial(item.url)}>
                <Ionicons name={item.icon_name} size={22} color={item.color || COLORS.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionHeading}>Send Us a Message</Text>
      <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('Feedback')}>
        <Ionicons name="create-outline" size={18} color="#fff" />
        <Text style={styles.ctaBtnText}>Submit Feedback</Text>
      </TouchableOpacity>
      </Container>
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  content: { padding: 20, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary },
  sub: { fontSize: 16, color: COLORS.gray500, marginTop: 10, marginBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  iconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(30,58,138,0.08)', alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 12, color: COLORS.gray500, fontWeight: '600' },
  rowValue: { fontSize: 15, color: COLORS.gray800, fontWeight: '600', marginTop: 2 },
  sectionHeading: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginTop: 24, marginBottom: 12 },
  mapCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
  },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
