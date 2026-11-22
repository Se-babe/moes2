import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import { ANNOUNCEMENT_CATEGORIES, STAKEHOLDER_GROUPS, INTERESTS } from '../services/announcements';

export function Toggle({ label, on, onPress, icon, radio }) {
  return (
    <Pressable onPress={onPress} style={[styles.opt, on && styles.optOn]} accessibilityRole={radio ? 'radio' : 'checkbox'} accessibilityState={{ checked: on }}>
      <Ionicons name={icon || (on ? (radio ? 'radio-button-on' : 'checkbox') : (radio ? 'radio-button-off' : 'square-outline'))} size={16} color={on ? COLORS.primary : COLORS.gray400} />
      <Text style={[styles.optText, on && { color: COLORS.primary }]}>{label}</Text>
    </Pressable>
  );
}

const Section = ({ title, hint, children }) => (
  <View style={{ marginBottom: SPACE.lg }}>
    <Text style={[TYPE.label, { marginBottom: hint ? 2 : 8 }]}>{title}</Text>
    {hint ? <Text style={[TYPE.small, { marginBottom: 8 }]}>{hint}</Text> : null}
    <View style={styles.opts}>{children}</View>
  </View>
);

/**
 * A citizen's preferences: who they are, where they are, what they want to
 * hear about and how. Used by the alerts sign-up and the "My NWSC" page.
 * `value` holds { areas, categories, stakeholder_group, interests,
 * notify_participation, language, whatsapp }; `hasPhone` shows the WhatsApp
 * choice.
 */
export default function ProfileFields({ value, onChange, areas, hasPhone }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const toggle = (key, item) => set({ [key]: value[key].includes(item) ? value[key].filter((x) => x !== item) : [...value[key], item] });
  return (
    <View>
      <Section title="I am a…" hint="Some notices are only for certain customers, such as businesses or landlords.">
        {STAKEHOLDER_GROUPS.map((g) => (
          <Toggle key={g.value} radio label={g.value} on={value.stakeholder_group === g.value} onPress={() => set({ stakeholder_group: g.value })} />
        ))}
      </Section>
      <Section title="My areas" hint="Leave empty for all areas.">
        {areas.map((a) => <Toggle key={a} label={a} on={value.areas.includes(a)} onPress={() => toggle('areas', a)} />)}
      </Section>
      <Section title="Service notices" hint="Emergencies are always sent. Leave empty for every type.">
        {ANNOUNCEMENT_CATEGORIES.filter((c) => c.value !== 'Emergency').map((c) => (
          <Toggle key={c.value} label={c.value} on={value.categories.includes(c.value)} onPress={() => toggle('categories', c.value)} />
        ))}
      </Section>
      <Section title="Topics I care about" hint="We suggest consultations, surveys and policy updates on these. Leave empty for everything.">
        {INTERESTS.map((i) => <Toggle key={i} label={i} on={value.interests.includes(i)} onPress={() => toggle('interests', i)} />)}
      </Section>
      <View style={{ marginBottom: SPACE.lg, gap: 8 }}>
        <Toggle
          label="Invite me to new consultations and surveys, and tell me about new policies, on my topics"
          on={value.notify_participation !== false}
          onPress={() => set({ notify_participation: value.notify_participation === false })}
        />
        {hasPhone ? (
          <Toggle label="Send my alerts on WhatsApp instead of SMS" on={!!value.whatsapp} onPress={() => set({ whatsapp: !value.whatsapp })} />
        ) : null}
      </View>
      <Section title="Message language">
        {[['en', 'English'], ['lg', 'Luganda'], ['xog', 'Lusoga']].map(([k, label]) => (
          <Toggle key={k} radio label={label} on={value.language === k} onPress={() => set({ language: k })} />
        ))}
      </Section>
    </View>
  );
}

export const EMPTY_PROFILE = {
  areas: [], categories: [], stakeholder_group: 'Household', interests: [], notify_participation: true, language: 'en', whatsapp: false,
};

const styles = StyleSheet.create({
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  optOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  optText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray700 },
});
