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
    },
  },
};

const AppNavigatorContent = () => {
  const { user, loading } = useAuth();
  const [chatVisible, setChatVisible] = useState(false);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0B5FA5" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#F8FAFC' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Consultations" component={ConsultationsScreen} />
        <Stack.Screen name="Surveys" component={SurveysScreen} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} />
        <Stack.Screen name="TrackRequest" component={TrackRequestScreen} />
        <Stack.Screen name="ProposeConsultation" component={ProposeConsultationScreen} />
        <Stack.Screen name="FAQs" component={FAQScreen} />
        <Stack.Screen name="ChatBot" component={ChatBotScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="News" component={NewsScreen} />
        <Stack.Screen name="Forum" component={ForumScreen} />
        <Stack.Screen name="MediaGallery" component={MediaGalleryScreen} />
        <Stack.Screen name="Updates" component={UpdatesScreen} />
        <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
        <Stack.Screen name="TownHalls" component={TownHallsScreen} />
        <Stack.Screen name="Contact" component={ContactScreen} />
        <Stack.Screen name="Sitemap" component={SitemapScreen} />
        <Stack.Screen name="ForumThread" component={ForumThreadScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
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
                <Text style={styles.chatTitle}>Chat with Maji</Text>
                <TouchableOpacity onPress={() => setChatVisible(false)}>
                  <Ionicons name="close" size={28} color="#0B5FA5" />
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
      <StatusBar barStyle="light-content" backgroundColor="#0B5FA5" />
      <NavigationContainer linking={linking}>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    width: width * 0.45,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B5FA5',
  },
});