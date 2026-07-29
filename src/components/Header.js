import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DropdownMenu from './DropdownMenu';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

const COLORS = {
  primaryDark: 'rgba(15,23,42,0.85)',
  primary: 'rgba(30,58,138,0.9)',
  accent: '#FCD34D',
  gray400: '#94A3B8',
};

export default function Header() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [contactInfo, setContactInfo] = useState({
    phone1: '+256(0)-41-4259338',
    phone2: 'Toll Free: 0800-100-257',
    phone3: 'TELA: 0800-377-771',
  });
  const [socialLinks, setSocialLinks] = useState([]);

  // Fetch contact info
  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value');
      if (data) {
        const newInfo = {};
        data.forEach(item => { newInfo[item.key] = item.value; });
        setContactInfo(prev => ({ ...prev, ...newInfo }));
      }
    };
    fetchSettings();
  }, []);

  // Fetch social links
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
    Linking.openURL(url).catch(() => alert('Open in browser'));
  };

  // Dropdown items
  const aboutItems = [
    { label: 'Projects', screen: 'Resources' },
    { label: 'Opportunities', screen: 'Resources' },
    { label: 'Information Systems', screen: 'Resources' },
    { label: 'Circulars & Reports', screen: 'Resources' },
    { label: 'Policies & Regulations', screen: 'Resources' },
    { label: 'Jobs & Careers', screen: 'Resources' },
    { label: 'Scholarships', screen: 'Resources' },
    { label: 'Tenders & Bids', screen: 'Resources' },
  ];

  const participationItems = [
    { label: 'Consultations', screen: 'Consultations' },
    { label: 'Surveys', screen: 'Surveys' },
    { label: 'Feedback', screen: 'Feedback' },
    { label: 'Ideas Hub', screen: 'Feedback' },
  ];

  const resourceItems = [
    { label: 'Resources', screen: 'Resources' },
    { label: 'FAQs', screen: 'FAQs' },
  ];

  const handleNav = (screen) => {
    if (screen) navigation.navigate(screen);
  };

  return (
    <View style={styles.headerContainer}>
      {/* TOP ROW */}
      <View style={styles.topRow}>
        <Image
          source={require('../../assets/coat_of_arms.png')}
          style={styles.coatOfArms}
          resizeMode="contain"
          onError={() => console.warn('Coat of Arms fallback used.')}
        />
        <View style={styles.contactInfo}>
          <Text style={styles.contactText}>
            <Ionicons name="call-outline" size={14} color={COLORS.accent} /> {contactInfo.phone1}
          </Text>
          <Text style={styles.contactText}>
            <Ionicons name="call-outline" size={14} color={COLORS.accent} /> {contactInfo.phone2}
          </Text>
          <Text style={styles.contactText}>
            <Ionicons name="chatbubble-outline" size={14} color={COLORS.accent} /> {contactInfo.phone3}
          </Text>
        </View>

        {/* ✅ Admin Badge */}
        {user && user.email === 'kemugisha@gmail.com' && (
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.accent} />
            <Text style={styles.adminText}>Admin</Text>
          </View>
        )}
      </View>

      {/* SECOND ROW */}
      <View style={styles.navRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.navScroll}>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.navLinkText}>Home</Text>
          </TouchableOpacity>
          <DropdownMenu
            label="About"
            items={aboutItems}
            onSelect={(item) => handleNav(item.screen)}
            icon="information-circle-outline"
          />
          <DropdownMenu
            label="Participation"
            items={participationItems}
            onSelect={(item) => handleNav(item.screen)}
            icon="people-outline"
          />
          <DropdownMenu
            label="Resources"
            items={resourceItems}
            onSelect={(item) => handleNav(item.screen)}
            icon="book-outline"
          />
        </ScrollView>

        <View style={styles.rightIcons}>
          {/* Social Links */}
          {socialLinks.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.iconBtn}
              onPress={() => handleSocialPress(item.url)}
            >
              <Ionicons name={item.icon_name} size={22} color={item.color || '#fff'} />
            </TouchableOpacity>
          ))}

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color={COLORS.gray400} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={COLORS.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => {
                if (searchQuery.trim().length > 0) {
                  navigation.navigate('FAQs');
                }
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: COLORS.primaryDark,
    backdropFilter: 'blur(10px)',
    paddingTop: 30,
    paddingBottom: 4,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 4,
  },
  coatOfArms: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  contactText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 12,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginLeft: 8,
  },
  adminText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: COLORS.primary,
    backdropFilter: 'blur(10px)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  navScroll: {
    flex: 1,
    flexDirection: 'row',
  },
  navLink: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  navLinkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  iconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 6,
    minWidth: 120,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 4,
    marginLeft: 6,
  },
});