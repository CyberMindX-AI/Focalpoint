import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import { useFonts, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { dark, light, type Palette } from './colors';
import { readJson, writeJson } from '../lib/files';

export type StudyTheme = 'system' | 'light' | 'dark';
const KEY = 'pastq-theme';

type ThemeApi = { mode: StudyTheme; colors: Palette; fontsReady: boolean; setMode: (mode: StudyTheme) => void; manrope: string; outfit: string };

const ThemeContext = createContext<ThemeApi | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<StudyTheme>('system');
  const [system, setSystem] = useState<Palette['scheme']>(Appearance.getColorScheme() === 'light' ? 'light' : 'dark');
  const [fontsLoaded] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold });
  useEffect(() => { void readJson<StudyTheme>(KEY, 'system').then(value => { if (value === 'light' || value === 'dark' || value === 'system') setModeState(value); }); }, []);
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme === 'light' ? 'light' : 'dark'));
    return () => sub.remove();
  }, []);
  const api = useMemo<ThemeApi>(() => ({
    mode,
    colors: (mode === 'system' ? system : mode) === 'light' ? light : dark,
    fontsReady: fontsLoaded,
    setMode: (next) => { setModeState(next); void writeJson(KEY, next); },
    manrope: 'Manrope_600SemiBold',
    outfit: 'Outfit_400Regular',
  }), [mode, system, fontsLoaded]);
  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('Theme missing');
  return value;
}
