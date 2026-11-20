import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONT, RADIUS } from '../theme';

// Speak instead of typing (alternative input). Uses the browser's built-in
// speech recognition where available (Chrome, Edge, Safari); hidden elsewhere.
const Recognition = Platform.OS === 'web' && typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;
const LANGS = { en: 'en-UG', lg: 'lg-UG', xog: 'en-UG' };

export default function DictateButton({ language = 'en', onText, label = 'Speak instead of typing' }) {
  const [listening, setListening] = useState(false);
  const rec = useRef(null);
  useEffect(() => () => rec.current?.abort?.(), []);
  if (!Recognition) return null;

  const toggle = () => {
    if (listening) { rec.current?.stop(); return; }
    const r = new Recognition();
    r.lang = LANGS[language] || 'en-UG';
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e) => {
      const said = Array.from(e.results).slice(e.resultIndex).filter((x) => x.isFinal).map((x) => x[0].transcript).join(' ').trim();
      if (said) onText(said);
    };
    r.onerror = (e) => {
      // Luganda isn't supported by every browser: fall back to English.
      if (e.error === 'language-not-supported' && r.lang !== 'en-UG') { r.lang = 'en-UG'; r.start(); return; }
      setListening(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };

  return (
    <Pressable onPress={toggle} style={[styles.btn, listening && styles.on]} accessibilityRole="button"
      accessibilityLabel={listening ? 'Stop dictation' : label} accessibilityState={{ checked: listening }}>
      <Ionicons name={listening ? 'stop-circle' : 'mic-outline'} size={16} color={listening ? '#fff' : COLORS.primary} />
      <Text style={[styles.text, listening && { color: '#fff' }]}>{listening ? 'Listening… tap to stop' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.primaryLight, backgroundColor: COLORS.primarySoft, marginTop: -8, marginBottom: 16 },
  on: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  text: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.primary },
});
