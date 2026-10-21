/** Closest text equivalent of the website's HTML/KaTeX question fields. */
export function plain(value?: string | null) {
  if (!value) return '';
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function questionText(question: { question?: string; questionHtml?: string }) {
  return plain(question.question) || plain(question.questionHtml);
}

export function optionText(option: string, html?: string) {
  return plain(option) || plain(html);
}
