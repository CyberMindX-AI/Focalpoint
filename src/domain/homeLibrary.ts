export type HomeMaterial = {
  id: string;
  title?: string;
  name?: string;
  questions?: unknown[];
  questionCount?: number;
  question_count?: number;
  accountSaved?: boolean;
};

const skipped = new Set(['demo', 'saved-questions']);

/** Papers the home screen may show. Local questions win. Account stubs and catalog matches stay downloadable. */
export function papersForHome(materials: HomeMaterial[], sessions: { source_bundle_id?: string }[], catalog: HomeMaterial[]) {
  const ready = materials.filter(item => item?.id && item.questions?.length);
  const account = materials.filter(item => item?.id && !item.questions?.length && (item.accountSaved || item.questionCount || item.question_count));
  const known = new Set([...ready, ...account].map(item => item.id));
  const practiced = [...new Set(sessions.map(session => session.source_bundle_id).filter((id): id is string => typeof id === 'string' && !skipped.has(id) && !known.has(id)))];
  const fromHistory = practiced.map(id => catalog.find(item => item.id === id)).filter((item): item is HomeMaterial => Boolean(item)).map(item => ({
    ...item,
    accountSaved: true,
    questions: [] as unknown[],
    questionCount: item.questionCount || item.question_count,
  }));
  return [...ready, ...account, ...fromHistory];
}

function practisedTopic(question: { topic?: string; section?: string }) {
  const topic = String(question.topic || question.section || '').trim();
  return topic || null;
}
function gradedChoice(question: { type?: string; correct?: number | string | null; options?: string[] }) {
  if (question.type === 'theory' || question.type === 'short_answer') return null;
  if (question.correct == null || question.correct === '' || !question.options) return null;
  const index = Number(question.correct);
  return Number.isInteger(index) && index >= 0 && index < question.options.length ? index : null;
}

/** The weakest practised topic on a downloaded paper, using the same rule as the website. */
export function topicSuggestion(materials: any[], attempts: { status: string; source: { bundleId: string }; questions: any[]; answers: (number | null)[]; completedAt?: string; updatedAt?: string }[]) {
  const groups = new Map<string, { material: any; subject: string; topic: string; correct: number; total: number; at: string; year: string; paper: string }>();
  for (const attempt of attempts) {
    if (attempt.status !== 'completed') continue;
    const material = materials.find(item => item.id === attempt.source?.bundleId && item.questions?.length);
    if (!material) continue;
    attempt.questions.forEach((question, index) => {
      const topic = practisedTopic(question);
      const key = gradedChoice(question);
      const answer = attempt.answers[index];
      if (!topic || key == null || answer == null) return;
      const id = JSON.stringify([attempt.source.bundleId, question.subject, topic]);
      const group = groups.get(id) || { material, subject: String(question.subject), topic, correct: 0, total: 0, at: attempt.completedAt || attempt.updatedAt || '', year: String(question.year || ''), paper: String(question.sourceSet || question.paper || '') };
      group.total += 1;
      if (answer === key) group.correct += 1;
      else { group.year = String(question.year || group.year); group.paper = String(question.sourceSet || question.paper || group.paper); }
      const at = attempt.completedAt || attempt.updatedAt || '';
      if (at > group.at) group.at = at;
      groups.set(id, group);
    });
  }
  return [...groups.values()].filter(group => group.correct < group.total).sort((a, b) => a.correct / a.total - b.correct / b.total || a.at.localeCompare(b.at))[0] || null;
}
