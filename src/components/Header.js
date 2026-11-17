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
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BrandMark from './BrandMark';
import { useNavigation } from '@react-navigation/native';
import DropdownMenu from './DropdownMenu';
import { supabase } from '../services/supabaseClient';

const COLORS = {
  primaryDark: 'rgba(7,62,110,0.95)',
  primary: 'rgba(11,95,165,0.95)',
  accent: '#FCD34D',
  gray400: '#94A3B8',
  gray200: '#E2E8F0',
  gray800: '#1E293B',
};

const MOBILE_BREAKPOINT = 768;

export default function Header() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    phone1: 'Toll Free: 0800-200-977',
    phone2: 'Customer Care: +256 (0)313-315-000',
    phone3: '',
  });
  const [socialLinks, setSocialLinks] = useState([]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('key, value');
      if (data) {
        const newInfo = {};
        data.forEach((item) => { newInfo[item.key] = item.value; });
        setContactInfo((prev) => ({ ...prev, ...newInfo }));
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchSocialLinks = async () => {
      const { data } = await supabase
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

  const aboutItems = [
    { label: 'About NWSC', screen: 'About' },
    { label: 'Service Updates', screen: 'Updates' },
    { label: 'News & Announcements', screen: 'News' },
    { label: 'Media Gallery', screen: 'MediaGallery' },
  ];

  const participationItems = [
    { label: 'Enquiries & Complaints', screen: 'Feedback' },
    { label: 'Track My Request', screen: 'TrackRequest' },
    { label: 'Public Consultations', screen: 'Consultations' },
    { label: 'Surveys & Polls', screen: 'Surveys' },
    { label: 'Discussion Forums', screen: 'Forum' },
    { label: 'Town Halls', screen: 'TownHalls' },
  ];

  const helpItems = [
    { label: 'FAQs', screen: 'FAQs' },
    { label: 'Contact Us', screen: 'Contact' },
    { label: 'Sitemap', screen: 'Sitemap' },
  ];

  const navSections = [
    { label: 'About', items: aboutItems },
    { label: 'Participation', items: participationItems },
    { label: 'Help', items: helpItems },
  ];

  const handleNav = (screen, params) => {
    if (screen) navigation.navigate(screen, params);
  };

  const handleMobileNav = (screen, params) => {
    setMobileMenuOpen(false);
    if (screen) navigation.navigate(screen, params);
  };

  const submitMobileSearch = () => {
    if (mobileSearchQuery.trim().length > 0) {
      setMobileMenuOpen(false);
      navigation.navigate('SearchResults', { query: mobileSearchQuery.trim() });
    }
  };

  if (isMobile) {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.mobileTopRow}>
          <TouchableOpacity style={styles.mobileBrand} onPress={() => navigation.navigate('Home')}>
            <BrandMark size="small" />
            <Text style={styles.mobileBrandText} numberOfLines={1}>NWSC e-Participation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setMobileMenuOpen(true)}>
            <Ionicons name="menu" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <Modal visible={mobileMenuOpen} animationType="slide" onRequestClose={() => setMobileMenuOpen(false)}>
          <View style={styles.mobileMenuContainer}>
            <View style={styles.mobileMenuHeader}>
              <Text style={styles.mobileMenuTitle}>Menu</Text>
              <TouchableOpacity onPress={() => setMobileMenuOpen(false)}>
                <Ionicons name="close" size={28} color={COLORS.gray800} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.mobileMenuContent}>
              <View style={styles.mobileSearchBox}>
                <Ionicons name="search-outline" size={18} color={COLORS.gray400} />
                <TextInput
                  style={styles.mobileSearchInput}
                  placeholder="Search..."
                  placeholderTextColor={COLORS.gray400}
                  value={mobileSearchQuery}
                  onChangeText={setMobileSearchQuery}
                  onSubmitEditing={submitMobileSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity onPress={submitMobileSearch}>
                  <Text style={styles.mobileSearchBtnText}>Go</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.mobileNavLink} onPress={() => handleMobileNav('Home')}>
                <Text style={styles.mobileNavLinkText}>Home</Text>
              </TouchableOpacity>

              {navSections.map((section) => (
                <View key={section.label} style={styles.mobileSection}>
                  <Text style={styles.mobileSectionLabel}>{section.label}</Text>
                  {section.items.map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      style={styles.mobileNavLink}
                      onPress={() => handleMobileNav(item.screen, item.params)}
                    >
                      <Text style={styles.mobileNavLinkText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              <View style={styles.mobileSection}>
                <Text style={styles.mobileSectionLabel}>Contact</Text>
                <Text style={styles.mobileContactText}>{contactInfo.phone1}</Text>
                <Text style={styles.mobileContactText}>{contactInfo.phone2}</Text>
                {contactInfo.phone3 ? <Text style={styles.mobileContactText}>{contactInfo.phone3}</Text> : null}
              </View>

              {socialLinks.length > 0 && (
                <View style={styles.mobileSocialRow}>
                  {socialLinks.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.mobileIconBtn}
                      onPress={() => handleSocialPress(item.url)}
                    >
                      <Ionicons name={item.icon_name} size={22} color={item.color || COLORS.gray800} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.headerContainer}>
      {/* TOP ROW */}
      <View style={styles.topRow}>
        <BrandMark />
        <View style={styles.contactInfo}>
          <Text style={styles.contactText}>
            <Ionicons name="call-outline" size={14} color={COLORS.accent} /> {contactInfo.phone1}
          </Text>
          <Text style={styles.contactText}>
            <Ionicons name="call-outline" size={14} color={COLORS.accent} /> {contactInfo.phone2}
          </Text>
          {contactInfo.phone3 ? (
            <Text style={styles.contactText}>
              <Ionicons name="chatbubble-outline" size={14} color={COLORS.accent} /> {contactInfo.phone3}
            </Text>
          ) : null}
        </View>

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
            onSelect={(item) => handleNav(item.screen, item.params)}
            icon="information-circle-outline"
          />
          <DropdownMenu
            label="Participation"
            items={participationItems}
            onSelect={(item) => handleNav(item.screen, item.params)}
            icon="people-outline"
          />
          <DropdownMenu
            label="Help"
            items={helpItems}
            onSelect={(item) => handleNav(item.screen, item.params)}
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
            <TouchableOpacity
              onPress={() => {
                if (searchQuery.trim().length > 0) {
                  navigation.navigate('SearchResults', { query: searchQuery.trim() });
                }
              }}
            >
              <Ionicons name="search-outline" size={20} color={COLORS.gray400} />
            </TouchableOpacity>
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={COLORS.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => {
                if (searchQuery.trim().length > 0) {
                  navigation.navigate('SearchResults', { query: searchQuery.trim() });
                }
              }}
              returnKeyType="search"
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

  // ---------- Mobile layout ----------
  mobileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  mobileBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  coatOfArmsSmall: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 8,
  },
  mobileBrandText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  hamburgerBtn: {
    padding: 4,
  },
  mobileMenuContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  mobileMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  mobileMenuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gray800,
  },
  mobileMenuContent: {
    padding: 20,
  },
  mobileSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    gap: 8,
  },
  mobileSearchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.gray800,
  },
  mobileSearchBtnText: {
    color: 'rgba(30,58,138,1)',
    fontWeight: '700',
    fontSize: 13,
  },
  mobileNavLink: {
    paddingVertical: 12,
  },
  mobileNavLinkText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  mobileSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  mobileSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray400,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  mobileContactText: {
    fontSize: 14,
    color: COLORS.gray800,
    paddingVertical: 4,
  },
  mobileSocialRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  mobileIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
