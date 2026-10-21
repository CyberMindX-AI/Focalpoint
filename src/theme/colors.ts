export type Scheme = 'light' | 'dark';

export type Palette = {
  scheme: Scheme;
  bg: string;
  panel: string;
  control: string;
  ink: string;
  soft: string;
  muted: string;
  faint: string;
  accent: string;
  accentHover: string;
  button: string;
  onButton: string;
  buttonShadow: string;
  line: string;
  done: string;
  onDone: string;
  paper: string;
  paperDot: string;
  paperInk: string;
  examHeader: string;
  timer: string;
  backdrop: string;
};

/** Values copied from src/styles/study-theme.css. */
export const dark: Palette = {
  scheme: 'dark',
  bg: '#151515',
  panel: '#202020',
  control: '#252525',
  ink: '#eee9e1',
  soft: '#ddd7ce',
  muted: '#aaa49b',
  faint: '#8e887e',
  accent: '#c7927d',
  accentHover: '#d6a58e',
  button: '#c7927d',
  onButton: '#181513',
  buttonShadow: '#815e4f',
  line: 'rgba(238,233,225,0.12)',
  done: '#e4d4bd',
  onDone: '#181513',
  paper: '#202020',
  paperDot: '#45423f',
  paperInk: '#e8ded1',
  examHeader: '#181818',
  timer: '#111111',
  backdrop: 'rgba(0,0,0,0.53)',
};

export const light: Palette = {
  scheme: 'light',
  bg: '#faf6f0',
  panel: '#fffcf8',
  control: '#f4ece3',
  ink: '#2e2a27',
  soft: '#514942',
  muted: '#746b62',
  faint: '#82776b',
  accent: '#b14c41',
  accentHover: '#9b4036',
  button: '#e67468',
  onButton: '#2e2a27',
  buttonShadow: '#be5b50',
  line: '#eadfd3',
  done: '#f5e8e7',
  onDone: '#704038',
  paper: '#fffcf8',
  paperDot: '#d9caba',
  paperInk: '#2e2a27',
  examHeader: '#f8f2e9',
  timer: '#eee5d9',
  backdrop: 'rgba(46,42,39,0.35)',
};
