import { useRef, useState } from 'react';
import { PanResponder, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { calculate } from '../domain/examSession';
import { queueReport } from '../services/account';
import { useTheme } from '../theme/Theme';
import { Heading, Muted, PrimaryButton, TextButton } from './ui';

const keys = ['AC', 'DEL', '(', ')', 'sin(', 'cos(', 'sqrt(', '^', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '.', '0', '%', '+'];

export function CalculatorSheet({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('0');
  const [error, setError] = useState('');
  const [evaluated, setEvaluated] = useState(false);
  function press(key: string) {
    setError('');
    if (key === 'AC') { setExpression(''); setResult('0'); setEvaluated(false); return; }
    if (key === 'DEL') { setExpression(value => value.slice(0, -1)); setEvaluated(false); return; }
    if (key === '=') {
      try { setResult(calculate(expression || result)); setEvaluated(true); }
      catch { setError('Check your expression'); }
      return;
    }
    const operator = /^[+−×÷^%]$/.test(key);
    setExpression(value => (evaluated ? operator ? result : '' : value) + key);
    setEvaluated(false);
  }
  return <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, maxHeight: '78%', backgroundColor: colors.panel, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold' }}>Calculator</Text><TextButton label="Close" onPress={onClose} /></View>
    <Text style={{ color: colors.muted, fontSize: 12 }}>Expression · degrees</Text>
    <TextInput accessibilityLabel="Calculator expression" value={expression} onChangeText={value => { setExpression(value); setEvaluated(false); setError(''); }} placeholder="0" placeholderTextColor={colors.faint} style={{ minHeight: 44, color: colors.ink, fontSize: 20 }} />
    <Text style={{ color: error ? colors.accent : colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 22 }}>{error || result}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{keys.map(key => <Pressable key={key} accessibilityLabel={key === 'DEL' ? 'Delete digit' : key} onPress={() => press(key)} style={{ width: '23%', minHeight: 40, borderRadius: 8, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.ink }}>{key.replace('sqrt(', '√')}</Text></Pressable>)}<Pressable accessibilityLabel="Equals" onPress={() => press('=')} style={{ width: '23%', minHeight: 40, borderRadius: 8, backgroundColor: colors.button, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.onButton, fontFamily: 'Manrope_700Bold' }}>=</Text></Pressable></View>
  </View>;
}

type Stroke = { points: string; erase: boolean };

export function DrawingBoard({ question, onClose }: { question: number; onClose: () => void }) {
  const { colors } = useTheme();
  const notes = useRef(new Map<number, Stroke[]>());
  const history = useRef(new Map<number, Stroke[][]>());
  const questionRef = useRef(question);
  const eraserRef = useRef(false);
  questionRef.current = question;
  const [eraser, setEraser] = useState(false);
  eraserRef.current = eraser;
  const [revision, setRevision] = useState(0);
  const strokes = notes.current.get(question) || [];
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      const current = questionRef.current;
      const snapshots = history.current.get(current) || [];
      snapshots.push([...(notes.current.get(current) || [])]);
      history.current.set(current, snapshots.slice(-50));
      const { locationX, locationY } = event.nativeEvent;
      const list = [...(notes.current.get(current) || []), { points: `${locationX},${locationY}`, erase: eraserRef.current }];
      notes.current.set(current, list);
      setRevision(value => value + 1);
    },
    onPanResponderMove: event => {
      const list = notes.current.get(questionRef.current);
      const stroke = list?.[list.length - 1];
      if (!stroke) return;
      const { locationX, locationY } = event.nativeEvent;
      stroke.points += ` ${locationX},${locationY}`;
      setRevision(value => value + 1);
    },
  })).current;
  return <View style={{ position: 'absolute', top: 72, left: 8, right: 8, bottom: 8, backgroundColor: colors.panel, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ flex: 1, color: colors.ink, fontFamily: 'Manrope_700Bold' }}>{`Working paper · Q${question + 1}`}</Text><TextButton label="Close" onPress={onClose} /></View>
    <View style={{ flexDirection: 'row', gap: 12, marginVertical: 8 }}>
      <TextButton label={eraser ? 'Pen' : 'Pen on'} onPress={() => setEraser(false)} />
      <TextButton label={eraser ? 'Eraser on' : 'Eraser'} onPress={() => setEraser(true)} />
      <TextButton label="Undo" disabled={!(history.current.get(question)?.length)} onPress={() => { const previous = history.current.get(question)?.pop(); if (previous) { notes.current.set(question, previous); setRevision(value => value + 1); } }} />
      <TextButton label="Clear" disabled={!strokes.length} onPress={() => { history.current.set(question, [[...strokes], ...(history.current.get(question) || [])].slice(0, 50)); notes.current.set(question, []); setRevision(value => value + 1); }} />
    </View>
    <View {...responder.panHandlers} style={{ flex: 1, backgroundColor: colors.bg, borderRadius: 8, overflow: 'hidden' }}>
      <Svg width="100%" height="100%" key={revision}>
        {strokes.map((stroke, index) => <Polyline key={index} points={stroke.points} fill="none" stroke={stroke.erase ? colors.bg : colors.ink} strokeWidth={stroke.erase ? 18 : 3} strokeLinecap="round" strokeLinejoin="round" />)}
      </Svg>
    </View>
  </View>;
}

const categories = [
  ['answer', 'Answer key'],
  ['diagram', 'Diagram'],
  ['wording', 'Wording'],
  ['solution', 'Solution'],
  ['topic', 'Topic'],
] as const;

export function ReportSheet({ owner, source, question, onClose }: { owner: string; source: { bundleId: string; version: string | null }; question: any; onClose: () => void }) {
  const { colors } = useTheme();
  const [category, setCategory] = useState<(typeof categories)[number][0]>('answer');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10 }}>
    <Heading>Report question</Heading>
    {sent ? <>
      <Muted>Saved. Your report will be sent when connected and checked by a person.</Muted>
      <PrimaryButton label="Done" onPress={onClose} />
    </> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{categories.map(([id, label]) => <Pressable key={id} onPress={() => setCategory(id)} style={{ paddingHorizontal: 12, minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: category === id ? colors.accent : colors.line, justifyContent: 'center' }}><Text style={{ color: colors.ink }}>{label}</Text></Pressable>)}</View>
      <TextInput multiline value={note} onChangeText={setNote} placeholder="What looks wrong?" placeholderTextColor={colors.faint} style={{ minHeight: 80, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 10, color: colors.ink, textAlignVertical: 'top' }} />
      {error ? <Muted>{error}</Muted> : null}
      <PrimaryButton label={busy ? 'Saving…' : 'Send report'} disabled={busy || !note.trim()} onPress={() => {
        setBusy(true); setError('');
        void queueReport(owner, { bundleId: source.bundleId, questionId: String(question.id || question.questionNumber || ''), version: source.version, category, note, subject: String(question.subject || 'General'), year: question.year ? String(question.year) : undefined }).then(() => setSent(true)).catch(() => setError('This report could not be saved. Check device storage and try again.')).finally(() => setBusy(false));
      }} />
      <TextButton label="Close" onPress={onClose} />
    </>}
  </View>;
}
