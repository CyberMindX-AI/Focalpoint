import { Image } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { examArtwork } from '../domain/examArtwork';
import { useTheme } from '../theme/Theme';

const images = {
  jamb: require('../../assets/exams/jamb.png'),
  waec: require('../../assets/exams/waec.png'),
} as const;

export function ExamMark({ identity }: { identity?: Parameters<typeof examArtwork>[0] }) {
  const { colors } = useTheme();
  const kind = examArtwork(identity);
  if (!kind) return <BookOpen color={colors.accent} size={22} strokeWidth={1.5} />;
  return <Image accessibilityIgnoresInvertColors source={images[kind]} style={{ width: 36, height: 36, borderRadius: 8 }} />;
}
