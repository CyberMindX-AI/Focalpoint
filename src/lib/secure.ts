import * as SecureStore from 'expo-secure-store';

const CHUNK = 1800;

/** Supabase sessions exceed SecureStore's per-value limit, so they are stored in pieces. */
export const secureStorage = {
  async getItem(key: string) {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (!count) return SecureStore.getItemAsync(key);
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string) {
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      await clearChunks(key);
      return;
    }
    const chunks = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < chunks; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${key}.n`, String(chunks));
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
  },
  async removeItem(key: string) {
    await clearChunks(key);
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
  },
};

async function clearChunks(key: string) {
  const count = await SecureStore.getItemAsync(`${key}.n`);
  if (!count) return;
  for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => undefined);
  await SecureStore.deleteItemAsync(`${key}.n`).catch(() => undefined);
}
