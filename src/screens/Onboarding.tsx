import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Check } from 'lucide-react-native';
import catalog from '../domain/onboarding-catalog.json';
import { completeOnboarding, type StudyFocus } from '../services/account';
import { useApp } from '../state/AppState';
import { useTheme } from '../theme/Theme';
import { PrimaryButton, Screen, SearchField, TextButton } from '../ui/ui';

type School = { id: string; n: string; s: string; a: string[]; t: string };
type Exam = { id: string; n: string; b: string; a: string[] };
const data = catalog as { schools: School[]; exams: Exam[] };

export function OnboardingScreen() {
  const { colors } = useTheme();
  const { user, replace, setPreferences } = useApp();
  const [undergraduate, setUndergraduate] = useState<boolean | null>(null);
  const [kind, setKind] = useState<'school' | 'exam'>('school');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<StudyFocus | null>(null);
  const [limit, setLimit] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = user?.user_metadata?.full_name?.split(/\s+/)[0] || user?.email?.split('@')[0] || 'there';
  const options = useMemo(() => kind === 'exam'
    ? data.exams.map(item => ({ id: item.id, name: item.n, detail: item.b, aliases: item.a }))
    : data.schools.filter(item => undergraduate !== true || item.t === 'university').map(item => ({ id: item.id, name: item.n, detail: item.s, aliases: item.a })), [kind, undergraduate]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter(option => !needle || [option.name, ...option.aliases].some(value => value.toLowerCase().includes(needle)));
  }, [options, query]);
  const title = undergraduate === null ? `Welcome, ${first}.` : undergraduate ? 'Pick your university.' : 'Make it yours.';

  async function finish(focus: StudyFocus | null) {
    if (busy || undergraduate === null) return;
    setBusy(true); setError('');
    try {
      const saved = await completeOnboarding(undergraduate, focus);
      setPreferences(saved);
      replace('home');
    } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t save your choice. Please try again.'); }
    finally { setBusy(false); }
  }

  return <Screen>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {undergraduate !== null && <Pressable accessibilityLabel="Back" onPress={() => { setUndergraduate(null); setSelected(null); setQuery(''); }} style={{ width: 44, height: 44, justifyContent: 'center' }}><ArrowLeft color={colors.muted} size={20} /></Pressable>}
      <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 28, letterSpacing: -0.8, marginBottom: 18 }}>{title}</Text>
      {undergraduate === null ? <View style={{ gap: 14 }}>
        <Choice title="Undergraduate" onPress={() => setUndergraduate(true)} />
        <Choice title="Other learner" onPress={() => setUndergraduate(false)} />
      </View> : <>
        {!undergraduate && <View style={{ flexDirection: 'row', backgroundColor: colors.control, borderRadius: 9, padding: 4, marginBottom: 14 }}>
          {(['school', 'exam'] as const).map(value => <Pressable key={value} onPress={() => { setKind(value); setSelected(null); setQuery(''); setLimit(8); }} style={{ flex: 1, minHeight: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: kind === value ? colors.panel : 'transparent' }}><Text style={{ color: kind === value ? colors.ink : colors.muted, fontFamily: 'Manrope_700Bold' }}>{value === 'school' ? 'School' : 'Exam'}</Text></Pressable>)}
        </View>}
        <SearchField value={query} onChangeText={value => { setQuery(value); setLimit(8); }} placeholder={undergraduate ? 'Search university or abbreviation' : `Search ${kind}`} />
        <View style={{ marginTop: 8 }}>
          {matches.slice(0, limit).map(option => {
            const active = selected?.id === option.id;
            return <Pressable key={option.id} onPress={() => setSelected({ kind, id: option.id, name: option.name, aliases: option.aliases })} style={{ minHeight: 62, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, borderWidth: active ? 1 : 0, borderColor: active ? colors.accent : 'transparent', borderRadius: 7, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: active ? colors.control : 'transparent' }}>
              <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 13 }}>{option.name}</Text>{!!option.detail && <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{option.detail}</Text>}</View>
              {active ? <Check color={colors.accent} size={16} /> : null}
            </Pressable>;
          })}
          {!matches.length && query.trim() ? <TextButton label={`Use “${query.trim()}”`} onPress={() => setSelected({ kind, id: `custom:${kind}:${query.trim().toLowerCase()}`, name: query.trim() })} /> : null}
        </View>
        {matches.length > limit && <TextButton label="Show more" onPress={() => setLimit(value => value + 8)} />}
        {error ? <Text style={{ color: colors.ink, marginTop: 12 }}>{error}</Text> : null}
        <View style={{ marginTop: 16 }}><PrimaryButton label={busy ? 'Saving…' : 'Let’s go'} disabled={busy || !selected} onPress={() => void finish(selected)} /></View>
        {!undergraduate && <TextButton label="Explore without choosing" onPress={() => void finish(null)} />}
      </>}
    </ScrollView>
  </Screen>;
}

function Choice({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={{ minHeight: 92, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 20, backgroundColor: colors.panel, justifyContent: 'center' }}>
    <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 15 }}>{title}</Text>
  </Pressable>;
}
