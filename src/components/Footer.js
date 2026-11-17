import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORG } from '../config/org';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { showAlert } from '../utils/alert';

const COLORS = {
  primaryDark: '#0F172A',
  accent: '#FCD34D',
};

export default function Footer() {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const [socialLinks, setSocialLinks] = useState([]);

  // Fetch social links from Supabase
  useEffect(() => {
    const fetchSocialLinks = async () => {
      const { data, error } = await supabase
        .from('social_links')
        .select('*')
        .eq('enabled', true)
        .order('display_order', { ascending: true });
      if (data) setSocialLinks(data);
    };
    fetchSocialLinks();
  }, []);

  const handleSocialPress = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => showAlert('Error', 'Could not open link.'));
  };

  const comingSoon = (label) => showAlert('Coming Soon', `${label} isn't available yet — check back soon.`);
  const goTo = (screen, params) => navigation.navigate(screen, params);

  return (
    <View style={styles.footer}>
      <View style={styles.footerContent}>
        {/* Brand */}
        <View style={styles.footerSection}>
          <Text style={styles.footerBrand}>
            <Ionicons name="water" size={18} color={COLORS.accent} /> {ORG.shortName} <Text style={{ color: COLORS.accent }}>e‑Participation</Text>
          </Text>
          <Text style={styles.footerTagline}>{ORG.tagline}</Text>
        </View>

        {/* Quick Links */}
        <View style={styles.footerSection}>
          <Text style={styles.footerHeading}>Quick Links</Text>
          <TouchableOpacity onPress={() => goTo('About')}><Text style={styles.footerLink}>About NWSC</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goTo('Updates')}><Text style={styles.footerLink}>Service Updates</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goTo('News')}><Text style={styles.footerLink}>News & Announcements</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goTo('MediaGallery')}><Text style={styles.footerLink}>Media Gallery</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goTo('Sitemap')}><Text style={styles.footerLink}>Sitemap</Text></TouchableOpacity>
        </View>

        {/* Participation */}
        <View style={styles.footerSection}>
          <Text style={styles.footerHeading}>Get Involved</Text>
          <TouchableOpacity onPress={() => goTo('Feedback')}><Text style={styles.footerLink}>Report an Issue / Enquiry</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goTo('TrackRequest')}><Text style={styles.footerLink}>Track My Request</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goTo('Consultations')}><Text style={styles.footerLink}>Public Consultations</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goTo('Surveys')}><Text style={styles.footerLink}>Surveys & Polls</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goTo('TownHalls')}><Text style={styles.footerLink}>Town Halls</Text></TouchableOpacity>
        </View>

        {/* Help */}
        <View style={styles.footerSection}>
          <Text style={styles.footerHeading}>Help</Text>
          <TouchableOpacity onPress={() => goTo('FAQs')}><Text style={styles.footerLink}>FAQs</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goTo('Forum')}><Text style={styles.footerLink}>Discussion Forums</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goTo('Contact')}><Text style={styles.footerLink}>Contact Us</Text></TouchableOpacity>
        </View>

        {/* Contact + Social */}
        <View style={styles.footerSection}>
          <Text style={styles.footerHeading}>Contact Us</Text>
          {ORG.phones.map((p) => (
            <Text key={p.label} style={styles.footerContact}>
              <Ionicons name="call-outline" size={14} color={COLORS.accent} /> {p.label}: {p.value}
            </Text>
          ))}
          <Text style={styles.footerContact}>
            <Ionicons name="mail-outline" size={14} color={COLORS.accent} /> {ORG.email}
          </Text>
          <Text style={styles.footerContact}>
            <Ionicons name="location-outline" size={14} color={COLORS.accent} /> {ORG.address}
          </Text>

          {/* ✅ DYNAMIC SOCIAL ICONS – from Supabase */}
          <View style={styles.socialRow}>
            {socialLinks.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.socialIconBtn}
                onPress={() => handleSocialPress(item.url)}
              >
                <Ionicons name={item.icon_name} size={28} color={item.color} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.chatBtn} onPress={() => showAlert('Chat with us', `Tap the chat bubble in the bottom-right corner to talk to ${ORG.assistantName}.`)}>
            <Ionicons name="chatbubbles" size={16} color={COLORS.primaryDark} />
            <Text style={styles.chatBtnText}>Chat with us</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.copyright}>{ORG.copyright}</Text>
        <View style={styles.bottomLinks}>
          <TouchableOpacity onPress={() => comingSoon('Terms of Use')}><Text style={styles.bottomLink}>Terms of Use</Text></TouchableOpacity>
          <Text style={styles.bottomLink}>|</Text>
          <TouchableOpacity onPress={() => comingSoon('Disclaimer')}><Text style={styles.bottomLink}>Disclaimer</Text></TouchableOpacity>
          <Text style={styles.bottomLink}>|</Text>
          <TouchableOpacity onPress={() => comingSoon('Privacy Policy')}><Text style={styles.bottomLink}>Privacy Policy</Text></TouchableOpacity>
          <Text style={styles.bottomLink}>|</Text>
          <TouchableOpacity onPress={() => goTo('Feedback')}><Text style={styles.bottomLink}>Feedback</Text></TouchableOpacity>

          {!user ? (
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.bottomLink, { color: COLORS.accent }]}> | Login</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={signOut}>
              <Text style={[styles.bottomLink, { color: '#EF4444' }]}> | Logout</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: COLORS.primaryDark,
    paddingVertical: 30,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  footerContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  footerSection: {
    width: '20%',
    minWidth: 120,
    marginBottom: 20,
  },
  footerBrand: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  footerTagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 18,
  },
  footerHeading: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  footerLink: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    paddingVertical: 3,
  },
  footerContact: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    paddingVertical: 2,
  },
  socialRow: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  socialIconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  chatBtnText: {
    color: COLORS.primaryDark,
    fontWeight: '600',
    marginLeft: 6,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 16,
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copyright: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  bottomLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  bottomLink: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginHorizontal: 6,
  },
});