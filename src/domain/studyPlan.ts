export function gradedPercent(session: any): number | null {
  const total = Number(session.graded_total ?? session.total_questions ?? session.total), score = Number(session.score);
  return total > 0 && Number.isFinite(score) && score >= 0 && score <= total ? Math.round(score / total * 100) : null;
}

export function studyPlan(materials: any[], sessions: { id: string; completed_at: string; source_bundle_id?: string; score: number; total_questions: number; graded_total?: number }[]) {
  const saved = [...new Map(materials.filter(item => item?.id && Array.isArray(item.questions) && item.questions.length > 0).map(item => [item.id, item])).values()].sort((a, b) => (new Date(b.updatedAt || b.createdAt || 0).getTime() || 0) - (new Date(a.updatedAt || a.createdAt || 0).getTime() || 0));
  const history = [...sessions].sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const latest = (id: string) => history.find(item => item.source_bundle_id === id);
  const weak = saved.map(material => ({ material, result: latest(material.id) })).filter(item => item.result && gradedPercent(item.result) !== null && gradedPercent(item.result)! < 75).sort((a, b) => gradedPercent(a.result)! - gradedPercent(b.result)!);
  const untried = saved.find(item => !latest(item.id));
  const material = weak[0]?.material || untried || [...saved].sort((a, b) => (latest(a.id)?.completed_at || '').localeCompare(latest(b.id)?.completed_at || ''))[0] || null;
  const last = material ? latest(material.id) : null;
  return { saved, material, last, reason: weak.length ? 'Worth another look' : untried ? 'Next from your saved papers' : 'Keep it fresh', percent: last ? gradedPercent(last) : null };
}
