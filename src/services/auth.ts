import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { apiUrl } from '../lib/config';
import { getSupabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}));
  return data.error || fallback;
}

export async function registerUser(email: string, password: string, name: string) {
  const response = await fetch(apiUrl('/api/auth/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to sign up');
  if (data.session) {
    const { error } = await getSupabase().auth.setSession(data.session);
    if (error) throw error;
  }
  return data.user;
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to login');
  if (data.session) {
    const { error } = await getSupabase().auth.setSession(data.session);
    if (error) throw error;
  }
  return data.user;
}

export async function logoutUser() {
  try { await fetch(apiUrl('/api/auth/logout'), { method: 'POST' }); } catch { /* Local session still clears. */ }
  await getSupabase().auth.signOut();
}

export async function sendPasswordReset(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('recovery') });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw error;
  await getSupabase().auth.signOut();
}

export async function loginWithGoogle() {
  const redirectTo = Linking.createURL('auth');
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { access_type: 'offline', prompt: 'select_account' } },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Google sign-in could not start.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('Google sign-in was cancelled.');
  await adoptAuthUrl(result.url);
}

export async function adoptAuthUrl(url: string) {
  const parsed = Linking.parse(url);
  const query = parsed.queryParams || {};
  const hash = url.includes('#') ? new URLSearchParams(url.split('#')[1]) : null;
  const access_token = String(query.access_token || hash?.get('access_token') || '');
  const refresh_token = String(query.refresh_token || hash?.get('refresh_token') || '');
  const code = String(query.code || hash?.get('code') || '');
  if (access_token && refresh_token) {
    const { error } = await getSupabase().auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return true;
  }
  if (code) {
    const { error } = await getSupabase().auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  return false;
}

export async function authHeader() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Please sign in again.');
  return { token: data.session.access_token, userId: data.session.user.id };
}

export async function authedFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const send = async () => {
    const { token } = await authHeader();
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(apiUrl(path), { ...init, headers });
  };
  let response: Response;
  try {
    response = await send();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message && !/network request failed|failed to fetch|network error|internet connection/i.test(message)) throw error;
    throw new Error('Could not reach Focalpoint. Check your connection and try again.');
  }
  if (response.status !== 401) return response;
  const { data, error } = await getSupabase().auth.refreshSession();
  if (error || !data.session) {
    await getSupabase().auth.signOut();
    throw new Error('Please sign in again.');
  }
  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') throw new Error('Your session was refreshed. Please try that again.');
  return send();
}

export function newId() {
  return Crypto.randomUUID();
}

export { readError };
