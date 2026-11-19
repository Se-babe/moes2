import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { showAlert } from '../utils/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONT } from '../theme';
import { PageHeader, Container } from '../components/ui';
import Footer from '../components/Footer';


export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleReset = async () => {
    if (!email) {
      showAlert('Error', 'Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      showAlert('Success', 'Password reset email sent. Please check your inbox.');
      navigation.goBack();
    } catch (error) {
      showAlert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <PageHeader title="Reset your password" subtitle="Enter your email and we'll send you a link to set a new password." icon="key-outline" overline="Your account" />
      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
            placeholderTextColor={COLORS.gray400}
          style={styles.input}
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.resetBtnText}>Send Reset Email</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  form: { padding: 28, paddingBottom: 32, width: '100%', maxWidth: 480, alignSelf: 'center', marginTop: -24, marginBottom: 40, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: COLORS.gray200 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.gray700, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16 },
  resetBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 30, alignItems: 'center' },
  resetBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  backText: { color: COLORS.primary, textAlign: 'center', marginTop: 16 },
});