/** A paper this size can start immediately. Larger libraries stay on the subject picker. */
export function shouldStartDownload(manifest: { totalBytes: number; totalQuestions: number; parts: unknown[] }) {
  return manifest.totalQuestions > 0 && manifest.totalBytes > 0 && manifest.totalBytes <= 8 * 1024 * 1024 && manifest.parts.length > 0 && manifest.parts.length <= 40;
}
