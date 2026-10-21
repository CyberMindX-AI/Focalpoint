import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const root = `${FileSystem.documentDirectory}pastq/`;

async function ensure(dir: string) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

export async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeKey(key: string) {
  await AsyncStorage.removeItem(key);
}

export async function writeFile(relative: string, value: unknown) {
  const path = root + relative;
  await ensure(path.slice(0, path.lastIndexOf('/')));
  await FileSystem.writeAsStringAsync(path, JSON.stringify(value));
}

export async function readFile<T>(relative: string): Promise<T | null> {
  const path = root + relative;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  return JSON.parse(await FileSystem.readAsStringAsync(path)) as T;
}

export async function deleteFile(relative: string) {
  const path = root + relative;
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
}

export async function listFiles(relative: string) {
  const dir = root + relative;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return [];
  return FileSystem.readDirectoryAsync(dir);
}

export async function fileBytes() {
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) return 0;
  const names = await FileSystem.readDirectoryAsync(root);
  let bytes = 0;
  for (const name of names) {
    const nested = await FileSystem.getInfoAsync(root + name);
    if (nested.exists && !nested.isDirectory && typeof nested.size === 'number') bytes += nested.size;
  }
  return bytes;
}
