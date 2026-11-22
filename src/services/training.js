import { supabase } from './supabaseClient';

const MODULE_COLUMNS = 'id, slug, title, summary, audience, topic, body, video_url, minutes, position, pass_mark, is_published, updated_at';

/** Published modules the viewer may see (row-level security decides). */
export async function fetchModules(audience) {
  let q = supabase.from('training_modules').select(MODULE_COLUMNS).order('position');
  if (audience) q = q.eq('audience', audience);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchModule(slug) {
  const { data, error } = await supabase.from('training_modules').select(MODULE_COLUMNS).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
}

/** Questions without answers. */
export async function getQuiz(moduleId) {
  const { data, error } = await supabase.rpc('get_quiz', { p_module: moduleId });
  if (error) throw error;
  return data || [];
}

export async function submitQuiz(moduleId, answers) {
  const { data, error } = await supabase.rpc('submit_quiz', { p_module: moduleId, p_answers: answers });
  if (error) throw error;
  return data;
}

export const startModule = (moduleId) => supabase.rpc('start_module', { p_module: moduleId }).then(() => {}, () => {});

export async function myProgress(userId) {
  const { data } = await supabase.from('training_progress').select('module_id, attempts, best_score, passed, completed_at').eq('user_id', userId);
  return Object.fromEntries((data || []).map((p) => [p.module_id, p]));
}

export async function trainingReport() {
  const { data, error } = await supabase.rpc('training_report');
  if (error) throw error;
  return data || [];
}

// ---------- Managing modules (administrators and HR) ----------
export async function fetchQuestions(moduleId) {
  const { data, error } = await supabase.from('training_questions').select('*').eq('module_id', moduleId).order('position');
  if (error) throw error;
  return data || [];
}

export async function saveModule(m, questions) {
  const row = {
    slug: m.slug || m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60),
    title: m.title.trim(), summary: m.summary?.trim() || null, audience: m.audience, topic: m.topic?.trim() || 'General',
    body: m.body || '', video_url: m.video_url?.trim() || null, minutes: Number(m.minutes) || 10,
    position: Number(m.position) || 0, pass_mark: Number(m.pass_mark) || 70, is_published: m.is_published !== false,
    updated_at: new Date().toISOString(),
  };
  const res = m.id
    ? await supabase.from('training_modules').update(row).eq('id', m.id).select('id').single()
    : await supabase.from('training_modules').insert(row).select('id').single();
  if (res.error) throw res.error;
  const id = res.data.id;
  if (questions) {
    const del = await supabase.from('training_questions').delete().eq('module_id', id);
    if (del.error) throw del.error;
    const rows = questions
      .filter((q) => q.prompt.trim() && q.options.filter((o) => o.trim()).length >= 2)
      .map((q, i) => ({ module_id: id, position: i, prompt: q.prompt.trim(), options: q.options.map((o) => o.trim()).filter(Boolean), answer: Number(q.answer) || 0, explanation: q.explanation?.trim() || null }));
    if (rows.length) {
      const ins = await supabase.from('training_questions').insert(rows);
      if (ins.error) throw ins.error;
    }
  }
  return id;
}
