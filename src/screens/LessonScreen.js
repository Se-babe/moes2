import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { PageHeader, Container, Card, Button, Badge, EmptyState, Loading } from '../components/ui';
import Footer from '../components/Footer';
import RichText from '../components/RichText';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import { showAlert } from '../utils/alert';
import { useAuth } from '../context/AuthContext';
import { fetchModule, getQuiz, submitQuiz, startModule } from '../services/training';
import { STAFF_ROLES } from '../services/staff';

/** One lesson: reading, optional video, then a short assessment. */
export default function LessonScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);
  const [mod, setMod] = useState(undefined);
  const [quiz, setQuiz] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setMod(undefined); setResult(null); setAnswers({});
    fetchModule(params?.slug).then((m) => {
      setMod(m || null);
      if (m) {
        getQuiz(m.id).then(setQuiz).catch(() => setQuiz([]));
        if (isStaff) startModule(m.id);
      }
    }).catch(() => setMod(null));
  }, [params?.slug, isStaff]);

  const submit = async () => {
    if (quiz.some((q) => answers[q.id] === undefined)) {
      showAlert('Answer every question', 'Choose one answer for each question, then check your answers.');
      return;
    }
    setSending(true);
    try {
      setResult(await submitQuiz(mod.id, quiz.map((q) => answers[q.id])));
    } catch (e) {
      showAlert('Could not check answers', e.message);
    } finally {
      setSending(false);
    }
  };

  if (mod === undefined) return <Loading />;
  if (!mod) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <Container narrow style={{ marginTop: SPACE.xxxl }}>
          <Card><EmptyState icon="school-outline" title="Lesson not found" message="It may be for NWSC staff only, or no longer available."
            action={<Button title="Help & learning centre" onPress={() => navigation.navigate('Learn')} />} /></Card>
        </Container>
      </ScrollView>
    );
  }

  const review = Object.fromEntries((result?.review || []).map((r) => [r.id, r]));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <PageHeader overline={mod.audience === 'staff' ? `Staff training · ${mod.topic}` : 'Help & learning'} title={mod.title} subtitle={mod.summary} icon="school-outline" />
      <Container narrow style={{ marginTop: -24, gap: SPACE.xl }}>
        <Card elevated style={{ gap: SPACE.lg }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Badge label={`${mod.minutes} min`} icon="time-outline" />
            {quiz.length ? <Badge label={`${quiz.length}-question check`} icon="help-circle-outline" tone="brand" /> : null}
            {mod.audience === 'staff' ? <Badge label={`Pass mark ${mod.pass_mark}%`} icon="ribbon-outline" tone="warning" /> : null}
          </View>
          {mod.video_url ? (
            <Pressable onPress={() => Linking.openURL(mod.video_url)} style={styles.video} accessibilityRole="link" accessibilityLabel="Watch the video">
              <Ionicons name="play-circle" size={40} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.label, { color: '#fff' }]}>Watch the video</Text>
                <Text style={[TYPE.small, { color: '#DBEAFE' }]}>Opens in a new tab</Text>
              </View>
            </Pressable>
          ) : null}
          <RichText text={mod.body} />
        </Card>

        {quiz.length > 0 && (
          <Card style={{ gap: SPACE.lg }}>
            <View>
              <Text style={TYPE.h3}>{mod.audience === 'staff' ? 'Assessment' : 'Quick check'}</Text>
              <Text style={TYPE.small}>
                {mod.audience === 'staff'
                  ? `Score ${mod.pass_mark}% or more to complete this module. Your result is recorded for your training record; you can try again.`
                  : 'See how much you remember. Nothing is recorded.'}
              </Text>
            </View>
            {quiz.map((q, i) => {
              const r = review[q.id];
              return (
                <View key={q.id} style={{ gap: 8 }}>
                  <Text style={TYPE.label}>{i + 1}. {q.prompt}</Text>
                  {q.options.map((o, k) => {
                    const chosen = answers[q.id] === k;
                    const isAnswer = r && r.answer === k;
                    const wrong = r && chosen && !r.correct;
                    return (
                      <Pressable
                        key={k}
                        disabled={!!result}
                        onPress={() => setAnswers((a) => ({ ...a, [q.id]: k }))}
                        style={[styles.option, chosen && styles.optionOn, isAnswer && styles.optionRight, wrong && styles.optionWrong]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: chosen }}
                      >
                        <Ionicons
                          name={isAnswer ? 'checkmark-circle' : wrong ? 'close-circle' : chosen ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={isAnswer ? COLORS.success : wrong ? COLORS.danger : chosen ? COLORS.primary : COLORS.gray400}
                        />
                        <Text style={[TYPE.body, { flex: 1 }]}>{o}</Text>
                      </Pressable>
                    );
                  })}
                  {r?.explanation ? <Text style={[TYPE.small, { color: r.correct ? COLORS.success : COLORS.gray700 }]}>{r.correct ? '✓ ' : ''}{r.explanation}</Text> : null}
                </View>
              );
            })}
            {result ? (
              <View style={[styles.result, result.passed ? styles.pass : styles.fail]}>
                <Ionicons name={result.passed ? 'ribbon' : 'refresh-circle'} size={28} color={result.passed ? COLORS.success : COLORS.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={TYPE.h3}>{result.score}% — {result.right} of {result.total} right</Text>
                  <Text style={TYPE.small}>
                    {result.passed
                      ? (mod.audience === 'staff' ? 'Well done — module completed and recorded.' : 'Well done!')
                      : `You need ${result.pass_mark}% to pass. Read the lesson again and retry.`}
                  </Text>
                </View>
                <Button title="Try again" size="sm" variant="secondary" onPress={() => { setResult(null); setAnswers({}); }} />
              </View>
            ) : (
              <Button title="Check my answers" icon="checkmark-done" loading={sending} onPress={submit} style={{ alignSelf: 'flex-start' }} />
            )}
          </Card>
        )}

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button title="All lessons" icon="arrow-back" variant="ghost" onPress={() => navigation.navigate(mod.audience === 'staff' && isStaff ? 'StaffPortal' : 'Learn', mod.audience === 'staff' ? { tab: 'training' } : undefined)} />
          {mod.audience === 'public' && <Button title="Practise it" icon="game-controller-outline" variant="secondary" onPress={() => navigation.navigate('Practice', { kind: 'report' })} />}
        </View>
      </Container>
      <View style={{ height: SPACE.xxl }} />
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  video: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACE.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  optionOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  optionRight: { borderColor: COLORS.success, backgroundColor: COLORS.successSoft },
  optionWrong: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerSoft },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACE.lg, borderRadius: RADIUS.md, flexWrap: 'wrap' },
  pass: { backgroundColor: COLORS.successSoft },
  fail: { backgroundColor: COLORS.warningSoft },
  kind: { fontFamily: FONT },
});
