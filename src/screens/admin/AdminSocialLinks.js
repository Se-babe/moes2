import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Switch, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../services/supabaseClient';
import { ADMIN_COLORS as COLORS } from './adminTheme';

export default function AdminSocialLinks() {
  const [socialLinks, setSocialLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingLink, setEditingLink] = useState(null);

  useEffect(() => {
    fetchSocialLinks();
  }, []);

  const fetchSocialLinks = async () => {
    setLoading(true);
    const { data } = await supabase.from('social_links').select('*').order('display_order', { ascending: true });
    if (data) setSocialLinks(data);
    setLoading(false);
  };

  const toggleSocialLink = async (id, enabled) => {
    const { error } = await supabase.from('social_links').update({ enabled: !enabled }).eq('id', id);
    if (error) showAlert('Error', error.message);
    else fetchSocialLinks();
  };

  const updateSocialLink = async (id, updates) => {
    const { error } = await supabase.from('social_links').update(updates).eq('id', id);
    if (error) showAlert('Error', error.message);
    else {
      fetchSocialLinks();
      setEditingLink(null);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.listItem}>
      <View style={styles.socialRow}>
        <Ionicons name={item.icon_name} size={24} color={item.color} />
        <Text style={styles.socialName}>{item.name}</Text>
        <Switch value={item.enabled} onValueChange={() => toggleSocialLink(item.id, item.enabled)} trackColor={{ false: COLORS.border, true: COLORS.primary }} />
      </View>
      <TouchableOpacity style={styles.editBtn} onPress={() => setEditingLink(item)}>
        <Text style={styles.editBtnText}>Edit</Text>
      </TouchableOpacity>
      {editingLink && editingLink.id === item.id && (
        <View style={styles.editForm}>
          <TextInput style={styles.inputSmall} placeholder="URL" placeholderTextColor={COLORS.textDim} value={editingLink.url} onChangeText={(text) => setEditingLink({ ...editingLink, url: text })} />
          <TextInput style={styles.inputSmall} placeholder="Icon name" placeholderTextColor={COLORS.textDim} value={editingLink.icon_name} onChangeText={(text) => setEditingLink({ ...editingLink, icon_name: text })} />
          <TextInput style={styles.inputSmall} placeholder="Color (hex)" placeholderTextColor={COLORS.textDim} value={editingLink.color} onChangeText={(text) => setEditingLink({ ...editingLink, color: text })} />
          <TouchableOpacity style={styles.saveBtn} onPress={() => updateSocialLink(item.id, { url: editingLink.url, icon_name: editingLink.icon_name, color: editingLink.color })}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Social Links</Text>
      <FlatList data={socialLinks} renderItem={renderItem} keyExtractor={(item) => item.id} scrollEnabled={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  listItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  socialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  socialName: { flex: 1, marginLeft: 8, fontSize: 16, color: COLORS.text },
  editBtn: { marginTop: 6, alignSelf: 'flex-start', width: '100%' },
  editBtnText: { color: COLORS.primary, fontWeight: '600' },
  editForm: { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, width: '100%' },
  inputSmall: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 8, fontSize: 14, marginBottom: 6, color: COLORS.text, backgroundColor: COLORS.surfaceAlt },
  saveBtn: { backgroundColor: COLORS.primary, padding: 8, borderRadius: 6, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
});
