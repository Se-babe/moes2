import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { PageHeader, Container, Card, Button, Badge, TextField, STATUS_TONE } from '../components/ui';
import Footer from '../components/Footer';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';

// Simulated exercises: the real screens' steps with a coach beside them.
// Nothing typed here leaves the page.

function Coach({ children }) {
  return (
    <View style={styles.coach} accessibilityRole="note">
      <Ionicons name="bulb" size={18} color={COLORS.warning} />
      <Text style={[TYPE.small, { flex: 1, color: '#78350F' }]}>{children}</Text>
    </View>
  );
}

function Choice({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, on && styles.choiceOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
      <Text style={[styles.choiceText, on && { color: COLORS.primary }]}>{label}</Text>
    </Pressable>
  );
}

function ReportPractice({ onDone }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ type: '', category: '', title: '', description: '', location: '', phone: '' });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const steps = [
    {
      title: '1 · What would you like to do?',
      coach: 'A leak is something wrong with a service, so choose "Complaint". Then pick the closest category: "Leak / burst pipe".',
      ok: f.type === 'Complaint' && f.category === 'Leak / burst pipe',
      body: (
        <View style={{ gap: SPACE.md }}>
          <View style={styles.choices}>{['Complaint', 'Enquiry', 'Suggestion', 'Compliment'].map((t) => <Choice key={t} label={t} on={f.type === t} onPress={() => set('type')(t)} />)}</View>
          <View style={styles.choices}>{['No water / supply', 'Leak / burst pipe', 'Billing', 'Water quality'].map((t) => <Choice key={t} label={t} on={f.category === t} onPress={() => set('category')(t)} />)}</View>
        </View>
      ),
    },
    {
      title: '2 · Tell us about it',
      coach: 'Keep the title short ("Burst pipe on Main Street"). In the details say what you see, since when, and a landmark nearby. Try to fill all three boxes.',
      ok: f.title.trim().length > 4 && f.description.trim().length > 10 && f.location.trim().length > 2,
      body: (
        <View>
          <TextField label="Title" value={f.title} onChangeText={set('title')} placeholder="e.g. Burst pipe on Main Street" />
          <TextField label="Details" multiline value={f.description} onChangeText={set('description')} placeholder="What, since when, how many homes affected" />
          <TextField label="Location" value={f.location} onChangeText={set('location')} placeholder="Area, street, landmark" />
        </View>
      ),
    },
    {
      title: '3 · How can we reach you?',
      coach: 'Your reference number and updates go to this phone or email. Use a pretend number here, e.g. 0772 000000.',
      ok: /^(\+?256|0)?7\d{8}$/.test(f.phone.replace(/\s/g, '')),
      body: <TextField label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="0772 000000" />,
    },
  ];
  if (step === steps.length) {
    return (
      <View style={{ gap: SPACE.lg }}>
        <View style={styles.success}>
          <Ionicons name="checkmark-circle" size={36} color={COLORS.success} />
          <View style={{ flex: 1 }}>
            <Text style={TYPE.h3}>Practice complete</Text>
            <Text style={TYPE.body}>In real life you would now see your reference, for example <Text style={{ fontWeight: '800' }}>NW-2611-PRACT1</Text>, and get it by SMS.</Text>
          </View>
        </View>
        <Coach>Next, practise tracking it — or report for real when you are ready.</Coach>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button title="Practise tracking" icon="search-outline" variant="secondary" onPress={() => onDone('track')} />
          <Button title="Report for real" icon="water-outline" onPress={() => onDone('real')} />
        </View>
      </View>
    );
  }
  const s = steps[step];
  return (
    <View style={{ gap: SPACE.lg }}>
      <Text style={TYPE.h3}>{s.title}</Text>
      <Coach>{s.coach}</Coach>
      {s.body}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Button title="Back" variant="ghost" icon="arrow-back" disabled={step === 0} onPress={() => setStep(step - 1)} />
        <Button title={step === steps.length - 1 ? 'Submit (practice)' : 'Next'} iconRight="arrow-forward" disabled={!s.ok} onPress={() => setStep(step + 1)} />
      </View>
      {!s.ok && <Text style={[TYPE.small, { textAlign: 'right' }]}>Follow the tip above to continue.</Text>}
    </View>
  );
}

const SAMPLE = {
  ref: 'NW-2611-DEMO01',
  title: 'Burst pipe on Main Street',
  timeline: [
    ['Submitted', 'We received your complaint. Reference NW-2611-DEMO01.'],
    ['Assigned', 'Passed to Water Distribution & Maintenance.'],
    ['In Progress', 'A team has been scheduled to inspect the site this afternoon.'],
    ['Resolved', 'Our crew replaced the damaged section. Water is back on. Please rate our service.'],
  ],
};

function TrackPractice({ onDone }) {
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(false);
  const [rating, setRating] = useState(0);
  return (
    <View style={{ gap: SPACE.lg }}>
      <Coach>Type the sample reference <Text style={{ fontWeight: '800' }}>{SAMPLE.ref}</Text> and press Track. Your real reference is in the SMS or email we send.</Coach>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <TextField style={{ flex: 1, minWidth: 200, marginBottom: 0 }} label="Reference number" value={q} onChangeText={setQ} autoCapitalize="characters" placeholder="NW-YYMM-XXXXXX" />
        <Button title="Track" icon="search" disabled={q.trim().toUpperCase() !== SAMPLE.ref} onPress={() => setShown(true)} />
      </View>
      {shown && (
        <View style={{ gap: SPACE.md }}>
          <Text style={TYPE.h3}>{SAMPLE.title}</Text>
          {SAMPLE.timeline.map(([status, msg]) => (
            <View key={status} style={styles.event}>
              <Badge label={status} tone={STATUS_TONE[status]} />
              <Text style={[TYPE.body, { flex: 1 }]}>{msg}</Text>
            </View>
          ))}
          <Coach>Once a request is resolved you can rate us. Tap a star — ratings help us improve.</Coach>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="radio" accessibilityLabel={`${n} stars`}>
                <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={32} color={n <= rating ? '#F59E0B' : COLORS.gray300} />
              </Pressable>
            ))}
          </View>
          {rating > 0 && (
            <View style={styles.success}>
              <Ionicons name="checkmark-circle" size={30} color={COLORS.success} />
              <Text style={[TYPE.body, { flex: 1 }]}>Practice complete. You know how to follow a request to the end.</Text>
              <Button title="Track a real request" size="sm" onPress={() => onDone('realTrack')} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function ConsultPractice({ onDone }) {
  const [vote, setVote] = useState(null);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <View style={{ gap: SPACE.lg }}>
      <Card style={{ backgroundColor: COLORS.gray50, gap: 6 }}>
        <Badge label="Sample proposal" tone="brand" />
        <Text style={TYPE.h3}>Extending customer care hours to Saturdays</Text>
        <Text style={TYPE.body}>NWSC Jinja proposes opening the customer care office from 9 am to 1 pm on Saturdays, so working customers can pay bills and raise issues in person.</Text>
      </Card>
      <Coach>Read the proposal, then choose the option that best matches your view.</Coach>
      <View style={styles.choices}>
        {['I support it', 'I support it with changes', "I don't support it"].map((o) => <Choice key={o} label={o} on={vote === o} onPress={() => setVote(o)} />)}
      </View>
      {vote && (
        <>
          <Coach>Explain your view in a sentence or two. Clear, respectful comments are the most useful.</Coach>
          <TextField label="Your comment" multiline value={comment} onChangeText={setComment} placeholder="e.g. Please open until 2 pm, because…" />
          {!sent ? (
            <Button title="Send (practice)" icon="send" disabled={comment.trim().length < 8} onPress={() => setSent(true)} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <View style={styles.success}>
              <Ionicons name="checkmark-circle" size={30} color={COLORS.success} />
              <Text style={[TYPE.body, { flex: 1 }]}>Practice complete. When a real consultation closes, look for "You said, we did" to see what changed.</Text>
              <Button title="See real consultations" size="sm" onPress={() => onDone('consult')} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const TITLES = {
  report: ['Practise reporting a leak', 'water-outline'],
  track: ['Practise tracking a request', 'search-outline'],
  consult: ['Practise taking part in a consultation', 'document-text-outline'],
};

export default function PracticeScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const kind = TITLES[params?.kind] ? params.kind : 'report';
  const done = (next) => {
    if (next === 'track') navigation.setParams({ kind: 'track' });
    else if (next === 'real') navigation.navigate('Feedback', { type: 'Complaint' });
    else if (next === 'realTrack') navigation.navigate('TrackRequest');
    else if (next === 'consult') navigation.navigate('Consultations');
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <PageHeader overline="Practice — nothing is sent" title={TITLES[kind][0]} icon={TITLES[kind][1]} />
      <Container narrow style={{ marginTop: -24, gap: SPACE.lg }}>
        <Card elevated>
          {kind === 'report' && <ReportPractice key="report" onDone={done} />}
          {kind === 'track' && <TrackPractice key="track" onDone={done} />}
          {kind === 'consult' && <ConsultPractice key="consult" onDone={done} />}
        </Card>
        <Button title="Back to help & learning" icon="arrow-back" variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => navigation.navigate('Learn')} />
      </Container>
      <View style={{ height: SPACE.xxl }} />
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  coach: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.warningSoft, alignItems: 'flex-start' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  choiceOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  choiceText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: COLORS.gray700 },
  success: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACE.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.successSoft, flexWrap: 'wrap' },
  event: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
});
