import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState, BackHandler, Linking } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { isConfigured } from '../lib/config';
import { readJson, writeJson } from '../lib/files';
import { getSupabase } from '../lib/supabase';
import { adoptAuthUrl, logoutUser } from '../services/auth';
import { getGlobalCatalog, getGlobalLibrary, getOfflineLibrary, saveBundle, type LibraryCatalog } from '../services/library';
import { getSavedMaterials, readInstalledLibrary, readStudyPreferences, type StudyPreferences } from '../services/account';
import { normalizePreparation, type Preparation } from '../domain/preparation';
import { listAttempts, loadHistory, readBookmarks, readPracticeHistory, syncPracticeHistory, type Bookmark, type PracticeSummary, type SavedAttempt } from '../services/practice';

export type Screen =
  | 'splash' | 'signup' | 'login' | 'forgot-password' | 'change-password' | 'onboarding'
  | 'home' | 'snap' | 'processing' | 'review-questions' | 'customize-cbt'
  | 'exam' | 'results' | 'review-answers' | 'manual-entry'
  | 'question-reports' | 'downloads' | 'settings-storage' | 'saved-questions' | 'profile-edit'
  | 'practice-history' | 'settings-preferences' | 'settings-reminders' | 'settings-notifications';
export type Tab = 'home' | 'library' | 'lead' | 'preference';

const publicScreens: Screen[] = ['splash', 'signup', 'login', 'forgot-password', 'change-password'];

type Store = {
  configured: boolean;
  ready: boolean;
  user: User | null;
  preferences: StudyPreferences | null;
  screen: Screen;
  tab: Tab;
  stack: Screen[];
  go: (screen: Screen) => void;
  replace: (screen: Screen) => void;
  back: () => void;
  setTab: (tab: Tab) => void;
  signOut: () => Promise<void>;
  setPreferences: (value: StudyPreferences | null) => void;
  catalog: LibraryCatalog | null;
  globalLibrary: any[];
  offlineLibrary: any[];
  libraryStatus: 'loading' | 'ready' | 'error';
  refreshLibrary: () => Promise<void>;
  sessions: PracticeSummary[];
  setSessions: (rows: PracticeSummary[]) => void;
  attempts: SavedAttempt[];
  setAttempts: (rows: SavedAttempt[]) => void;
  bookmarks: Bookmark[];
  setBookmarks: (rows: Bookmark[]) => void;
  preparation: Preparation;
  setPreparation: (value: Preparation) => void;
  bundle: any | null;
  setBundle: (bundle: any | null) => void;
  attempt: SavedAttempt | null;
  setAttempt: (attempt: SavedAttempt | null) => void;
  visionId: string | null;
  setVisionId: (id: string | null) => void;
  questions: any[];
  setQuestions: (rows: any[]) => void;
  downloadId: string | null;
  setDownloadId: (id: string | null) => void;
  notice: string;
  setNotice: (value: string) => void;
  reloadLocal: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function AppStore({ children }: { children: ReactNode }) {
  const configured = isConfigured();
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<StudyPreferences | null>(null);
  const [stack, setStack] = useState<Screen[]>(['splash']);
  const [tab, setTabState] = useState<Tab>('home');
  const [catalog, setCatalog] = useState<LibraryCatalog | null>(null);
  const [globalLibrary, setGlobalLibrary] = useState<any[]>([]);
  const [offlineLibrary, setOfflineLibrary] = useState<any[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sessions, setSessions] = useState<PracticeSummary[]>([]);
  const [attempts, setAttempts] = useState<SavedAttempt[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [preparation, setPreparationState] = useState<Preparation>({ enabled: false, activeEnvironment: null });
  const [bundle, setBundle] = useState<any | null>(null);
  const [attempt, setAttempt] = useState<SavedAttempt | null>(null);
  const [visionId, setVisionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const userId = useRef<string | null>(null);

  const screen = stack[stack.length - 1] || 'splash';
  function go(next: Screen) { setStack(previous => [...previous, next]); }
  function replace(next: Screen) { setStack([next]); }
  function back() { setStack(previous => previous.length > 1 ? previous.slice(0, -1) : previous); }
  function setTab(next: Tab) { setTabState(next); setStack(previous => previous[previous.length - 1] === 'home' ? previous : [...previous.filter(item => item !== 'home'), 'home']); }

  async function setPreparation(value: Preparation) {
    setPreparationState(value);
    if (user) await writeJson(`pastq-preparation:${user.id}`, value);
  }

  async function reloadLocal() {
    const id = userId.current;
    if (!id) return;
    const [offline, history, savedAttempts, savedBookmarks, prep] = await Promise.all([
      accountLibrary(id), loadHistory(id).catch(() => readPracticeHistory(id)), listAttempts(id), readBookmarks(id), readJson(`pastq-preparation:${id}`, null),
    ]);
    if (userId.current !== id) return;
    setOfflineLibrary(offline); setSessions(history); setAttempts(savedAttempts); setBookmarks(savedBookmarks); setPreparationState(normalizePreparation(prep));
    void syncPracticeHistory(id).then(items => { if (userId.current === id) setSessions(items); }).catch(() => undefined);
  }

  async function refreshLibrary() {
    setLibraryStatus('loading');
    try {
      const [catalogValue, bundles, saved] = await Promise.all([getGlobalCatalog(), getGlobalLibrary(), userId.current ? getSavedMaterials().catch(() => []) : Promise.resolve([])]);
      setCatalog(catalogValue);
      setGlobalLibrary(bundles);
      const owner = userId.current;
      if (owner) {
        for (const item of saved) await saveBundle({ ...item, ownerId: owner }, owner).catch(() => undefined);
        if (userId.current !== owner) return;
        setOfflineLibrary(await accountLibrary(owner));
      }
      setLibraryStatus('ready');
    } catch {
      setLibraryStatus('error');
    }
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1 && screen !== 'exam') { back(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack, screen]);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user || null;
      userId.current = next?.id || null;
      setUser(next);
      setPreferences(next ? readStudyPreferences(next.user_metadata) : null);
      setReady(true);
      if (!next) {
        setSessions([]); setAttempts([]); setBookmarks([]); setOfflineLibrary([]); setAttempt(null); setBundle(null);
        setStack(previous => publicScreens.includes(previous[previous.length - 1]) ? previous : ['login']);
      }
    });
    void supabase.auth.getSession().finally(() => setReady(true));
    const link = Linking.addEventListener('url', ({ url }) => { void adoptAuthUrl(url).catch(() => undefined); });
    void Linking.getInitialURL().then(url => { if (url) void adoptAuthUrl(url); });
    return () => { data.subscription.unsubscribe(); link.remove(); };
  }, [configured]);

  useEffect(() => {
    if (!user) return;
    setOfflineLibrary([]); setSessions([]); setAttempts([]); setBookmarks([]); setBundle(null); setAttempt(null);
    if (screen === 'splash' || screen === 'login' || screen === 'signup') replace(preferences ? 'home' : 'onboarding');
    void reloadLocal();
    void refreshLibrary();
  }, [user?.id]);

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', state => { if (state === 'active' && userId.current) void reloadLocal(); });
    const retry = setInterval(() => {
      const id = userId.current;
      if (!id) return;
      void syncPracticeHistory(id).then(items => { if (userId.current === id) setSessions(items); }).catch(() => undefined);
    }, 20000);
    return () => { sub.remove(); clearInterval(retry); };
  }, []);

  const value = useMemo<Store>(() => ({
    configured, ready, user, preferences, screen, tab, stack, go, replace, back, setTab, signOut: async () => { await logoutUser(); },
    setPreferences, catalog, globalLibrary, offlineLibrary, libraryStatus, refreshLibrary, sessions, setSessions, attempts, setAttempts,
    bookmarks, setBookmarks, preparation, setPreparation, bundle, setBundle, attempt, setAttempt, visionId, setVisionId, questions, setQuestions,
    downloadId, setDownloadId, notice, setNotice, reloadLocal,
  }), [configured, ready, user, preferences, screen, tab, stack, catalog, globalLibrary, offlineLibrary, libraryStatus, sessions, attempts, bookmarks, preparation, bundle, attempt, visionId, questions, downloadId, notice]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

async function accountLibrary(owner: string) {
  const local = await getOfflineLibrary(owner);
  const installed = await readInstalledLibrary().catch(() => []);
  const known = new Set(local.map(item => item.id));
  const copies = installed.filter(item => !known.has(item.id)).map(item => ({ id: item.id, title: item.title, name: item.title, questions: [], accountSaved: true, questionCount: item.questionCount }));
  return [...local, ...copies];
}

export function useApp() {
  const value = useContext(Ctx);
  if (!value) throw new Error('App store missing');
  return value;
}
