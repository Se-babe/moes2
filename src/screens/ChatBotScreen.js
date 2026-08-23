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
} from 'react-native';
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

const AUDIO_PREFIX = 'AUDIO::';

// UgaJapa Translation API — Voice Engine, via the live-translate ticket+WebSocket
// flow (the old one-shot POST /transcribe returns 500 on real audio; this path
// was confirmed working by protocol-probing it directly).
// TODO: this points at a local dev instance (localhost:5000) — only reachable on
// this machine. Swap for the real deployed URL once available, and move the key
// behind a server-side proxy before production (same reasoning as the Groq key
// below: it's metered/billed, and shipping it in client code lets anyone extract
// it from devtools and spend against the account quota).
const UGAJAPA_API_KEY = 'ugj_live_3fb02347-bc69ddd1-84839b37';
const UGAJAPA_TICKET_URL = 'http://localhost:5000/live/translate/ticket';
const UGAJAPA_LIVE_WS_URL = 'ws://localhost:5000/live/translate';

// Groq — powers Massa's actual conversational replies. The call itself lives
// server-side in supabase/functions/chat-completion (see getBotResponse
// below): the key is a Supabase Edge Function secret, never shipped here.

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

// ----- Voice-note playback bubble -----
function AudioBubble({ uri, isUser }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const togglePlay = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) await player.seekTo(0);
    player.play();
  };

  const format = (secs) => {
    const s = Math.max(0, Math.floor(secs || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const progress = status.duration ? Math.min((status.currentTime / status.duration) * 100, 100) : 0;

  return (
    <TouchableOpacity style={styles.audioBubbleRow} onPress={togglePlay} activeOpacity={0.7}>
      <Ionicons
        name={status.playing ? 'pause-circle' : 'play-circle'}
        size={34}
        color={isUser ? '#fff' : COLORS.primary}
      />
      <View style={styles.audioWaveform}>
        <View style={[styles.audioProgressTrack, isUser && styles.audioProgressTrackUser]}>
          <View style={[styles.audioProgressFill, isUser && styles.audioProgressFillUser, { width: `${progress}%` }]} />
        </View>
        <Text style={[styles.audioDuration, isUser && { color: 'rgba(255,255,255,0.85)' }]}>
          {format(status.currentTime)} / {format(status.duration)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

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

  // ----- Voice note state -----
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 150); // fast poll so the mic button/timer feel responsive
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

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
    const { data } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
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
      showAlert('Error', 'Please fill in all fields.');
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
      showAlert('Registration Failed', error.message);
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

  // ----- Voice note: record -----
  const toggleRecording = async () => {
    if (recorderState.isRecording) {
      try {
        await recorder.stop();
        if (recorder.uri) await sendVoiceNote(recorder.uri);
      } catch (error) {
        showAlert('Recording Error', error.message || 'Could not finish recording.');
      }
      return;
    }
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showAlert('Permission Needed', 'Please allow microphone access to record a voice note.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      showAlert('Recording Error', error.message || 'Could not start recording.');
    }
  };

  // The live-translate WebSocket expects raw 16kHz mono PCM16 samples, not a
  // compressed container — decode+resample the recorded clip (webm/m4a/whatever)
  // down to that exact format before sending it over the socket.
  const blobToPCM16 = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const DecodeCtx = window.AudioContext || window.webkitAudioContext;
    const decodeCtx = new DecodeCtx();
    const decoded = await decodeCtx.decodeAudioData(arrayBuffer);
    decodeCtx.close?.();

    const targetRate = 16000;
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    // Downmix to mono ourselves below; connecting directly to a 1-channel
    // OfflineAudioContext already sums/averages channels for us.
    source.connect(offlineCtx.destination);
    source.start();
    const resampled = await offlineCtx.startRendering();

    const samples = resampled.getChannelData(0); // Float32, -1.0..1.0
    const pcm16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      pcm16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }
    return pcm16.buffer; // raw PCM16LE bytes, 16kHz mono
  };

  // ----- Voice note: transcribe via UgaJapa's live-translate WebSocket -----
  // Protocol (confirmed by direct testing, not documented anywhere):
  // 1. POST /live/translate/ticket -> { ticket }
  // 2. Open ws://.../live/translate?ticket=...&from=..&to=.. -> server sends {type:"ready"}
  // 3. Send the whole recorded clip as one binary WS frame of raw 16kHz mono PCM16
  //    (no envelope needed — but it must be raw samples, not compressed audio)
  // 4. Server replies with {type:"transcript", text, ...}, then {type:"translation", ...},
  //    {type:"usage", ...}, and an optional {type:"audio"} + binary TTS frame we don't need.
  // We only care about the transcript event, and close right after it arrives.
  const transcribeAudio = async (blob) => {
    try {
      const pcm16Buffer = await blobToPCM16(blob);
      const ticketRes = await fetch(UGAJAPA_TICKET_URL, {
        method: 'POST',
        headers: { 'X-API-Key': UGAJAPA_API_KEY },
      });
      const ticketData = await ticketRes.json();
      if (!ticketRes.ok || !ticketData.ticket) {
        console.error('[UgaJapa] ticket request failed:', ticketRes.status, ticketData);
        return null;
      }

      return await new Promise((resolve) => {
        const ws = new WebSocket(`${UGAJAPA_LIVE_WS_URL}?ticket=${ticketData.ticket}&from=en&to=en`);
        let settled = false;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          try { ws.close(); } catch (e) {}
          resolve(result);
        };
        const timeoutId = setTimeout(() => {
          console.warn('[UgaJapa] live-translate timed out waiting for a transcript');
          finish(null);
        }, 12000);

        ws.onopen = () => {
          const preview = Array.from(new Uint8Array(pcm16Buffer.slice(0, 16)))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(' ');
          console.log('[UgaJapa live] sending PCM16:', pcm16Buffer.byteLength, 'bytes. First 16:', preview);
          ws.send(pcm16Buffer);
        };

        ws.onmessage = (event) => {
          // Binary frames are synthesized TTS audio we don't use — JSON.parse
          // throws on those, which doubles as our "ignore it" branch.
          try {
            const msg = JSON.parse(event.data);
            console.log('[UgaJapa live] message:', msg);
            if (msg.type === 'transcript') {
              finish(msg.text?.trim() || null);
            } else if (msg.type === 'error' && msg.scope !== 'window') {
              console.error('[UgaJapa live] connection-level error:', msg);
              finish(null);
            }
          } catch (e) {
            // binary (TTS) frame — ignore
          }
        };
        ws.onerror = (err) => {
          console.error('[UgaJapa live] socket error:', err.message || err);
          finish(null);
        };
        ws.onclose = () => finish(null);
      });
    } catch (e) {
      console.error('[UgaJapa] transcribeAudio failed:', e);
      return null;
    }
  };

  // ----- Voice note: upload + send -----
  const sendVoiceNote = async (uri) => {
    setIsUploadingAudio(true);
    try {
      const blob = await fetch(uri).then((r) => r.blob());
      // RecordingPresets.HIGH_QUALITY produces a different container per platform
      // (audio/webm on web, audio/mp4 (.m4a) on iOS/Android) — name the file to match
      // what was actually recorded rather than assuming .m4a everywhere.
      const contentType = blob.type || 'audio/m4a';
      const ext = contentType.includes('webm') ? 'webm' : contentType.includes('ogg') ? 'ogg' : 'm4a';
      const fileName = `voice_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('chat_audio')
        .upload(fileName, blob, { contentType });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('chat_audio').getPublicUrl(fileName);
      addMessage('user', `${AUDIO_PREFIX}${publicUrl}`);

      try {
        const admin = await getAdminUser();
        if (admin) {
          await createNotification(
            admin.id,
            'Voice Message',
            `${userName || 'User'} sent a voice note`,
            'chat',
            'ChatBot'
          );
        }
      } catch (e) {
        console.error('Failed to create notification:', e);
      }

      const transcript = await transcribeAudio(blob);
      if (transcript) {
        addMessage('user', `📝 "${transcript}"`);
        const reply = await getBotResponse(transcript);
        addBotMessage(reply);
      } else {
        addBotMessage("Thanks for the voice note! I've saved it and our team will listen and follow up if needed.");
      }
    } catch (error) {
      showAlert('Voice Note Failed', error.message || 'Could not send your voice note. Please try again.');
    } finally {
      setIsUploadingAudio(false);
    }
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

  // ----- Bot response: real conversation via Groq, grounded with live data -----
  const buildSystemPrompt = (stats, knowledge) => {
    let prompt = `You are Massa, the assistant for Uganda's Ministry of Education and Sports (MoES) e-Participation platform. You help citizens engage with government consultations, surveys, and feedback about education, sports, and health services.

Be warm, concise (2-4 sentences unless real detail is needed), and steer people to the right in-app tab when relevant: Feedback, Consultations, Surveys, Resources, FAQs, Town Halls. Stay focused on this platform and Ugandan education/sports/health civic participation — politely redirect if asked something unrelated. Never invent statistics; only use the live numbers given below.`;

    if (stats) {
      prompt += `\n\nLive platform stats right now:\n- Active consultations: ${stats.consCount ?? 'unknown'}\n- Active surveys: ${stats.surveyCount ?? 'unknown'}\n- Total feedback submissions: ${stats.feedbackCount ?? 'unknown'}`;
    }
    if (knowledge && knowledge.length > 0) {
      prompt += `\n\nReference Q&A curated by MoES staff (use when relevant):\n${knowledge
        .map((k) => `- ${(k.keywords || []).join(', ')}: ${k.response}`)
        .join('\n')}`;
    }
    return prompt;
  };

  const getBotResponse = async (userText) => {
    try {
      const [stats, knowledgeRes] = await Promise.all([
        getSystemStats(),
        supabase.from('bot_knowledge').select('response, keywords'),
      ]);
      const knowledge = knowledgeRes?.data || [];

      // Prior turns for real multi-turn context; the current userText is appended
      // explicitly below since React state here still reflects the pre-send snapshot.
      const history = messages
        .filter((m) => typeof m.text === 'string' && !m.text.startsWith(AUDIO_PREFIX))
        .slice(-10)
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

      const { data, error } = await supabase.functions.invoke('chat-completion', {
        body: {
          messages: [
            { role: 'system', content: buildSystemPrompt(stats, knowledge) },
            ...history,
            { role: 'user', content: userText },
          ],
        },
      });
      if (error) {
        console.error('[chat-completion] error:', error);
        throw error;
      }
      const reply = data?.reply?.trim();
      if (!reply) throw new Error('Empty response from chat-completion');
      return reply;
    } catch (e) {
      console.error('[chat-completion] getBotResponse failed:', e);
      return "I'm having trouble thinking right now — please try again in a moment, or tap one of the options below.";
    }
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
  const renderItem = ({ item }) => {
    const isUser = item.sender === 'user';
    const isAudio = item.text?.startsWith(AUDIO_PREFIX);
    return (
      <View style={[styles.messageContainer, isUser ? styles.userContainer : styles.botContainer]}>
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.botBubble, isAudio && styles.audioBubble]}>
          {isAudio ? (
            <AudioBubble uri={item.text.slice(AUDIO_PREFIX.length)} isUser={isUser} />
          ) : (
            <Text style={[styles.messageText, isUser && { color: '#fff' }]}>{item.text}</Text>
          )}
        </View>
      </View>
    );
  };

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
      {recorderState.isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            Recording... {Math.floor((recorderState.durationMillis || 0) / 1000)}s
          </Text>
        </View>
      )}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.chatInput}
          placeholder="Type your message..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => sendMessage()}
          editable={!recorderState.isRecording}
        />
        <TouchableOpacity
          style={[styles.micBtn, recorderState.isRecording && styles.micBtnActive]}
          onPress={toggleRecording}
          disabled={isUploadingAudio}
        >
          {isUploadingAudio ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons
              name={recorderState.isRecording ? 'stop-circle' : 'mic-outline'}
              size={24}
              color={recorderState.isRecording ? COLORS.danger : COLORS.primary}
            />
          )}
        </TouchableOpacity>
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
  micBtn: { padding: 8, marginRight: 2, borderRadius: 20 },
  micBtnActive: { backgroundColor: '#FEE2E2' },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#FEF2F2' },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger, marginRight: 8 },
  recordingText: { fontSize: 13, color: COLORS.danger, fontWeight: '600' },
  audioBubble: { paddingVertical: 8, minWidth: 180 },
  audioBubbleRow: { flexDirection: 'row', alignItems: 'center' },
  audioWaveform: { flex: 1, marginLeft: 10 },
  audioProgressTrack: { height: 4, borderRadius: 2, backgroundColor: COLORS.gray200, overflow: 'hidden' },
  audioProgressTrackUser: { backgroundColor: 'rgba(255,255,255,0.3)' },
  audioProgressFill: { height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
  audioProgressFillUser: { backgroundColor: '#fff' },
  audioDuration: { fontSize: 12, color: COLORS.gray500, marginTop: 4 },
});