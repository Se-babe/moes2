import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Card, Badge, Loading, Grid, Button } from '../ui';
import { COLORS, FONT, SPACE, TYPE } from '../../theme';
import { fetchModules, myProgress } from '../../services/training';

/** The signed-in staff member's training: modules, status and scores. */
export default function StaffTraining({ user }) {
  const navigation = useNavigation();
  const [mods, setMods] = useState(null);
  const [progress, setProgress] = useState({});
  useEffect(() => {
    Promise.all([fetchModules('staff'), myProgress(user.id)])
      .then(([m, p]) => { setMods(m); setProgress(p); })
      .catch(() => setMods([]));
  }, [user.id]);
  if (mods === null) return <Loading />;
  const done = mods.filter((m) => progress[m.id]?.passed).length;
  const pct = mods.length ? Math.round((100 * done) / mods.length) : 0;

  return (
    <View style={{ gap: SPACE.lg }}>
      <Card style={{ gap: SPACE.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Text style={TYPE.h3}>My training</Text>
          <Text style={TYPE.label}>{done} of {mods.length} completed</Text>
        </View>
        <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        <Text style={TYPE.small}>
          Data management skills and how to use the platform. Read each lesson and pass its assessment; your results go on your training record.
        </Text>
      </Card>
      <Grid columns={2} minItemWidth={280} gap={SPACE.lg}>
        {mods.map((m) => {
          const p = progress[m.id];
          const status = p?.passed ? ['Completed', 'success', 'checkmark-circle'] : p?.attempts ? ['Not yet passed', 'warning', 'refresh'] : p ? ['In progress', 'info', 'book-outline'] : ['Not started', 'neutral', 'ellipse-outline'];
          return (
            <Pressable key={m.id} onPress={() => navigation.navigate('Lesson', { slug: m.slug })} style={{ height: '100%' }} accessibilityRole="link">
              {({ hovered }) => (
                <Card style={[{ gap: 8, height: '100%' }, hovered && { borderColor: COLORS.primaryLight }]}>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Badge label={status[0]} tone={status[1]} icon={status[2]} />
                    <Badge label={m.topic} />
                    <Badge label={`${m.minutes} min`} icon="time-outline" />
                  </View>
                  <Text style={TYPE.h3}>{m.title}</Text>
                  <Text style={TYPE.small}>{m.summary}</Text>
                  {p?.best_score != null ? <Text style={TYPE.small}>Best score {p.best_score}% · {p.attempts} attempt{p.attempts === 1 ? '' : 's'}</Text> : null}
                  <Text style={styles.link}>{p?.passed ? 'Review →' : 'Start →'}</Text>
                </Card>
              )}
            </Pressable>
          );
        })}
      </Grid>
      <Button title="Public guides and practice exercises" icon="school-outline" variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => navigation.navigate('Learn')} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 10, borderRadius: 5, backgroundColor: COLORS.gray100, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 5 },
  link: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 'auto' },
});
