import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { ArrowLeft, ArrowRight, Bell, BookOpen, Bookmark, ChevronRight, Compass, Database, Download, History, KeyRound, MessageSquareWarning, Monitor, Moon, Plus, Sun, Upload } from 'lucide-react-native';
import { examArtwork } from '../domain/examArtwork';
import { environmentFor, publisherName, savedEnvironments } from '../domain/preparation';
import { papersForHome, topicSuggestion } from '../domain/homeLibrary';
import { gradedPercent, studyPlan } from '../domain/studyPlan';
import { getReminders, getSavedMaterial, type ReminderSnapshot } from '../services/account';
import { useApp } from '../state/AppState';
import { useTheme } from '../theme/Theme';
import { ExamMark } from '../ui/ExamMark';
import { Scholar } from '../ui/Scholar';
import { BottomNav, Card, Heading, Muted, PrimaryButton, Screen, SearchField, TextButton, TopBar, Wordmark } from '../ui/ui';
import { getOfflineBundle, saveBundle, type CatalogManufacturer, type CatalogExamType, type CatalogUniversity, type LibraryCatalog } from '../services/library';

export function MainScreen() {
  const app = useApp();
  return <Screen pad={false}>
    <View style={{ flex: 1 }}>
      {app.tab === 'home' && <Home />}
      {app.tab === 'library' && <Library />}
      {app.tab === 'lead' && <DiscoverTab />}
      {app.tab === 'preference' && <PreferencesTab />}
    </View>
    <BottomNav tab={app.tab} onTab={app.setTab} onSnap={() => app.go('snap')} />
  </Screen>;
}

function Home() {
  const { colors } = useTheme();
  const app = useApp();
  const name = app.user?.user_metadata?.full_name || app.user?.email?.split('@')[0] || 'there';
  const first = String(name).split(/\s+/)[0] || 'there';
  const focused = app.preparation.enabled ? app.offlineLibrary.filter(item => environmentFor(item).id === app.preparation.activeEnvironment) : [];
  const materials = focused.length ? focused : app.offlineLibrary;
  const papers = papersForHome(materials, app.sessions, app.globalLibrary);
  const readyPapers = papers.filter(item => item.questions?.length);
  const plan = studyPlan(readyPapers, app.sessions);
  const suggestion = topicSuggestion(readyPapers, app.attempts);
  const featured = suggestion?.material || plan.material || papers[0] || null;
  const featuredCount = featured ? (featured.questions?.length || featured.questionCount || featured.question_count || 0) : 0;
  const featuredReady = Boolean(featured?.questions?.length);
  const lastScore = featured && featured.id === plan.material?.id ? plan.percent : null;
  const ongoing = app.attempts.find(item => item.status === 'active');
  const scores = app.sessions.map(gradedPercent).filter((value): value is number => value !== null);
  const average = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
  const waiting = app.libraryStatus === 'loading' && !featured;
  const failed = app.libraryStatus === 'error' && !featured;
  const room = focused.length ? environmentFor(focused[0]).name : examLabel(app.catalog, featured?.id) || 'Your study room';
  return <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
    <TopBar left={<Wordmark />} right={<Text style={{ color: colors.muted, fontFamily: 'Outfit_400Regular', fontSize: 12 }}>{room}</Text>} />
    <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
      <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 31, letterSpacing: -1.7, marginBottom: 22 }}>{`Hi, ${first}.`}</Text>
      {ongoing && <Card><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{ongoing.title}</Text><Muted>{`${ongoing.answers.filter(answer => answer !== null).length} of ${ongoing.questions.length} answered`}</Muted><View style={{ marginTop: 14, alignSelf: 'flex-start' }}><PrimaryButton label="Resume" onPress={() => { app.setAttempt(ongoing); app.setBundle({ id: ongoing.source.bundleId, title: ongoing.title, questions: ongoing.questions, assets: ongoing.assets }); app.go('exam'); }} /></View></Card>}
      {waiting ? <ActivityIndicator color={colors.accent} /> : null}
      {failed ? <Card><Muted>Your study room could not load.</Muted><View style={{ marginTop: 12 }}><TextButton label="Try again" onPress={() => void app.refreshLibrary()} /></View></Card> : null}
      {featured ? <>
        <Card style={{ paddingVertical: 24, paddingHorizontal: 20, minHeight: 240 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{suggestion ? 'A topic to revisit' : featuredReady ? plan.reason : 'Saved to your account'}</Text>
              <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 25, lineHeight: 30, letterSpacing: -1, marginTop: 12, marginBottom: 16 }}>{suggestion?.topic || featured.title || featured.name || 'Your saved paper'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {suggestion ? <Text style={{ color: colors.muted, fontSize: 11 }}>{`${suggestion.subject} · ${suggestion.material.title || suggestion.material.name || ''}`}</Text> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Download color={colors.muted} size={14} /><Text style={{ color: colors.muted, fontSize: 11 }}>{featuredReady ? 'Ready offline' : 'Download to practice'}</Text></View>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{`${featuredCount} questions`}</Text>
                {!suggestion && lastScore !== null && <Text style={{ color: colors.muted, fontSize: 11 }}>{`Last score ${lastScore}%`}</Text>}
              </View>
              <View style={{ marginTop: 24, alignSelf: 'flex-start' }}><PrimaryButton label={featuredReady ? 'Practice' : 'Download'} icon={<ArrowRight color={colors.onButton} size={17} />} onPress={() => void openInstalled(app, featured, suggestion ? { subject: suggestion.subject, topic: suggestion.topic, year: suggestion.year, paper: suggestion.paper } : undefined)} /></View>
            </View>
            <Scholar state={plan.percent !== null && plan.percent < 75 ? 'encourage' : 'study'} width={110} height={119} />
          </View>
        </Card>
        {app.sessions.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 20 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold' }}>{app.sessions.length}</Text> {app.sessions.length === 1 ? 'session' : 'sessions'} completed</Text>
          {average !== null && <Text style={{ color: colors.muted, fontSize: 12 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold' }}>{average}%</Text> average</Text>}
        </View>}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 }}>
          <Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold', fontSize: 16 }}>{featuredReady ? 'On your device' : 'Your papers'}</Text>
          <Pressable accessibilityRole="button" onPress={() => app.setTab('library')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
            <Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold', fontSize: 12 }}>Library</Text>
            <ArrowRight color={colors.accent} size={15} />
          </Pressable>
        </View>
        {papers.slice(0, 3).map(material => {
          const count = material.questions?.length || material.questionCount || material.question_count || 0;
          return <Paper key={material.id} title={material.title || material.name || 'Saved paper'} detail={`${count} questions`} onPress={() => void openInstalled(app, material)} identity={material} />;
        })}
        <HomeLink icon={<BookOpen color={colors.ink} size={22} />} label="Find another paper" onPress={() => app.setTab('library')} />
        <HomeLink icon={<Upload color={colors.ink} size={22} />} label="Add material" onPress={() => app.go('snap')} />
      </> : !waiting && !failed ? <>
        {app.sessions.length > 0 ? <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold' }}>{app.sessions.length}</Text> {app.sessions.length === 1 ? 'session' : 'sessions'} completed</Text>
            {average !== null && <Text style={{ color: colors.muted, fontSize: 12 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold' }}>{average}%</Text> average</Text>}
          </View>
          <PrimaryButton label="Find a paper" icon={<ArrowRight color={colors.onButton} size={17} />} onPress={() => app.setTab('library')} />
        </View> : <Card>
        <Scholar state="encourage" width={140} height={152} />
        <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 25, marginVertical: 16 }}>Your first paper.</Text>
        <PrimaryButton label="Find a paper" icon={<ArrowRight color={colors.onButton} size={17} />} onPress={() => app.setTab('library')} />
        <View style={{ marginTop: 8 }}><TextButton label="Add your own material" onPress={() => app.go('snap')} /></View>
      </Card>}
      </> : null}
      {failed && app.sessions.length > 0 ? <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold' }}>{app.sessions.length}</Text> {app.sessions.length === 1 ? 'session' : 'sessions'} completed</Text>
        {average !== null && <Text style={{ color: colors.muted, fontSize: 12 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold' }}>{average}%</Text> average</Text>}
      </View> : null}
    </View>
  </ScrollView>;
}

function Library() {
  const { colors } = useTheme();
  const app = useApp();
  const [exploring, setExploring] = useState(false);
  const [showList, setShowList] = useState(false);
  const [search, setSearch] = useState('');
  const saved = app.offlineLibrary.filter(item => item?.questions?.length).map(item => decorateMaterial(item, app.catalog));
  const environments = savedEnvironments(saved);
  const needle = search.trim().toLowerCase();
  const stored = environments.find(item => item.id === app.preparation.activeEnvironment);
  const active = showList ? null : stored || (environments.length === 1 ? environments[0] : null);
  const matches = (material: any) => [material.title, material.name, publisherName(material), ...new Set((material.questions || []).map((question: any) => question.subject))].filter(Boolean).some(value => String(value).toLowerCase().includes(needle));
  const materials = active?.materials.filter(matches) || [];
  const visible = environments.filter(environment => !needle || `${environment.name} ${environment.organization}`.toLowerCase().includes(needle) || environment.materials.some(matches));
  if (exploring) return <BrowseLibrary onBack={() => { setExploring(false); setSearch(''); }} />;
  return <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
    <View style={{ minHeight: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {active ? <Pressable accessibilityRole="button" onPress={() => { setShowList(true); setSearch(''); void app.setPreparation({ ...app.preparation, activeEnvironment: null }); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
        <ArrowLeft color={colors.accent} size={17} /><Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold', fontSize: 14 }}>Your exams</Text>
      </Pressable> : <Wordmark />}
      <Pressable accessibilityRole="button" onPress={() => setExploring(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}>
        <Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold', fontSize: 14 }}>Find more</Text><Plus color={colors.accent} size={17} />
      </Pressable>
    </View>
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Download color={colors.muted} size={14} /><Text style={{ color: colors.muted, fontSize: 11 }}>On your device</Text></View>
      <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 32, lineHeight: 38, letterSpacing: -1.1, marginVertical: 12 }}>{active?.name || 'Your study spaces.'}</Text>
      {active?.organization ? <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>{active.organization}</Text> : null}
      <View style={{ marginTop: 14, marginBottom: 8 }}>
        <SearchField value={search} onChangeText={setSearch} placeholder={active ? 'Find a publisher or subject' : 'Find an exam or material'} />
      </View>
      {active ? materials.map(material => <Pressable key={material.id} accessibilityRole="button" onPress={() => void openInstalled(app, material)} style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <View style={{ width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}><ExamMark identity={material} /></View>
        <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold', fontSize: 16 }}>{publisherName(material)}</Text><Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{`${material.title || material.name} · ${material.questions.length.toLocaleString()} ${material.questions.length === 1 ? 'question' : 'questions'}`}</Text></View>
        <ArrowRight color={colors.muted} size={19} />
      </Pressable>) : visible.map(environment => <Pressable key={environment.id} accessibilityRole="button" onPress={() => { setShowList(false); setSearch(''); void app.setPreparation({ ...app.preparation, activeEnvironment: environment.id }); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 18, padding: 22, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel }}>
        <ExamMark identity={environment} />
        <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 22 }}>{environment.name}</Text>{environment.organization ? <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>{environment.organization}</Text> : null}<Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>{`${environment.materials.length} saved ${environment.materials.length === 1 ? 'collection' : 'collections'}`}</Text></View>
        <ArrowRight color={colors.accent} size={19} />
      </Pressable>)}
      {active && !materials.length ? <Muted>{needle ? 'No matching saved materials.' : 'No saved materials in this exam.'}</Muted> : null}
      {!environments.length ? <View style={{ alignItems: 'center', gap: 16, paddingVertical: 36 }}>
        <BookOpen color={colors.muted} size={30} strokeWidth={1.3} />
        <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 22 }}>No saved exams yet.</Text>
        <PrimaryButton label="Find an exam" icon={<ArrowRight color={colors.onButton} size={17} />} onPress={() => setExploring(true)} />
      </View> : null}
      {!active && environments.length > 0 && !visible.length ? <Muted>No matching downloaded exams.</Muted> : null}
      {environments.length > 0 ? <Pressable accessibilityRole="button" onPress={() => app.go('snap')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, minHeight: 44 }}>
        <Upload color={colors.accent} size={17} /><Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold', fontSize: 12 }}>Add your own material</Text>
      </Pressable> : <TextButton label="Add material" onPress={() => app.go('snap')} />}
    </View>
  </ScrollView>;
}

function BrowseLibrary({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const app = useApp();
  const [tab, setTab] = useState<'browse' | 'flat' | 'downloaded'>('browse');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const needle = search.trim().toLowerCase();
  const organizations = (app.catalog?.organizations?.length ? app.catalog.organizations : app.catalog?.universities || []).filter(org => !['general', 'unknown', 'misc'].includes(org.name.trim().toLowerCase()));
  const org = organizations.find(item => item.id === orgId);
  const items = (tab === 'downloaded' ? app.offlineLibrary : app.globalLibrary).filter(item => (item.title || item.name || '').toLowerCase().includes(needle));
  return <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
    <View style={{ paddingHorizontal: 20, paddingTop: 12 }}><Pressable accessibilityRole="button" onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}><ArrowLeft color={colors.accent} size={17} /><Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold', fontSize: 12 }}>Your downloaded exams</Text></Pressable></View>
    <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 14 }}>
      <Heading>Browse</Heading>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search a school, subject or test" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[['browse', 'Explore'], ['flat', 'All materials'], ['downloaded', 'Saved']].map(([id, label]) => <Pressable key={id} onPress={() => setTab(id as typeof tab)} style={{ paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: tab === id ? 2 : 0, borderBottomColor: colors.accent }}>
          <Text style={{ color: tab === id ? colors.accent : colors.muted, fontFamily: 'Manrope_700Bold', fontSize: 13 }}>{label}</Text>
        </Pressable>)}
      </View>
      {app.libraryStatus === 'loading' && !organizations.length && tab !== 'downloaded' ? <ActivityIndicator color={colors.accent} /> : null}
      {app.libraryStatus === 'error' && tab !== 'downloaded' ? <View><Muted>Your library couldn’t load.</Muted><TextButton label="Try again" onPress={() => void app.refreshLibrary()} /></View> : null}
      {tab === 'browse' && !org && ['Schools & universities', 'Tests & qualifications', 'Professional study', 'Other materials'].map(title => <Pressable key={title} onPress={() => setCategory(category === title ? null : title)} style={{ padding: 16, borderRadius: 12, borderWidth: 1, borderColor: category === title ? colors.accent : colors.line, backgroundColor: colors.panel }}>
        <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{title}</Text>
        {category === title && organizations.filter(item => matchesCategory(item.type, title) && (!needle || item.name.toLowerCase().includes(needle) || item.examTypes.some(exam => exam.name.toLowerCase().includes(needle)))).map(item => <Pressable key={item.id} onPress={() => setOrgId(item.id)} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 8 }}>
          <Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold' }}>{item.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{item.examTypes.length} collections</Text>
        </Pressable>)}
      </Pressable>)}
      {tab === 'browse' && org && <View>
        <TextButton label="All organisations" onPress={() => setOrgId(null)} />
        <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 22, marginVertical: 8 }}>{org.name}</Text>
        {org.examTypes.map(exam => <View key={exam.id} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.muted, marginBottom: 6 }}>{exam.name}</Text>
          {(exam.materials || exam.manufacturers || []).filter(material => !needle || `${material.title || ''} ${material.name}`.toLowerCase().includes(needle)).map(material => <Paper key={material.bundleId || material.id} title={material.title || material.name} detail={`${material.questionCount || 0} questions`} onPress={() => void choose(app, material, exam, org)} />)}
        </View>)}
      </View>}
      {tab !== 'browse' && items.map(item => {
        const savedCopy = app.offlineLibrary.find(savedItem => savedItem.id === item.id);
        const ready = Boolean((tab === 'downloaded' ? item : savedCopy)?.questions?.length);
        const count = item.questions?.length || savedCopy?.questions?.length || item.questionCount || item.question_count || 0;
        return <Pressable key={item.id} accessibilityRole="button" onPress={() => void openInstalled(app, ready ? (savedCopy || item) : item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <ExamMark identity={item} />
          <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{item.title || item.name}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{`${count} questions`}</Text></View>
          {ready ? <Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold' }}>Start</Text> : <Download color={colors.accent} size={20} />}
        </Pressable>;
      })}
      {tab !== 'browse' && !items.length ? <Muted>{tab === 'downloaded' ? 'No saved materials yet.' : 'No materials here yet.'}</Muted> : null}
    </View>
  </ScrollView>;
}

function matchesCategory(type: string | undefined, title: string) {
  const institution = ['university', 'polytechnic', 'college', 'school'].includes(type || '');
  if (title.startsWith('Schools')) return institution;
  if (title.startsWith('Tests')) return type === 'exam_board';
  if (title.startsWith('Professional')) return type === 'professional_body';
  return !institution && type !== 'exam_board' && type !== 'professional_body';
}

async function choose(app: ReturnType<typeof useApp>, material: CatalogManufacturer, exam: CatalogExamType, org: CatalogUniversity) {
  const cached = await getOfflineBundle(material.bundleId, app.user?.id);
  if (!cached?.questions?.length) { app.setDownloadId(material.bundleId); app.go('downloads'); return; }
  app.setBundle({ ...cached, examType: exam.name, university: org.name, manufacturer: material.name });
  app.go('customize-cbt');
}

async function openInstalled(app: ReturnType<typeof useApp>, material: any, suggestion?: { subject: string; topic: string; year?: string; paper?: string }) {
  app.setNotice('');
  const cached = material?.id ? await getOfflineBundle(material.id, app.user?.id) : null;
  const local = cached?.questions?.length ? cached : material?.questions?.length ? material : null;
  if (local?.questions?.length) {
    app.setBundle(suggestion ? { ...local, suggestion } : local);
    app.go('customize-cbt');
    return;
  }
  if (material?.sourceSessionId) {
    try {
      const full = await getSavedMaterial(material.sourceSessionId);
      const saved = await saveBundle({ ...full, ownerId: app.user?.id }, app.user?.id);
      if (!saved.questions?.length) { app.setNotice('This saved material has no questions yet.'); return; }
      app.setBundle(saved);
      await app.reloadLocal();
      app.go('customize-cbt');
    } catch (err) {
      app.setNotice(err instanceof Error ? err.message : 'Could not open this material.');
    }
    return;
  }
  if (material?.id || material?.bundleId) {
    app.setDownloadId(material.bundleId || material.id);
    app.go('downloads');
    return;
  }
  app.setNotice('This material could not be opened.');
}

function DiscoverTab() {
  return <DiscoverBody />;
}

function DiscoverBody() {
  const { colors } = useTheme();
  const app = useApp();
  const [rows, setRows] = useState<{ sessions: any[]; joined: any[] }>({ sessions: [], joined: [] });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void import('../services/account').then(({ getDiscover }) => getDiscover().then(value => { if (active) setRows(value); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); }));
    return () => { active = false; };
  }, [app.user?.id]);
  const list = (filter === 'joined' ? rows.joined : rows.sessions).filter((item: any) => (filter === 'all' || filter === 'joined' || item.kind === filter) && `${item.title} ${item.tag || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const filters = [['all', 'All'], ['tutorial', 'Tutorials'], ['exam', 'Exams'], ['joined', 'Joined']];
  function joinWithCode() {
    if (busy || !code.trim()) return;
    setBusy(true); setError('');
    void import('../services/account').then(({ joinPrivate }) => joinPrivate(code).then(({ session }) => {
      setRows(previous => ({ sessions: previous.sessions, joined: [session, ...previous.joined.filter((item: any) => item.id !== session.id)] }));
      setShowCode(false); setCode(''); setSelected(session);
    }).catch(err => setError(err.message)).finally(() => setBusy(false)));
  }
  return <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
    <TopBar left={<Wordmark />} right={<Pressable accessibilityRole="button" accessibilityState={{ expanded: showCode }} onPress={() => { setShowCode(value => !value); setError(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44 }}><KeyRound color={colors.accent} size={17} /><Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold', fontSize: 12 }}>Join with code</Text></Pressable>} />
    <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
      <Heading>Discover</Heading>
      <View style={{ marginTop: 16 }}><SearchField value={search} onChangeText={setSearch} placeholder="Find a tutorial or exam session" /></View>
      {showCode && <View style={{ marginTop: 24, padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.panel, gap: 12 }}>
        <Text style={{ color: colors.ink, fontSize: 13 }}>Private session code</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput value={code} onChangeText={value => setCode(value.toUpperCase())} placeholder="Code from your tutor" placeholderTextColor={colors.faint} autoCapitalize="characters" autoCorrect={false} maxLength={24} style={{ flex: 1, minHeight: 46, paddingHorizontal: 12, color: colors.ink, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderRadius: 7, fontSize: 14 }} />
          <PrimaryButton label={busy ? 'Joining…' : 'Join'} disabled={busy || !code.trim()} icon={<ArrowRight color={colors.onButton} size={16} />} onPress={joinWithCode} />
        </View>
        {error ? <Text style={{ color: colors.accent, fontSize: 12 }}>{error}</Text> : null}
      </View>}
      <View style={{ flexDirection: 'row', gap: 22, marginTop: 22, borderBottomWidth: 1, borderBottomColor: colors.line }}>{filters.map(([id, title]) => <Pressable key={id} onPress={() => setFilter(id)} style={{ paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: filter === id ? colors.accent : 'transparent', marginBottom: -1 }}><Text style={{ color: filter === id ? colors.accent : colors.muted, fontFamily: 'Manrope_700Bold', fontSize: 13 }}>{title}</Text></Pressable>)}</View>
      {!showCode && error ? <Muted>{error}</Muted> : null}
      {loading && !list.length ? <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} /> : list.map((item: any) => <Pressable key={item.id} onPress={() => setSelected(item)} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{item.title}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{item.kind === 'exam' ? 'Exam' : 'Tutorial'}{item.tag ? ` · ${item.tag}` : ''}</Text></View>
        <ArrowRight color={colors.muted} size={18} />
      </Pressable>)}
      {!loading && !list.length && !error ? <View style={{ minHeight: 290, alignItems: 'center', justifyContent: 'center', paddingVertical: 36 }}>
        <Compass color={colors.accent} size={38} strokeWidth={1.2} />
        <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 24, letterSpacing: -0.8, marginTop: 22 }}>{search ? 'No matching sessions' : filter === 'joined' ? 'No joined sessions yet.' : 'No sessions yet.'}</Text>
        {!search && <Pressable accessibilityRole="button" onPress={() => setShowCode(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, minHeight: 44 }}><Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold', fontSize: 14 }}>Have a code?</Text><ArrowRight color={colors.accent} size={16} /></Pressable>}
      </View> : null}
      {selected && <Card>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{selected.kind === 'exam' ? 'Exam' : 'Tutorial'}{selected.visibility === 'private' ? ' · Private' : ''}</Text>
        <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 22, marginVertical: 8 }}>{selected.title}</Text>
        {selected.status === 'ended' ? <Muted>This session has ended.</Muted> : selected.joined ? <Muted>You’re in. Waiting for your tutor.</Muted> : <PrimaryButton label="Join session" onPress={() => void import('../services/account').then(({ joinPublic }) => joinPublic(selected.id).then(({ session }) => setSelected(session)).catch(err => setError(err.message)))} />}
        <TextButton label="Close" onPress={() => setSelected(null)} />
      </Card>}
    </View>
  </ScrollView>;
}

function profilePhoto(user: { user_metadata?: Record<string, unknown>; identities?: { provider?: string; identity_data?: Record<string, unknown> }[] } | null) {
  const meta = user?.user_metadata || {};
  const google = user?.identities?.find(item => item.provider === 'google')?.identity_data || {};
  const candidates = [meta.avatar_url, meta.picture, google.avatar_url, google.picture];
  return candidates.find((value): value is string => typeof value === 'string' && /^https?:\/\//.test(value)) || '';
}

function progressPoints(sessions: { score: number; total_questions: number; graded_total?: number; completed_at: string }[]) {
  return sessions.flatMap(session => {
    const score = gradedPercent(session);
    const at = Date.parse(session.completed_at);
    return score !== null && Number.isFinite(at) ? [{ score, at }] : [];
  }).sort((a, b) => a.at - b.at);
}

function PreferencesTab() {
  const { colors, mode } = useTheme();
  const app = useApp();
  const meta = app.user?.user_metadata || {};
  const name = String(meta.full_name || meta.name || 'Student');
  const email = app.user?.email || '';
  const photo = profilePhoto(app.user);
  const points = progressPoints(app.sessions);
  const recent = points.slice(-10);
  const average = points.length ? Math.round(points.reduce((sum, item) => sum + item.score, 0) / points.length) : null;
  const [reminders, setReminders] = useState<ReminderSnapshot | null>(null);
  useEffect(() => {
    const id = app.user?.id;
    if (!id) return;
    let active = true;
    void getReminders().then(value => { if (active) setReminders(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [app.user?.id]);
  const reminderDetail = !reminders ? 'Manage reminders' : reminders.settings.enabled ? reminders.settings.pausedUntil && Date.parse(reminders.settings.pausedUntil) > Date.now() ? 'Paused' : `${reminders.settings.mode === 'smart' ? 'Smart timing' : 'Daily'} · ${reminders.preview?.targetTime || reminders.settings.time}` : 'Off';
  const themeIcon = mode === 'dark' ? <Moon color={colors.accent} size={20} /> : mode === 'light' ? <Sun color={colors.accent} size={20} /> : <Monitor color={colors.accent} size={20} />;
  const themeDetail = mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark';
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 36 }}>
    <TopBar left={<Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 19, letterSpacing: -0.4 }}>Preferences</Text>} />
    <View style={{ paddingHorizontal: 22, paddingTop: 24, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 28 }}>
        <ProfileMark name={name} url={photo} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 16 }}>{name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{email}</Text>
        </View>
      </View>
      {app.sessions.length ? <View style={{ padding: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.panel }}>
        <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 17, letterSpacing: -0.4 }}>Your progress</Text>
        <View style={{ flexDirection: 'row', marginTop: 18, marginBottom: 8 }}>
          <Stat label="Sessions" value={String(app.sessions.length)} />
          <Stat label="Average" value={average === null ? '—' : `${average}%`} />
          <Stat label="Best" value={points.length ? `${Math.max(...points.map(item => item.score))}%` : '—'} accent />
        </View>
        {recent.length ? <ScoreChart points={recent} /> : <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 28 }}>Complete an objective session to see scores.</Text>}
      </View> : <View style={{ alignItems: 'center', gap: 16, paddingVertical: 12 }}>
        <Scholar state="study" width={92} height={100} />
        <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 22 }}>Start with one paper.</Text>
        <PrimaryButton label="Find a paper" icon={<ArrowRight color={colors.onButton} size={16} />} onPress={() => app.setTab('home')} />
      </View>}
      <View style={{ marginTop: 18 }}>
        <SettingRow icon={<History color={colors.accent} size={20} />} label="Past sessions" onPress={() => app.go('practice-history')} compact />
        <SettingRow icon={<Bookmark color={colors.accent} size={20} />} label="Saved questions" onPress={() => app.go('saved-questions')} compact />
      </View>
      <View style={{ marginTop: 24 }}>
        <SettingRow icon={<Database color={colors.accent} size={20} />} label="Storage & backup" onPress={() => app.go('settings-storage')} />
        <SettingRow icon={<MessageSquareWarning color={colors.accent} size={20} />} label="Question reports" onPress={() => app.go('question-reports')} />
        <SettingRow icon={<Bell color={colors.accent} size={20} />} label="Notifications" detail="Your messages from Focalpoint" onPress={() => app.go('settings-notifications')} />
        <SettingRow icon={themeIcon} label="Theme" detail={themeDetail} onPress={() => app.go('settings-preferences')} />
        <SettingRow icon={<Bell color={colors.accent} size={20} />} label="Study reminders" detail={reminderDetail} onPress={() => app.go('settings-reminders')} />
        <SettingRow icon={<BookOpen color={colors.accent} size={20} />} label="Edit profile" onPress={() => app.go('profile-edit')} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, minHeight: 88, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <View style={{ width: 34, alignItems: 'center' }}><BookOpen color={colors.accent} size={20} /></View>
        <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold', fontSize: 15 }}>Preparation environment</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Open your downloaded exams first.</Text></View>
        <Pressable accessibilityRole="switch" accessibilityLabel="Preparation environment" accessibilityState={{ checked: app.preparation.enabled }} onPress={() => void app.setPreparation({ ...app.preparation, enabled: !app.preparation.enabled })} style={{ width: 48, height: 28, borderRadius: 18, borderWidth: 1, borderColor: app.preparation.enabled ? colors.button : colors.line, backgroundColor: app.preparation.enabled ? colors.button : colors.control, justifyContent: 'center', padding: 3 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: app.preparation.enabled ? colors.onButton : colors.muted, transform: [{ translateX: app.preparation.enabled ? 20 : 0 }] }} />
        </Pressable>
      </View>
      <TextButton label="Log out" onPress={() => void app.signOut()} />
    </View>
  </ScrollView>;
}

function ProfileMark({ name, url }: { name: string; url: string }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const initials = (name || 'Student').split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase();
  if (url && !failed) return <Image accessibilityIgnoresInvertColors source={{ uri: url }} onError={() => setFailed(true)} style={{ width: 46, height: 46, borderRadius: 23 }} />;
  return <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.line, backgroundColor: `${colors.accent}12`, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold', fontSize: 15 }}>{initials}</Text>
  </View>;
}

function ScoreChart({ points }: { points: { score: number; at: number }[] }) {
  const { colors } = useTheme();
  const x = (index: number) => points.length === 1 ? 286 : 42 + index * 488 / (points.length - 1);
  const y = (score: number) => 150 - score * 1.25;
  const first = new Date(points[0].at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const last = new Date(points[points.length - 1].at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return <View>
    <Svg viewBox="0 0 560 180" width="100%" height={150} accessibilityLabel={`Scores from your last ${points.length} graded sessions. Latest score ${points[points.length - 1].score} percent.`}>
      {[0, 50, 100].map(value => <Line key={value} x1={32} x2={540} y1={150 - value * 1.25} y2={150 - value * 1.25} stroke={colors.line} strokeDasharray="3 4" />)}
      {[0, 50, 100].map(value => <SvgText key={`label-${value}`} x={24} y={154 - value * 1.25} fill={colors.muted} fontSize={20} textAnchor="end">{value}</SvgText>)}
      <Polyline points={points.map((item, index) => `${x(index)},${y(item.score)}`).join(' ')} fill="none" stroke={colors.accent} strokeWidth={2.2} strokeLinejoin="round" />
      {points.map((item, index) => <Circle key={`${item.at}-${index}`} cx={x(index)} cy={y(item.score)} r={index === points.length - 1 ? 4 : 3} fill={index === points.length - 1 ? colors.accent : colors.panel} stroke={colors.accent} strokeWidth={2} />)}
    </Svg>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 28 }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{first}</Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{last}</Text>
    </View>
  </View>;
}

function SettingRow({ icon, label, detail, onPress, compact }: { icon: ReactNode; label: string; detail?: string; onPress: () => void; compact?: boolean }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 15, minHeight: compact ? 64 : 72, paddingVertical: compact ? 12 : 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
    <View style={{ width: 34, alignItems: 'center' }}>{icon}</View>
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold', fontSize: 15 }}>{label}</Text>
      {detail ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{detail}</Text> : null}
    </View>
    <ChevronRight color={colors.muted} size={19} />
  </Pressable>;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { colors } = useTheme();
  return <View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text><Text style={{ color: accent ? colors.accent : colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 26, letterSpacing: -1, marginTop: 4 }}>{value}</Text></View>;
}

function catalogPlacement(catalog: LibraryCatalog | null, id?: string) {
  if (!catalog || !id) return null;
  const orgs = catalog.organizations?.length ? catalog.organizations : catalog.universities || [];
  for (const org of orgs) {
    for (const exam of org.examTypes || []) {
      const materials = exam.materials || exam.manufacturers || [];
      const material = materials.find(item => item.bundleId === id || item.id === id);
      if (material) return { exam: exam.name, organization: org.name, publisher: material.name || material.title || '' };
    }
  }
  return null;
}

function examLabel(catalog: LibraryCatalog | null, id?: string) {
  return catalogPlacement(catalog, id)?.exam || '';
}

function decorateMaterial(material: any, catalog: LibraryCatalog | null) {
  const found = catalogPlacement(catalog, material?.id);
  if (!found) return material;
  return { ...material, exam: material.exam || found.exam, examType: material.examType || found.exam, organization: material.organization || found.organization, university: material.university || found.organization, publisher: material.publisher || found.publisher, manufacturer: material.manufacturer || found.publisher };
}

function HomeLink({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.line }}>
    {icon}
    <Text style={{ flex: 1, color: colors.ink, fontFamily: 'Manrope_600SemiBold', fontSize: 14 }}>{label}</Text>
    <ArrowRight color={colors.muted} size={18} />
  </Pressable>;
}

function Paper({ title, detail, onPress, identity }: { title: string; detail: string; onPress: () => void; identity?: any }) {
  const { colors } = useTheme();
  const official = Boolean(examArtwork(identity || title));
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.line }}>
    <View style={{ width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: official ? '#fff' : 'transparent' }}>
      <ExamMark identity={identity || title} />
    </View>
    <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_600SemiBold', fontSize: 14 }}>{title}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>{detail}</Text></View>
    <ArrowRight color={colors.muted} size={17} />
  </Pressable>;
}
