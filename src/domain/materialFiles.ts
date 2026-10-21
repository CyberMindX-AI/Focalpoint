export type UploadFile = { uri: string; name: string; mime: string; size?: number };
export type MaterialFiles = { kind: 'photos' | 'pdf' | 'text'; files: UploadFile[] };

/** Same rules as the website: one PDF, one text file, or an ordered set of photos. */
export function classifyMaterialFiles(files: UploadFile[]): MaterialFiles {
  if (!files.length) throw new Error('Choose a file first.');
  if (files.some(file => file.size === 0)) throw new Error('One of these files is empty. Choose another file.');
  const pdfs = files.filter(file => file.mime === 'application/pdf' || /\.pdf$/i.test(file.name));
  const texts = files.filter(file => /\.(txt|md|json)$/i.test(file.name) || /^(text\/|application\/json)/i.test(file.mime));
  const photos = files.filter(file => file.mime.startsWith('image/') || /\.(heic|heif|jpg|jpeg|png|webp|bmp|tif|tiff)$/i.test(file.name));
  if (pdfs.length + texts.length + photos.length !== files.length) throw new Error('Choose photos, a PDF, or a TXT, Markdown or JSON file.');
  if (pdfs.length) {
    if (files.length !== 1) throw new Error('Upload one PDF at a time. Add photos as a separate material.');
    return { kind: 'pdf', files };
  }
  if (texts.length) {
    if (files.length !== 1) throw new Error('Upload one text file at a time, separately from photos.');
    return { kind: 'text', files };
  }
  return { kind: 'photos', files };
}

/** Sort a new selection only. The student can still reorder the full list afterwards. */
export function sortUploadFiles<T extends { name: string }>(files: T[]): T[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

export function reviewMinimumOptions(question: { type?: string }): number {
  return question.type && !['single_choice', 'multiple_choice', 'true_false'].includes(question.type) ? 0 : 2;
}
