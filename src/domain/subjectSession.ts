import { isCbtQuestion, topicOf, type CbtQuestion } from './cbtFilters';

export const questionIdentity = (q: any) => JSON.stringify([q.id ?? q.questionNumber ?? q.question, q.subject, q.year || '', q.sourceSet || q.paper || '']);

export interface SubjectSettings {
  selectedSet?:boolean;
  studyBy: 'paper' | 'topic';
  year: string;
  paper: string;
  topics: string[] | null;
  count: string;
}

export function calendarYear(question: CbtQuestion): string | null {
  return String(question.year || '').match(/\b(?:19|20)\d{2}\b/)?.[0] || null;
}
export function subjectYears(questions: CbtQuestion[]): string[] {
  return [...new Set(questions.map(calendarYear).filter((year): year is string => !!year))].sort().reverse();
}
export function subjectPapers(questions: CbtQuestion[], year: string): string[] {
  return [...new Set(questions.filter(question => calendarYear(question) === year)
    .map(question => String(question.sourceSet || question.paper || '').trim()).filter(Boolean))];
}
export function defaultSubjectSettings(questions: CbtQuestion[]): SubjectSettings {
  const year = subjectYears(questions)[0] || '';
  const papers = subjectPapers(questions, year);
  return { studyBy: year ? 'paper' : 'topic', year, paper: papers.includes(year) ? year : papers[0] || '', topics: null, count: '20' };
}
/** A subject has its own paper and count; one subject cannot consume another's allocation. */
export function subjectPool(questions: CbtQuestion[], settings: SubjectSettings): CbtQuestion[] {
  let pool = questions.filter(isCbtQuestion);
  if (!settings.selectedSet && settings.studyBy === 'paper') {
    if (!settings.year) return [];
    pool = pool.filter(question => calendarYear(question) === settings.year);
    if (settings.paper) pool = pool.filter(question => String(question.sourceSet || question.paper || '').trim() === settings.paper);
  } else if (!settings.selectedSet && subjectYears(questions).length && questions.some(question => !calendarYear(question))) {
    // Preserve the undated topic bank alongside, rather than merge it into, annual papers.
    pool = pool.filter(question => !calendarYear(question));
  }
  if (settings.topics !== null) {
    const topics = new Set(settings.topics);
    pool = pool.filter(question => topics.has(topicOf(question) || 'Unsectioned'));
  }
  return pool;
}
export function subjectQuestionCount(questions: CbtQuestion[], settings: SubjectSettings): number {
  const available = subjectPool(questions, settings).length;
  const count = settings.count === 'all' ? available : Number(settings.count);
  return Number.isSafeInteger(count) && count > 0 ? Math.min(count, available) : 0;
}
export function buildSubjectSession(subjects: string[], bySubject: Record<string, CbtQuestion[]>, settings: Record<string, SubjectSettings>, shuffle: boolean, seen?: Set<string>): CbtQuestion[] {
  return subjects.flatMap(subject => {
    if (!settings[subject]) return [];
    const pool = [...subjectPool(bySubject[subject] || [], settings[subject])];
    if (shuffle) for (let index = pool.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[other]] = [pool[other], pool[index]];
    }
    if (seen) pool.sort((a,b)=>Number(seen.has(questionIdentity(a)))-Number(seen.has(questionIdentity(b))));
    return pool.slice(0, subjectQuestionCount(bySubject[subject] || [], settings[subject]));
  });
}
