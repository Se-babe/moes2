import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../services/supabaseClient';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';

/** "You said, we did": what NWSC did with the public's views on a consultation. */
export default function Outcomes({ limit = 6, style }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    supabase.from('consultations')
      .select('id, title, outcome, outcome_at, poll_votes_count, comments_count')
      .not('outcome', 'is', null)
      .order('outcome_at', { ascending: false })
      .limit(limit)
      .then(({ data }) => setRows(data || []));
  }, [limit]);
  if (!rows.length) return null;
  return (
    <View style={[{ gap: SPACE.md }, style]}>
      <View>
        <Text style={styles.overline}>Your views made a difference</Text>
        <Text style={TYPE.h3}>You said, we did</Text>
      </View>
      {rows.map((c) => {
        const voices = (c.poll_votes_count || 0) + (c.comments_count || 0);
        return (
          <View key={c.id} style={styles.card}>
            <Text style={TYPE.label}>{c.title}</Text>
            {voices ? <Text style={TYPE.small}>{voices} contribution{voices === 1 ? '' : 's'} from the public</Text> : null}
            <View style={styles.did}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.success} style={{ marginTop: 1 }} />
              <Text style={[TYPE.body, { flex: 1 }]}>{c.outcome}</Text>
            </View>
            <Text style={TYPE.small}>Official NWSC response · {new Date(c.outcome_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overline: { fontFamily: FONT, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: COLORS.success },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray200, padding: SPACE.lg, gap: 6 },
  did: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.successSoft },
});
