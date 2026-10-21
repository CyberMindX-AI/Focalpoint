type ExamIdentity = string | { name?: string; id?: string; title?: string; exam?: ExamIdentity; examType?: string; organization?: ExamIdentity; university?: string; libraryMeta?: { exam?: ExamIdentity; organization?: ExamIdentity } };

/** Same artwork choice as the website. Post-UTME is not JAMB UTME. */
export function examArtwork(value?: ExamIdentity): 'jamb' | 'waec' | null {
  if (!value) return null;
  if (typeof value !== 'string') {
    const exam = value.exam || value.libraryMeta?.exam || value.examType;
    if (exam) return examArtwork(exam);
    return examArtwork([value.name, value.title, value.id].filter(Boolean).join(' '))
      || examArtwork(value.organization || value.libraryMeta?.organization || value.university);
  }
  if (/\bpost[\s-]*utme\b/i.test(value)) return null;
  if (/\bwaec\b|west african examinations council/i.test(value)) return 'waec';
  if (/\butme\b|\bjamb\b|joint admissions and matriculation board/i.test(value)) return 'jamb';
  return null;
}
