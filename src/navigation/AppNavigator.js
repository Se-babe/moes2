import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { NavigationContainer, useNavigationContainerRef, getStateFromPath, getPathFromState } from '@react-navigation/native';
import { BASE_PATH, stripBase } from '../config/base';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';

import { AuthProvider } from '../context/AuthContext';
import { PreferencesProvider } from '../context/PreferencesContext';
import Header from '../components/Header';
import ChatButton from '../components/ChatButton';

import HomeScreen from '../screens/HomeScreen';
import NotFoundScreen from '../screens/NotFoundScreen';
import { COLORS, FONT } from '../theme';
import { lazyScreen, preloadScreens } from './lazyScreen';

// Every other page is downloaded the first time it is opened, so the first
// visit only loads the home page. The common public pages are fetched in the
// background once the home page is showing (see preloadScreens below).
const ConsultationsScreen = lazyScreen(() => import('../screens/ConsultationsScreen'));
const SurveysScreen = lazyScreen(() => import('../screens/SurveysScreen'));
const FeedbackScreen = lazyScreen(() => import('../screens/FeedbackScreen'));
const TrackRequestScreen = lazyScreen(() => import('../screens/TrackRequestScreen'));
const ProposeConsultationScreen = lazyScreen(() => import('../screens/ProposeConsultationScreen'));
const FAQScreen = lazyScreen(() => import('../screens/FAQScreen'));
const ChatBotScreen = lazyScreen(() => import('../screens/ChatBotScreen'));
const LoginScreen = lazyScreen(() => import('../screens/LoginScreen'));
const ForgotPasswordScreen = lazyScreen(() => import('../screens/ForgotPasswordScreen'));
const AdminDashboardScreen = lazyScreen(() => import('../screens/AdminDashboardScreen'));
const HRDashboardScreen = lazyScreen(() => import('../screens/HRDashboardScreen'));
const MeScreen = lazyScreen(() => import('../screens/MeScreen'));
const CitizenSignInScreen = lazyScreen(() => import('../screens/CitizenSignInScreen'));
const LearnScreen = lazyScreen(() => import('../screens/LearnScreen'));
const LessonScreen = lazyScreen(() => import('../screens/LessonScreen'));
const PracticeScreen = lazyScreen(() => import('../screens/PracticeScreen'));
const DocumentsScreen = lazyScreen(() => import('../screens/DocumentsScreen'));
const PerformanceScreen = lazyScreen(() => import('../screens/PerformanceScreen'));
const AboutScreen = lazyScreen(() => import('../screens/AboutScreen'));
const NewsScreen = lazyScreen(() => import('../screens/NewsScreen'));
const ForumScreen = lazyScreen(() => import('../screens/ForumScreen'));
const ForumThreadScreen = lazyScreen(() => import('../screens/ForumThreadScreen'));
const MediaGalleryScreen = lazyScreen(() => import('../screens/MediaGalleryScreen'));
const UpdatesScreen = lazyScreen(() => import('../screens/UpdatesScreen'));
const UpdateDetailScreen = lazyScreen(() => import('../screens/UpdateDetailScreen'));
const AlertsScreen = lazyScreen(() => import('../screens/AlertsScreen'));
const SurveyDetailScreen = lazyScreen(() => import('../screens/SurveyDetailScreen'));
const SearchResultsScreen = lazyScreen(() => import('../screens/SearchResultsScreen'));
const TownHallsScreen = lazyScreen(() => import('../screens/TownHallsScreen'));
const ContactScreen = lazyScreen(() => import('../screens/ContactScreen'));
const SitemapScreen = lazyScreen(() => import('../screens/SitemapScreen'));
const PrivacyScreen = lazyScreen(() => import('../screens/PrivacyScreen'));
const SetPasswordScreen = lazyScreen(() => import('../screens/SetPasswordScreen'));
const StaffPortalScreen = lazyScreen(() => import('../screens/staff/StaffPortalScreen'));
const StaffRequestScreen = lazyScreen(() => import('../screens/staff/StaffRequestScreen'));
const StaffSettingsScreen = lazyScreen(() => import('../screens/staff/StaffSettingsScreen'));

const Stack = createStackNavigator();
const { width, height } = Dimensions.get('window');

// Real URL routing (web) / deep linking (native). AdminDashboard gets its
// own path ("/admin") so it's a genuine bookmarkable/shareable URL, distinct
// from the citizen-facing screens — access itself is still gated inside
// AdminDashboardScreen (role check), not by whether the route exists.
const linking = {
  prefixes: [Linking.createURL('/')],
  // On GitHub Pages the site lives under /moes2: drop it before matching a
  // route, and add it back to every address the app writes.
  getStateFromPath: (path, options) => {
    const state = getStateFromPath(stripBase(path), options);
    // React Navigation writes the matched route's path back to the address
    // bar, so keep the sub-folder on it.
    for (let s = BASE_PATH ? state : null; s?.routes;) {
      const route = s.routes[s.index ?? s.routes.length - 1];
      if (route.path && !route.path.startsWith(BASE_PATH)) route.path = BASE_PATH + route.path;
      s = route.state;
    }
    return state;
  },
  getPathFromState: (state, options) => `${BASE_PATH}${getPathFromState(state, options)}`,
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
      ForgotPassword: 'forgot-password',
      About: 'about',
      News: 'news',
      Forum: 'forum',
      ForumThread: 'forum/:topicId',
      MediaGallery: 'gallery',
      Updates: 'updates',
      UpdateDetail: 'updates/:id',
      Alerts: 'alerts',
      Me: 'me',
      SignIn: 'signin',
      Learn: 'learn',
      Practice: 'learn/practice/:kind',
      Lesson: 'learn/:slug',
      Documents: 'documents',
      Performance: 'dashboard',
      SurveyDetail: 'surveys/:id',
      SearchResults: 'search',
      TownHalls: 'town-halls',
      Contact: 'contact',
      Sitemap: 'sitemap',
      AdminDashboard: 'admin',
      HRDashboard: 'hr',
      Privacy: 'privacy',
      SetPassword: 'set-password',
      StaffPortal: 'staff',
      StaffRequest: 'staff/requests/:id',
      StaffSettings: 'staff/settings',
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
  Login: 'Staff sign in',
  ForgotPassword: 'Reset password',
  About: 'About NWSC Jinja',
  News: 'News & announcements',
  Forum: 'Discussion forums',
  MediaGallery: 'Media gallery',
  Updates: 'Service updates',
  UpdateDetail: 'Service update',
  Alerts: 'Alerts & my profile',
  Me: 'My NWSC',
  SignIn: 'Sign in',
  Learn: 'Help & learning',
  Lesson: 'Lesson',
  Practice: 'Practice',
  Documents: 'Documents & policies',
  Performance: "How we're doing",
  SurveyDetail: 'Survey',
  SearchResults: 'Search',
  TownHalls: 'Community meetings',
  Contact: 'Contact us',
  Sitemap: 'Sitemap',
  ForumThread: 'Discussion',
  AdminDashboard: 'Admin console',
  HRDashboard: 'HR dashboard',
  Privacy: 'Privacy & terms',
  SetPassword: 'Set your password',
  StaffPortal: 'Staff portal',
  StaffRequest: 'Request',
  StaffSettings: 'Settings',
  NotFound: 'Page not found',
};

// Staff and admin work areas get a focused layout without the public header
// and assistant button.
const WORKSPACE_ROUTES = ['StaffPortal', 'StaffRequest', 'StaffSettings', 'AdminDashboard', 'HRDashboard', 'Login', 'ForgotPassword', 'SetPassword'];

const AppNavigatorContent = ({ currentRoute }) => {
  const inWorkspace = WORKSPACE_ROUTES.includes(currentRoute);
  const [chatVisible, setChatVisible] = useState(false);

  // Public pages show straight away; staff pages wait for sign-in themselves
  // (StaffGate). Fetch the pages citizens open most once the first page is up.
  useEffect(() => {
    preloadScreens([FeedbackScreen, TrackRequestScreen, UpdatesScreen, SurveysScreen, ConsultationsScreen, ForumScreen, AboutScreen, ContactScreen, FAQScreen]);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {!inWorkspace && <Header />}
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
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: TITLES.ForgotPassword }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ title: TITLES.About }} />
        <Stack.Screen name="News" component={NewsScreen} options={{ title: TITLES.News }} />
        <Stack.Screen name="Forum" component={ForumScreen} options={{ title: TITLES.Forum }} />
        <Stack.Screen name="MediaGallery" component={MediaGalleryScreen} options={{ title: TITLES.MediaGallery }} />
        <Stack.Screen name="Updates" component={UpdatesScreen} options={{ title: TITLES.Updates }} />
        <Stack.Screen name="UpdateDetail" component={UpdateDetailScreen} options={{ title: TITLES.UpdateDetail }} />
        <Stack.Screen name="Alerts" component={AlertsScreen} options={{ title: TITLES.Alerts }} />
        <Stack.Screen name="SurveyDetail" component={SurveyDetailScreen} options={{ title: TITLES.SurveyDetail }} />
        <Stack.Screen name="SearchResults" component={SearchResultsScreen} options={{ title: TITLES.SearchResults }} />
        <Stack.Screen name="TownHalls" component={TownHallsScreen} options={{ title: TITLES.TownHalls }} />
        <Stack.Screen name="Contact" component={ContactScreen} options={{ title: TITLES.Contact }} />
        <Stack.Screen name="Sitemap" component={SitemapScreen} options={{ title: TITLES.Sitemap }} />
        <Stack.Screen name="ForumThread" component={ForumThreadScreen} options={{ title: TITLES.ForumThread }} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: TITLES.AdminDashboard }} />
        <Stack.Screen name="HRDashboard" component={HRDashboardScreen} options={{ title: TITLES.HRDashboard }} />
        <Stack.Screen name="Me" component={MeScreen} options={{ title: TITLES.Me }} />
        <Stack.Screen name="SignIn" component={CitizenSignInScreen} options={{ title: TITLES.SignIn }} />
        <Stack.Screen name="Learn" component={LearnScreen} options={{ title: TITLES.Learn }} />
        <Stack.Screen name="Lesson" component={LessonScreen} options={{ title: TITLES.Lesson }} />
        <Stack.Screen name="Practice" component={PracticeScreen} options={{ title: TITLES.Practice }} />
        <Stack.Screen name="Documents" component={DocumentsScreen} options={{ title: TITLES.Documents }} />
        <Stack.Screen name="Performance" component={PerformanceScreen} options={{ title: TITLES.Performance }} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: TITLES.Privacy }} />
        <Stack.Screen name="SetPassword" component={SetPasswordScreen} options={{ title: TITLES.SetPassword }} />
        <Stack.Screen name="StaffPortal" component={StaffPortalScreen} options={{ title: TITLES.StaffPortal }} />
        <Stack.Screen name="StaffRequest" component={StaffRequestScreen} options={{ title: TITLES.StaffRequest }} />
        <Stack.Screen name="StaffSettings" component={StaffSettingsScreen} options={{ title: TITLES.StaffSettings }} />
        <Stack.Screen name="NotFound" component={NotFoundScreen} options={{ title: TITLES.NotFound }} />
      </Stack.Navigator>

      {!inWorkspace && <ChatButton onPress={() => setChatVisible(true)} />}

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
              {chatVisible && <ChatBotScreen onClose={() => setChatVisible(false)} />}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function AppNavigator() {
  const navigationRef = useNavigationContainerRef();
  const [currentRoute, setCurrentRoute] = useState(null);
  const syncRoute = () => setCurrentRoute(navigationRef.getCurrentRoute()?.name ?? null);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <NavigationContainer
        ref={navigationRef}
        onReady={syncRoute}
        onStateChange={syncRoute}
        linking={linking}
        documentTitle={{ formatter: (options) => `${options?.title ?? 'Home'} · NWSC Jinja e-Participation` }}
      >
        <AuthProvider>
          <PreferencesProvider>
            <AppNavigatorContent currentRoute={currentRoute} />
          </PreferencesProvider>
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
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