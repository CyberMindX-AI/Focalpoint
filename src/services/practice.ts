import { answerIndex } from '../domain/examSession';
import { mergePracticeHistory } from '../domain/practiceSync';
import { questionIdentity } from '../domain/subjectSession';
import { deleteFile, listFiles, readFile, readJson, writeFile, writeJson } from '../lib/files';
import { getSupabase } from '../lib/supabase';
import { newId } from './auth';

export type PracticeSummary = { id: string; title: string; score: number; total_questions: number; graded_total?: number; completed_at: string; source_bundle_id?: string; source_bundle_version?: string | null; answered_count?: number; duration_seconds?: number; pending?: boolean };

export type SavedAttempt = {
  id: string; owner: string; title: string; status: 'active' | 'completed';
  source: { bundleId: string; version: string | null };
  questions: any[]; assets: Record<string, { mime?: string; data?: string }>;
  answers: (number | null)[]; writtenAnswers: string[]; flagged: boolean[]; currentQ: number;
  duration: number; deadline: number; practice: boolean; timeTaken?: number; score?: number; completedAt?: string; updatedAt: string;
};

export type Bookmark = { key: string; owner: string; title: string; source: { bundleId: string; version: string | null }; question: any; answer: number | null; note?: string; createdAt: string };

const historyKey = (owner: string) => `pastq-history:${owner}`;
const bookmarkKey = (owner: string) => `pastq-bookmarks:${owner}`;
const attemptFile = (owner: string, id: string) => `attempts/${owner}/${id}.json`;
const queues = new Map<string, Promise<unknown>>();

function serialize<T>(owner: string, work: () => Promise<T>): Promise<T> {
  const next = (queues.get(owner) || Promise.resolve()).catch(() => undefined).then(work);
  queues.set(owner, next);
  void next.finally(() => { if (queues.get(owner) === next) queues.delete(owner); });
  return next;
}

export async function readPracticeHistory(owner: string) {
  return readJson<PracticeSummary[]>(historyKey(owner), []);
}
export function rememberPractice(owner: string, summary: PracticeSummary) {
  return serialize(owner, async () => {
    const items = mergePracticeHistory([], [summary, ...(await readPracticeHistory(owner)).filter(item => item.id !== summary.id)]);
    await writeJson(historyKey(owner), items);
    return items;
  });
}

async function rememberCompletedAttempts(owner: string, history: PracticeSummary[]) {
  const known = new Set(history.map(row => row.id));
  const extra: PracticeSummary[] = [];
  for (const attempt of await listAttempts(owner)) {
    if (attempt.status !== 'completed' || !attempt.completedAt || known.has(attempt.id)) continue;
    extra.push({
      id: attempt.id, title: attempt.title, score: attempt.score || 0, total_questions: attempt.questions.length,
      graded_total: attempt.questions.filter(question => answerIndex(question) !== null).length, completed_at: attempt.completedAt,
      source_bundle_id: attempt.source.bundleId, source_bundle_version: attempt.source.version,
      answered_count: attempt.answers.filter(answer => answer !== null).length, duration_seconds: attempt.timeTaken || 0, pending: true,
    });
  }
  if (!extra.length) return history;
  const items = mergePracticeHistory([], [...extra, ...history]);
  await writeJson(historyKey(owner), items);
  return items;
}

export function loadHistory(owner: string) {
  return serialize(owner, async () => {
    const local = await rememberCompletedAttempts(owner, await readPracticeHistory(owner));
    try {
      const { data, error } = await getSupabase().from('exam_sessions').select('*').eq('user_id', owner);
      if (error) return local;
      const practice = await getSupabase().from('practice_sessions').select('id, source_bundle_id, source_bundle_version, question_count, correct_count, answered_count, duration_seconds, completed_at, mode').eq('user_id', owner);
      const practiceRows = practice.error ? [] : (practice.data || []).map((row: any) => ({
        id: row.id, title: row.mode === 'timed' ? 'Exam' : 'Practice', score: row.correct_count, total_questions: row.question_count,
        completed_at: row.completed_at, source_bundle_id: row.source_bundle_id, source_bundle_version: row.source_bundle_version,
        answered_count: row.answered_count, duration_seconds: row.duration_seconds,
      }));
      const remote = [...(data || []), ...practiceRows].map((row: any) => ({ ...row, completed_at: row.completed_at || row.created_at })).filter((row: any) => row.id && row.completed_at);
      const items = mergePracticeHistory(remote, local);
      await writeJson(historyKey(owner), items);
      return items;
    } catch {
      return local;
    }
  });
}

export function syncPracticeHistory(owner: string) {
  return serialize(owner, async () => {
    const { data } = await getSupabase().auth.getSession();
    if (data.session?.user.id !== owner) return readPracticeHistory(owner);
    let items = await rememberCompletedAttempts(owner, await readPracticeHistory(owner));
    for (const item of items.filter(row => row.pending)) {
      const current = await getSupabase().auth.getSession();
      if (current.data.session?.user.id !== owner) return items;
      const { pending: _pending, graded_total: _graded, completed_at, ...row } = item;
      try {
        const { error } = await getSupabase().from('exam_sessions').upsert({ ...row, created_at: completed_at, user_id: owner }, { onConflict: 'id' });
        if (error) continue;
        const attempt = await readFile<SavedAttempt>(attemptFile(owner, item.id));
        if (attempt?.status === 'completed') await recordPracticeResult(owner, attempt);
      } catch { continue; }
      items = mergePracticeHistory([], [{ ...item, pending: false }, ...items.filter(row => row.id !== item.id)]);
      await writeJson(historyKey(owner), items);
    }
    return items;
  });
}

export async function listAttempts(owner: string) {
  const names = await listFiles(`attempts/${owner}`);
  const rows: SavedAttempt[] = [];
  for (const name of names) {
    const attempt = await readFile<SavedAttempt>(`attempts/${owner}/${name}`);
    if (attempt?.owner === owner) rows.push(attempt);
  }
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createAttempt(owner: string, input: { title: string; source: SavedAttempt['source']; questions: any[]; assets: SavedAttempt['assets']; duration: number; practice: boolean }) {
  const now = Date.now();
  const attempt: SavedAttempt = {
    id: newId(), owner, title: input.title || 'CBT Session', status: 'active', source: input.source,
    questions: input.questions, assets: input.assets || {}, answers: input.questions.map(() => null), writtenAnswers: [], flagged: input.questions.map(() => false),
    currentQ: 0, duration: input.duration, deadline: now + input.duration * 1000, practice: input.practice, updatedAt: new Date(now).toISOString(),
  };
  await writeFile(attemptFile(owner, attempt.id), attempt);
  return attempt;
}

export async function saveCheckpoint(attempt: SavedAttempt, progress: Pick<SavedAttempt, 'answers' | 'writtenAnswers' | 'flagged' | 'currentQ'>) {
  const next = { ...attempt, ...progress, updatedAt: new Date().toISOString() };
  await writeFile(attemptFile(attempt.owner, attempt.id), next);
  return next;
}

export async function completeAttempt(attempt: SavedAttempt, progress: Pick<SavedAttempt, 'answers' | 'writtenAnswers' | 'flagged' | 'currentQ'>) {
  const score = attempt.questions.filter((question, index) => answerIndex(question) !== null && progress.answers[index] === answerIndex(question)).length;
  const next: SavedAttempt = { ...attempt, ...progress, status: 'completed', score, timeTaken: Math.max(0, Math.round((Date.now() - (attempt.deadline - attempt.duration * 1000)) / 1000)), completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await writeFile(attemptFile(attempt.owner, attempt.id), next);
  return next;
}

export async function discardAttempt(owner: string, id: string) {
  await deleteFile(attemptFile(owner, id));
}

export async function readBookmarks(owner: string) {
  return readJson<Bookmark[]>(bookmarkKey(owner), []);
}
export async function writeBookmarks(owner: string, rows: Bookmark[]) {
  await writeJson(bookmarkKey(owner), rows);
}

export function practiceQuestionKey(sourceBundleId: string, question: any, order: number) {
  if (question.practiceKey) return question.practiceKey;
  return [sourceBundleId, question.sourceType || 'question', question.year || '-', question.paper || '-', question.pageIndex ?? '-', question.questionNumber ?? question.id, order].join(':');
}

export async function recordPracticeResult(owner: string, attempt: SavedAttempt) {
  const attempts = attempt.questions.map((question, index) => ({
    questionKey: practiceQuestionKey(attempt.source.bundleId, question, index),
    topicKey: [question.sourceBundleId || attempt.source.bundleId, question.subject, question.topic || question.section || 'general'].join(':'),
    selectedOptionIndex: question.type === 'short_answer' || question.type === 'theory' ? null : attempt.answers[index],
    answered: attempt.answers[index] != null,
    isCorrect: answerIndex(question) === null || attempt.answers[index] == null ? null : attempt.answers[index] === answerIndex(question),
    attemptOrder: index,
  }));
  const completedAt = attempt.completedAt || new Date().toISOString();
  const { data: practice, error } = await getSupabase().from('practice_sessions').upsert({
    id: attempt.id, user_id: owner, source_bundle_id: attempt.source.bundleId, source_bundle_version: attempt.source.version,
    mode: attempt.practice ? 'practice' : 'timed', question_count: attempts.length, answered_count: attempts.filter(item => item.answered).length,
    correct_count: attempt.score || 0, duration_seconds: attempt.timeTaken || 0, status: 'completed', completed_at: completedAt,
    question_keys: attempts.map(item => item.questionKey),
  }, { onConflict: 'id' }).select('id').single();
  if (error) throw error;
  const { error: attemptsError } = await getSupabase().from('question_attempts').upsert(attempts.map(item => ({
    user_id: owner, practice_session_id: practice.id, question_key: item.questionKey, topic_keys: [item.topicKey],
    selected_option_index: item.selectedOptionIndex, is_correct: item.isCorrect, attempt_order: item.attemptOrder,
  })), { onConflict: 'practice_session_id,question_key' });
  if (attemptsError) throw attemptsError;
  return attempts;
}

export function bookmarkIdentity(source: { bundleId: string }, question: any) {
  return `${source.bundleId}:${questionIdentity(question)}`;
}
