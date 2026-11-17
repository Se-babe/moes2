import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import AdminSlides from './AdminSlides';
import AdminSocialLinks from './AdminSocialLinks';
import AdminSimpleList from './AdminSimpleList';
import AdminMediaGallery from './AdminMediaGallery';
import AdminSettings from './AdminSettings';
import { ADMIN_COLORS as COLORS } from './adminTheme';

const SUB_TABS = [
  { key: 'slides', label: 'Slides' },
  { key: 'media_gallery', label: 'Media Gallery' },
  { key: 'updates', label: 'Updates' },
  { key: 'surveys', label: 'Surveys' },
  { key: 'town_halls', label: 'Town Halls' },
  { key: 'news', label: 'News' },
  { key: 'faqs', label: 'FAQs' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'departments', label: 'Departments' },
  { key: 'categories', label: 'Categories' },
  { key: 'bot_knowledge', label: 'Bot Knowledge' },
  { key: 'settings', label: 'Site Settings' },
  { key: 'social_links', label: 'Social Links' },
];

export default function AdminContent() {
  const [subTab, setSubTab] = useState('slides');

  const renderSubTab = () => {
    switch (subTab) {
      case 'slides':
        return <AdminSlides />;
      case 'media_gallery':
        return <AdminMediaGallery />;
      case 'updates':
        return (
          <AdminSimpleList
            table="updates"
            title="Platform Updates"
            titleField="title"
            subtitleField="description"
            fields={[
              { key: 'title', label: 'Title', type: 'text', required: true },
              { key: 'description', label: 'Description', type: 'multiline' },
              { key: 'category', label: 'Category', type: 'select', options: ['Announcement', 'Feature', 'Policy', 'Maintenance'] },
            ]}
          />
        );
      case 'surveys':
        return (
          <AdminSimpleList
            table="surveys"
            title="Surveys"
            titleField="title"
            subtitleField="description"
            fields={[
              { key: 'title', label: 'Title', type: 'text', required: true },
              { key: 'description', label: 'Description', type: 'multiline' },
              { key: 'end_date', label: 'End Date', type: 'date' },
              { key: 'is_active', label: 'Active (visible to citizens)', type: 'boolean' },
            ]}
          />
        );
      case 'town_halls':
        return (
          <AdminSimpleList
            table="town_halls"
            title="Town Halls"
            titleField="topic"
            subtitleField="description"
            metaFields={['event_date', 'event_time', 'location']}
            orderBy="event_date"
            ascending
            fields={[
              { key: 'topic', label: 'Topic', type: 'text', required: true },
              { key: 'description', label: 'Description', type: 'multiline' },
              { key: 'event_date', label: 'Event Date', type: 'date', required: true },
              { key: 'event_time', label: 'Event Time', type: 'time' },
              { key: 'location', label: 'Location (e.g. Virtual (Zoom), or physical address)', type: 'text' },
              { key: 'meeting_link', label: 'Meeting Link (Zoom/Meet/YouTube URL, for virtual sessions)', type: 'text' },
            ]}
          />
        );
      case 'categories':
        return (
          <AdminSimpleList
            table="categories"
            title="Categories"
            titleField="name"
            orderBy="name"
            ascending
            fields={[
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'icon', label: 'Ionicon name (e.g. water-outline)', type: 'text' },
            ]}
          />
        );
      case 'bot_knowledge':
        return (
          <AdminSimpleList
            table="bot_knowledge"
            title="Maji's Knowledge Base"
            titleField="response"
            orderBy="id"
            fields={[
              { key: 'response', label: 'Response Maji should give', type: 'multiline', required: true },
              { key: 'keywords', label: 'Keywords', type: 'tags', required: true },
            ]}
          />
        );
      case 'settings':
        return <AdminSettings />;
      case 'social_links':
        return <AdminSocialLinks />;
      case 'news':
        return (
          <AdminSimpleList
            table="news"
            title="News"
            titleField="title"
            subtitleField="summary"
            fields={[
              { key: 'title', label: 'Title', type: 'text', required: true },
              { key: 'summary', label: 'Summary', type: 'multiline' },
              { key: 'image_url', label: 'Image URL', type: 'text' },
              { key: 'is_active', label: 'Active (visible to citizens)', type: 'boolean' },
            ]}
          />
        );
      case 'faqs':
        return (
          <AdminSimpleList
            table="faqs"
            title="FAQs"
            titleField="question"
            subtitleField="answer"
            fields={[
              { key: 'question', label: 'Question', type: 'text', required: true },
              { key: 'answer', label: 'Answer', type: 'multiline', required: true },
            ]}
          />
        );
      case 'leadership':
        return (
          <AdminSimpleList
            table="leadership"
            title="Leadership"
            titleField="name"
            subtitleField="title"
            orderBy="display_order"
            ascending
            fields={[
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'title', label: 'Title / Role', type: 'text' },
              { key: 'bio', label: 'Bio', type: 'multiline' },
              { key: 'photo_url', label: 'Photo URL', type: 'text' },
              { key: 'display_order', label: 'Display Order', type: 'number' },
            ]}
          />
        );
      case 'departments':
        return (
          <AdminSimpleList
            table="departments"
            title="Departments"
            titleField="name"
            subtitleField="description"
            orderBy="display_order"
            ascending
            fields={[
              { key: 'name', label: 'Name', type: 'text', required: true },
              { key: 'description', label: 'Description', type: 'multiline' },
              { key: 'icon', label: 'Ionicon name (e.g. water-outline)', type: 'text' },
              { key: 'display_order', label: 'Display Order', type: 'number' },
            ]}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabScroll} contentContainerStyle={styles.subTabRow}>
        {SUB_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.subTabChip, subTab === t.key && styles.subTabChipActive]}
            onPress={() => setSubTab(t.key)}
          >
            <Text style={[styles.subTabText, subTab === t.key && styles.subTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.content}>{renderSubTab()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subTabScroll: { flexGrow: 0, marginBottom: 16 },
  subTabRow: { flexDirection: 'row', gap: 8 },
  subTabChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  subTabChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  subTabText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  subTabTextActive: { color: '#fff' },
  content: { flex: 1 },
});
