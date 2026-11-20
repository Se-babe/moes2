import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../../theme';
import { Badge, EmptyState, STATUS_TONE, useBreakpoint } from '../ui';
import { fetchQueue, ALL_STATUSES, PRIORITY_TONE, dueInfo, fmtDateTime } from '../../services/staff';

const STATUS_FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'Escalated', label: 'Escalated' },
  { key: 'Resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
];

/**
 * Work queue used by the staff portal (scopes: mine / department / unassigned)
 * and the admin console (scope: all).
 */
export default function RequestQueue({ user, scopes, initialScope, onOpen, departments = [], staff = [], refreshKey = 0 }) {
  const { isDesktop } = useBreakpoint();
  const [scope, setScope] = useState(initialScope || scopes[0].key);
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const deptName = useMemo(() => Object.fromEntries(departments.map((d) => [d.id, d.name])), [departments]);
  const staffName = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s.full_name || s.email])), [staff]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchQueue({ scope, status, search, userId: user?.id, departmentId: user?.department_id }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [scope, status, search, user?.id, user?.department_id]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0); // debounce typing
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  return (
    <View style={styles.wrap}>
      {/* Filters */}
      <View style={[styles.filters, !isDesktop && { flexDirection: 'column', alignItems: 'stretch' }]}>
        {scopes.length > 1 && (
          <View style={styles.segment}>
            {scopes.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => setScope(s.key)}
                style={[styles.segBtn, scope === s.key && styles.segBtnActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: scope === s.key }}
              >
                <Text style={[styles.segText, scope === s.key && styles.segTextActive]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={COLORS.gray400} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search reference or title"
            placeholderTextColor={COLORS.gray400}
            accessibilityLabel="Search requests"
          />
        </View>
        <Pressable onPress={load} style={styles.refresh} accessibilityLabel="Refresh">
          <Ionicons name="refresh" size={18} color={COLORS.primary} />
        </Pressable>
      </View>
      <View style={styles.chips}>
        {STATUS_FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setStatus(f.key)} style={[styles.chip, status === f.key && styles.chipActive]}>
            <Text style={[styles.chipText, status === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ padding: 40 }}><ActivityIndicator color={COLORS.primary} /></View>
      ) : error ? (
        <EmptyState icon="warning-outline" title="Couldn't load requests" message={error} />
      ) : rows.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title="Nothing here" message="No requests match these filters." />
      ) : (
        <View style={styles.table}>
          {isDesktop && (
            <View style={[styles.row, styles.headRow]}>
              <Text style={[styles.th, { flex: 1.1 }]}>Reference</Text>
              <Text style={[styles.th, { flex: 3 }]}>Request</Text>
              <Text style={[styles.th, { flex: 1.1 }]}>Priority</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>Status</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>Due</Text>
              <Text style={[styles.th, { flex: 1.6 }]}>Assigned to</Text>
            </View>
          )}
          {rows.map((r) => {
            const due = dueInfo(r.due_at, r.status);
            return (
              <Pressable
                key={r.id}
                onPress={() => onOpen(r.id)}
                style={({ hovered }) => [styles.row, !isDesktop && styles.rowCard, hovered && { backgroundColor: COLORS.primarySoft }]}
                accessibilityRole="link"
                accessibilityLabel={`${r.reference_no}: ${r.title}, ${r.status}`}
              >
                {isDesktop ? (
                  <>
                    <Text style={[styles.ref, { flex: 1.1 }]}>{r.reference_no}</Text>
                    <View style={{ flex: 3, paddingRight: 12 }}>
                      <Text style={styles.title} numberOfLines={1}>{r.title}</Text>
                      <Text style={TYPE.small} numberOfLines={1}>
                        {r.request_type}{r.source && r.source !== 'Online' ? ` (${r.source})` : ''} · {r.category} · {deptName[r.department_id] || 'No department'}
                      </Text>
                    </View>
                    <View style={{ flex: 1.1 }}><Badge label={r.priority} tone={PRIORITY_TONE[r.priority]} /></View>
                    <View style={{ flex: 1.2, gap: 4 }}>
                      <Badge label={r.status} tone={STATUS_TONE[r.status]} />
                      {r.escalation_level > 0 && <Text style={styles.esc}>Level {r.escalation_level}</Text>}
                    </View>
                    <View style={{ flex: 1.2 }}>
                      {due ? <Badge label={due.text} tone={due.tone} icon="time-outline" /> : <Text style={TYPE.small}>{fmtDateTime(r.resolved_at || r.updated_at)}</Text>}
                    </View>
                    <Text style={[TYPE.small, { flex: 1.6, color: r.assigned_to ? COLORS.gray700 : COLORS.danger }]} numberOfLines={1}>
                      {r.assigned_to ? staffName[r.assigned_to] || 'Staff member' : 'Unassigned'}
                    </Text>
                  </>
                ) : (
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.ref}>{r.reference_no}</Text>
                      <Badge label={r.status} tone={STATUS_TONE[r.status]} />
                    </View>
                    <Text style={styles.title} numberOfLines={2}>{r.title}</Text>
                    <View style={styles.cardMeta}>
                      <Badge label={r.priority} tone={PRIORITY_TONE[r.priority]} />
                      {due && <Badge label={due.text} tone={due.tone} icon="time-outline" />}
                    </View>
                    <Text style={TYPE.small}>
                      {r.category} · {r.assigned_to ? staffName[r.assigned_to] || 'Staff member' : 'Unassigned'}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
      {!loading && rows.length > 0 && <Text style={[TYPE.small, { marginTop: 10 }]}>{rows.length} request{rows.length === 1 ? '' : 's'}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  filters: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  segment: { flexDirection: 'row', backgroundColor: COLORS.gray100, borderRadius: RADIUS.md, padding: 4 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.sm },
  segBtnActive: { backgroundColor: COLORS.white, boxShadow: '0 1px 2px rgba(15,23,42,0.12)' },
  segText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: COLORS.gray500 },
  segTextActive: { color: COLORS.gray900 },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: 42,
  },
  searchInput: { fontFamily: FONT, flex: 1, fontSize: 14, color: COLORS.gray900, paddingVertical: 10 },
  refresh: { padding: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white, alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACE.lg },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  chipTextActive: { color: COLORS.white },
  table: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray200, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg, paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  rowCard: { alignItems: 'flex-start' },
  headRow: { backgroundColor: COLORS.gray50, borderTopWidth: 0, paddingVertical: 10 },
  th: { fontFamily: FONT, fontSize: 12, fontWeight: '700', color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.6 },
  ref: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.3 },
  title: { fontFamily: FONT, fontSize: 14.5, fontWeight: '600', color: COLORS.gray900 },
  esc: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: COLORS.danger },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
});
