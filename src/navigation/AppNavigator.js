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

import { AuthProvider, useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import ChatButton from '../components/ChatButton';

import HomeScreen from '../screens/HomeScreen';
import ConsultationsScreen from '../screens/ConsultationsScreen';
import SurveysScreen from '../screens/SurveysScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import FeedbackListScreen from '../screens/FeedbackListScreen';
import ProposeConsultationScreen from '../screens/ProposeConsultationScreen';
import ResourcesScreen from '../screens/ResourcesScreen';
import FAQScreen from '../screens/FAQScreen';
import ChatBotScreen from '../screens/ChatBotScreen';
import LoginScreen from '../screens/LoginScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';

const Stack = createStackNavigator();
const { width, height } = Dimensions.get('window');

const AppNavigatorContent = () => {
  const { user, loading } = useAuth();
  const [chatVisible, setChatVisible] = useState(false);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
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
        <Stack.Screen name="FeedbackList" component={FeedbackListScreen} />
        <Stack.Screen name="ProposeConsultation" component={ProposeConsultationScreen} />
        <Stack.Screen name="Resources" component={ResourcesScreen} />
        <Stack.Screen name="FAQs" component={FAQScreen} />
        <Stack.Screen name="ChatBot" component={ChatBotScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        {user && user.email === 'kemugisha@gmail.com' && (
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        )}
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
                <Text style={styles.chatTitle}>Chat with Massa</Text>
                <TouchableOpacity onPress={() => setChatVisible(false)}>
                  <Ionicons name="close" size={28} color="#1E3A8A" />
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
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" />
      <NavigationContainer>
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
    color: '#1E3A8A',
  },
});