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
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { showAlert } from '../utils/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONT } from '../theme';
import { PageHeader, Container } from '../components/ui';
import Footer from '../components/Footer';


const ROLES = [
  { label: 'Customer / Resident', value: 'citizen' },
  { label: 'Business / Institution', value: 'business' },
  { label: 'Community Leader', value: 'community_leader' },
];

export default function SignUpScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('citizen');
  const [roleLabel, setRoleLabel] = useState('Customer / Resident');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const auth = useAuth();

  const validatePassword = (pwd) => {
    return pwd.length >= 6 && /[A-Za-z]/.test(pwd) && /\d/.test(pwd);
  };

  const handleSignUp = async () => {

    if (!name || !email || !phone || !password || !confirmPassword) {
      showAlert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Error', 'Passwords do not match.');
      return;
    }
    if (!validatePassword(password)) {
      showAlert('Error', 'Password must be at least 6 characters long and contain both letters and numbers.');
      return;
    }
    setLoading(true);
    try {
      const result = await auth.signUp(email, password, name, phone, role);
      // Email confirmation is off for this project, so signUp() already returns
      // an active session — no need to send them to Login to re-enter credentials.
      // SignUp is always reached via Login's "Sign Up" link, so pop 2 screens to
      // land back where the user actually started (e.g. Forum), not on Login.
      showAlert('Welcome!', 'Your account has been created and you\'re now logged in.', [
        { text: 'OK', onPress: () => navigation.pop(2) },
      ]);
    } catch (error) {
      console.error('❌ SignUp error:', error);
      showAlert('Signup Failed', error.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = (item) => {
    setRole(item.value);
    setRoleLabel(item.label);
    setModalVisible(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <PageHeader title="Create an account" subtitle="An account keeps all your requests together and pre-fills your details." icon="person-add-outline" overline="Your account" />
      <ScrollView 
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Full Name</Text>
        <TextInput
            placeholderTextColor={COLORS.gray400} style={styles.input} placeholder="Enter your full name" value={name} onChangeText={setName} />

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

        <Text style={styles.label}>Phone</Text>
        <TextInput
            placeholderTextColor={COLORS.gray400}
          style={styles.input}
          placeholder="Enter your phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Role</Text>
        <TouchableOpacity
          style={styles.roleSelector}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.roleSelectorText}>{roleLabel}</Text>
          <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholderTextColor={COLORS.gray400}
            style={[styles.input, { flex: 1, borderWidth: 0 }]}
            placeholder="At least 6 chars, letters & numbers"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={COLORS.gray500} />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
            placeholderTextColor={COLORS.gray400}
          style={styles.input}
          placeholder="Confirm your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
        />

        <TouchableOpacity 
          style={[styles.signupBtn, loading && styles.disabledBtn]} 
          onPress={handleSignUp} 
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signupBtnText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Role Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <FlatList
              data={ROLES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => selectRole(item)}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  {role === item.value && (
                    <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  roleSelectorText: { fontSize: 16, color: COLORS.gray800 },
  signupBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  signupBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  loginText: { color: COLORS.gray500 },
  loginLink: { color: COLORS.primary, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: 300,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  modalItemText: { fontSize: 16, color: COLORS.gray800 },
});