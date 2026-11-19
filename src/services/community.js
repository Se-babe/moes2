import React, { useState, useRef, useCallback } from 'react';
import { View, Text, Modal, StyleSheet, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import { Button, TextField } from '../components/ui';
import { COLORS, RADIUS, SHADOW, SPACE, TYPE } from '../theme';

const KEY = 'nwsc_guest_identity';

/** Calls the community-action Edge Function (guest posts, comments, votes). */
export async function communityAction(payload) {
  const { data, error } = await supabase.functions.invoke('community-action', { body: payload });
  if (error) {
    const msg = await error.context?.json?.().then((b) => b?.error).catch(() => null);
    throw new Error(msg || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Name + phone for citizens taking part without an account. Remembered on
 * this device. Usage:
 *   const guest = useGuestIdentity();
 *   guest.run((id) => communityAction({ action: 'comment', ...id, ... }));
 *   ...render {guest.modal}
 */
export function useGuestIdentity() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);
  const pending = useRef(null);

  const run = useCallback(async (fn) => {
    let saved = null;
    try { saved = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null'); } catch {}
    if (saved?.name && saved?.phone) return fn(saved);
    pending.current = fn;
    setName(saved?.name || '');
    setPhone(saved?.phone || '');
    setError(null);
    setOpen(true);
    return undefined;
  }, []);

  const confirm = async () => {
    if (name.trim().length < 2) return setError('Please give your name.');
    if (!/^(\+?256|0)?7\d{8}$|^(\+?256|0)?[23]\d{8}$/.test(phone.replace(/[\s-]/g, ''))) {
      return setError('Enter a valid phone number, e.g. 0772 123456.');
    }
    const id = { name: name.trim(), phone: phone.trim() };
    try { await AsyncStorage.setItem(KEY, JSON.stringify(id)); } catch {}
    setOpen(false);
    const fn = pending.current;
    pending.current = null;
    if (fn) fn(id);
  };

  const forget = async () => {
    try { await AsyncStorage.removeItem(KEY); } catch {}
  };

  const modal = (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View style={[styles.panel, SHADOW.lg]}>
          <Text style={TYPE.h3}>Join the conversation</Text>
          <Text style={[TYPE.body, { color: COLORS.gray600, marginTop: 4, marginBottom: SPACE.lg }]}>
            Your name is shown with your post. Your phone number is never shown — it keeps the forum fair (one vote per person) and free of spam.
          </Text>
          <TextField label="Your name" value={name} onChangeText={setName} autoComplete="name" maxLength={60} />
          <TextField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0772 123456" error={error} />
          <View style={styles.actions}>
            <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
            <Button title="Continue" icon="arrow-forward" onPress={confirm} />
          </View>
        </View>
      </View>
    </Modal>
  );

  return { run, modal, forget };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.45)', alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  panel: { width: '100%', maxWidth: 440, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
