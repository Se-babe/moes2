import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { PageHeader, Container, Card, Button, TextField, EmptyState, Loading } from '../components/ui';
import Footer from '../components/Footer';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import { showAlert } from '../utils/alert';
import { fetchAreas } from '../services/announcements';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RATING_LABELS = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

function Option({ label, selected, onPress, multi }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [styles.option, selected && styles.optionOn, hovered && !selected && { borderColor: COLORS.primaryLight }]}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
    >
      <Ionicons
        name={multi ? (selected ? 'checkbox' : 'square-outline') : selected ? 'radio-button-on' : 'radio-button-off'}
        size={18}
        color={selected ? COLORS.primary : COLORS.gray400}
      />
      <Text style={[TYPE.body, { flex: 1, color: COLORS.gray800 }]}>{label}</Text>
    </Pressable>
  );
}

export default function SurveyDetailScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const [survey, setSurvey] = useState(undefined);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [areas, setAreas] = useState([]);
  const [area, setArea] = useState(null);
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: q }] = await Promise.all([
        supabase.from('surveys').select('*').eq('id', params?.id).maybeSingle(),
        supabase.from('survey_questions').select('*').eq('survey_id', params?.id).order('position'),
      ]);
      setSurvey(s || null);
      setQuestions(q || []);
    })();
    fetchAreas().then(setAreas);
  }, [params?.id]);

  // Save-and-resume: answers are kept on this device until submitted.
  const draftKey = `nwsc_survey_draft_${params?.id}`;
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(draftKey).then((raw) => {
      if (raw) { try { const d = JSON.parse(raw); if (d && Object.keys(d).length) { setAnswers(d); setResumed(true); } } catch {} }
    }).catch(() => {});
  }, [draftKey]);
  useEffect(() => {
    if (Object.keys(answers).length) AsyncStorage.setItem(draftKey, JSON.stringify(answers)).catch(() => {});
  }, [answers, draftKey]);

  const setAnswer = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));
  const toggleMulti = (id, v) => setAnswers((a) => {
    const cur = a[id] || [];
    return { ...a, [id]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
  });

  const submit = async () => {
    const missing = questions.find((q) => q.required && (answers[q.id] === undefined || answers[q.id] === '' || (Array.isArray(answers[q.id]) && !answers[q.id].length)));
    if (missing) {
      showAlert('One more answer', `Please answer: ${missing.prompt}`);
      return;
    }
    setSending(true);
    const { error } = await supabase.rpc('submit_survey_response', {
      p_survey: survey.id, p_answers: answers, p_area: area, p_phone: phone.trim() || null,
    });
    setSending(false);
    if (error) showAlert('Could not submit', error.message);
    else { setDone(true); AsyncStorage.removeItem(draftKey).catch(() => {}); }
  };

  const closed = survey && (!survey.is_active || (survey.end_date && survey.end_date < new Date().toISOString().slice(0, 10)));

  let body;
  if (survey === undefined) body = <Loading />;
  else if (!survey || closed) {
    body = <EmptyState icon="clipboard-outline" title="This survey is closed" message="Thank you for your interest. See other ways to take part." action={<Button title="Surveys & polls" onPress={() => navigation.navigate('Surveys')} />} />;
  } else if (done) {
    body = (
      <EmptyState
        icon="heart-outline"
        title="Thank you for your feedback!"
        message={survey.thank_you || 'Your answers help NWSC Jinja improve water and sewerage services.'}
        action={<Button title="Back to surveys" variant="secondary" onPress={() => navigation.navigate('Surveys')} />}
      />
    );
  } else {
    body = (
      <View style={{ gap: SPACE.xl }}>
        {resumed && (
          <View style={styles.resumed}>
            <Ionicons name="time-outline" size={18} color={COLORS.primary} />
            <Text style={[TYPE.small, { flex: 1, color: COLORS.gray800 }]}>We kept the answers you started earlier.</Text>
            <Button title="Start over" size="sm" variant="ghost" onPress={() => { setAnswers({}); setResumed(false); AsyncStorage.removeItem(draftKey).catch(() => {}); }} />
          </View>
        )}
        {questions.map((q, i) => (
          <View key={q.id} accessibilityRole="radiogroup">
            <Text style={TYPE.label}>
              {i + 1}. {q.prompt}{q.required ? <Text style={{ color: COLORS.danger }}> *</Text> : <Text style={TYPE.small}> (optional)</Text>}
            </Text>
            <View style={{ marginTop: SPACE.md, gap: 8 }}>
              {q.kind === 'rating' && (
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const on = answers[q.id] === n;
                    return (
                      <Pressable key={n} onPress={() => setAnswer(q.id, n)} style={[styles.rating, on && styles.ratingOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${n} — ${RATING_LABELS[n - 1]}`}>
                        <Text style={[styles.ratingNum, on && { color: '#fff' }]}>{n}</Text>
                        <Text style={[styles.ratingLabel, on && { color: '#DBEAFE' }]}>{RATING_LABELS[n - 1]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {q.kind === 'single' && q.options.map((o) => <Option key={o} label={o} selected={answers[q.id] === o} onPress={() => setAnswer(q.id, o)} />)}
              {q.kind === 'multi' && q.options.map((o) => <Option key={o} multi label={o} selected={(answers[q.id] || []).includes(o)} onPress={() => toggleMulti(q.id, o)} />)}
              {q.kind === 'text' && (
                <TextField multiline value={answers[q.id] || ''} onChangeText={(v) => setAnswer(q.id, v)} maxLength={2000} placeholder="Type your answer" style={{ marginBottom: 0 }} />
              )}
            </View>
          </View>
        ))}

        <View style={styles.about}>
          <Text style={TYPE.label}>About you <Text style={TYPE.small}>(optional)</Text></Text>
          <Text style={[TYPE.label, { marginTop: SPACE.md, marginBottom: 8, fontWeight: '500' }]}>Your area</Text>
          <View style={styles.areas}>
            {areas.map((a) => (
              <Pressable key={a} onPress={() => setArea(area === a ? null : a)} style={[styles.area, area === a && styles.areaOn]}>
                <Text style={[styles.areaText, area === a && { color: COLORS.primary }]}>{a}</Text>
              </Pressable>
            ))}
          </View>
          <TextField
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="0772 123456"
            hint="Only used to make sure each person answers once. It is not linked to your answers."
            style={{ marginTop: SPACE.md, marginBottom: 0 }}
          />
        </View>

        <Button title="Submit answers" icon="send" size="lg" loading={sending} onPress={submit} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} keyboardShouldPersistTaps="handled">
      <PageHeader overline="Survey" title={survey?.title || 'Survey'} subtitle={survey?.description || undefined} icon="clipboard-outline" />
      <Container narrow style={{ marginTop: -24 }}>
        <Card elevated>{body}</Card>
      </Container>
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  optionOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  ratingRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rating: { flexGrow: 1, flexBasis: 90, alignItems: 'center', paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  ratingOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  ratingNum: { fontFamily: FONT, fontSize: 20, fontWeight: '800', color: COLORS.gray900 },
  ratingLabel: { fontFamily: FONT, fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  resumed: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.primarySoft },
  about: { padding: SPACE.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.gray50, borderWidth: 1, borderColor: COLORS.gray200 },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  area: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  areaOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  areaText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray700 },
});
