import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import { supabase } from '../../services/supabaseClient';
import { ADMIN_COLORS as COLORS } from './adminTheme';

// Header.js falls back to these three keys if the settings table has no
// matching row yet — keep this list in sync with that default object.
// email/address/office_hours are used by the Contact Us page (ContactScreen.js).
const KNOWN_KEYS = [
  { key: 'phone1', label: 'Primary Phone', placeholder: '+256(0)-41-4259338' },
  { key: 'phone2', label: 'Toll Free Number', placeholder: 'Toll Free: 0800-100-257' },
  { key: 'phone3', label: 'TELA / SMS Line', placeholder: 'TELA: 0800-377-771' },
  { key: 'email', label: 'Contact Email', placeholder: 'info@education.go.ug' },
  { key: 'address', label: 'Office Address', placeholder: 'Embassy House, Kampala, Uganda' },
  { key: 'office_hours', label: 'Office Hours', placeholder: 'Monday – Friday, 8:00 AM – 5:00 PM' },
];

export default function AdminSettings() {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('settings').select('key, value');
    const map = {};
    (data || []).forEach((row) => { map[row.key] = row.value; });
    setValues(map);
    setLoading(false);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const rows = KNOWN_KEYS.map(({ key }) => ({ key, value: values[key] || '' }));
      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
      if (error) throw error;
      showAlert('Saved', 'Contact info updated — it will show immediately across the site.');
    } catch (error) {
      showAlert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Site Contact Info</Text>
      <Text style={styles.subheading}>Phone numbers show in the header on every page; all fields show on the public Contact Us page.</Text>

      {KNOWN_KEYS.map(({ key, label, placeholder }) => (
        <View key={key} style={styles.field}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textDim}
            value={values[key] || ''}
            onChangeText={(text) => setValues({ ...values, [key]: text })}
          />
        </View>
      ))}

      <TouchableOpacity style={styles.saveBtn} onPress={saveAll} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, maxWidth: 480 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  subheading: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, marginBottom: 20 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.surfaceAlt },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
