import React from 'react';
import { Pressable, StyleSheet, Text, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONT, SHADOW, gradient } from '../theme';
import { useBreakpoint } from './ui';

export default function ChatButton({ onPress }) {
  const { isMobile } = useBreakpoint();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Chat with Maji, the NWSC assistant"
      style={({ hovered }) => [
        styles.button,
        gradient(COLORS.primaryLight, COLORS.primary),
        SHADOW.lg,
        isMobile && styles.round,
        hovered && { transform: [{ translateY: -2 }] },
      ]}
    >
      <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
      {!isMobile && <Text style={styles.label}>Ask Maji</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    ...(Platform.OS === 'web' ? { transitionDuration: '150ms', cursor: 'pointer' } : null),
  },
  round: { width: 56, height: 56, paddingVertical: 0, paddingHorizontal: 0, justifyContent: 'center', bottom: 16, right: 16 },
  label: { fontFamily: FONT, color: '#fff', fontWeight: '700', fontSize: 15 },
});
