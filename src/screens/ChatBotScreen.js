// ============================================================
// FULL ChatBotScreen.js with Notification on User Message
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';

const COLORS = {
  primary: '#1E3A8A',
  primaryLight: '#3B82F6',
  primaryDark: '#0F172A',
  accent: '#FCD34D',
  white: '#FFFFFF',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};

export default function ChatBotScreen({ onClose }) {
  // ----- Registration State -----
  const [isRegistered, setIsRegistered] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [userName, setUserName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [registering, setRegistering] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);

  // ----- Chat State -----
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const flatListRef = useRef(null);

  // ----- Quick options -----
  const quickOptions = [
    { label: '📝 Submit Feedback', value: 'submit feedback' },
    { label: '📄 Active Consultations', value: 'consultations' },
    { label: '📊 Take a Survey', value: 'survey' },
    { label: '🏛️ Town Halls', value: 'town hall' },
    { label: '❓ General Help', value: 'help' },
  ];

  // ----- Helper: get admin user -----
  const getAdminUser = async () => {
    const { data } = await supabase.from('users').select('id').limit(1);
    return data?.[0];
  };

  // ----- Helper: create notification -----
  const createNotification = async (userId, title, message, type, targetScreen) => {
    await supabase.from('notifications').insert([{
      user_id: userId,
      title,
      message,
      type,
      target_screen: targetScreen,
      read: false,
    }]);
  };

  // ----- Load saved session -----
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedSessionId = await AsyncStorage.getItem('chat_session_id');
        const storedUserName = await AsyncStorage.getItem('chat_user_name');
        if (storedSessionId && storedUserName) {
          const { data, error } = await supabase
            .from('chat_sessions')
            .select('id, user_name')
            .eq('id', storedSessionId)
            .single();
          if (data) {
            setSessionId(storedSessionId);
            setUserName(storedUserName);
            setIsRegistered(true);
            const { data: msgs } = await supabase
              .from('chat_messages')
              .select('*')
              .eq('session_id', storedSessionId)
              .order('created_at', { ascending: true });
            if (msgs) {
              const formatted = msgs.map(m => ({ id: m.id, sender: m.sender, text: m.message }));
              setMessages(formatted);
            }
            if (!msgs || msgs.length === 0) {
              addBotMessage(`Welcome back ${storedUserName}! How can I help you today?`);
              setTimeout(() => {
                addBotMessage(`You can ask about consultations, surveys, feedback, town halls, or choose an option below.`);
              }, 800);
            }
          } else {
            await AsyncStorage.removeItem('chat_session_id');
            await AsyncStorage.removeItem('chat_user_name');
          }
        }
      } catch (e) {
        console.error('Error loading session:', e);
      } finally {
        setLoadingSession(false);
      }
    };
    loadSession();
  }, []);

  // ----- Register -----
  const handleRegister = async () => {
    if (!userName.trim() || !phone.trim() || !email.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    setRegistering(true);
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert([
          { user_name: userName.trim(), phone: phone.trim(), email: email.trim(), status: 'active' },
        ])
        .select('id')
        .single();
      if (error) throw error;
      setSessionId(data.id);
      setIsRegistered(true);
      await AsyncStorage.setItem('chat_session_id', data.id);
      await AsyncStorage.setItem('chat_user_name', userName.trim());
      addBotMessage(`Hello ${userName}! I am Massa, your MoES assistant. How can I help you today?`);
      setTimeout(() => {
        addBotMessage(`You can ask me about consultations, surveys, feedback, town halls, or choose one of the options below.`);
      }, 800);
    } catch (error) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setRegistering(false);
    }
  };

  // ----- Message Helpers -----
  const addMessage = (sender, text) => {
    const newMsg = { id: Date.now().toString(), sender, text };
    setMessages(prev => [...prev, newMsg]);
    if (sessionId) {
      supabase
        .from('chat_messages')
        .insert([{ session_id: sessionId, sender, message: text }])
        .then(({ error }) => { if (error) console.error(error); });
    }
  };

  const addBotMessage = (text) => {
    setIsBotTyping(true);
    setTimeout(() => {
      addMessage('bot', text);
      setIsBotTyping(false);
    }, 400);
  };

  // ----- System stats -----
  const getSystemStats = async () => {
    try {
      const { count: consCount } = await supabase
        .from('consultations')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      const { count: surveyCount } = await supabase
        .from('surveys')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      const { count: feedbackCount } = await supabase
        .from('feedback')
        .select('*', { count: 'exact', head: true });
      return { consCount, surveyCount, feedbackCount };
    } catch (e) {
      return null;
    }
  };

  // ----- Bot response -----
  const getBotResponse = async (userText) => {
    const lower = userText.toLowerCase();

    if (lower.match(/^(hello|hi|hey|good morning|good afternoon)/)) {
      return `Hello! I am Massa, your MoES assistant. How can I help you today? You can ask about consultations, surveys, feedback, town halls, or choose an option below.`;
    }

    if (lower.includes('consultation') && (lower.includes('count') || lower.includes('how many'))) {
      const stats = await getSystemStats();
      if (stats) {
        return `Currently, there are **${stats.consCount}** active consultations. You can review and comment on them from the Consultations tab.`;
      }
    }
    if (lower.includes('survey') && (lower.includes('count') || lower.includes('how many'))) {
      const stats = await getSystemStats();
      if (stats) {
        return `We have **${stats.surveyCount}** active surveys. Your feedback helps us improve our services. Check the Surveys tab to participate.`;
      }
    }
    if (lower.includes('feedback') && (lower.includes('count') || lower.includes('how many'))) {
      const stats = await getSystemStats();
      if (stats) {
        return `We have received **${stats.feedbackCount}** feedback submissions so far. Each one is reviewed and helps shape our policies. Thank you for your contribution!`;
      }
    }

    if (lower.includes('submit feedback')) {
      return 'To submit feedback, please go to the Feedback tab in the main menu. You can also describe your issue now and I will record it for you.';
    }
    if (lower.includes('consultations') || lower.includes('draft')) {
      return 'Active consultations are listed on the Home page. You can also view all under the Consultations tab.';
    }
    if (lower.includes('survey')) {
      return 'You can participate in surveys from the Surveys tab. Your opinions help us improve!';
    }
    if (lower.includes('town hall') || lower.includes('event')) {
      return 'Upcoming town halls and events are announced on the Home page. You can register directly there.';
    }
    if (lower.includes('help') || lower.includes('menu')) {
      return 'I can help you with:\n• Submit Feedback\n• Check Consultation Status\n• Take a Survey\n• Upcoming Town Halls\n• General Information\n\nJust tell me what you need or tap an option below.';
    }

    try {
      const { data, error } = await supabase
        .from('bot_knowledge')
        .select('response, keywords');
      if (error) throw error;
      let matched = data.find(item =>
        item.keywords.some(keyword => lower.includes(keyword))
      );
      if (matched) {
        return matched.response;
      }
    } catch (e) {
      console.error(e);
    }

    return "I'm not sure I understand. Please ask about consultations, surveys, feedback, town halls, or how to participate. You can also tap one of the options below.";
  };

  // ----- Send message (with notification) -----
  const sendMessage = async (text) => {
    const userMsg = text || inputText.trim();
    if (!userMsg) return;
    setInputText('');
    addMessage('user', userMsg);
    setIsBotTyping(true);

    // ----- CREATE NOTIFICATION FOR ADMIN -----
    try {
      const admin = await getAdminUser();
      if (admin) {
        await createNotification(
          admin.id,
          'Chat Message',
          `From ${userName || 'User'}: ${userMsg.substring(0, 80)}`,
          'chat',
          'ChatBot'
        );
      }
    } catch (e) {
      console.error('Failed to create notification:', e);
    }

    // Human escalation
    if (userMsg.toLowerCase().includes('human') || userMsg.toLowerCase().includes('agent')) {
      setTimeout(() => {
        addBotMessage('I am connecting you to a human agent. Please wait...');
        setTimeout(() => {
          addBotMessage('Hello, this is a human agent. How can I assist you further? (This is a demo simulation)');
        }, 1500);
        setIsBotTyping(false);
      }, 500);
      return;
    }

    const reply = await getBotResponse(userMsg);
    addBotMessage(reply);
  };

  // ----- Quick option -----
  const handleQuickOption = (value) => {
    sendMessage(value);
  };

  // ----- Auto-scroll -----
  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // ----- Render -----
  const renderItem = ({ item }) => (
    <View style={[styles.messageContainer, item.sender === 'user' ? styles.userContainer : styles.botContainer]}>
      <View style={[styles.messageBubble, item.sender === 'user' ? styles.userBubble : styles.botBubble]}>
        <Text style={[styles.messageText, item.sender === 'user' && { color: '#fff' }]}>
          {item.text}
        </Text>
      </View>
    </View>
  );

  if (loadingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your session...</Text>
      </View>
    );
  }

  // ----- Registration Screen -----
  if (!isRegistered) {
    return (
      <KeyboardAvoidingView style={styles.registerContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.registerHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.registerTitle}>Let's Chat</Text>
        </View>
        <ScrollView contentContainerStyle={styles.registerContent}>
          <View style={styles.registerForm}>
            <Text style={styles.label}>Name <Text style={{ color: 'red' }}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Enter your full name" value={userName} onChangeText={setUserName} />
            <Text style={styles.label}>Phone <Text style={{ color: 'red' }}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Enter your phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Text style={styles.label}>Email <Text style={{ color: 'red' }}>*</Text></Text>
            <TextInput style={styles.input} placeholder="Enter your email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TouchableOpacity style={styles.startBtn} onPress={handleRegister} disabled={registering}>
              {registering ? <ActivityIndicator color="#fff" /> : <Text style={styles.startBtnText}>Start Chat</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ----- Chat Interface -----
  return (
    <KeyboardAvoidingView style={styles.chatContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={10}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatMessages}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      {isBotTyping && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>Massa is typing...</Text>
        </View>
      )}
      <View style={styles.quickOptionsContainer}>
        {quickOptions.map((opt, idx) => (
          <TouchableOpacity key={idx} style={styles.quickOption} onPress={() => handleQuickOption(opt.value)}>
            <Text style={styles.quickOptionText}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.inputArea}>
        <TextInput style={styles.chatInput} placeholder="Type your message..." value={inputText} onChangeText={setInputText} onSubmitEditing={() => sendMessage()} />
        <TouchableOpacity style={styles.sendBtn} onPress={() => sendMessage()}>
          <Ionicons name="send" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },
  registerContainer: { flex: 1, backgroundColor: COLORS.gray50 },
  registerHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  closeBtn: { padding: 4 },
  registerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary, marginLeft: 12, flex: 1 },
  registerContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  registerForm: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.gray700, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16 },
  startBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 30, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  chatContainer: { flex: 1, backgroundColor: '#f8fafc' },
  chatMessages: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
  messageContainer: { marginVertical: 4 },
  userContainer: { alignItems: 'flex-end' },
  botContainer: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18 },
  userBubble: { backgroundColor: COLORS.primary },
  botBubble: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.gray200 },
  messageText: { fontSize: 15, color: COLORS.gray800 },
  typingContainer: { paddingHorizontal: 16, paddingVertical: 4 },
  typingText: { fontSize: 13, color: COLORS.gray500, fontStyle: 'italic' },
  quickOptionsContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.gray200 },
  quickOption: { backgroundColor: COLORS.gray100, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, marginBottom: 6 },
  quickOptionText: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
  inputArea: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.gray200 },
  chatInput: { flex: 1, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 25, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, fontSize: 16 },
  sendBtn: { padding: 8 },
});