import React, { useState } from 'react';
import { homeForRole } from '../services/staff';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase, authLinkError, authLinkType } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Container, Card, Button, TextField, EmptyState, Loading } from '../components/ui';
import Footer from '../components/Footer';
import { COLORS, SPACE, TYPE } from '../theme';
import { showAlert } from '../utils/alert';

// Landing page for staff invitations and password-reset emails. The email
// link signs the person in (session in the URL); here they choose a password.
export default function SetPasswordScreen() {
  const navigation = useNavigation();
  const { user, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const invited = authLinkType === 'invite';

  const save = async () => {
    const e = {};
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = 'Use a mix of letters and numbers.';
    if (confirm !== password) e.confirm = 'The passwords do not match.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      showAlert('Could not set password', error.message);
      return;
    }
    showAlert('Password saved', 'You can now sign in with your email and this password.');
    const role = user?.role;
    navigation.navigate(homeForRole(role) || 'Home');
  };

  let body;
  if (loading) {
    body = <Loading label="Checking your link…" />;
  } else if (!user) {
    body = (
      <EmptyState
        icon="time-outline"
        title="This link has expired or was already used"
        message={
          (authLinkError ? `${authLinkError}. ` : '') +
          'Request a new link below, or ask an administrator to send you a new invitation.'
        }
        action={<Button title="Send me a new link" icon="mail-outline" onPress={() => navigation.navigate('ForgotPassword')} />}
      />
    );
  } else {
    body = (
      <View>
        <Text style={TYPE.h3}>{invited ? 'Welcome to NWSC e-Participation' : 'Choose a new password'}</Text>
        <Text style={[TYPE.body, { color: COLORS.gray600, marginTop: 4, marginBottom: SPACE.xl }]}>
          Signed in as <Text style={{ fontWeight: '700' }}>{user.email}</Text>.{' '}
          {invited ? 'Set a password to finish creating your staff account.' : 'Enter your new password twice.'}
        </Text>
        <TextField
          label="New password"
          required
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          error={errors.password}
          hint="At least 8 characters, with letters and numbers."
        />
        <TextField
          label="Confirm password"
          required
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          autoComplete="new-password"
          error={errors.confirm}
          onSubmitEditing={save}
        />
        <Button title="Save password" icon="lock-closed-outline" size="lg" loading={saving} onPress={save} full />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader
        overline="Your account"
        title={invited ? 'Activate your account' : 'Set your password'}
        subtitle="For your security, choose a password only you know."
        icon="key-outline"
        back={false}
      />
      <Container narrow style={{ marginTop: -24, maxWidth: 520 }}>
        <Card elevated>{body}</Card>
      </Container>
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
});
