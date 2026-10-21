import * as Crypto from 'expo-crypto';
import { apiUrl } from '../lib/config';
import { deleteFile, listFiles, readFile, writeFile } from '../lib/files';

export type LibraryCatalog = {
  organizations?: CatalogUniversity[];
  universities: CatalogUniversity[];
  ungrouped?: CatalogManufacturer[];
};

export type CatalogUniversity = {
  id: string; slug: string; name: string; shortName?: string | null; type?: string; examTypes: CatalogExamType[];
};
export type CatalogExamType = { id: string; slug: string; name: string; manufacturers: CatalogManufacturer[]; materials?: CatalogManufacturer[] };
export type CatalogManufacturer = {
  id: string; slug: string; name: string; title?: string; bundleId: string; yearMin?: number | null; yearMax?: number | null;
  questionCount?: number; subjects?: string[]; streams?: string[];
};

function normalizeBundle(raw: any) {
  if (!raw || typeof raw !== 'object') return null;
  let parsedDesc = null;
  if (typeof raw.description === 'string' && raw.description.startsWith('{')) {
    try { parsedDesc = JSON.parse(raw.description); } catch { /* Description is plain text. */ }
  }
  const questions = Array.isArray(raw.questions) ? raw.questions : Array.isArray(raw.data?.questions) ? raw.data.questions : Array.isArray(parsedDesc?.questions) ? parsedDesc.questions : [];
  return { ...raw, ...parsedDesc, id: raw.id || raw.bundle_id, title: raw.title || raw.name || 'Untitled Material', updatedAt: raw.updatedAt || raw.updated_at || null, questions, groups: raw.groups || parsedDesc?.groups || [] };
}

async function apiGet<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(apiUrl(path), { signal: controller.signal });
    if (!response.ok) throw new Error('The question library could not be loaded. Try again.');
    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.message === 'The question library could not be loaded. Try again.') throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The question library took too long to respond.');
    throw new Error('Could not reach Focalpoint. Check your connection and try again.');
  } finally { clearTimeout(timer); }
}

export const getGlobalCatalog = () => apiGet<LibraryCatalog>('/api/library/catalog');
export const getGlobalLibrary = async () => {
  const data = await apiGet<{ bundles?: any[]; materials?: any[] }>('/api/library/bundles');
  return (data.bundles || data.materials || []).map(normalizeBundle).filter(Boolean);
};
export const getBundleFromApi = async (bundleId: string) => {
  const bundle = normalizeBundle(await apiGet(`/api/library/bundles/${bundleId}`));
  if (!bundle) throw new Error('Invalid bundle');
  return bundle;
};

const bundlePath = (id: string, ownerId?: string) => ownerId && id.includes(':') ? '' : `bundles/${safe(id)}.json`;
const safe = (id: string) => id.replace(/[^a-zA-Z0-9._:-]/g, '_');

export async function saveBundle(bundle: any, ownerId?: string) {
  const normalized = normalizeBundle(bundle);
  if (!normalized?.id) throw new Error('Invalid bundle');
  const key = normalized.sourceSessionId && ownerId ? `private:${ownerId}:${normalized.id}` : normalized.id;
  await writeFile(`bundles/${safe(key)}.json`, { ...normalized, ownerId: normalized.sourceSessionId ? ownerId : normalized.ownerId });
  if (!normalized.sourceSessionId) {
    const { rememberInstalledLibrary } = await import('./account');
    await rememberInstalledLibrary(normalized).catch(() => undefined);
  }
  return normalized;
}

export async function getOfflineLibrary(ownerId?: string) {
  const names = await listFiles('bundles');
  const bundles = [];
  for (const name of names) {
    const bundle = normalizeBundle(await readFile(`bundles/${name}`));
    if (!bundle) continue;
    if (bundle.sourceSessionId && bundle.ownerId !== ownerId) continue;
    bundles.push(bundle);
  }
  return bundles.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
}

export async function getOfflineBundle(id: string, ownerId?: string) {
  return normalizeBundle(await readFile(`bundles/${safe(ownerId ? `private:${ownerId}:${id}` : id)}.json`) || await readFile(`bundles/${safe(id)}.json`));
}

export async function removeOfflineBundle(id: string, ownerId?: string) {
  await deleteFile(`bundles/${safe(id)}.json`);
  if (ownerId) await deleteFile(`bundles/${safe(`private:${ownerId}:${id}`)}.json`);
}

export async function sha256(text: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

export type DownloadPart = { hash: string; subject: string; year: string; paper: string; count: number; bytes: number };
export type DownloadManifest = { version: string; bundle: any; parts: DownloadPart[]; totalQuestions: number; totalBytes: number };

export async function downloadManifest(id: string): Promise<DownloadManifest> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(apiUrl(`/api/library/bundles/${encodeURIComponent(id)}/manifest`), { signal: controller.signal });
    if (!response.ok) throw new Error('Download details could not load. Reconnect and try again.');
    const value = await response.json();
    if (!Array.isArray(value.parts) || !value.parts.length || value.bundle?.id !== id) throw new Error('Invalid download details.');
    return value;
  } catch (error) {
    if (error instanceof Error && /Download details|Invalid download/.test(error.message)) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Download details took too long to load.');
    throw new Error('Could not reach Focalpoint. Check your connection and try again.');
  } finally { clearTimeout(timer); }
}

function readPart(url: string, onBytes: (loaded: number) => void, signal?: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.timeout = 120000;
    const fail = (message: string) => reject(new Error(message));
    xhr.onprogress = event => onBytes(event.loaded || 0);
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.responseText) : fail('Download interrupted. Reconnect and tap Resume.');
    xhr.onerror = () => fail('Could not reach Focalpoint. Check your connection and try again.');
    xhr.ontimeout = () => fail('The download took too long. Tap Resume.');
    xhr.onabort = () => fail('Download paused.');
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send();
  });
}

export async function downloadSelected(manifest: DownloadManifest, selected: string[], ownerId: string | undefined, onProgress?: (done: number, total: number) => void, signal?: AbortSignal) {
  const parts = manifest.parts.filter(part => selected.includes(part.hash));
  if (!parts.length) throw new Error('Choose a subject or paper.');
  const questions: any[] = [];
  const assets: Record<string, unknown> = {};
  const total = parts.reduce((sum, part) => sum + part.bytes, 0) || 1;
  let done = 0;
  onProgress?.(0, total);
  for (const part of parts) {
    if (signal?.aborted) throw new Error('Download paused.');
    const text = await readPart(apiUrl(`/api/library/bundles/${encodeURIComponent(manifest.bundle.id)}/parts/${part.hash}`), loaded => onProgress?.(done + Math.min(loaded, part.bytes), total), signal);
    if (await sha256(text) !== part.hash) throw new Error('A download part failed verification. Resume to retry.');
    const payload = JSON.parse(text);
    if (payload.questions?.length !== part.count) throw new Error('A download part is incomplete.');
    questions.push(...payload.questions);
    Object.assign(assets, payload.assets);
    done += part.bytes;
    onProgress?.(done, total);
  }
  if (!questions.length) throw new Error('This paper downloaded without any questions.');
  return saveBundle({
    ...manifest.bundle,
    questions,
    assets,
    question_count: questions.length,
    updatedAt: manifest.version,
    downloadedAt: new Date().toISOString(),
    downloadedParts: parts.map(part => part.hash),
    partialDownload: parts.length !== manifest.parts.length,
  }, ownerId);
}

export function formatBytes(bytes: number) {
  return bytes <= 0 ? '0 B' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
