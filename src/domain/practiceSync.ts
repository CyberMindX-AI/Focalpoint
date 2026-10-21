export type HistoryRow = { id: string; title: string; score: number; total_questions: number; graded_total?: number; completed_at: string; source_bundle_id?: string; source_bundle_version?: string | null; answered_count?: number; duration_seconds?: number; pending?: boolean };

/** Keep the phone copy. A session stays pending until this device has uploaded it. */
export function mergePracticeHistory(remote: HistoryRow[], local: HistoryRow[]) {
  const items = new Map<string, HistoryRow>();
  for (const raw of [...remote, ...local]) {
    if (!raw?.id || !raw.completed_at) continue;
    const previous = items.get(raw.id);
    const pending = raw.pending === true || (previous?.pending === true && raw.pending !== false);
    items.set(raw.id, { ...previous, ...raw, title: raw.title || previous?.title || 'Practice session', pending });
  }
  return [...items.values()].sort((a, b) => b.completed_at.localeCompare(a.completed_at)).slice(0, 200);
}
