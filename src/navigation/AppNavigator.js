import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Text,
  ActivityIndicator,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import { AuthProvider, useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import ChatButton from '../components/ChatButton';

import HomeScreen from '../screens/HomeScreen';
import ConsultationsScreen from '../screens/ConsultationsScreen';
import SurveysScreen from '../screens/SurveysScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import TrackRequestScreen from '../screens/TrackRequestScreen';
import ProposeConsultationScreen from '../screens/ProposeConsultationScreen';
import FAQScreen from '../screens/FAQScreen';
import ChatBotScreen from '../screens/ChatBotScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AboutScreen from '../screens/AboutScreen';
import NewsScreen from '../screens/NewsScreen';
import ForumScreen from '../screens/ForumScreen';
import ForumThreadScreen from '../screens/ForumThreadScreen';
import MediaGalleryScreen from '../screens/MediaGalleryScreen';
import UpdatesScreen from '../screens/UpdatesScreen';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import TownHallsScreen from '../screens/TownHallsScreen';
import ContactScreen from '../screens/ContactScreen';
import SitemapScreen from '../screens/SitemapScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import NotFoundScreen from '../screens/NotFoundScreen';
import { COLORS, FONT } from '../theme';

const Stack = createStackNavigator();
const { width, height } = Dimensions.get('window');

// Real URL routing (web) / deep linking (native). AdminDashboard gets its
// own path ("/admin") so it's a genuine bookmarkable/shareable URL, distinct
// from the citizen-facing screens — access itself is still gated inside
// AdminDashboardScreen (role check), not by whether the route exists.
const linking = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: {
      Home: '',
      Consultations: 'consultations',
      Surveys: 'surveys',
      Feedback: 'feedback',
      TrackRequest: 'track',
      ProposeConsultation: 'consultations/propose',
      FAQs: 'faqs',
      Login: 'login',
      SignUp: 'signup',
      ForgotPassword: 'forgot-password',
      About: 'about',
      News: 'news',
      Forum: 'forum',
      ForumThread: 'forum/:topicId',
      MediaGallery: 'gallery',
      Updates: 'updates',
      SearchResults: 'search',
      TownHalls: 'town-halls',
      Contact: 'contact',
      Sitemap: 'sitemap',
      AdminDashboard: 'admin',
      Privacy: 'privacy',
      NotFound: '*',
    },
  },
};

// Browser tab titles (web) — "<Page> · NWSC Jinja e-Participation".
const TITLES = {
  Home: 'Home',
  Consultations: 'Public consultations',
  Surveys: 'Surveys & polls',
  Feedback: 'Enquiries & complaints',
  TrackRequest: 'Track my request',
  ProposeConsultation: 'Propose a consultation',
  FAQs: 'FAQs',
  ChatBot: 'Assistant',
  Login: 'Sign in',
  SignUp: 'Create account',
  ForgotPassword: 'Reset password',
  About: 'About NWSC Jinja',
  News: 'News & announcements',
  Forum: 'Discussion forums',
  MediaGallery: 'Media gallery',
  Updates: 'Service updates',
  SearchResults: 'Search',
  TownHalls: 'Community meetings',
  Contact: 'Contact us',
  Sitemap: 'Sitemap',
  ForumThread: 'Discussion',
  AdminDashboard: 'Staff area',
  Privacy: 'Privacy & terms',
  NotFound: 'Page not found',
};

const AppNavigatorContent = () => {
  const { user, loading } = useAuth();
  const [chatVisible, setChatVisible] = useState(false);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: COLORS.bg },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: TITLES.Home }} />
        <Stack.Screen name="Consultations" component={ConsultationsScreen} options={{ title: TITLES.Consultations }} />
        <Stack.Screen name="Surveys" component={SurveysScreen} options={{ title: TITLES.Surveys }} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ title: TITLES.Feedback }} />
        <Stack.Screen name="TrackRequest" component={TrackRequestScreen} options={{ title: TITLES.TrackRequest }} />
        <Stack.Screen name="ProposeConsultation" component={ProposeConsultationScreen} options={{ title: TITLES.ProposeConsultation }} />
        <Stack.Screen name="FAQs" component={FAQScreen} options={{ title: TITLES.FAQs }} />
        <Stack.Screen name="ChatBot" component={ChatBotScreen} options={{ title: TITLES.ChatBot }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: TITLES.Login }} />
        <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: TITLES.SignUp }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: TITLES.ForgotPassword }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ title: TITLES.About }} />
        <Stack.Screen name="News" component={NewsScreen} options={{ title: TITLES.News }} />
        <Stack.Screen name="Forum" component={ForumScreen} options={{ title: TITLES.Forum }} />
        <Stack.Screen name="MediaGallery" component={MediaGalleryScreen} options={{ title: TITLES.MediaGallery }} />
        <Stack.Screen name="Updates" component={UpdatesScreen} options={{ title: TITLES.Updates }} />
        <Stack.Screen name="SearchResults" component={SearchResultsScreen} options={{ title: TITLES.SearchResults }} />
        <Stack.Screen name="TownHalls" component={TownHallsScreen} options={{ title: TITLES.TownHalls }} />
        <Stack.Screen name="Contact" component={ContactScreen} options={{ title: TITLES.Contact }} />
        <Stack.Screen name="Sitemap" component={SitemapScreen} options={{ title: TITLES.Sitemap }} />
        <Stack.Screen name="ForumThread" component={ForumThreadScreen} options={{ title: TITLES.ForumThread }} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: TITLES.AdminDashboard }} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: TITLES.Privacy }} />
        <Stack.Screen name="NotFound" component={NotFoundScreen} options={{ title: TITLES.NotFound }} />
      </Stack.Navigator>

      <ChatButton onPress={() => setChatVisible(true)} />

      <Modal
        visible={chatVisible}
        transparent
        animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
        onRequestClose={() => setChatVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackground} onPress={() => setChatVisible(false)} activeOpacity={1} />
          <View style={[styles.chatContainer, Platform.OS === 'web' && styles.webChatContainer]} onStartShouldSetResponder={() => true}>
            <View style={styles.chatPanel}>
              <View style={styles.chatHeader}>
                <View>
                  <Text style={styles.chatTitle}>Maji · NWSC assistant</Text>
                  <Text style={styles.chatSub}>Answers in seconds. For emergencies call 0800-200-977.</Text>
                </View>
                <TouchableOpacity onPress={() => setChatVisible(false)} accessibilityLabel="Close chat">
                  <Ionicons name="close" size={26} color={COLORS.white} />
                </TouchableOpacity>
              </View>
              <ChatBotScreen onClose={() => setChatVisible(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function AppNavigator() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <NavigationContainer
        linking={linking}
        documentTitle={{ formatter: (options) => `${options?.title ?? 'Home'} · NWSC Jinja e-Participation` }}
      >
        <AuthProvider>
          <AppNavigatorContent />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4,31,58,0.45)',
    justifyContent: Platform.OS === 'web' ? 'flex-start' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'flex-end' : 'stretch',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  chatContainer: {
    height: Platform.OS === 'web' ? '100%' : height * 0.6,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: Platform.OS === 'web' ? 0 : 20,
    borderTopRightRadius: Platform.OS === 'web' ? 0 : 20,
    overflow: 'hidden',
    pointerEvents: 'auto',
    zIndex: 10,
  },
  webChatContainer: {
    width: '100%',
    maxWidth: 440,
    height: '100%',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  chatPanel: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
  },
  chatTitle: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
  },
  chatSub: {
    fontFamily: FONT,
    fontSize: 12,
    color: '#BAE6FD',
    marginTop: 2,
  },
});