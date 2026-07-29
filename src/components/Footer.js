import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

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
    Linking.openURL(url).catch(() => alert('Could not open link.'));
  };

  return (
    <View style={styles.footer}>
      <View style={styles.footerContent}>
        {/* Brand */}
        <View style={styles.footerSection}>
          <Text style={styles.footerBrand}>
            <Ionicons name="school" size={18} color={COLORS.accent} /> MoES<span style={{ color: COLORS.accent }}>e‑Participation</span>
          </Text>
          <Text style={styles.footerTagline}>
            Empowering Ugandans to shape education, sports, and health policies through active participation and collaboration.
          </Text>
        </View>

        {/* Quick Links */}
        <View style={styles.footerSection}>
          <Text style={styles.footerHeading}>Quick Links</Text>
          <Text style={styles.footerLink}>About Us</Text>
          <Text style={styles.footerLink}>Contact Us</Text>
          <Text style={styles.footerLink}>FAQs</Text>
          <Text style={styles.footerLink}>Sitemap</Text>
          <Text style={styles.footerLink}>Media Center</Text>
        </View>

        {/* Participation */}
        <View style={styles.footerSection}>
          <Text style={styles.footerHeading}>Participation</Text>
          <Text style={styles.footerLink}>Submit Feedback</Text>
          <Text style={styles.footerLink}>Take a Survey</Text>
          <Text style={styles.footerLink}>Ideas Hub</Text>
          <Text style={styles.footerLink}>Virtual Town Halls</Text>
          <Text style={styles.footerLink}>Whistle Blow</Text>
        </View>

        {/* Resources */}
        <View style={styles.footerSection}>
          <Text style={styles.footerHeading}>Resources</Text>
          <Text style={styles.footerLink}>Legal & Policy</Text>
          <Text style={styles.footerLink}>Research & Publications</Text>
          <Text style={styles.footerLink}>Circulars & Reports</Text>
          <Text style={styles.footerLink}>Tax Education</Text>
          <Text style={styles.footerLink}>Opportunities</Text>
        </View>

        {/* Contact + Social */}
        <View style={styles.footerSection}>
          <Text style={styles.footerHeading}>Contact Us</Text>
          <Text style={styles.footerContact}>
            <Ionicons name="call-outline" size={14} color={COLORS.accent} /> +256 (0)41-4259338
          </Text>
          <Text style={styles.footerContact}>
            <Ionicons name="call-outline" size={14} color={COLORS.accent} /> Toll Free: 0800-100-257
          </Text>
          <Text style={styles.footerContact}>
            <Ionicons name="mail-outline" size={14} color={COLORS.accent} /> info@education.go.ug
          </Text>
          <Text style={styles.footerContact}>
            <Ionicons name="location-outline" size={14} color={COLORS.accent} /> Kampala, Uganda
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

          <TouchableOpacity style={styles.chatBtn} onPress={() => alert('Chat with us!')}>
            <Ionicons name="chatbubbles" size={16} color={COLORS.primaryDark} />
            <Text style={styles.chatBtnText}>Chat with us</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.copyright}>© 2026 - Ministry of Education and Sports, Uganda</Text>
        <View style={styles.bottomLinks}>
          <Text style={styles.bottomLink}>Terms of Use</Text>
          <Text style={styles.bottomLink}>|</Text>
          <Text style={styles.bottomLink}>Disclaimer</Text>
          <Text style={styles.bottomLink}>|</Text>
          <Text style={styles.bottomLink}>Privacy Policy</Text>
          <Text style={styles.bottomLink}>|</Text>
          <Text style={styles.bottomLink}>Feedback</Text>

          {!user ? (
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.bottomLink, { color: COLORS.accent }]}> | Admin Login</Text>
            </TouchableOpacity>
          ) : (
            <>
              {user.email === 'kemugisha@gmail.com' && (
                <TouchableOpacity onPress={() => navigation.navigate('AdminDashboard')}>
                  <Text style={[styles.bottomLink, { color: COLORS.accent }]}> | Dashboard</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={signOut}>
                <Text style={[styles.bottomLink, { color: '#EF4444' }]}> | Logout</Text>
              </TouchableOpacity>
            </>
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