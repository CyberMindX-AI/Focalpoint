import { File } from 'expo-file-system';
import { authedFetch } from './auth';
import { readJson, writeJson } from '../lib/files';
import { getSupabase } from '../lib/supabase';

/** Expo's fetch cannot send React Native `{ uri }` form parts. Read the file and attach its bytes. */
function uploadPart(file: { uri: string; name: string; mime: string }) {
  return {
    name: file.name,
    type: file.mime,
    bytes: async () => new Uint8Array(await new File(file.uri).arrayBuffer()),
  };
}

export type StudyFocus = { kind: 'school' | 'exam'; id: string; name: string; aliases?: string[] };
export type StudyPreferences = { undergraduate: boolean; focus: StudyFocus | null; completedAt: string };

export function readStudyPreferences(metadata: Record<string, any> = {}): StudyPreferences | null {
  const value = metadata?.study_preferences;
  if (!value || typeof value.undergraduate !== 'boolean' || typeof value.completedAt !== 'string') return null;
  const focus = value.focus;
  if (focus !== null && (!focus || !['school', 'exam'].includes(focus.kind) || typeof focus.id !== 'string' || typeof focus.name !== 'string')) return null;
  if (value.undergraduate && focus?.kind !== 'school') return null;
  return { undergraduate: value.undergraduate, focus: focus ? { kind: focus.kind, id: focus.id, name: focus.name, aliases: focus.aliases || [] } : null, completedAt: value.completedAt };
}

export async function completeOnboarding(undergraduate: boolean, focus: StudyFocus | null) {
  if (undergraduate && focus?.kind !== 'school') throw new Error('Please choose your university.');
  const preferences = { undergraduate, focus, completedAt: new Date().toISOString() };
  const { data, error } = await getSupabase().auth.updateUser({ data: { is_undergraduate: undergraduate, study_preferences: preferences } });
  if (error) throw error;
  if (!data.user) throw new Error('Please sign in again to save your choice.');
  const { error: profileError } = await getSupabase().from('users').update({ onboarding_complete: true }).eq('id', data.user.id);
  if (profileError) console.warn('Profile marker could not be updated; study preferences are saved on the account.');
  return preferences;
}

export async function createVisionSession(name: string) {
  const response = await authedFetch('/api/vision/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || body?.error || 'Could not start this upload.');
  return body;
}

export async function uploadSessionPages(sessionId: string, files: { uri: string; name: string; mime: string }[], startIndex = 0) {
  const form = new FormData();
  files.forEach((file, index) => form.append('images', uploadPart({ uri: file.uri, name: file.name || `page-${index + 1}.jpg`, mime: file.mime || 'image/jpeg' }) as unknown as Blob));
  form.append('pageIndexes', JSON.stringify(files.map((_, index) => startIndex + index)));
  const response = await authedFetch(`/api/vision/sessions/${sessionId}/pages`, { method: 'POST', body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || body?.error || 'Could not upload these pages.');
  return body;
}

export async function uploadSessionPdf(sessionId: string, file: { uri: string; name: string; mime: string }) {
  const form = new FormData();
  form.append('pdf', uploadPart({ uri: file.uri, name: file.name || 'material.pdf', mime: file.mime || 'application/pdf' }) as unknown as Blob);
  const response = await authedFetch(`/api/vision/sessions/${sessionId}/pdf`, { method: 'POST', body: form });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || body?.error || 'Could not upload this PDF.');
  }
}

export async function startVisionSession(sessionId: string) {
  const response = await authedFetch(`/api/vision/sessions/${sessionId}/start`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to start processing');
  return response.json();
}

export async function resumeVisionSession(sessionId: string) {
  const response = await authedFetch(`/api/vision/sessions/${sessionId}/resume`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to resume');
  return response.json();
}

export async function replyVisionFollowUp(sessionId: string, opts: { followUpId?: string; action?: string; image?: { uri: string; name: string; mime: string } | null }) {
  const form = new FormData();
  if (opts.followUpId) form.append('followUpId', opts.followUpId);
  if (opts.action) form.append('action', opts.action);
  if (opts.image) form.append('image', uploadPart({ uri: opts.image.uri, name: opts.image.name || 'page.jpg', mime: opts.image.mime || 'image/jpeg' }) as unknown as Blob);
  const response = await authedFetch(`/api/vision/sessions/${sessionId}/reply`, { method: 'POST', body: form });
  if (!response.ok) throw new Error('Failed to reply');
  return response.json();
}

export async function getVisionSession(sessionId: string) {
  const response = await authedFetch(`/api/vision/sessions/${sessionId}`);
  if (!response.ok) throw new Error('Session not found');
  return response.json();
}

export async function extractVisionText(payload: { text: string; name?: string }) {
  const response = await authedFetch('/api/vision/extract-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || body?.error || 'Could not prepare your questions.');
  return body as { sessionId?: string; jobId?: string; status: string };
}

export async function confirmVisionMaterial(sessionId: string, questions: unknown[]) {
  const response = await authedFetch(`/api/vision/sessions/${encodeURIComponent(sessionId)}/confirm`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || body?.error || 'Could not save your material.');
  return body;
}

export async function getSavedMaterials() {
  const response = await authedFetch('/api/vision/materials?offset=0&limit=100');
  if (!response.ok) throw new Error('Could not load your saved uploads.');
  const body = await response.json();
  return body.materials || [];
}

export async function getSavedMaterial(id: string) {
  const response = await authedFetch(`/api/vision/materials/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error('Could not open your saved material. Check your connection and try again.');
  return response.json();
}

export type InstalledRef = { id: string; title: string; questionCount?: number };

export async function readInstalledLibrary(): Promise<InstalledRef[]> {
  const { data } = await getSupabase().auth.getUser();
  const raw = data.user?.user_metadata?.installed_library;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is InstalledRef => Boolean(item && typeof item.id === 'string' && typeof item.title === 'string')).map(item => ({ id: item.id, title: item.title, questionCount: Number(item.questionCount) > 0 ? Number(item.questionCount) : undefined })).slice(0, 80);
}

export async function rememberInstalledLibrary(bundle: { id?: string; title?: string; name?: string; sourceSessionId?: string; questions?: unknown[]; questionCount?: number; question_count?: number }) {
  if (!bundle.id || bundle.sourceSessionId) return;
  const count = Array.isArray(bundle.questions) ? bundle.questions.length : Number(bundle.questionCount ?? bundle.question_count);
  const current = await readInstalledLibrary();
  const next = [{ id: bundle.id, title: String(bundle.title || bundle.name || 'Saved paper').slice(0, 200), questionCount: Number.isFinite(count) && count > 0 ? count : undefined }, ...current.filter(item => item.id !== bundle.id)].slice(0, 80);
  const { error } = await getSupabase().auth.updateUser({ data: { installed_library: next } });
  if (error) throw error;
}

export type StudySession = { id: string; title: string; kind: 'exam' | 'tutorial'; visibility: 'public' | 'private'; status: 'upcoming' | 'live' | 'ended'; logo: string | null; tag: string | null; startsAt: string | null; joined: boolean };

async function discover<T>(path = '', body?: unknown): Promise<T> {
  const response = await authedFetch(`/api/discover${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const value = await response.json();
  if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : 'Could not load sessions.');
  return value;
}
export const getDiscover = () => discover<{ sessions: StudySession[]; joined: StudySession[] }>('');
export const joinPublic = (id: string) => discover<{ session: StudySession }>(`/${encodeURIComponent(id)}/join`, {});
export const joinPrivate = (code: string) => discover<{ session: StudySession }>('/join', { code });

export type ReminderSettings = { enabled: boolean; mode: 'smart' | 'scheduled'; time: string; timezone: string; days: number[]; quietStart: string; quietEnd: string; personalized: boolean; pausedUntil: string | null };
export type ReminderSnapshot = { ownerId: string; settings: ReminderSettings; push: { configured: boolean; publicKey: string | null; devices: string[] }; preview: { title: string; body: string; targetTime: string; mood?: string }; lastDelivery: { day: string; status: string } | null };
export type InboxItem = { id: string; title: string; body: string; deepLink: string; sent_at: string; read_at: string | null };

async function reminders<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
  const response = await authedFetch(`/api/reminders${path}`, method === 'GET' ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'Could not save your reminders.');
  return result;
}
export const getReminders = () => reminders<ReminderSnapshot>();
export const saveReminders = (settings: ReminderSettings) => reminders<ReminderSnapshot>('', 'PUT', settings);
export const getNotificationInbox = (offset = 0) => reminders<{ items: InboxItem[]; total: number; unread: number }>(`/inbox?offset=${offset}`);
export const readNotification = (id: string) => reminders(`/inbox/${encodeURIComponent(id)}/read`, 'POST', {});

export type QuestionReport = { id: string; owner: string; bundleId: string; questionId: string; version: string | null; category: string; note: string; status: 'queued' | 'received' | 'reviewing' | 'corrected' | 'no_change' | string; createdAt: string; subject: string; year?: string; resolution?: string };

export async function listReports(owner: string) {
  return readJson<QuestionReport[]>(`pastq-reports:${owner}`, []);
}
export async function queueReport(owner: string, input: Omit<QuestionReport, 'id' | 'owner' | 'createdAt' | 'status'>) {
  const row: QuestionReport = { ...input, id: `${Date.now()}`, owner, status: 'queued', createdAt: new Date().toISOString() };
  const rows = [row, ...await listReports(owner)];
  await writeJson(`pastq-reports:${owner}`, rows);
  try {
    const response = await authedFetch('/api/question-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (response.ok) {
      const remote = await response.json();
      await writeJson(`pastq-reports:${owner}`, rows.map(item => item.id === row.id ? { ...item, ...remote, owner } : item));
    }
  } catch { /* The report stays on this device and can be retried. */ }
  return row;
}

export async function syncReports(owner: string) {
  let rows = await listReports(owner);
  for (const row of rows.filter(item => item.status === 'queued')) {
    try {
      const { owner: _owner, id: _id, status: _status, createdAt: _created, resolution: _resolution, ...input } = row;
      const response = await authedFetch('/api/question-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!response.ok) continue;
      const remote = await response.json();
      rows = rows.map(item => item.id === row.id ? { ...item, ...remote, owner } : item);
    } catch { break; }
  }
  try {
    const response = await authedFetch('/api/question-reports');
    if (response.ok) {
      const body = await response.json();
      if (Array.isArray(body.items)) {
        const known = new Map(rows.map(row => [row.id, row]));
        for (const row of body.items) known.set(row.id, { ...known.get(row.id), ...row, owner });
        rows = [...known.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
    }
  } catch { /* Keep the device copy. */ }
  await writeJson(`pastq-reports:${owner}`, rows);
  return rows;
}
