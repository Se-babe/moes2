import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { PageHeader, Container, Card, Button, TextField } from '../components/ui';
import Footer from '../components/Footer';
import { COLORS, RADIUS, SPACE, TYPE } from '../theme';
import { useAuth } from '../context/AuthContext';
import { requestSignInCode, verifySignInCode, signInRemembered, rememberedNumbers, normalizePhone } from '../services/citizen';

const PHONE_RE = /^(\+?256|0)?7\d{8}$/;

/** Optional citizen sign-in: phone number, then a code by SMS. No password. */
export default function CitizenSignInScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // phone | code
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);
  const [remember, setRemember] = useState(true);
  const [known, setKnown] = useState([]);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);
  // Numbers this device remembers: one tap (or just the number) signs in.
  useEffect(() => { rememberedNumbers().then((list) => { setKnown(list); if (list[0]) setPhone(list[0].replace(/^\+256/, '0')); }); }, []);
  useEffect(() => { if (user?.role === 'citizen') navigation.navigate('Me'); }, [user, navigation]);

  const startWait = () => {
    setWait(60);
    clearInterval(timer.current);
    timer.current = setInterval(() => setWait((w) => { if (w <= 1) { clearInterval(timer.current); return 0; } return w - 1; }), 1000);
  };

  const send = async () => {
    setError('');
    if (!PHONE_RE.test(phone.replace(/\s/g, ''))) { setError('Enter a Ugandan mobile number, e.g. 0772 123456.'); return; }
    setBusy(true);
    try {
      // Remembered on this device? Then the number is enough.
      if (await signInRemembered(phone)) { navigation.navigate('Me'); return; }
      await requestSignInCode(phone);
      setStep('code');
      setCode('');
      startWait();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError('');
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code from the SMS.'); return; }
    setBusy(true);
    try {
      await verifySignInCode(phone, code.trim(), remember);
      navigation.navigate('Me');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} keyboardShouldPersistTaps="handled">
      <PageHeader overline="My NWSC" title="Sign in with your phone" subtitle="Optional. Signing in keeps your profile and requests together on any phone or computer. No password needed." icon="phone-portrait-outline" />
      <Container narrow style={{ marginTop: -24, gap: SPACE.lg }}>
        <Card elevated style={{ gap: SPACE.md }}>
          {step === 'phone' ? (
            <>
              <Text style={TYPE.h3}>{known.length ? 'Welcome back' : 'Your mobile number'}</Text>
              <Text style={TYPE.small}>
                {known.includes(normalizePhone(phone))
                  ? 'This phone remembers your number — no code needed.'
                  : "We'll send a 6-digit code by SMS the first time on this phone. Standard SMS is free to receive."}
              </Text>
              <TextField label="Phone" value={phone} onChangeText={(v) => { setPhone(v); setError(''); }} keyboardType="phone-pad" autoComplete="tel"
                placeholder="0772 123456" error={error || undefined} onSubmitEditing={send} />
              <Button title={known.includes(normalizePhone(phone)) ? 'Sign in' : 'Continue'} icon="log-in-outline" size="lg" loading={busy} onPress={send} />
            </>
          ) : (
            <>
              <Text style={TYPE.h3}>Enter the code</Text>
              <Text style={TYPE.small}>We sent a 6-digit code to {phone}. It expires in 10 minutes.</Text>
              <TextField label="6-digit code" value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6}
                placeholder="123456" error={error || undefined} onSubmitEditing={verify} inputStyle={{ fontSize: 22, letterSpacing: 6 }} />
              <Pressable onPress={() => setRemember((v) => !v)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: remember }}>
                <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={20} color={remember ? COLORS.primary : COLORS.gray400} />
                <View style={{ flex: 1 }}>
                  <Text style={TYPE.label}>Remember this phone</Text>
                  <Text style={TYPE.small}>Next time, just your number signs you in here. Untick on a shared phone.</Text>
                </View>
              </Pressable>
              <Button title="Sign in" icon="log-in-outline" size="lg" loading={busy} onPress={verify} />
              <View style={styles.row}>
                <Button title="Change number" variant="ghost" size="sm" onPress={() => { setStep('phone'); setError(''); }} />
                <Button title={wait ? `Send again in ${wait}s` : 'Send a new code'} variant="ghost" size="sm" disabled={!!wait || busy} onPress={send} />
              </View>
            </>
          )}
        </Card>

        <View style={styles.note}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
          <Text style={[TYPE.small, { flex: 1 }]}>
            You don't need an account to report a problem, track a request or take part — those stay open to everyone.
            NWSC staff will never ask for your code. You can delete your account at any time from My NWSC.
          </Text>
        </View>
        <Button title="Continue without signing in" variant="ghost" icon="arrow-forward" style={{ alignSelf: 'center' }} onPress={() => navigation.navigate('Home')} />
        <Text style={[TYPE.small, { textAlign: 'center' }]} onPress={() => navigation.navigate('Login')}>NWSC staff? <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Sign in here</Text></Text>
      </Container>
      <View style={{ height: SPACE.xxl }} />
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 4 },
  note: { flexDirection: 'row', gap: 10, padding: SPACE.md, borderRadius: RADIUS.md, backgroundColor: COLORS.primarySoft },
});
