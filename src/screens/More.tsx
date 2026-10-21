import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Camera, Check, Trash2, Upload, X } from 'lucide-react-native';
import { useApp } from '../state/AppState';
import { useTheme } from '../theme/Theme';
import { Scholar } from '../ui/Scholar';
import { Field, Heading, Muted, PrimaryButton, Screen, SearchField, TextButton, TopBar, Wordmark } from '../ui/ui';
import { confirmVisionMaterial, createVisionSession, extractVisionText, getNotificationInbox, getReminders, getVisionSession, listReports, queueReport, readNotification, replyVisionFollowUp, resumeVisionSession, saveReminders, startVisionSession, syncReports, uploadSessionPages, uploadSessionPdf, type InboxItem, type ReminderSettings, type ReminderSnapshot } from '../services/account';
import { downloadManifest, downloadSelected, formatBytes, removeOfflineBundle } from '../services/library';
import { discardAttempt, writeBookmarks } from '../services/practice';
import { exportStudyBackup, importStudyBackup } from '../services/studyBackup';
import { saveBundle } from '../services/library';
import { prepareUploadPhoto } from '../services/photoPrepare';
import { PaperCamera } from '../ui/PaperCamera';
import { getSupabase } from '../lib/supabase';
import { classifyMaterialFiles, reviewMinimumOptions, sortUploadFiles, type UploadFile } from '../domain/materialFiles';
import { gradedPercent } from '../domain/studyPlan';
import { questionText } from '../lib/plain';
import { fileBytes } from '../lib/files';
import type { StudyTheme } from '../theme/Theme';

function BackBar({ title }: { title: string }) {
  const { colors } = useTheme();
  const { back } = useApp();
  return <TopBar left={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pressable accessibilityLabel="Back" onPress={back}><ArrowLeft color={colors.muted} size={20} /></Pressable><Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 18 }}>{title}</Text></View>} />;
}

function PaperArt() {
  const { colors } = useTheme();
  const art = colors.done;
  return <Svg width={120} height={112} viewBox="0 0 180 168" accessibilityElementsHidden>
    <Rect x={40} y={26} width={100} height={126} rx={4} rotation={-10} origin="40, 26" fill={colors.control} stroke={colors.line} />
    <Rect x={57} y={13} width={100} height={132} rx={4} rotation={6} origin="57, 13" fill={colors.bg} stroke={art} strokeOpacity={0.5} />
    <G rotation={6} origin="57, 13">
      <Path d="M74 36h47" stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />
      <Path d="M74 47h30M74 66h65M74 73h51M74 99h65M74 106h45" stroke={art} strokeOpacity={0.4} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={78} cy={85} r={3} stroke={art} strokeOpacity={0.5} fill="none" />
      <Circle cx={93} cy={85} r={3} stroke={colors.accent} fill="none" />
      <Path d="M78 120h45" stroke={art} strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
    </G>
    <Path d="m26 128 21 21 45-47" stroke={colors.accent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

async function readUploadText(uri: string) {
  try { return await FileSystem.readAsStringAsync(uri); }
  catch { return fetch(uri).then(response => response.text()); }
}

export function SnapScreen() {
  const { colors } = useTheme();
  const app = useApp();
  const [name, setName] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const dropRef = useRef<any>(null);
  const addRef = useRef<(incoming: Array<UploadFile & { width?: number; height?: number }>) => void>(() => undefined);
  function addSelection(incoming: Array<UploadFile & { width?: number; height?: number }>) {
    if (busy || !incoming.length) return;
    setError('');
    const ordered = sortUploadFiles(incoming);
    void Promise.all(ordered.map(file => prepareUploadPhoto(file))).then(prepared => setFiles(current => [...current, ...prepared]));
  }
  addRef.current = addSelection;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = dropRef.current;
    if (!node?.addEventListener) return;
    const over = (event: DragEvent) => { event.preventDefault(); setDragging(true); };
    const leave = () => setDragging(false);
    const drop = (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const incoming = [...(event.dataTransfer?.files || [])].map(file => ({ uri: URL.createObjectURL(file), name: file.name, mime: file.type || 'application/octet-stream', size: file.size }));
      addRef.current(incoming);
    };
    node.addEventListener('dragover', over);
    node.addEventListener('dragleave', leave);
    node.addEventListener('drop', drop);
    return () => { node.removeEventListener('dragover', over); node.removeEventListener('dragleave', leave); node.removeEventListener('drop', drop); };
  }, []);
  function moveFile(index: number, direction: -1 | 1) {
    setFiles(current => {
      const next = [...current];
      const other = index + direction;
      if (other < 0 || other >= next.length) return current;
      [next[index], next[other]] = [next[other], next[index]];
      return next;
    });
  }
  async function addImages() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError('Allow camera access, or use your phone’s camera below. You can also choose an existing photo.'); return; }
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.94 });
    if (!shot.canceled) addSelection(shot.assets.map(asset => ({ uri: asset.uri, name: asset.fileName || `page_${Date.now()}.jpg`, mime: asset.mimeType || 'image/jpeg', size: asset.fileSize, width: asset.width, height: asset.height })));
  }
  async function addFiles() {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf', 'text/plain', 'text/markdown', 'application/json'], multiple: true, copyToCacheDirectory: true });
    if (!picked.canceled) addSelection(picked.assets.map(asset => ({ uri: asset.uri, name: asset.name, mime: asset.mimeType || 'application/octet-stream', size: asset.size })));
  }
  async function send() {
    if (!files.length || busy) return;
    setBusy(true); setError(''); setProgress('Preparing your material');
    try {
      const material = classifyMaterialFiles(files);
      const title = name.trim() || 'New material';
      if (material.kind === 'text') {
        const text = await readUploadText(material.files[0].uri);
        if (!text.trim()) throw new Error('This file has no text. Choose another file.');
        const result = await extractVisionText({ text, name: title });
        const id = result.sessionId || result.jobId;
        if (!id) throw new Error('Your upload could not be opened. Please try again.');
        app.setVisionId(id);
        app.go('processing');
        return;
      }
      const session = await createVisionSession(title);
      if (!session.id) throw new Error('Your upload could not be opened. Please try again.');
      if (material.kind === 'pdf') {
        setProgress('Uploading your PDF');
        await uploadSessionPdf(session.id, material.files[0]);
      } else {
        for (let index = 0; index < material.files.length; index += 8) {
          const pages = material.files.slice(index, index + 8);
          setProgress(index ? `Uploading photos ${index + 1}–${index + pages.length}` : 'Uploading your photos');
          await uploadSessionPages(session.id, pages, index);
        }
        await startVisionSession(session.id);
      }
      app.setVisionId(session.id);
      app.go('processing');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not upload this material.'); }
    finally { setBusy(false); }
  }
  return <Screen pad={false}><ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
    <View style={{ minHeight: 64, paddingHorizontal: 20, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Wordmark /><View style={{ width: 1, height: 18, marginLeft: 20, backgroundColor: colors.ink, opacity: 0.18 }} /></View>
    </View>
    <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
      <Text style={{ color: colors.ink, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 36, lineHeight: 42, letterSpacing: -1.6, marginBottom: 26 }}>Upload material</Text>
      <View ref={dropRef} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.panel, padding: 24 }}>
        <View style={{ position: 'absolute', top: -1, left: 30, width: 42, height: 2, backgroundColor: colors.accent }} />
        {!files.length ? <View style={{ alignItems: 'center', gap: 12 }}>
          <PaperArt />
          {dragging ? <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 18 }}>Drop files here</Text> : null}
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Photos, PDF or text</Text>
          <Pressable accessibilityRole="button" onPress={() => void addFiles()} disabled={busy} style={({ pressed }) => [{ marginTop: 8, minHeight: 48, width: '100%', paddingHorizontal: 20, borderRadius: 6, backgroundColor: pressed ? colors.accentHover : colors.button, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: busy ? 0.4 : 1 }]}>
            <Upload color={colors.onButton} size={18} />
            <Text style={{ flex: 1, color: colors.onButton, fontFamily: 'Manrope_800ExtraBold', fontSize: 15 }}>Choose files</Text>
            <ArrowRight color={colors.onButton} size={18} />
          </Pressable>
        </View> : <View style={{ gap: 12 }}>
          <Field label="Material name" value={name} onChangeText={setName} placeholder="e.g. Chemistry revision" editable={!busy} />
          <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{`${files.length} file${files.length === 1 ? '' : 's'} selected`}</Text>
          {files.map((file, index) => <View key={`${file.uri}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.muted, width: 24 }}>{String(index + 1).padStart(2, '0')}</Text>
            {file.mime.startsWith('image/') ? <Image source={{ uri: file.uri }} style={{ width: 36, height: 36, borderRadius: 4 }} /> : <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}><BookOpen color={colors.muted} size={18} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 12 }} numberOfLines={1}>{file.name}</Text>
              {typeof file.size === 'number' && file.size > 0 ? <Text style={{ color: colors.muted, fontSize: 11 }}>{formatBytes(file.size)}</Text> : null}
            </View>
            <Pressable accessibilityLabel={`Move ${file.name} up`} disabled={busy || index === 0} onPress={() => moveFile(index, -1)}><ArrowUp color={colors.muted} size={16} /></Pressable>
            <Pressable accessibilityLabel={`Move ${file.name} down`} disabled={busy || index === files.length - 1} onPress={() => moveFile(index, 1)}><ArrowDown color={colors.muted} size={16} /></Pressable>
            <Pressable accessibilityLabel={`Remove ${file.name}`} disabled={busy} onPress={() => setFiles(current => current.filter((_, item) => item !== index))}><X color={colors.muted} size={17} /></Pressable>
          </View>)}
          {progress && busy ? <Muted>{progress}</Muted> : null}
          {error ? <Muted>{error}</Muted> : null}
          <PrimaryButton label={busy ? 'Uploading…' : 'Prepare questions'} disabled={busy} icon={<Upload color={colors.onButton} size={18} />} onPress={() => void send()} />
          <TextButton label="Add files" disabled={busy} onPress={() => void addFiles()} />
        </View>}
      </View>
      {!busy && <View style={{ marginTop: 14 }}>
        <Pressable accessibilityRole="button" onPress={() => setCameraOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 64, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Camera color={colors.accent} size={21} strokeWidth={1.5} />
          <Text style={{ flex: 1, color: colors.soft, fontSize: 13 }}>Take a photo</Text>
          <ArrowRight color={colors.muted} size={18} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => app.go('manual-entry')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 64, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <BookOpen color={colors.accent} size={21} strokeWidth={1.5} />
          <Text style={{ flex: 1, color: colors.soft, fontSize: 13 }}>Paste questions instead</Text>
          <ArrowRight color={colors.muted} size={18} />
        </Pressable>
      </View>}
      {!files.length && error ? <View style={{ marginTop: 16 }}><Muted>{error}</Muted></View> : null}
    </View>
  </ScrollView>
  {cameraOpen && <PaperCamera onClose={() => setCameraOpen(false)} onPhoto={file => { setCameraOpen(false); addSelection([file]); }} onUnavailable={() => { setCameraOpen(false); void addImages(); }} />}
  </Screen>;
}

export function ManualScreen() {
  const app = useApp();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();
  return <Screen pad={false}><BackBar title="Manual Entry" /><ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
    <Field label="Material name" value={name} onChangeText={setName} placeholder="e.g. Physics 2018 Past Q" />
    <Text style={{ color: colors.muted }}>Paste questions here</Text>
    <TextInput multiline value={text} onChangeText={setText} placeholder="Paste your raw text questions and options here..." placeholderTextColor={colors.faint} style={{ minHeight: 220, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink, backgroundColor: colors.panel, textAlignVertical: 'top' }} />
    {error ? <Muted>{error}</Muted> : null}
    <PrimaryButton label={busy ? 'Preparing…' : 'Prepare questions'} disabled={!text.trim() || busy} onPress={() => {
      setBusy(true); setError('');
      void extractVisionText({ text, name: name.trim() || 'Manual Entry' }).then(data => { app.setVisionId(data.sessionId || data.jobId || null); app.go('processing'); }).catch(err => setError(err.message)).finally(() => setBusy(false));
    }} />
  </ScrollView></Screen>;
}

export function ProcessingScreen() {
  const { colors } = useTheme();
  const app = useApp();
  const [session, setSession] = useState<any>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [busy, setBusy] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const opened = useRef<string | null>(null);
  useEffect(() => {
    setSession(null); setConnectionError(false); setActionMessage(''); opened.current = null;
    if (!app.visionId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const current = await getVisionSession(app.visionId!);
        if (!active) return;
        setSession(current); setConnectionError(false);
        const ready = ['completed', 'completed_with_errors'].includes(current.status) && current.questions?.length;
        if (ready && opened.current !== current.id) {
          opened.current = current.id;
          app.setQuestions(current.questions || []);
          app.go('review-questions');
          return;
        }
      } catch { if (active) setConnectionError(true); }
      if (active) timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [app.visionId]);
  const followUps = (session?.followUps || []).filter((item: any) => item.status === 'open');
  const ready = ['completed', 'completed_with_errors'].includes(session?.status || '') && !!session?.questions?.length;
  const failed = session?.status === 'failed' || (['completed', 'completed_with_errors'].includes(session?.status || '') && !session?.questions?.length);
  const waiting = ['needs_input', 'paused', 'needs_attention'].includes(session?.status || '') || followUps.length > 0;
  const progress = session?.progress;
  const fraction = progress?.total ? Math.round(((progress.done || 0) + (progress.skipped || 0)) / progress.total * 100) : null;
  async function act(key: string, request: () => Promise<any>) {
    if (busy || !app.visionId) return;
    setBusy(key); setActionMessage('');
    try { const updated = await request(); if (updated) setSession(updated); }
    catch { setActionMessage('That didn’t work. Please try again.'); }
    finally { setBusy(''); }
  }
  async function attach(item: any) {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (picked.canceled || !picked.assets[0] || !app.visionId) return;
    const image = picked.assets[0];
    await act(item.id, () => replyVisionFollowUp(app.visionId!, { followUpId: item.id, action: 'replace_page', image: { uri: image.uri, name: image.fileName || 'page.jpg', mime: image.mimeType || 'image/jpeg' } }));
  }
  if (!app.visionId) return <Screen><View style={{ padding: 24, gap: 16 }}><Heading>Choose a material</Heading><PrimaryButton label="Choose a material" onPress={() => app.go('snap')} /></View></Screen>;
  return <Screen><ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
    <Scholar state={failed ? 'encourage' : waiting ? 'thinking' : 'study'} />
    {!failed && <ActivityIndicator color={colors.accent} />}
    <Heading>{connectionError ? 'Reconnecting' : failed ? 'Preparation stopped' : waiting ? 'Needs a check' : 'Preparing your questions'}</Heading>
    <Muted>{actionMessage || (connectionError ? 'Reconnecting. Your preparation will continue.' : failed ? 'Your material is saved. Try preparing it again.' : fraction !== null ? `${progress.done || 0} of ${progress.total} pages` : 'Scholar is reading your material.')}</Muted>
    {followUps.map((item: any) => {
      const page = session?.pages?.find((entry: any) => entry.id === item.pageId);
      const unclear = item.type === 'unclear_image';
      const canAttach = ['unclear_image', 'missing_questions', 'missing_question_numbers', 'count_anomaly'].includes(item.type);
      return <View key={item.id} style={{ width: '100%', gap: 8, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12 }}>
        <Muted>{unclear ? `A clearer photo${page ? ` of page ${page.index + 1}` : ''} will help.` : canAttach ? 'You can add another page to complete this material.' : 'This material needs a quick check before continuing.'}</Muted>
        {canAttach && <PrimaryButton label={busy === item.id ? 'Adding…' : unclear ? 'Add clearer photo' : 'Add a page'} disabled={!!busy} onPress={() => void attach(item)} />}
        {!unclear && <TextButton label="Skip this check" disabled={!!busy} onPress={() => void act(item.id, () => replyVisionFollowUp(app.visionId!, { followUpId: item.id, action: 'dismiss' }))} />}
      </View>;
    })}
    {!ready && (failed || waiting || (progress?.failed || 0) > 0) && <PrimaryButton label={busy === 'resume' ? 'Trying again…' : 'Try again'} disabled={!!busy} onPress={() => void act('resume', () => resumeVisionSession(app.visionId!))} />}
    {!ready && waiting && !!session?.questions?.length && <TextButton label="Use ready questions" disabled={!!busy} onPress={() => { app.setQuestions(session.questions || []); app.go('review-questions'); }} />}
    <TextButton label="Back" onPress={app.back} />
  </ScrollView></Screen>;
}

export function ReviewScreen() {
  const { colors } = useTheme();
  const app = useApp();
  const [rows, setRows] = useState<any[]>(app.questions);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState('all');
  const grouped = new Map<string, number[]>();
  rows.forEach((question, index) => {
    const key = question.section || [question.year, question.paper && question.paper !== 'Default' ? question.paper : ''].filter(Boolean).join(' ') || 'Questions';
    grouped.set(key, [...(grouped.get(key) || []), index]);
  });
  const groups = [...grouped.entries()];
  const visible: number[] = group === 'all' ? rows.map((_, index) => index) : grouped.get(group) || [];
  const blocking = rows.filter(question => !String(question.question || '').trim() || (question.options || []).filter((option: string) => String(option).trim()).length < reviewMinimumOptions(question) || question.incomplete);
  function saveEdit() {
    if (editIndex === null || !draft) return;
    const options = (draft.options || []).map((option: string) => String(option).trim()).filter(Boolean);
    const correct = draft.correct === '' || draft.correct == null ? null : Number(draft.correct);
    const incomplete = !String(draft.question || '').trim() || options.length < reviewMinimumOptions(draft);
    setRows(current => current.map((question, index) => index === editIndex ? { ...draft, question: String(draft.question || '').trim(), options, correct: Number.isInteger(correct) ? correct : null, incomplete } : question));
    setEditIndex(null); setDraft(null);
  }
  return <Screen pad={false}><BackBar title="Check your questions" /><ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 120 }}>
    <Muted>{`${rows.length} extracted · viewing ${visible.length}`}</Muted>
    {groups.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}><Pressable onPress={() => setGroup('all')} style={{ paddingHorizontal: 12, minHeight: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: group === 'all' ? colors.button : colors.control }}><Text style={{ color: group === 'all' ? colors.onButton : colors.ink }}>{`All (${rows.length})`}</Text></Pressable>{groups.map(([key, items]) => <Pressable key={key} onPress={() => setGroup(key)} style={{ paddingHorizontal: 12, minHeight: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: group === key ? colors.button : colors.control }}><Text style={{ color: group === key ? colors.onButton : colors.ink }}>{`${key} (${items.length})`}</Text></Pressable>)}</ScrollView>}
    {blocking.length > 0 && <Muted>{`${blocking.length} incomplete. Open each one and compare it with the source page.`}</Muted>}
    {visible.map(index => {
      const question = rows[index];
      return <Pressable key={index} accessibilityLabel="Edit question" onPress={() => { setEditIndex(index); setDraft({ ...question, options: [...(question.options || [])], correct: question.correct ?? '' }); }} style={{ backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14 }}>
        <Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold' }}>{question.questionNumber || index + 1}. {question.subject}{question.year ? ` · ${question.year}` : ''}</Text>
        {typeof question.confidence === 'number' && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{`${Math.round(question.confidence * 100)}% confidence`}</Text>}
        {(question.figures || []).filter((figure: { url?: string }) => figure?.url).slice(0, 1).map((figure: { url: string }) => <Image key={figure.url} source={{ uri: figure.url }} style={{ width: '100%', height: 120, marginTop: 8 }} resizeMode="contain" />)}
        <Text style={{ color: colors.ink, marginTop: 6 }} numberOfLines={3}>{questionText(question)}</Text>
        {(question.needsReview || question.incomplete) && <Text style={{ color: colors.accent, fontSize: 12, marginTop: 6 }}>Review</Text>}
        {question.correct == null && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>No key</Text>}
      </Pressable>;
    })}
    {error ? <Muted>{error}</Muted> : null}
  </ScrollView>
  <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.line, gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Scholar state={busy ? 'study' : 'idle'} width={54} height={58} /><Muted>{busy ? 'Saving your material…' : 'Ready when you are.'}</Muted></View>
    <PrimaryButton label={busy ? 'Saving…' : blocking.length ? `Fix ${blocking.length} incomplete question${blocking.length === 1 ? '' : 's'}` : 'Looks good — save'} disabled={busy || blocking.length > 0 || !rows.length} onPress={() => {
      if (!app.user || !app.visionId) { setError('Please sign in again to save this material.'); return; }
      setBusy(true);
      void confirmVisionMaterial(app.visionId, rows).then(saved => saveBundle({ ...saved, ownerId: app.user!.id }, app.user!.id)).then(material => { app.setBundle(material); app.go('customize-cbt'); void app.reloadLocal(); }).catch(err => setError(err.message)).finally(() => setBusy(false));
    }} />
  </View>
  {editIndex !== null && draft && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.backdrop, justifyContent: 'flex-end' }}>
    <View style={{ maxHeight: '86%', backgroundColor: colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10 }}>
      <Heading>Edit question</Heading>
      <ScrollView>
        <TextInput multiline value={draft.question || ''} onChangeText={question => setDraft({ ...draft, question })} placeholder="Question" placeholderTextColor={colors.faint} style={{ minHeight: 90, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 12, color: colors.ink, textAlignVertical: 'top' }} />
        {(draft.options || []).map((option: string, optionIndex: number) => <TextInput key={optionIndex} value={option} onChangeText={text => setDraft({ ...draft, options: draft.options.map((item: string, index: number) => index === optionIndex ? text : item) })} placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} placeholderTextColor={colors.faint} style={{ height: 46, marginTop: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, color: colors.ink }} />)}
        <TextInput value={draft.correct == null ? '' : String(draft.correct)} onChangeText={correct => setDraft({ ...draft, correct })} placeholder="Answer key, for example 0 for A" placeholderTextColor={colors.faint} keyboardType="number-pad" style={{ height: 46, marginTop: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, color: colors.ink }} />
      </ScrollView>
      <PrimaryButton label="Save question" onPress={saveEdit} />
      <TextButton label="Close" onPress={() => { setEditIndex(null); setDraft(null); }} />
    </View>
  </View>}
  </Screen>;
}

export function DownloadsScreen() {
  const { colors } = useTheme();
  const app = useApp();
  const [manifest, setManifest] = useState<Awaited<ReturnType<typeof downloadManifest>> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [subject, setSubject] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!app.downloadId) return;
    let active = true;
    abortRef.current?.abort();
    setError('');
    setPaused(false);
    setSubject(null);
    setManifest(null);
    setProgress(0);
    void downloadManifest(app.downloadId).then(value => {
      if (!active) return;
      setManifest(value);
      setSelected(value.parts.map(part => part.hash));
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Download details could not load.'); });
    return () => { active = false; };
  }, [app.downloadId, attempt]);
  function begin(hashes: string[]) {
    if (!manifest || busy || !hashes.length) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setError('');
    setProgress(0);
    void downloadSelected(manifest, hashes, app.user?.id, (done, total) => setProgress(total ? done / total : 0), abort.signal).then(bundle => {
      if (!bundle.questions?.length) throw new Error('This paper downloaded without any questions.');
      void app.reloadLocal();
      app.setBundle(bundle);
      app.go('customize-cbt');
    }).catch(err => { if (abort.signal.aborted) { setPaused(true); return; } setError(err instanceof Error ? err.message : 'Download interrupted. Tap Resume.'); }).finally(() => setBusy(false));
  }
  const subjects = [...new Set((manifest?.parts || []).map(part => part.subject || 'Questions'))];
  const visibleParts = subject ? (manifest?.parts || []).filter(part => (part.subject || 'Questions') === subject) : [];
  return <Screen pad={false}>
    <BackBar title={subject || 'Download'} />
    <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 24 }}>
      {!manifest && !error ? <ActivityIndicator color={colors.accent} /> : null}
      {manifest && !subject && <>
        <Heading>{manifest.bundle.title || manifest.bundle.name || 'Material'}</Heading>
        <Muted>{`${manifest.totalQuestions} questions · ${formatBytes(manifest.totalBytes)}`}</Muted>
        {subjects.map(name => {
          const group = manifest.parts.filter(part => (part.subject || 'Questions') === name);
          const hashes = group.map(part => part.hash);
          const on = hashes.every(hash => selected.includes(hash));
          return <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Pressable disabled={busy} onPress={() => setSelected(previous => on ? previous.filter(hash => !hashes.includes(hash)) : [...new Set([...previous, ...hashes])])} style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{on ? '☑' : '☐'} {name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{`${group.reduce((sum, part) => sum + part.count, 0)} questions · ${formatBytes(group.reduce((sum, part) => sum + part.bytes, 0))}`}</Text>
            </Pressable>
            <TextButton label="Parts" onPress={() => setSubject(name)} />
          </View>;
        })}
      </>}
      {manifest && subject && <>
        <TextButton label="All subjects" onPress={() => setSubject(null)} />
        {visibleParts.map(part => <Pressable key={part.hash} disabled={busy} onPress={() => setSelected(previous => previous.includes(part.hash) ? previous.filter(hash => hash !== part.hash) : [...previous, part.hash])} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{selected.includes(part.hash) ? '☑' : '☐'} {part.paper || part.year || 'Topic collection'}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{`${part.count} questions · ${formatBytes(part.bytes)}`}</Text>
        </Pressable>)}
      </>}
      {error ? <Muted>{error}</Muted> : null}
      {error && !manifest ? <TextButton label="Try again" onPress={() => setAttempt(value => value + 1)} /> : null}
    </ScrollView>
    {manifest ? <View style={{ paddingHorizontal: 20, paddingBottom: 24, gap: 10 }}>
      {busy || progress > 0 ? <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.line }}><View style={{ height: 4, borderRadius: 2, backgroundColor: colors.accent, width: `${Math.max(4, Math.round(progress * 100))}%` }} /></View> : null}
      {busy ? <Muted>{`Downloading… ${Math.round(progress * 100)}%`}</Muted> : null}
      <PrimaryButton label={busy ? 'Pause' : paused || error ? 'Resume download' : 'Save for offline'} disabled={!busy && !selected.length} onPress={() => busy ? abortRef.current?.abort() : begin(selected)} />
    </View> : null}
  </Screen>;
}

export function HistoryScreen() {
  const { colors } = useTheme();
  const app = useApp();
  const ongoing = app.attempts.filter(item => item.status === 'active');
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const discarding = ongoing.find(item => item.id === discardId);
  return <Screen pad={false}><BackBar title="Past sessions" /><ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
    {ongoing.length > 0 && <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 16 }}>Unfinished</Text>}
    {ongoing.map(item => <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <BookOpen color={colors.accent} size={22} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{item.title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{`${item.answers.filter(answer => answer !== null).length} of ${item.questions.length} answered`}</Text>
      </View>
      <PrimaryButton label="Resume" onPress={() => { app.setAttempt(item); app.go('exam'); }} />
      <Pressable accessibilityLabel={`Discard ${item.title}`} onPress={() => { setError(''); setDiscardId(item.id); }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Trash2 color={colors.muted} size={17} /></Pressable>
    </View>)}
    {ongoing.length > 0 && app.sessions.length > 0 && <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 16, marginTop: 8 }}>Completed</Text>}
    {app.sessions.map(item => {
      const saved = app.attempts.find(row => row.id === item.id && row.status === 'completed');
      const percent = gradedPercent(item);
      const date = item.completed_at ? new Date(item.completed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Completed';
      const body = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BookOpen color={colors.accent} size={22} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{item.title || 'Practice session'}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{`${date} · ${saved ? 'Review answers' : 'Score only'}`}</Text>
        </View>
        <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{percent === null ? 'Completed' : `${percent}%`}</Text>
        {saved ? <ArrowRight color={colors.muted} size={17} /> : null}
      </View>;
      return saved ? <Pressable key={item.id} accessibilityRole="button" onPress={() => { app.setAttempt(saved); app.go('review-answers'); }} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>{body}</Pressable> : <View key={item.id} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>{body}</View>;
    })}
    {!app.sessions.length && !ongoing.length && <View style={{ alignItems: 'flex-start', gap: 12, paddingVertical: 24 }}>
      <BookOpen color={colors.muted} size={30} />
      <Heading>No sessions yet.</Heading>
      <PrimaryButton label="Find a paper" icon={<ArrowRight color={colors.onButton} size={17} />} onPress={() => app.setTab('library')} />
    </View>}
  </ScrollView>
  {discarding && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.backdrop, justifyContent: 'flex-end' }}>
    <View style={{ backgroundColor: colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 }}>
      <Heading>Discard this unfinished exam?</Heading>
      <Muted>Your completed sessions and downloaded papers stay saved.</Muted>
      {error ? <Muted>{error}</Muted> : null}
      <PrimaryButton label={busy ? 'Discarding…' : 'Discard exam'} disabled={busy} onPress={() => {
        if (!app.user) return;
        setBusy(true);
        void discardAttempt(app.user.id, discarding.id).then(() => { app.setAttempts(app.attempts.filter(row => row.id !== discarding.id)); setDiscardId(null); }).catch(() => setError('Could not discard this exam. Try again.')).finally(() => setBusy(false));
      }} />
      <TextButton label="Keep exam" disabled={busy} onPress={() => setDiscardId(null)} />
    </View>
  </View>}
  </Screen>;
}

export function SavedScreen() {
  const { colors } = useTheme();
  const app = useApp();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [noteKey, setNoteKey] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const filtered = app.bookmarks.filter(row => `${row.question.subject || ''} ${row.question.year || ''} ${row.question.question || ''} ${row.note || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const chosen = app.bookmarks.filter(row => selected.includes(row.key));
  function practise(rows: typeof app.bookmarks) {
    if (!rows.length) return;
    app.setBundle({ id: 'saved-questions', title: 'Saved questions', questions: rows.map(row => row.question), assets: Object.assign({}, ...rows.map(row => (row as { assets?: object }).assets || {})), revisionSet: true });
    app.go('customize-cbt');
  }
  return <Screen pad={false}><BackBar title="Saved questions" /><ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
    {app.bookmarks.length > 0 && <>
      <SearchField value={search} onChangeText={setSearch} placeholder="Subject, year, question or note" />
      <PrimaryButton label={chosen.length ? `Practise · ${chosen.length}` : 'Practise saved questions'} disabled={!(chosen.length || filtered.length)} onPress={() => practise(chosen.length ? chosen : filtered)} />
    </>}
    {!filtered.length ? <Muted>{app.bookmarks.length ? 'No matching questions.' : 'Save a question to revisit it.'}</Muted> : null}
    {filtered.map(row => <View key={row.key} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 6 }}>
      <Pressable onPress={() => setSelected(previous => previous.includes(row.key) ? previous.filter(key => key !== row.key) : [...previous, row.key])}><Text style={{ color: colors.accent }}>{selected.includes(row.key) ? 'Selected' : 'Select'}</Text></Pressable>
      <Pressable onPress={() => { app.setAttempt({ id: row.key, owner: app.user?.id || row.owner, title: row.title, status: 'completed', source: row.source, questions: [row.question], assets: {}, answers: [row.answer], writtenAnswers: [], flagged: [false], currentQ: 0, duration: 60, deadline: Date.now(), practice: true, updatedAt: row.createdAt }); app.go('review-answers'); }}><Text style={{ color: colors.ink }} numberOfLines={3}>{questionText(row.question)}</Text></Pressable>
      {row.note && noteKey !== row.key ? <Muted>{row.note}</Muted> : null}
      {noteKey === row.key && <TextInput multiline value={note} onChangeText={setNote} placeholder="Your note" placeholderTextColor={colors.faint} style={{ minHeight: 70, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 10, color: colors.ink }} />}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <TextButton label={noteKey === row.key ? 'Save note' : 'Note'} onPress={() => {
          if (!app.user) return;
          if (noteKey !== row.key) { setNoteKey(row.key); setNote(row.note || ''); return; }
          const next = app.bookmarks.map(item => item.key === row.key ? { ...item, note } : item);
          app.setBookmarks(next); void writeBookmarks(app.user.id, next); setNoteKey(null);
        }} />
        <TextButton label="Remove" onPress={() => { if (!app.user) return; const next = app.bookmarks.filter(item => item.key !== row.key); app.setBookmarks(next); setSelected(previous => previous.filter(key => key !== row.key)); void writeBookmarks(app.user.id, next); }} />
      </View>
    </View>)}
  </ScrollView></Screen>;
}

export function StorageScreen() {
  const { colors } = useTheme();
  const app = useApp();
  const [bytes, setBytes] = useState(0);
  const [tab, setTab] = useState<'downloads' | 'backup'>('downloads');
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { void fileBytes().then(setBytes); }, [app.offlineLibrary.length]);
  const removing = app.offlineLibrary.find(item => item.id === removeId);
  return <Screen pad={false}><BackBar title="Storage & backup" /><ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
    <View style={{ flexDirection: 'row', gap: 16 }}>{(['downloads', 'backup'] as const).map(id => <Pressable key={id} onPress={() => setTab(id)}><Text style={{ color: tab === id ? colors.accent : colors.muted, fontFamily: 'Manrope_700Bold' }}>{id === 'downloads' ? 'Downloads' : 'Backup'}</Text></Pressable>)}</View>
    {tab === 'downloads' ? <>
      <Muted>{`Saved materials use about ${formatBytes(bytes)} on this device. Question text stays on the device.`}</Muted>
      {app.offlineLibrary.map(item => <View key={item.id} style={{ gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{item.title || item.name}</Text>
        <Muted>{`${item.questions?.length || 0} questions`}</Muted>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {!item.sourceSessionId && <TextButton label="Update" onPress={() => { app.setDownloadId(item.id); app.go('downloads'); }} />}
          <TextButton label="Remove" onPress={() => setRemoveId(item.id)} />
        </View>
      </View>)}
      {!app.offlineLibrary.length ? <Muted>No downloads on this device.</Muted> : null}
    </> : <>
      <Muted>A backup keeps your sessions, saved questions, and scores for this account. Existing work is not overwritten.</Muted>
      <PrimaryButton label="Create backup" onPress={() => { if (!app.user) return; setError(''); void exportStudyBackup(app.user.id).then(file => Share.share({ title: 'Focalpoint backup', url: file.path, message: `Focalpoint backup: ${file.sessions} sessions, ${file.bookmarks} saved questions.` }).then(() => setStatus('Backup file is ready to share.'))).catch(err => setError(err.message)); }} />
      <TextButton label="Import backup" onPress={() => { if (!app.user) return; void DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true }).then(async picked => { if (picked.canceled) return; const result = await importStudyBackup(app.user!.id, picked.assets[0].uri); await app.reloadLocal(); setStatus(`Imported ${result.sessions} sessions and ${result.bookmarks} saved questions.`); }).catch(err => setError(err.message)); }} />
    </>}
    {status ? <Muted>{status}</Muted> : null}
    {error ? <Muted>{error}</Muted> : null}
  </ScrollView>
  {removing && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.backdrop, justifyContent: 'flex-end' }}>
    <View style={{ backgroundColor: colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 }}>
      <Heading>Remove this download?</Heading>
      <Muted>Past sessions and saved questions keep their own diagrams and answers.</Muted>
      <PrimaryButton label="Remove download" onPress={() => { void removeOfflineBundle(removing.id, app.user?.id).then(() => app.reloadLocal()); setRemoveId(null); }} />
      <TextButton label="Keep download" onPress={() => setRemoveId(null)} />
    </View>
  </View>}
  </Screen>;
}

const reportLabels: Record<string, string> = { queued: 'Waiting for connection', received: 'Received', reviewing: 'Under review', corrected: 'Corrected', no_change: 'Reviewed' };

export function ReportsScreen() {
  const { colors } = useTheme();
  const app = useApp();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listReports>> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!app.user) return;
    let active = true;
    void listReports(app.user.id).then(value => { if (active) setRows(value); });
    void syncReports(app.user.id).then(value => { if (active) setRows(value); }).catch(() => { if (active) setError('Showing reports saved on this device.'); });
    return () => { active = false; };
  }, [app.user?.id]);
  return <Screen pad={false}><BackBar title="Question reports" /><ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
    {rows === null ? <ActivityIndicator color={colors.accent} /> : rows.map(row => <View key={row.id} style={{ gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{row.subject}{row.year ? ` · ${row.year}` : ''}</Text>
      <Muted>{reportLabels[row.status] || row.status}</Muted>
      {row.note ? <Text style={{ color: colors.ink }}>{row.note}</Text> : null}
      {row.resolution ? <Muted>{row.resolution}</Muted> : null}
      {row.status === 'corrected' && <TextButton label="Update saved material" onPress={() => { app.setDownloadId(row.bundleId); app.go('downloads'); }} />}
    </View>)}
    {rows?.length === 0 ? <Muted>No reports yet.</Muted> : null}
    {error ? <Muted>{error}</Muted> : null}
  </ScrollView></Screen>;
}

export function ThemeScreen() {
  const { mode, setMode, colors } = useTheme();
  const options: StudyTheme[] = ['system', 'light', 'dark'];
  return <Screen pad={false}><BackBar title="Theme" /><View style={{ padding: 20, gap: 12 }}>{options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: mode === option }} onPress={() => setMode(option)} style={{ padding: 16, borderRadius: 12, borderWidth: 1, borderColor: mode === option ? colors.accent : colors.line, backgroundColor: colors.panel, gap: 12 }}>
    <View style={{ height: 72, borderRadius: 8, backgroundColor: option === 'light' ? '#faf6f0' : option === 'dark' ? '#151515' : colors.bg, borderWidth: 1, borderColor: colors.line, padding: 10, gap: 6 }}>
      <View style={{ height: 8, width: '46%', borderRadius: 4, backgroundColor: option === 'light' ? '#2e2a27' : '#eee9e1' }} />
      <View style={{ height: 6, width: '70%', borderRadius: 4, backgroundColor: option === 'light' ? '#eadfd3' : '#333' }} />
      <View style={{ height: 22, borderRadius: 4, backgroundColor: option === 'light' ? '#fff' : '#202020' }} />
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold', textTransform: 'capitalize' }}>{option}</Text>
      {mode === option && <Check color={colors.accent} size={16} />}
    </View>
  </Pressable>)}{mode === 'system' && <Muted>Follows your device.</Muted>}</View></Screen>;
}

export function RemindersScreen() {
  const { colors } = useTheme();
  const [snapshot, setSnapshot] = useState<ReminderSnapshot | null>(null);
  const [draft, setDraft] = useState<ReminderSettings | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);
  useEffect(() => { void getReminders().then(value => { setSnapshot(value); setDraft(value.settings); }).catch(err => setError(err.message)); }, []);
  const paused = Boolean(draft?.enabled && draft.pausedUntil && Date.parse(draft.pausedUntil) > Date.now());
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
  const mood = draft?.personalized ? snapshot?.preview.mood : 'welcome';
  return <Screen pad={false}><BackBar title="Study reminders" /><ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
    <Muted>Reminder settings are saved on your Focalpoint account. A daily notification is also scheduled on this phone.</Muted>
    {draft && snapshot && <>
      <Pressable onPress={() => setDraft({ ...draft, enabled: !draft.enabled })} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{paused ? 'Reminders paused' : 'Study reminders'}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{paused && draft.pausedUntil ? `Until ${new Date(draft.pausedUntil).toLocaleDateString()}` : 'Skips days you’ve practised.'}</Text></View><Text style={{ color: colors.accent }}>{draft.enabled ? 'On' : 'Off'}</Text></Pressable>
      <View accessibilityLabel="Reminder preview" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12 }}>
        <Scholar state={mood === 'celebrate' ? 'celebrate' : mood === 'focus' ? 'study' : 'idle'} width={64} height={69} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Focalpoint · Scholar</Text>
          <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{draft.personalized ? snapshot.preview.title : 'A study moment with Scholar'}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{draft.personalized ? snapshot.preview.body : 'Come back for a short practice session.'}</Text>
        </View>
      </View>
      {draft.enabled && <TextButton label={testing ? 'Sending…' : 'Send test reminder'} disabled={testing} onPress={() => {
        setTesting(true); setError('');
        void sendTestReminder(draft.personalized ? snapshot.preview : { title: 'A study moment with Scholar', body: 'Come back for a short practice session.' }).then(() => setStatus('Test reminder sent to this device.')).catch(err => setError(err instanceof Error ? err.message : 'Could not send a test reminder.')).finally(() => setTesting(false));
      }} />}
      <View style={{ flexDirection: 'row', gap: 8 }}>{(['smart', 'scheduled'] as const).map(mode => <Pressable key={mode} onPress={() => setDraft({ ...draft, mode })} style={{ flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: draft.mode === mode ? colors.button : colors.control }}><Text style={{ color: draft.mode === mode ? colors.onButton : colors.muted, fontFamily: 'Manrope_700Bold' }}>{mode === 'smart' ? 'Smart' : 'Choose a time'}</Text></Pressable>)}</View>
      {draft.mode === 'scheduled' ? <Field label="Reminder time" value={draft.time} onChangeText={time => setDraft({ ...draft, time })} placeholder="18:00" /> : <Muted>{`Around ${snapshot.preview.targetTime}.`}</Muted>}
      <Text style={{ color: colors.muted, fontSize: 12 }}>Study days</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{days.map((day, order) => { const index = (order + 1) % 7; const on = draft.days.includes(index); return <Pressable key={day} accessibilityLabel={day} onPress={() => { const next = on ? draft.days.filter(value => value !== index) : [...draft.days, index]; if (next.length) setDraft({ ...draft, days: next }); }} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.button : 'transparent', borderWidth: 1, borderColor: on ? colors.button : colors.line }}><Text style={{ color: on ? colors.onButton : colors.muted }}>{day.slice(0, 1)}</Text></Pressable>; })}</View>
      <Field label="Quiet hours from" value={draft.quietStart} onChangeText={quietStart => setDraft({ ...draft, quietStart })} placeholder="22:00" />
      <Field label="Quiet hours until" value={draft.quietEnd} onChangeText={quietEnd => setDraft({ ...draft, quietEnd })} placeholder="07:00" />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><Text style={{ flex: 1, color: colors.muted }}>{draft.timezone.replace(/_/g, ' ')}</Text>{draft.timezone !== zone && <TextButton label="Use device time" onPress={() => setDraft({ ...draft, timezone: zone })} />}</View>
      <Pressable onPress={() => setDraft({ ...draft, personalized: !draft.personalized })}><Text style={{ color: colors.ink }}>{draft.personalized ? '☑' : '☐'} Include study details in reminders</Text></Pressable>
      <PrimaryButton label="Save changes" onPress={() => { void saveReminders(draft).then(async value => { setSnapshot(value); setDraft(value.settings); await scheduleLocalReminder(value.settings); setStatus('Reminder settings saved.'); }).catch(err => setError(err.message)); }} />
      {draft.enabled && <TextButton label={paused ? 'Resume reminders' : 'Pause for 7 days'} onPress={() => { const next = { ...draft, pausedUntil: paused ? null : new Date(Date.now() + 7 * 86400000).toISOString() }; setDraft(next); void saveReminders(next).then(value => { setSnapshot(value); setDraft(previous => previous ? { ...previous, enabled: value.settings.enabled, pausedUntil: value.settings.pausedUntil } : value.settings); setStatus(paused ? 'Reminders resumed.' : 'Reminders paused for 7 days.'); }).catch(err => setError(err.message)); }} />}
    </>}
    {status ? <Muted>{status}</Muted> : null}
    {error ? <Muted>{error}</Muted> : null}
  </ScrollView></Screen>;
}

async function sendTestReminder(preview: { title: string; body: string }) {
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Notifications were not allowed on this device.');
  await Notifications.scheduleNotificationAsync({
    content: { title: preview.title || 'A study moment with Scholar', body: preview.body || 'Come back for a short practice session.' },
    trigger: null,
  });
}

async function scheduleLocalReminder(settings: ReminderSettings) {
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.enabled) return;
  const [hour, minute] = settings.time.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Focalpoint', body: 'Come back for a short practice session.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

export function NotificationsScreen() {
  const { colors } = useTheme();
  const app = useApp();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [offset, setOffset] = useState(0);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => { void getNotificationInbox(offset).then(value => { setItems(value.items || []); setTotal(value.total || 0); setUnread(value.unread || 0); }).catch(err => setError(err.message)); }, [offset, version]);
  function openLink(link: string) {
    if (link.includes('library')) app.setTab('library');
    else if (link.includes('discover') || link.includes('lead')) app.setTab('lead');
    else if (link.includes('preference')) app.setTab('preference');
    else app.setTab('home');
  }
  return <Screen pad={false}>
    <TopBar left={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pressable accessibilityLabel="Back" onPress={app.back}><ArrowLeft color={colors.muted} size={20} /></Pressable><Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 18 }}>Notifications</Text></View>} right={<Pressable accessibilityLabel="Refresh notifications" onPress={() => setVersion(value => value + 1)}><Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold' }}>Refresh</Text></Pressable>} />
    <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
      <Muted>{`${unread} unread · ${total} notifications`}</Muted>
      {error ? <Muted>{error}</Muted> : null}
      {!items.length && !error ? <Muted>You’re all caught up.</Muted> : null}
      {items.map(item => <View key={item.id} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 4 }}>
        <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{item.title}</Text>
        <Text style={{ color: colors.muted }}>{item.body}</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {item.deepLink && item.deepLink !== '/?inbox=1' && <TextButton label="Open in Focalpoint" onPress={() => { void readNotification(item.id); openLink(item.deepLink); }} />}
          {!item.read_at && <TextButton label="Mark as read" onPress={() => { void readNotification(item.id).then(() => setVersion(value => value + 1)); }} />}
        </View>
      </View>)}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <TextButton label="Previous" disabled={!offset} onPress={() => setOffset(value => Math.max(0, value - 20))} />
        <TextButton label="Next" disabled={offset + 20 >= total} onPress={() => setOffset(value => value + 20)} />
      </View>
    </ScrollView>
  </Screen>;
}

export function ProfileScreen() {
  const app = useApp();
  const [name, setName] = useState(app.user?.user_metadata?.full_name || '');
  const [error, setError] = useState('');
  return <Screen pad={false}><BackBar title="Edit profile" /><View style={{ padding: 20, gap: 12 }}>
    <Field label="Full name" value={name} onChangeText={setName} />
    <Field label="Email address" value={app.user?.email || ''} editable={false} />
    <Muted>Email address cannot be changed.</Muted>
    {error ? <Muted>{error}</Muted> : null}
    <PrimaryButton label="Save changes" onPress={() => { void getSupabase().auth.updateUser({ data: { full_name: name.trim() } }).then(({ error: updateError }) => { if (updateError) setError(updateError.message); else app.back(); }); }} />
  </View></Screen>;
}
