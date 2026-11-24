import React, { useState } from 'react';
import { homeForRole } from '../services/staff';
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


export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signOut } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const { profile } = await signIn(email, password);
      const role = profile?.role;
      if (homeForRole(role)) navigation.navigate(homeForRole(role));
      else {
        await signOut();
        showAlert('Staff only', 'This sign-in is for NWSC staff. Customers can sign in with their phone number instead.');
      }
    } catch (error) {
      showAlert('Login Failed', error.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <PageHeader title="Staff sign in" subtitle="For NWSC officers, supervisors, and administrators." icon="briefcase-outline" overline="Staff portal" />
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
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholderTextColor={COLORS.gray400}
            style={[styles.input, { flex: 1, borderWidth: 0 }]}
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={COLORS.gray500} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Login</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  form: { padding: 28, paddingBottom: 32, width: '100%', maxWidth: 480, alignSelf: 'center', marginTop: -24, marginBottom: 40, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: COLORS.gray200 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.gray700, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    marginBottom: 16,
  },
  eyeBtn: { paddingHorizontal: 12 },
  forgotText: { color: COLORS.primary, textAlign: 'right', marginBottom: 16 },
  loginBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 30, alignItems: 'center' },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
