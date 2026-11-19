import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Platform, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS } from '../theme';

/** Share an official update on WhatsApp, Facebook, X, or copy the link. */
export default function ShareBar({ title, url }) {
  const [copied, setCopied] = useState(false);
  const text = `${title} — NWSC Jinja`;
  const enc = encodeURIComponent;
  const targets = [
    { key: 'whatsapp', icon: 'logo-whatsapp', color: '#25D366', label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { key: 'facebook', icon: 'logo-facebook', color: '#1877F2', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { key: 'x', icon: 'logo-twitter', color: '#0F172A', label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
  ];

  const copy = async () => {
    try {
      if (Platform.OS === 'web' && navigator.clipboard) await navigator.clipboard.writeText(url);
      else await Share.share({ message: `${text} ${url}` });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <View style={styles.row} accessibilityLabel="Share this update">
      <Text style={styles.label}>Share:</Text>
      {targets.map((t) => (
        <Pressable key={t.key} onPress={() => Linking.openURL(t.href)} style={styles.btn} accessibilityLabel={`Share on ${t.label}`}>
          <Ionicons name={t.icon} size={17} color={t.color} />
        </Pressable>
      ))}
      <Pressable onPress={copy} style={[styles.btn, styles.copy]} accessibilityLabel="Copy link">
        <Ionicons name={copied ? 'checkmark' : 'link'} size={16} color={COLORS.primary} />
        <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy link'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  label: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray500, marginRight: 2 },
  btn: {
    height: 34, minWidth: 34, paddingHorizontal: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
  },
  copy: { flexDirection: 'row', gap: 6, paddingHorizontal: 12 },
  copyText: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
