import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import { usePreferences } from '../context/PreferencesContext';
import { phrase } from '../i18n/phrases';

/** "How to take part" in numbered steps, with a link to the practice run. */
export default function GuideSteps({ title, steps, practice }) {
  const navigation = useNavigation();
  const { language } = usePreferences();
  const p = (s) => phrase(language, s);
  return (
    <View style={styles.box} accessibilityRole="summary">
      <View style={styles.head}>
        <Text style={TYPE.label}>{p(title)}</Text>
        {practice ? (
          <Pressable onPress={() => navigation.navigate('Practice', { kind: practice })} accessibilityRole="link">
            <Text style={styles.link}>{p('Try a practice run →')}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.steps}>
        {steps.map((s, i) => (
          <View key={s} style={styles.step}>
            <View style={styles.num}><Text style={styles.numText}>{i + 1}</Text></View>
            <Text style={[TYPE.small, { flex: 1, color: COLORS.gray700 }]}>{p(s)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray200, padding: SPACE.lg, gap: SPACE.md, marginBottom: SPACE.lg },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  link: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: COLORS.primary },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  step: { flexDirection: 'row', gap: 8, flex: 1, minWidth: 200, alignItems: 'flex-start' },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: FONT, fontSize: 12, fontWeight: '800', color: '#fff' },
});
