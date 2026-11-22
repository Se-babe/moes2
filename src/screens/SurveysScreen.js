import React, { useState, useEffect } from 'react';
import GuideSteps from '../components/GuideSteps';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { showAlert } from '../utils/alert';
import { supabase } from '../services/supabaseClient';
import { COLORS, FONT } from '../theme';
import { PageHeader, Container, EmptyState } from '../components/ui';
import Footer from '../components/Footer';
import { useGuestIdentity, communityAction } from '../services/community';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components/ui';


export default function SurveysScreen() {
  const navigation = useNavigation();
  const [surveys, setSurveys] = useState([]);
  const [polls, setPolls] = useState([]);
  const [userVotes, setUserVotes] = useState({}); // consultationId -> poll_option_id
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user || null);
      await fetchData(user);
    })();
  }, []);

  const fetchData = async (currentUser) => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data: surveyData } = await supabase.from('surveys').select('*, survey_questions(count)').eq('is_active', true).or(`end_date.is.null,end_date.gte.${today}`).order('created_at', { ascending: false });
    if (surveyData) setSurveys(surveyData);

    const { data: consData } = await supabase
      .from('consultations')
      .select('id, title, polls (id, question, poll_options (id, option_text, vote_count))')
      .eq('is_active', true);

    const withPolls = (consData || []).filter((c) => c.polls && c.polls.length > 0);
    setPolls(withPolls);

    if (currentUser && withPolls.length > 0) {
      const { data: votesData } = await supabase
        .from('poll_votes')
        .select('consultation_id, poll_option_id')
        .eq('user_id', currentUser.id)
        .in('consultation_id', withPolls.map((c) => c.id));
      const votes = {};
      (votesData || []).forEach((v) => { votes[v.consultation_id] = v.poll_option_id; });
      setUserVotes(votes);
    }
    setLoading(false);
  };

  const guest = useGuestIdentity();
  const vote = async (consultationId, pollOptionId) => {
    if (!user) {
      guest.run(async (id) => {
        setVotingId(pollOptionId);
        try {
          await communityAction({ action: 'poll_vote', ...id, poll_option_id: pollOptionId });
          setUserVotes((prev) => ({ ...prev, [consultationId]: pollOptionId }));
          showAlert('Thank you!', 'Your vote has been recorded.');
          await fetchData(null);
        } catch (e) {
          showAlert('Vote not recorded', e.message);
        } finally {
          setVotingId(null);
        }
      });
      return;
    }
    setVotingId(pollOptionId);
    try {
      const existingOptionId = userVotes[consultationId];
      const isUnvote = existingOptionId === pollOptionId;

      if (existingOptionId) {
        const { data: existingRow } = await supabase
          .from('poll_votes')
          .select('id')
          .eq('user_id', user.id)
          .eq('consultation_id', consultationId)
          .maybeSingle();
        if (existingRow) await supabase.from('poll_votes').delete().eq('id', existingRow.id);
      }

      if (isUnvote) {
        setUserVotes((prev) => { const next = { ...prev }; delete next[consultationId]; return next; });
        showAlert('Vote Removed', 'Your vote has been removed.');
      } else {
        // Vote counts are updated by the database.
        const { error: voteError } = await supabase.from('poll_votes').insert([{ user_id: user.id, poll_option_id: pollOptionId, consultation_id: consultationId }]);
        if (voteError) throw voteError;
        setUserVotes((prev) => ({ ...prev, [consultationId]: pollOptionId }));
        showAlert('Thank You!', 'Your vote has been recorded.');
      }
      await fetchData(user);
    } catch (error) {
      showAlert('Error', error.message);
    } finally {
      setVotingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading surveys and polls...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <PageHeader title="Surveys & polls" subtitle="Rate our services and vote on the issues that matter most to you." icon="stats-chart-outline" overline="Participate" />
      <Container style={styles.content}>
        <GuideSteps
          title="How to take part"
          steps={[
            'Choose a survey or poll below.',
            'Answer the questions — most take a few minutes. Your answers are saved on this phone if you stop half-way.',
            'Press Submit. You get a thank-you, and results help decide what we improve.',
          ]}
        />

      <Text style={styles.sectionHeading}>🗳️ Live Polls</Text>
      {polls.length === 0 ? (
        <EmptyState icon="stats-chart-outline" title="No live polls right now" message="Check back soon to vote on the issues that matter to you." />
      ) : (
        polls.map((c) => {
          const poll = c.polls[0];
          const totalVotes = poll.poll_options.reduce((sum, o) => sum + (o.vote_count || 0), 0);
          const myVote = userVotes[c.id];
          return (
            <View key={poll.id} style={styles.pollCard}>
              <Text style={styles.pollTopic}>{c.title}</Text>
              <Text style={styles.pollQuestion}>{poll.question}</Text>
              <View style={styles.optionsWrap}>
                {poll.poll_options.map((opt) => {
                const pct = totalVotes > 0 ? Math.round(((opt.vote_count || 0) / totalVotes) * 100) : 0;
                const selected = myVote === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.optionChip, selected && styles.optionChipSelected]}
                    onPress={() => vote(c.id, opt.id)}
                    disabled={votingId === opt.id}
                  >
                    <View style={[styles.optionChipFill, { width: `${pct}%` }, selected && styles.optionChipFillSelected]} />
                    <View style={styles.optionChipContent}>
                      <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]} numberOfLines={1}>
                        {selected ? '✓ ' : ''}{opt.option_text}
                      </Text>
                      <Text style={styles.optionChipPct}>{pct}%</Text>
                    </View>
                  </TouchableOpacity>
                );
                })}
              </View>
              <Text style={styles.pollMeta}>{totalVotes} vote{totalVotes === 1 ? '' : 's'} · Tap your choice again to remove your vote</Text>
            </View>
          );
        })
      )}

      <Text style={styles.sectionHeading}>📋 Surveys</Text>
      {surveys.length === 0 ? (
        <EmptyState icon="clipboard-outline" title="No surveys open right now" message="When we ask for your feedback on our services, the survey will appear here." />
      ) : (
        surveys.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
            <Text style={styles.cardStatus}>
              {item.survey_questions?.[0]?.count || 0} question{item.survey_questions?.[0]?.count === 1 ? '' : 's'}
              {item.end_date ? ` · Closes ${new Date(item.end_date).toDateString()}` : ''}
            </Text>
            <Button title="Take the survey" icon="arrow-forward" size="sm" style={{ marginTop: 12 }} onPress={() => navigation.navigate('SurveyDetail', { id: item.id })} />
          </View>
        ))
      )}
      </Container>
      <Footer />
      {guest.modal}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  content: { padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.gray500 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary },
  sub: { fontSize: 16, color: COLORS.gray500, marginTop: 10, marginBottom: 8 },
  sectionHeading: { fontSize: 18, fontWeight: '700', color: COLORS.gray800, marginTop: 20, marginBottom: 10 },
  emptyText: { color: COLORS.gray500, fontSize: 14, paddingVertical: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray800 },
  cardDesc: { color: COLORS.gray500, marginTop: 4 },
  cardStatus: { color: COLORS.info, marginTop: 8, fontWeight: '600' },
  pollCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  pollTopic: { fontSize: 12, fontWeight: '700', color: COLORS.info, textTransform: 'uppercase' },
  pollQuestion: { fontSize: 17, fontWeight: '700', color: COLORS.gray800, marginTop: 4, marginBottom: 12 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.gray50,
    minWidth: 130,
  },
  optionChipSelected: { borderColor: COLORS.success },
  optionChipFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(30,58,138,0.12)',
  },
  optionChipFillSelected: { backgroundColor: 'rgba(34,197,94,0.15)' },
  optionChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 10,
  },
  optionChipText: { fontSize: 13, color: COLORS.gray800, fontWeight: '500' },
  optionChipTextSelected: { color: COLORS.success, fontWeight: '700' },
  optionChipPct: { fontSize: 12, color: COLORS.gray600, fontWeight: '700' },
  pollMeta: { fontSize: 12, color: COLORS.gray500, marginTop: 10 },
});
