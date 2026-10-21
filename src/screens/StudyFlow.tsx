import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Clock3, Flag, Pencil, Plus, X } from 'lucide-react-native';
import { answerIndex, sessionSummary } from '../domain/examSession';
import { environmentFor, publisherName } from '../domain/preparation';
import { buildSubjectSession, calendarYear, defaultSubjectSettings, questionIdentity, subjectPapers, subjectPool, subjectQuestionCount, subjectYears, type SubjectSettings } from '../domain/subjectSession';
import { customDurationSeconds, getAvailableSubjects, getAvailableTopics, isCbtQuestion, topicOf, type CbtQuestion } from '../domain/cbtFilters';
import { readJson, writeJson } from '../lib/files';
import { questionText, optionText } from '../lib/plain';
import { useApp } from '../state/AppState';
import { useTheme } from '../theme/Theme';
import { CalculatorSheet, DrawingBoard, ReportSheet } from '../ui/ExamTools';
import { Scholar } from '../ui/Scholar';
import { Card, Heading, Muted, PrimaryButton, Screen, TextButton, TopBar, Wordmark } from '../ui/ui';
import { bookmarkIdentity, completeAttempt, createAttempt, listAttempts, rememberPractice, saveCheckpoint, syncPracticeHistory, writeBookmarks } from '../services/practice';

type SetupStep = 'subjects' | 'settings' | 'review';
const setupSteps: SetupStep[] = ['subjects', 'settings', 'review'];
const setupNames = { subjects: 'Subjects', settings: 'Session', review: 'Review' };

function sessionSetup(subjects: string[], bySubject: Record<string, CbtQuestion[]>, saved: any, bundle: any) {
  const settings: Record<string, SubjectSettings> = {};
  for (const subject of subjects) {
    const defaults = defaultSubjectSettings(bySubject[subject] || []);
    const old = saved?.settings?.[subject];
    const questions = bySubject[subject] || [];
    settings[subject] = old && ['paper', 'topic'].includes(old.studyBy) && (old.studyBy !== 'paper' || subjectYears(questions).includes(old.year))
      && (old.topics === null || Array.isArray(old.topics) && old.topics.every((topic: unknown) => typeof topic === 'string'))
      && (old.count === 'all' || /^\d{1,5}$/.test(String(old.count))) ? { ...defaults, ...old } : defaults;
  }
  for (const subject of subjects) {
    if (bundle?.revisionSet) settings[subject] = { ...settings[subject], studyBy: 'topic', selectedSet: true, count: 'all' };
    if (bundle?.suggestion?.subject === subject) settings[subject] = { ...settings[subject], studyBy: bundle.suggestion.year ? 'paper' : 'topic', year: bundle.suggestion.year || '', paper: bundle.suggestion.paper || '', topics: [bundle.suggestion.topic], count: '10' };
  }
  const selected = bundle?.suggestion ? [bundle.suggestion.subject] : Array.isArray(saved?.subjects) ? saved.subjects.filter((subject: string) => subjects.includes(subject) && bySubject[subject]?.length) : subjects.length <= 4 ? subjects.filter(subject => bySubject[subject]?.length) : [];
  return { settings, selected, mode: saved?.mode === 'full' ? 'full' as const : 'practice' as const, duration: typeof saved?.duration === 'string' ? saved.duration : '20', shuffle: saved?.shuffle === true };
}

async function seenQuestionKeys(owner: string, bundleId: string) {
  const keys = new Set<string>();
  for (const attempt of await listAttempts(owner)) {
    if (attempt.status !== 'completed') continue;
    attempt.questions.forEach((question, index) => {
      if ((question.sourceBundleId || attempt.source.bundleId) !== bundleId || attempt.answers[index] == null) return;
      keys.add(questionIdentity(question));
    });
  }
  return keys;
}

export function CustomizeScreen() {
  const { colors } = useTheme();
  const app = useApp();
  const bundle = app.bundle;
  const subjects = useMemo(() => bundle ? getAvailableSubjects(bundle) : [], [bundle]);
  const bySubject = useMemo(() => {
    const map: Record<string, CbtQuestion[]> = {};
    for (const question of bundle?.questions || []) if (isCbtQuestion(question)) (map[question.subject] ||= []).push(question);
    return map;
  }, [bundle]);
  const storageKey = app.user && bundle ? `pastq-session:${app.user.id}:${bundle.id}${bundle.revisionSet ? ':revision' : bundle.suggestion ? ':topic-plan' : ''}` : '';
  const [selected, setSelected] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, SubjectSettings>>({});
  const [step, setStep] = useState<SetupStep>('subjects');
  const [mode, setMode] = useState<'practice' | 'full'>('practice');
  const [minutes, setMinutes] = useState('20');
  const [shuffle, setShuffle] = useState(false);
  const [mock, setMock] = useState(false);
  const [unseenFirst, setUnseenFirst] = useState(true);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [topicPicker, setTopicPicker] = useState(false);
  const [finder, setFinder] = useState(false);
  const [finderTab, setFinderTab] = useState<'search' | 'coverage'>('search');
  const [finderQuery, setFinderQuery] = useState('');
  const [finderSubject, setFinderSubject] = useState('');
  const [search, setSearch] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const durationEdited = useRef(false);
  const starting = useRef(false);
  useEffect(() => {
    let active = true;
    const base = sessionSetup(subjects, bySubject, null, bundle);
    setSettings(base.settings); setSelected(base.selected); setMode(base.mode); setMinutes(base.duration); setShuffle(base.shuffle);
    setStep('subjects'); setEditing(null); setMock(false); setHydrated(false); durationEdited.current = false;
    void (async () => {
      const saved = storageKey ? await readJson<any>(storageKey, null) : null;
      if (!active) return;
      const next = sessionSetup(subjects, bySubject, saved, bundle);
      setSettings(next.settings); setSelected(next.selected); setMode(next.mode); setMinutes(next.duration); setShuffle(next.shuffle); setHydrated(true);
      if (app.user && bundle?.id) seenQuestionKeys(app.user.id, String(bundle.id)).then(keys => { if (active) setSeen(keys); }).catch(() => undefined);
    })();
    return () => { active = false; };
  }, [bundle?.id]);
  useEffect(() => {
    if (!storageKey || !hydrated) return;
    void writeJson(storageKey, { subjects: selected, settings, mode, duration: minutes, shuffle });
  }, [storageKey, hydrated, selected, settings, mode, minutes, shuffle]);
  if (!bundle) return <Missing title="Material unavailable" />;
  const counts = Object.fromEntries(selected.map(subject => [subject, settings[subject] ? subjectQuestionCount(bySubject[subject] || [], settings[subject]) : 0]));
  const count = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const durationSeconds = customDurationSeconds(minutes);
  const isUtme = bundle.kind === 'utme-bank' || /^UTME$/i.test(bundle.examType || '');
  const english = subjects.find(subject => /^(use of )?english( language)?$/i.test(subject));
  const shortSubject = selected.find(subject => counts[subject] < (subject === english ? 60 : 40));
  const mockError = mock ? (!english || !selected.includes(english) || selected.length !== 4 ? 'Choose English and three other subjects.' : shortSubject ? `Choose a paper with at least ${shortSubject === english ? 60 : 40} questions for ${shortSubject}.` : '') : '';
  const invalidSubject = selected.find(subject => !counts[subject]);
  const ready = selected.length > 0 && !invalidSubject && durationSeconds !== null && (!mock || mode === 'full' && durationSeconds === 7200) && !mockError;
  const environment = environmentFor(bundle);
  const publisher = publisherName(bundle);
  const subtitle = [...new Set([bundle.title !== environment.name ? bundle.title : '', publisher !== 'Saved material' ? publisher : ''].filter(Boolean))].join(' · ');
  const current = editing ? settings[editing] : null;
  const currentQuestions = editing ? bySubject[editing] || [] : [];
  const years = subjectYears(currentQuestions);
  const papers = current ? subjectPapers(currentQuestions, current.year) : [];
  const topicPool = current ? subjectPool(currentQuestions, { ...current, topics: null }) : [];
  const topics = getAvailableTopics(topicPool);
  if (topicPool.some(question => !question.topic && !question.section)) topics.push('Unsectioned');
  function update(subject: string, changes: Partial<SubjectSettings>) { setSettings(previous => ({ ...previous, [subject]: { ...previous[subject], ...changes } })); setError(''); }
  function applyMock() {
    if (!english) return;
    setMock(true); setMode('full'); setMinutes('120'); setShuffle(false);
    setSelected(previous => [english, ...previous.filter(subject => subject !== english).slice(0, 3)]);
    setSettings(previous => Object.fromEntries(Object.entries(previous).map(([subject, value]) => [subject, { ...value, count: subject === english ? '60' : '40' }])));
  }
  function toggleSubject(subject: string) {
    if (mock && subject === english) return;
    if (mock && !selected.includes(subject) && selected.length >= 4) return;
    if (mock) update(subject, { count: subject === english ? '60' : '40' });
    setSelected(previous => previous.includes(subject) ? previous.filter(value => value !== subject) : [...previous, subject]);
  }
  function describe(subject: string) {
    const value = settings[subject];
    if (!value) return '';
    return [value.studyBy === 'paper' ? value.paper || value.year : 'Topic practice', value.topics === null ? 'All topics' : `${value.topics.length} topics`, `${counts[subject] || 0} questions`].join(' · ');
  }
  function back() { if (editing) setEditing(null); else if (step !== 'subjects') setStep(setupSteps[setupSteps.indexOf(step) - 1]); else app.back(); }
  async function start() {
    if (!app.user || !ready || starting.current || durationSeconds === null) return;
    starting.current = true; setBusy(true); setError('');
    try {
      const questions = buildSubjectSession(selected, bySubject, settings, shuffle, mode === 'practice' && unseenFirst ? seen : undefined);
      if (!questions.length) throw new Error('No questions selected. Choose a topic or another paper.');
      const attempt = await createAttempt(app.user.id, { title: bundle.title || bundle.name || selected.join(', '), source: { bundleId: String(bundle.id), version: bundle.updatedAt || null }, questions, assets: bundle.assets || {}, duration: durationSeconds, practice: mode === 'practice' });
      app.setAttempt(attempt);
      app.setAttempts([attempt, ...app.attempts]);
      app.go('exam');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not start this session. Please try again.'); starting.current = false; setBusy(false); }
  }
  const countsReady = selected.length > 0;
  return <Screen pad={false}>
    <TopBar left={<Pressable accessibilityLabel={editing ? 'Back to session setup' : step === 'subjects' ? 'Back to library' : 'Previous setup step'} onPress={back}><ArrowLeft color={colors.ink} size={20} /></Pressable>} right={<Wordmark />} />
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
      <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 14 }}>{environment.name}</Text>
      {subtitle ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text> : null}
      <TextButton label="Search & coverage" onPress={() => setFinder(true)} />
    </View>
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line }}>{setupSteps.map((value, index) => {
      const active = !editing && step === value;
      const done = !editing && setupSteps.indexOf(step) > index;
      return <Pressable key={value} accessibilityLabel={setupNames[value]} disabled={value !== 'subjects' && !selected.length} onPress={() => { setEditing(null); setStep(value); }} style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: active ? colors.accent : 'transparent', opacity: value !== 'subjects' && !selected.length ? 0.4 : 1 }}>
        <Text style={{ color: active ? colors.accent : colors.muted, fontFamily: 'Manrope_700Bold', fontSize: 12 }}>{done ? '✓ ' : `${index + 1} `}{setupNames[value]}</Text>
      </Pressable>;
    })}</View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      {isUtme && !bundle.revisionSet && <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <Pressable onPress={() => setMock(false)} style={{ flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: mock ? colors.control : colors.button }}><Text style={{ color: mock ? colors.muted : colors.onButton, fontFamily: 'Manrope_700Bold' }}>Custom</Text></Pressable>
        <Pressable disabled={!english} onPress={applyMock} style={{ flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: mock ? colors.button : colors.control, opacity: english ? 1 : 0.4 }}><Text style={{ color: mock ? colors.onButton : colors.muted, fontFamily: 'Manrope_700Bold' }}>UTME mock</Text></Pressable>
      </View>}
      {mock && <Muted>English 60 + three subjects of 40 · 120 minutes · 2026 format</Muted>}
      {mockError ? <Text style={{ color: colors.accent, marginTop: 8 }}>{mockError}</Text> : null}
      {editing && current ? <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}><Heading>{editing}</Heading><Text style={{ color: colors.muted }}>{counts[editing] || 0} questions</Text></View>
        {years.length > 0 && currentQuestions.some(question => !calendarYear(question)) && <View style={{ gap: 8 }}><Text style={{ color: colors.muted, fontSize: 12 }}>Study by</Text><View style={{ flexDirection: 'row', gap: 8 }}>{(['paper', 'topic'] as const).map(value => <Pressable key={value} onPress={() => update(editing, { studyBy: value, topics: null })} style={{ flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: current.studyBy === value ? colors.accent : colors.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{value === 'paper' ? 'Past paper' : 'Topic practice'}</Text></Pressable>)}</View></View>}
        {current.studyBy === 'paper' && years.length > 0 && <View style={{ gap: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Year</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{years.map(year => <Pressable key={year} onPress={() => { const available = subjectPapers(currentQuestions, year); update(editing, { year, paper: available.includes(year) ? year : available[0] || '', topics: null }); }} style={{ paddingHorizontal: 12, minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: current.year === year ? colors.accent : colors.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.ink }}>{year}</Text></Pressable>)}</View>
          {papers.length > 1 && <><Text style={{ color: colors.muted, fontSize: 12 }}>Paper</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{papers.map(paper => <Pressable key={paper} onPress={() => update(editing, { paper, topics: null })} style={{ paddingHorizontal: 12, minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: current.paper === paper ? colors.accent : colors.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.ink }}>{paper}</Text></Pressable>)}</View></>}
        </View>}
        {topics.length > 0 && <Pressable onPress={() => setTopicPicker(true)} style={{ minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1, color: colors.muted }}>{current.studyBy === 'topic' ? 'Topics / sections' : 'Topics'}</Text><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{current.topics === null ? 'All' : `${current.topics.length} selected`}</Text><ChevronRight color={colors.muted} size={18} /></Pressable>}
        <Text style={{ color: colors.muted, fontSize: 12 }}>Questions</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[10, 20, 30, 40, 50, 60, ...(!['10', '20', '30', '40', '50', '60', 'all'].includes(current.count) ? [Number(current.count)] : [])].map(value => <Pressable key={value} disabled={mock} onPress={() => update(editing, { count: String(value) })} style={{ paddingHorizontal: 12, minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: current.count === String(value) ? colors.accent : colors.line, alignItems: 'center', justifyContent: 'center', opacity: mock ? 0.4 : 1 }}><Text style={{ color: colors.ink }}>{value}</Text></Pressable>)}<Pressable disabled={mock} onPress={() => update(editing, { count: 'all' })} style={{ paddingHorizontal: 12, minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: current.count === 'all' ? colors.accent : colors.line, alignItems: 'center', justifyContent: 'center', opacity: mock ? 0.4 : 1 }}><Text style={{ color: colors.ink }}>{`All (${subjectPool(currentQuestions, current).length})`}</Text></Pressable></View>
        {counts[editing] === 0 && <Text style={{ color: colors.accent }}>No questions selected. Choose a topic or another paper.</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><BookOpen color={colors.muted} size={18} /><Text style={{ color: colors.muted, fontSize: 12 }}>{`${subjectPool(currentQuestions, current).length.toLocaleString()} available in this selection`}</Text></View>
      </View> : step === 'subjects' ? <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Heading>Your subjects.</Heading><Pressable onPress={() => { setSearch(''); setPicker(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}><Plus color={colors.accent} size={17} /><Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold' }}>{selected.length ? 'Change' : 'Choose subjects'}</Text></Pressable></View>
        {selected.length ? selected.map((subject, index) => <View key={subject} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Text style={{ color: colors.muted, width: 28 }}>{String(index + 1).padStart(2, '0')}</Text>
          <Pressable accessibilityLabel={`Edit ${subject}`} onPress={() => setEditing(subject)} style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{subject}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{describe(subject)}</Text></Pressable>
          <Pressable accessibilityLabel={`Edit ${subject} settings`} onPress={() => setEditing(subject)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Pencil color={colors.muted} size={17} /></Pressable>
          <Pressable accessibilityLabel={`Remove ${subject}`} disabled={mock && subject === english} onPress={() => toggleSubject(subject)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: mock && subject === english ? 0.35 : 1 }}><X color={colors.muted} size={16} /></Pressable>
        </View>) : <View style={{ alignItems: 'flex-start', marginTop: 24 }}><PrimaryButton label="Choose subjects" icon={<Plus color={colors.onButton} size={17} />} onPress={() => { setSearch(''); setPicker(true); }} /></View>}
      </View> : step === 'settings' ? <View style={{ gap: 16 }}>
        <Heading>Your pace.</Heading>
        <View style={{ flexDirection: 'row', gap: 10 }}>{(['practice', 'full'] as const).map(value => <Pressable key={value} onPress={() => { setMode(value); if (value === 'practice') setMock(false); if (mock && value === 'full') setMinutes('120'); else if (!durationEdited.current) setMinutes(value === 'practice' ? '20' : '60'); }} style={{ flex: 1, minHeight: 84, borderRadius: 8, borderWidth: 1, borderColor: mode === value ? colors.accent : colors.line, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.panel }}>
          {value === 'practice' ? <BookOpen color={colors.ink} size={22} /> : <Clock3 color={colors.ink} size={22} />}
          <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{value === 'practice' ? 'Practice' : 'Exam'}</Text>
          {mode === value && <Check color={colors.accent} size={16} />}
        </Pressable>)}</View>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Time limit</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: durationSeconds === null ? colors.accent : colors.line, borderRadius: 8, paddingHorizontal: 12 }}>
          <Clock3 color={colors.muted} size={17} />
          <TextInput accessibilityLabel="Time limit in minutes" value={minutes} editable={!mock} onChangeText={value => { durationEdited.current = true; setMinutes(value); }} keyboardType="decimal-pad" style={{ flex: 1, height: 46, color: colors.ink, fontFamily: 'Outfit_500Medium' }} />
          <Text style={{ color: colors.muted }}>min</Text>
        </View>
        {durationSeconds === null && <Text style={{ color: colors.accent }}>Enter a time greater than zero.</Text>}
        {mode === 'practice' && !bundle.revisionSet && <Pressable onPress={() => setUnseenFirst(value => !value)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}><Text style={{ color: colors.ink }}>Start with unseen questions</Text><Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold' }}>{unseenFirst ? 'On' : 'Off'}</Text></Pressable>}
        <Pressable onPress={() => setShuffle(value => !value)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}><Text style={{ color: colors.ink }}>Shuffle within each subject</Text><Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold' }}>{shuffle ? 'On' : 'Off'}</Text></Pressable>
      </View> : <View style={{ gap: 12 }}>
        <Heading>Ready when you are.</Heading>
        <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 42 }}>{count.toLocaleString()}</Text>
        <Muted>{`questions · ${minutes} min · ${mode === 'full' ? 'Exam' : 'Practice'}`}</Muted>
        {selected.map(subject => <Pressable key={subject} accessibilityLabel={`Revise ${subject}`} onPress={() => setEditing(subject)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}><View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{subject}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{describe(subject)}</Text></View><Pencil color={colors.muted} size={17} /></Pressable>)}
        <TextButton label="Change session settings" onPress={() => setStep('settings')} />
      </View>}
      {error ? <Text style={{ color: colors.accent, marginTop: 12 }}>{error}</Text> : null}
      {!editing && invalidSubject ? <Text style={{ color: colors.accent, marginTop: 8 }}>{`Choose questions for ${invalidSubject}.`}</Text> : null}
    </ScrollView>
    <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{`${count.toLocaleString()} questions`}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{`${selected.length} ${selected.length === 1 ? 'subject' : 'subjects'}`}</Text></View>
      {editing ? <PrimaryButton label="Done" icon={<Check color={colors.onButton} size={17} />} onPress={() => setEditing(null)} /> : <PrimaryButton label={busy ? 'Preparing…' : step === 'review' ? 'Start session' : 'Continue'} icon={<ArrowRight color={colors.onButton} size={18} />} disabled={busy || (step === 'review' ? !ready : !countsReady || step === 'settings' && durationSeconds === null)} onPress={() => step === 'review' ? void start() : setStep(setupSteps[setupSteps.indexOf(step) + 1])} />}
    </View>
    {(picker || topicPicker && editing && current) && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.backdrop, justifyContent: 'flex-end' }}>
      <View style={{ maxHeight: '80%', backgroundColor: colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 }}>
        <Heading>{picker ? 'Choose subjects' : `${editing} topics`}</Heading>
        {picker && <TextInput accessibilityLabel="Find a subject" value={search} onChangeText={setSearch} placeholder="Find a subject" placeholderTextColor={colors.faint} style={{ height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, color: colors.ink }} />}
        <ScrollView style={{ maxHeight: 360 }}>
          {topicPicker && current && <Pressable onPress={() => update(editing!, { topics: current.topics === null ? [] : null })} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}><Text style={{ flex: 1, color: colors.ink }}>All topics</Text><Text style={{ color: colors.accent }}>{current.topics === null ? 'On' : 'Off'}</Text></Pressable>}
          {picker && subjects.filter(subject => subject.toLowerCase().includes(search.trim().toLowerCase())).map(subject => {
            const locked = !bySubject[subject]?.length || Boolean(mock && (subject === english || !selected.includes(subject) && selected.length >= 4));
            return <Pressable key={subject} disabled={locked} onPress={() => toggleSubject(subject)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, opacity: locked ? 0.4 : 1 }}><Text style={{ flex: 1, color: colors.ink }}>{subject}</Text><Text style={{ color: colors.muted, marginRight: 10 }}>{(bySubject[subject]?.length || 0).toLocaleString()}</Text><Text style={{ color: colors.accent, width: 36 }}>{selected.includes(subject) ? 'On' : 'Off'}</Text></Pressable>;
          })}
          {topicPicker && current && topics.map(topic => <Pressable key={topic} onPress={() => { const values = current.topics === null ? [...topics] : current.topics; update(editing!, { topics: values.includes(topic) ? values.filter(value => value !== topic) : [...values, topic] }); }} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}><Text style={{ flex: 1, color: colors.ink }}>{topic}</Text><Text style={{ color: colors.accent }}>{current.topics === null || current.topics.includes(topic) ? 'On' : 'Off'}</Text></Pressable>)}
          {picker && !subjects.some(subject => subject.toLowerCase().includes(search.trim().toLowerCase())) && <Muted>No matching subjects.</Muted>}
        </ScrollView>
        <PrimaryButton label={picker && selected.length ? `Done · ${selected.length}` : 'Done'} icon={<Check color={colors.onButton} size={17} />} onPress={() => { setPicker(false); setTopicPicker(false); }} />
      </View>
    </View>}
    {finder && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.backdrop, justifyContent: 'flex-end' }}>
      <View style={{ maxHeight: '86%', backgroundColor: colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 }}>
        <Heading>{finderTab === 'search' ? 'Find a question' : 'Available content'}</Heading>
        <View style={{ flexDirection: 'row', gap: 8 }}>{(['search', 'coverage'] as const).map(tab => <Pressable key={tab} onPress={() => setFinderTab(tab)} style={{ flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: finderTab === tab ? colors.button : colors.control }}><Text style={{ color: finderTab === tab ? colors.onButton : colors.muted, fontFamily: 'Manrope_700Bold' }}>{tab === 'search' ? 'Search' : 'Coverage'}</Text></Pressable>)}</View>
        {finderTab === 'search' ? <>
          <TextInput accessibilityLabel="Search downloaded questions" value={finderQuery} onChangeText={setFinderQuery} placeholder="Question, topic or year" placeholderTextColor={colors.faint} style={{ height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, color: colors.ink }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}><Pressable onPress={() => setFinderSubject('')} style={{ paddingHorizontal: 12, minHeight: 36, borderRadius: 8, justifyContent: 'center', backgroundColor: finderSubject ? colors.control : colors.button }}><Text style={{ color: finderSubject ? colors.muted : colors.onButton }}>All subjects</Text></Pressable>{subjects.map(subject => <Pressable key={subject} onPress={() => setFinderSubject(subject)} style={{ paddingHorizontal: 12, minHeight: 36, borderRadius: 8, justifyContent: 'center', backgroundColor: finderSubject === subject ? colors.button : colors.control }}><Text style={{ color: finderSubject === subject ? colors.onButton : colors.muted }}>{subject}</Text></Pressable>)}</ScrollView>
          <ScrollView style={{ maxHeight: 320 }}>{(bundle.questions || []).filter((question: any) => (!finderSubject || question.subject === finderSubject) && (!finderQuery.trim() || [question.question, question.topic, question.section, question.year, ...(question.options || [])].join(' ').toLowerCase().includes(finderQuery.trim().toLowerCase()))).slice(0, 40).map((question: any, index: number) => <Pressable key={index} onPress={() => { app.setAttempt({ id: `search-${index}`, owner: app.user?.id || '', title: bundle.title || 'Question', status: 'completed', source: { bundleId: String(bundle.id), version: bundle.updatedAt || null }, questions: [question], assets: bundle.assets || {}, answers: [null], writtenAnswers: [], flagged: [false], currentQ: 0, duration: 60, deadline: Date.now(), practice: true, updatedAt: new Date().toISOString() }); setFinder(false); app.go('review-answers'); }} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}><Text style={{ color: colors.muted, fontSize: 12 }}>{[question.subject, question.year, topicOf(question)].filter(Boolean).join(' · ')}</Text><Text style={{ color: colors.ink }} numberOfLines={2}>{String(question.question || 'View diagram').replace(/\[Illustration\]/gi, '').trim()}</Text></Pressable>)}</ScrollView>
        </> : <ScrollView style={{ maxHeight: 360 }}>{subjects.map(name => {
          const pool = ((bundle.questions || []) as CbtQuestion[]).filter(question => question.subject === name);
          const covered = [...new Set(pool.map(question => topicOf(question)).filter(Boolean))] as string[];
          return <View key={name} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 4 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{name}</Text><Muted>{`${pool.length.toLocaleString()} questions`}</Muted><Text style={{ color: colors.muted, fontSize: 12 }}>{subjectYears(pool).join(' · ') || 'Topic collection'}</Text>{covered.length > 0 && <Text style={{ color: colors.soft, fontSize: 12 }}>{covered.slice(0, 8).join(' · ')}</Text>}</View>;
        })}<Muted>Coverage reflects this download. A collection’s edition is not a guarantee that it includes the latest examination paper.</Muted></ScrollView>}
        <TextButton label="Close" onPress={() => setFinder(false)} />
      </View>
    </View>}
  </Screen>;
}

export function ExamScreen({ review = false }: { review?: boolean }) {
  const { colors } = useTheme();
  const app = useApp();
  const attempt = app.attempt;
  const [index, setIndex] = useState(attempt?.currentQ || 0);
  const [answers, setAnswers] = useState<(number | null)[]>(attempt?.answers || []);
  const [written, setWritten] = useState<string[]>(attempt?.writtenAnswers || []);
  const [flagged, setFlagged] = useState<boolean[]>(attempt?.flagged || []);
  const [left, setLeft] = useState(attempt ? Math.max(0, Math.ceil((attempt.deadline - Date.now()) / 1000)) : 0);
  const [confirm, setConfirm] = useState(false);
  const [grid, setGrid] = useState(false);
  const [scale, setScale] = useState(1);
  const [calculator, setCalculator] = useState(false);
  const [board, setBoard] = useState(false);
  const [report, setReport] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'incorrect' | 'skipped' | 'saved'>('all');
  const [picked, setPicked] = useState<number[]>([]);
  const saving = useRef(false);
  const questions = attempt?.questions || [];
  const question = questions[index];
  useEffect(() => {
    if (review || !attempt || attempt.status !== 'active') return;
    const timer = setInterval(() => setLeft(Math.max(0, Math.ceil((attempt.deadline - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [attempt?.id, review]);
  useEffect(() => {
    if (review || !attempt || left !== 0 || attempt.status !== 'active') return;
    void finish();
  }, [left]);
  useEffect(() => {
    if (review || !attempt) return;
    const timer = setTimeout(() => { void saveCheckpoint({ ...attempt, answers, writtenAnswers: written, flagged, currentQ: index }, { answers, writtenAnswers: written, flagged, currentQ: index }).then(app.setAttempt); }, 400);
    return () => clearTimeout(timer);
  }, [answers, written, flagged, index]);
  if (!attempt || !question) return <Missing title="Open your unfinished exam from Past sessions." />;
  const key = answerIndex(question);
  const clock = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  const groups = new Map<string, number[]>();
  questions.forEach((item, itemIndex) => { const list = groups.get(item.subject) || []; list.push(itemIndex); groups.set(item.subject, list); });
  const subjectNames = [...groups.keys()];
  const subjectIndexes = groups.get(question.subject) || [index];
  const visibleIndexes = questions.flatMap((item, itemIndex) => {
    const answerKey = answerIndex(item);
    const answer = answers[itemIndex];
    const saved = app.bookmarks.some(row => row.key === bookmarkIdentity(attempt.source, item));
    const show = !review || reviewFilter === 'all' || (reviewFilter === 'incorrect' && answerKey !== null && answer != null && answer !== answerKey) || (reviewFilter === 'skipped' && answer == null) || (reviewFilter === 'saved' && saved);
    return show ? [itemIndex] : [];
  });
  const place = Math.max(0, visibleIndexes.indexOf(index));
  const figures = (question.figures || []).filter((figure: { url?: string }) => figure?.url);
  function stepQuestion(direction: -1 | 1) {
    const next = visibleIndexes[place + direction];
    if (next != null) setIndex(next);
  }
  async function finish() {
    if (saving.current || !app.user || review) return;
    saving.current = true;
    try {
      const completed = await completeAttempt(attempt!, { answers, writtenAnswers: written, flagged, currentQ: index });
      app.setAttempt(completed);
      const summary = { id: completed.id, title: completed.title, score: completed.score || 0, total_questions: completed.questions.length, graded_total: completed.questions.filter(item => answerIndex(item) !== null).length, completed_at: completed.completedAt!, source_bundle_id: completed.source.bundleId, source_bundle_version: completed.source.version, answered_count: answers.filter(item => item !== null).length, duration_seconds: completed.timeTaken || 0, pending: true };
      const history = await rememberPractice(app.user.id, summary);
      app.setSessions(history);
      void syncPracticeHistory(app.user.id).then(items => { if (items) app.setSessions(items); }).catch(() => undefined);
      app.replace('results');
    } catch (err) { app.setNotice(err instanceof Error ? err.message : 'Your result could not be saved.'); saving.current = false; }
  }
  async function toggleBookmark() {
    if (!app.user) return;
    const id = bookmarkIdentity(attempt!.source, question);
    const existing = app.bookmarks.some(row => row.key === id);
    const next = existing ? app.bookmarks.filter(row => row.key !== id) : [{ key: id, owner: app.user.id, title: attempt!.title, source: attempt!.source, question, answer: answers[index] ?? null, createdAt: new Date().toISOString() }, ...app.bookmarks];
    app.setBookmarks(next);
    await writeBookmarks(app.user.id, next);
  }
  return <Screen pad={false}>
    <View style={{ backgroundColor: colors.examHeader, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable accessibilityLabel="Back" onPress={() => review ? app.back() : setConfirm(true)}><ArrowLeft color={colors.muted} size={20} /></Pressable>
      <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{review ? 'Review' : clock}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityLabel="Decrease question text" disabled={scale <= 0.9} onPress={() => setScale(value => Math.max(0.9, Number((value - 0.1).toFixed(1))))}><Text style={{ color: colors.muted }}>A−</Text></Pressable>
        <Pressable accessibilityLabel="Increase question text" disabled={scale >= 1.4} onPress={() => setScale(value => Math.min(1.4, Number((value + 0.1).toFixed(1))))}><Text style={{ color: colors.ink, fontSize: 18 }}>A+</Text></Pressable>
        <Pressable accessibilityLabel="Question list" onPress={() => setGrid(true)}><Text style={{ color: colors.accent }}>{subjectIndexes.indexOf(index) + 1}/{subjectIndexes.length}</Text></Pressable>
      </View>
    </View>
    {subjectNames.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}>{subjectNames.map(name => <Pressable key={name} onPress={() => setIndex(groups.get(name)![0])} style={{ paddingHorizontal: 12, minHeight: 36, borderRadius: 8, justifyContent: 'center', backgroundColor: name === question.subject ? colors.button : colors.control }}><Text style={{ color: name === question.subject ? colors.onButton : colors.muted }}>{name}</Text></Pressable>)}</ScrollView>}
    {review && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>{(['all', 'incorrect', 'skipped', 'saved'] as const).map(filter => <Pressable key={filter} onPress={() => { setReviewFilter(filter); }} style={{ paddingHorizontal: 12, minHeight: 36, borderRadius: 8, justifyContent: 'center', backgroundColor: reviewFilter === filter ? colors.button : colors.control }}><Text style={{ color: reviewFilter === filter ? colors.onButton : colors.muted, textTransform: 'capitalize' }}>{filter}</Text></Pressable>)}</ScrollView>}
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
      {!visibleIndexes.includes(index) ? <View style={{ gap: 12 }}><Heading>No questions in this view.</Heading><TextButton label="Show all questions" onPress={() => setReviewFilter('all')} /></View> : <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{question.subject}</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {review && <Pressable accessibilityLabel={picked.includes(index) ? 'Remove from practice selection' : 'Add to practice selection'} onPress={() => setPicked(previous => previous.includes(index) ? previous.filter(item => item !== index) : [...previous, index])}><Text style={{ color: colors.accent }}>{picked.includes(index) ? 'Selected' : 'Select'}</Text></Pressable>}
          <Pressable accessibilityLabel="Report a question issue" onPress={() => setReport(true)}><Text style={{ color: colors.muted }}>Report</Text></Pressable>
          <Pressable accessibilityLabel="Flag question" onPress={() => { if (review) return; setFlagged(previous => previous.map((value, item) => item === index ? !value : value)); }}><Flag color={flagged[index] ? colors.accent : colors.muted} size={18} /></Pressable>
        </View>
      </View>
      {question.passage ? <Text style={{ color: colors.soft, marginBottom: 12, fontSize: 15 * scale, lineHeight: 22 * scale }}>{question.passage}</Text> : null}
      {figures.map((figure: { url: string }, figureIndex: number) => <Image key={figureIndex} accessibilityIgnoresInvertColors source={{ uri: figure.url }} style={{ width: '100%', height: 180, marginBottom: 12, borderRadius: 8 }} resizeMode="contain" />)}
      <Text style={{ color: colors.ink, fontFamily: 'Outfit_400Regular', fontSize: 16 * scale, lineHeight: 24 * scale }}>{questionText(question)}</Text>
      {question.type === 'theory' || question.type === 'short_answer' ? <TextInput multiline value={written[index] || ''} editable={!review} onChangeText={text => setWritten(previous => { const next = [...previous]; next[index] = text; return next; })} placeholder="Write your answer" placeholderTextColor={colors.faint} style={{ marginTop: 16, minHeight: 140, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink, textAlignVertical: 'top' }} /> : (question.options || []).map((option: string, optionIndex: number) => {
        const chosen = answers[index] === optionIndex;
        const reveal = review && key === optionIndex;
        return <Pressable key={optionIndex} disabled={review} onPress={() => setAnswers(previous => previous.map((value, item) => item === index ? optionIndex : value))} style={{ marginTop: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: reveal || chosen ? colors.accent : colors.line, backgroundColor: chosen ? colors.control : colors.panel }}>
          <Text style={{ color: colors.ink }}>{String.fromCharCode(65 + optionIndex)}. {optionText(option, question.optionsHtml?.[optionIndex])}</Text>
        </Pressable>;
      })}
      {review && <Card style={{ marginTop: 16 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>Explanation</Text><Text style={{ color: colors.soft, marginTop: 6 }}>{questionText({ question: question.explanation, questionHtml: question.explanationHtml }) || 'No explanation was saved for this question.'}</Text></Card>}
      <TextButton label="Save question" onPress={() => void toggleBookmark()} />
      </>}
    </ScrollView>
    <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 8 }}>
      <TextButton label="Calculate" onPress={() => { setBoard(false); setCalculator(value => !value); }} />
      <TextButton label="Work out" onPress={() => { setCalculator(false); setBoard(value => !value); }} />
      {subjectNames.length > 1 && <TextButton label="Next subject" onPress={() => { const next = subjectNames[(subjectNames.indexOf(question.subject) + 1) % subjectNames.length]; setIndex(groups.get(next)![0]); }} />}
      {review && picked.length > 0 && <TextButton label={`Practise · ${picked.length}`} onPress={() => { app.setBundle({ id: attempt.source.bundleId, title: 'Selected questions', questions: picked.map(item => questions[item]), assets: attempt.assets, revisionSet: true }); app.go('customize-cbt'); }} />}
    </View>
    <View style={{ flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flex: 1 }}><PrimaryButton label="Previous" disabled={place <= 0} onPress={() => stepQuestion(-1)} /></View>
      <View style={{ flex: 1 }}>{place < visibleIndexes.length - 1 ? <PrimaryButton label="Next" onPress={() => stepQuestion(1)} /> : review ? <PrimaryButton label="Done" onPress={() => app.back()} /> : <PrimaryButton label="Finish" onPress={() => setConfirm(true)} />}</View>
    </View>
    {calculator && <CalculatorSheet onClose={() => setCalculator(false)} />}
    {board && <DrawingBoard question={index} onClose={() => setBoard(false)} />}
    {report && app.user && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.backdrop, justifyContent: 'flex-end' }}><ReportSheet owner={app.user.id} source={attempt.source} question={question} onClose={() => setReport(false)} /></View>}
    {(confirm || grid) && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.backdrop, justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 }}>
        {confirm ? <>
          <Heading>Submit this session?</Heading>
          <Muted>{`${answers.filter(item => item !== null).length} of ${questions.length} answered.`}</Muted>
          <PrimaryButton label="Submit" onPress={() => void finish()} />
          <TextButton label="Keep going" onPress={() => setConfirm(false)} />
        </> : <>
          <Heading>Questions</Heading>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{questions.map((_, item) => <Pressable key={item} onPress={() => { setIndex(item); setGrid(false); }} style={{ width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: item === index ? colors.button : answers[item] != null ? colors.done : colors.control }}><Text style={{ color: item === index ? colors.onButton : colors.ink }}>{item + 1}</Text></Pressable>)}</View>
          <TextButton label="Close" onPress={() => setGrid(false)} />
        </>}
      </View>
    </View>}
  </Screen>;
}

export function ResultsScreen() {
  const { colors } = useTheme();
  const app = useApp();
  const attempt = app.attempt;
  if (!attempt) return <Missing title="Result unavailable" />;
  const summary = sessionSummary(attempt.questions, attempt.answers);
  return <Screen>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ alignItems: 'center' }}><Scholar state={summary.percent !== null && summary.percent >= 70 ? 'celebrate' : 'study'} /></View>
      <Wordmark />
      <Heading>{summary.percent === null ? 'Session complete.' : summary.percent >= 70 ? 'Good pass.' : 'Session complete.'}</Heading>
      <Text style={{ color: colors.ink, fontFamily: 'Manrope_800ExtraBold', fontSize: 56 }}>{summary.percent === null ? '—' : `${summary.percent}%`}</Text>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.control, overflow: 'hidden' }}><View style={{ width: `${summary.percent || 0}%`, height: 8, backgroundColor: colors.accent }} /></View>
      {[...new Set(attempt.questions.map(question => question.subject))].map(subject => {
        const rows = attempt.questions.map((question, index) => ({ question, answer: attempt.answers[index] })).filter(row => row.question.subject === subject && answerIndex(row.question) !== null);
        const correct = rows.filter(row => row.answer === answerIndex(row.question)).length;
        const percent = rows.length ? Math.round(correct / rows.length * 100) : 0;
        return <View key={subject} style={{ gap: 4 }}><Text style={{ color: colors.ink }}>{subject} · {percent}%</Text><View style={{ height: 6, borderRadius: 3, backgroundColor: colors.control }}><View style={{ width: `${percent}%`, height: 6, borderRadius: 3, backgroundColor: colors.done }} /></View></View>;
      })}
      <Muted>{`${summary.correct} correct · ${summary.incorrect} to revisit · ${summary.skipped} unanswered`}</Muted>
      <Muted>{`Time ${Math.floor((attempt.timeTaken || 0) / 60)}m ${(attempt.timeTaken || 0) % 60}s`}</Muted>
      <PrimaryButton label="Review answers" onPress={() => app.go('review-answers')} />
      <TextButton label="Practice missed questions" onPress={() => {
        const missed = attempt.questions.filter((question, index) => answerIndex(question) !== null && attempt.answers[index] !== answerIndex(question));
        if (!missed.length) return;
        app.setBundle({ id: attempt.source.bundleId, title: 'Questions to revisit', questions: missed, assets: attempt.assets, revisionSet: true });
        app.go('customize-cbt');
      }} />
      <TextButton label="Back to library" onPress={() => { app.setTab('library'); }} />
    </ScrollView>
  </Screen>;
}

function Missing({ title }: { title: string }) {
  const app = useApp();
  return <Screen><View style={{ padding: 24, gap: 16 }}><Heading>{title}</Heading><PrimaryButton label="Back" onPress={() => app.back()} /></View></Screen>;
}
