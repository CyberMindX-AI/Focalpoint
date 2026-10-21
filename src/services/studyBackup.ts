import * as FileSystem from 'expo-file-system/legacy';
import { writeFile } from '../lib/files';
import { listAttempts, readBookmarks, readPracticeHistory, rememberPractice, writeBookmarks, type Bookmark, type SavedAttempt } from './practice';

export async function exportStudyBackup(owner: string) {
  if (!owner) throw new Error('Sign in before creating a backup.');
  const attempts = (await listAttempts(owner)).map(attempt => ({
    ...attempt,
    startedAt: attempt.updatedAt,
    writer: 'pastq-phone',
    questionCount: attempt.questions.length,
    writtenAnswers: attempt.questions.map((_, index) => attempt.writtenAnswers[index] || ''),
    flagged: attempt.questions.map((_, index) => Boolean(attempt.flagged[index])),
  }));
  const body = JSON.stringify({
    format: 'pastq-study-backup', version: 1, owner, createdAt: new Date().toISOString(),
    attempts, papers: attempts.map(attempt => ({ id: attempt.id, paper: { questions: attempt.questions, assets: attempt.assets, title: attempt.title, source: attempt.source } })),
    bookmarks: await readBookmarks(owner), history: await readPracticeHistory(owner),
  });
  const path = `${FileSystem.documentDirectory}pastq-backup.json`;
  await FileSystem.writeAsStringAsync(path, body);
  return { path, sessions: attempts.length, bookmarks: (JSON.parse(body) as { bookmarks: unknown[] }).bookmarks.length };
}

export async function importStudyBackup(owner: string, uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists && typeof info.size === 'number' && info.size > 200 * 1024 * 1024) throw new Error('This backup is too large. Use a file below 200 MB.');
  const raw = JSON.parse(await FileSystem.readAsStringAsync(uri));
  if (raw?.format !== 'pastq-study-backup' || raw.version !== 1 || raw.owner !== owner) throw new Error('This backup belongs to another account or uses an unsupported format.');
  if (!Array.isArray(raw.attempts) || !Array.isArray(raw.bookmarks) || !Array.isArray(raw.history)) throw new Error('Invalid backup.');
  const existing = new Set((await listAttempts(owner)).map(attempt => attempt.id));
  let sessions = 0;
  for (const attempt of raw.attempts) {
    if (!attempt?.id || existing.has(attempt.id) || attempt.owner !== owner) continue;
    const paper = (raw.papers || []).find((item: { id: string }) => item.id === attempt.id)?.paper;
    const questions = Array.isArray(attempt.questions) ? attempt.questions : paper?.questions;
    if (!Array.isArray(questions) || !Array.isArray(attempt.answers) || attempt.answers.length !== questions.length) continue;
    const saved: SavedAttempt = {
      id: attempt.id, owner, title: attempt.title || paper?.title || 'Practice session', status: attempt.status === 'active' ? 'active' : 'completed',
      source: attempt.source || paper?.source, questions, assets: attempt.assets || paper?.assets || {}, answers: attempt.answers,
      writtenAnswers: Array.isArray(attempt.writtenAnswers) ? attempt.writtenAnswers : [], flagged: Array.isArray(attempt.flagged) ? attempt.flagged : questions.map(() => false), currentQ: attempt.currentQ || 0,
      duration: attempt.duration || 60, deadline: attempt.deadline || Date.now(), practice: attempt.practice !== false,
      updatedAt: attempt.updatedAt || attempt.startedAt || attempt.completedAt || new Date().toISOString(), completedAt: attempt.completedAt, score: attempt.score, timeTaken: attempt.timeTaken,
    };
    if (!saved.source?.bundleId) continue;
    await writeFile(`attempts/${owner}/${saved.id}.json`, saved);
    existing.add(saved.id);
    sessions += 1;
  }
  const bookmarks = await readBookmarks(owner);
  const known = new Set(bookmarks.map(row => row.key));
  const added = (raw.bookmarks as Bookmark[]).filter(row => row?.key && row.owner === owner && !known.has(row.key));
  if (added.length) await writeBookmarks(owner, [...added, ...bookmarks]);
  for (const row of raw.history) if (row?.id && row.title && row.completed_at && typeof row.score === 'number' && typeof row.total_questions === 'number') await rememberPractice(owner, { ...row, pending: true });
  return { sessions, bookmarks: added.length };
}
