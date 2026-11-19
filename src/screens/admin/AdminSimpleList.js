import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Switch, Modal, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../services/supabaseClient';
import { ADMIN_COLORS as COLORS } from './adminTheme';
import DateTimeField from '../../components/DateTimeField';

// Generic list+create+edit+delete admin screen, configured per-table.
// fields: [{ key, label, type: 'text'|'multiline'|'number'|'boolean'|'select'|'tags'|'date'|'time', options?, required? }]
// 'tags' fields are stored as a text[] column but edited as a comma-separated string.
// 'date'/'time' fields render a real calendar/clock picker on web (see DateTimeField).
// metaFields: optional array of field keys shown as a small "·"-joined line
// under the subtitle (e.g. a scheduled date/time/location an admin needs to
// scan at a glance without opening the edit modal).
export default function AdminSimpleList({ table, title, fields, orderBy = 'created_at', ascending = false, titleField, subtitleField, metaFields }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({});

  const emptyForm = () => {
    const f = {};
    fields.forEach((field) => { f[field.key] = field.type === 'boolean' ? true : field.type === 'number' ? 0 : ''; });
    return f;
  };

  useEffect(() => {
    fetchItems();
  }, [table]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending });
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error(`Error fetching ${table}:`, error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingItem(null);
    setForm(emptyForm());
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    const f = {};
    fields.forEach((field) => {
      if (field.type === 'tags') {
        f[field.key] = Array.isArray(item[field.key]) ? item[field.key].join(', ') : '';
      } else {
        f[field.key] = item[field.key] ?? (field.type === 'boolean' ? true : field.type === 'number' ? 0 : '');
      }
    });
    setForm(f);
    setModalVisible(true);
  };

  const save = async () => {
    const requiredField = fields.find((f) => f.required && !String(form[f.key] || '').trim());
    if (requiredField) {
      showAlert('Error', `${requiredField.label} is required.`);
      return;
    }
    const payload = {};
    fields.forEach((field) => {
      let value = form[field.key];
      if (field.type === 'number') value = parseInt(value) || 0;
      else if (field.type === 'tags') value = String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
      else if (field.type === 'text' || field.type === 'multiline' || field.type === 'date' || field.type === 'time') value = String(value || '').trim() || null;
      payload[field.key] = value;
    });
    try {
      const { error } = editingItem
        ? await supabase.from(table).update(payload).eq('id', editingItem.id)
        : await supabase.from(table).insert([payload]);
      if (error) throw error;
      setModalVisible(false);
      setEditingItem(null);
      setForm(emptyForm());
      fetchItems();
    } catch (error) {
      showAlert('Error', error.message);
    }
  };

  const remove = (id) => {
    showAlert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from(table).delete().eq('id', id);
          if (error) showAlert('Error', error.message);
          else fetchItems();
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{item[titleField] || 'Untitled'}</Text>
        {subtitleField && item[subtitleField] ? <Text style={styles.itemSub} numberOfLines={2}>{item[subtitleField]}</Text> : null}
        {metaFields && metaFields.some((key) => item[key]) ? (
          <Text style={styles.itemMeta}>{metaFields.map((key) => item[key]).filter(Boolean).join(' · ')}</Text>
        ) : null}
      </View>
      <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
        <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtn} onPress={() => remove(item.id)}>
        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
      </TouchableOpacity>
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
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{title} ({items.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add-circle" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>Nothing here yet — tap + to add one.</Text>
      ) : (
        <FlatList data={items} renderItem={renderItem} keyExtractor={(item) => item.id} scrollEnabled={false} />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingItem ? `Edit` : `Add`} {title.replace(/s$/, '')}</Text>
            {fields.map((field) => {
              if (field.type === 'boolean') {
                return (
                  <View key={field.key} style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{field.label}</Text>
                    <Switch
                      value={!!form[field.key]}
                      onValueChange={(v) => setForm({ ...form, [field.key]: v })}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    />
                  </View>
                );
              }
              if (field.type === 'date' || field.type === 'time') {
                return (
                  <View key={field.key} style={{ marginBottom: 12 }}>
                    <Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
                    <DateTimeField
                      mode={field.type}
                      style={styles.input}
                      value={form[field.key]}
                      onChangeText={(text) => setForm({ ...form, [field.key]: text })}
                    />
                  </View>
                );
              }
              if (field.type === 'select') {
                return (
                  <View key={field.key} style={{ marginBottom: 12 }}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <View style={styles.selectRow}>
                      {field.options.map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.selectChip, form[field.key] === opt && styles.selectChipActive]}
                          onPress={() => setForm({ ...form, [field.key]: opt })}
                        >
                          <Text style={[styles.selectChipText, form[field.key] === opt && styles.selectChipTextActive]}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              }
              return (
                <TextInput
                  key={field.key}
                  style={[styles.input, field.type === 'multiline' && styles.textArea]}
                  placeholder={(field.type === 'tags' ? `${field.label} (comma-separated)` : field.label) + (field.required ? ' *' : '')}
                  placeholderTextColor={COLORS.textDim}
                  value={String(form[field.key] ?? '')}
                  onChangeText={(text) => setForm({ ...form, [field.key]: text })}
                  multiline={field.type === 'multiline'}
                  keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                />
              );
            })}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={save}>
                <Text style={styles.submitBtnText}>{editingItem ? 'Update' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  addBtn: { padding: 2 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, paddingVertical: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  itemSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  itemMeta: { fontSize: 11, color: COLORS.textDim, marginTop: 3, fontWeight: '600' },
  iconBtn: { padding: 6, marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, width: '90%', maxHeight: '85%', borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.surfaceAlt },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6 },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  selectChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  selectChipText: { fontSize: 13, color: COLORS.textMuted },
  selectChipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  switchLabel: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginLeft: 8 },
  cancelBtn: { backgroundColor: COLORS.surfaceAlt },
  cancelBtnText: { color: COLORS.textMuted },
  submitBtn: { backgroundColor: COLORS.primary },
  submitBtnText: { color: '#fff', fontWeight: '600' },
});
