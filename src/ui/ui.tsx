import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Camera, Compass, Home, Library, User } from 'lucide-react-native';
import { useTheme } from '../theme/Theme';

export function Wordmark() {
  const { colors } = useTheme();
  const focal = colors.scheme === 'dark' ? '#ffffff' : colors.ink;
  return <Text accessibilityLabel="Focalpoint" style={{ color: focal, fontFamily: 'Manrope_800ExtraBold', fontSize: 25, letterSpacing: -1.4 }}>Focal<Text style={{ color: colors.accent }}>point</Text></Text>;
}

export function PrimaryButton({ label, onPress, disabled, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: React.ReactNode }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [{ minHeight: 48, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: pressed ? colors.accentHover : colors.button, borderRadius: 6, borderWidth: 1, borderColor: colors.button, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, opacity: disabled ? 0.4 : 1, shadowColor: colors.buttonShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 }, ]}>
    <Text style={{ color: colors.onButton, fontFamily: 'Manrope_800ExtraBold', fontSize: 15 }}>{label}</Text>{icon}
  </Pressable>;
}

export function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return <Pressable disabled={disabled} onPress={onPress} style={{ minHeight: 46, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
    <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 14 }}>{label}</Text>
  </Pressable>;
}

export function TextButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return <Pressable disabled={disabled} onPress={onPress} style={{ minHeight: 44, justifyContent: 'center', opacity: disabled ? 0.45 : 1 }}><Text style={{ color: colors.accent, fontFamily: 'Manrope_700Bold', fontSize: 14 }}>{label}</Text></Pressable>;
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  const { colors } = useTheme();
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 12 }}>{label}</Text>
    <TextInput placeholderTextColor={colors.faint} {...props} style={[{ height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 13, color: colors.ink, backgroundColor: colors.panel, fontFamily: 'Outfit_400Regular', fontSize: 16 }, props.style]} />
  </View>;
}

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, backgroundColor: colors.panel }}>
    <Text style={{ color: colors.muted, fontSize: 16 }}>⌕</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.faint} style={{ flex: 1, height: 46, color: colors.ink, fontFamily: 'Outfit_400Regular', fontSize: 16 }} />
  </View>;
}

export function Screen({ children, style, pad = true }: { children: React.ReactNode; style?: ViewStyle; pad?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return <View style={[{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }, style]}>{pad ? <View style={{ flex: 1 }}>{children}</View> : children}</View>;
}

export function TopBar({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ minHeight: 64, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>{left}{right}</View>;
}

export function Heading({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 28, letterSpacing: -0.8 }}>{children}</Text>;
}

export function Muted({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.muted, fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 20 }}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 22 }, style]}>{children}</View>;
}

export function Notice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return <View style={{ margin: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <Text style={{ flex: 1, color: colors.ink, fontFamily: 'Outfit_400Regular', fontSize: 13 }}>{message}</Text>
    {onRetry && <TextButton label="Retry" onPress={onRetry} />}
  </View>;
}

export function BottomNav({ tab, onTab, onSnap }: { tab: 'home' | 'library' | 'lead' | 'preference'; onTab: (tab: 'home' | 'library' | 'lead' | 'preference') => void; onSnap: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const items = [
    { id: 'home' as const, label: 'Home' },
    { id: 'library' as const, label: 'Library' },
    { id: 'lead' as const, label: 'Discover' },
    { id: 'preference' as const, label: 'Preferences' },
  ];
  return <View style={{ paddingTop: 24, paddingBottom: insets.bottom, backgroundColor: 'transparent' }}>
    <View style={{ position: 'absolute', left: 0, right: 0, top: 24, bottom: 0, backgroundColor: colors.panel }} />
    <Svg viewBox="0 0 375 72" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 72, width: '100%' }}>
      <Path d="M0 0 L125 0 C140 0 145 38 187.5 38 C230 38 235 0 250 0 L375 0 L375 72 L0 72 Z" fill={colors.panel} />
    </Svg>
    <Pressable accessibilityLabel="Add material" onPress={onSnap} style={{ position: 'absolute', top: -4, left: '50%', marginLeft: -26, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.button, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
      <Camera color={colors.onButton} size={24} />
    </Pressable>
    <View style={{ height: 72, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8 }}>
      {items.map((item, index) => {
        const Icon = item.id === 'home' ? Home : item.id === 'library' ? Library : item.id === 'lead' ? Compass : User;
        const active = tab === item.id;
        return <Pressable key={item.id} onPress={() => onTab(item.id)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 58, paddingBottom: 12, marginRight: index === 1 ? 48 : 0 }}>
          <Icon color={active ? colors.accent : colors.muted} size={22} strokeWidth={active ? 2.5 : 2} />
          <Text style={{ color: active ? colors.accent : colors.muted, fontFamily: 'Manrope_700Bold', fontSize: 10, marginTop: 4 }}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

export const row = StyleSheet.create({ line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth } });
