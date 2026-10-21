import { Text, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { Scholar } from '../ui/Scholar';
import { PrimaryButton, Screen, TextButton, Wordmark } from '../ui/ui';
import { useApp } from '../state/AppState';

export function WelcomeScreen() {
  const { colors } = useTheme();
  const { go } = useApp();
  return <Screen>
    <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 20 }}>
      <View style={{ alignItems: 'center', paddingVertical: 8 }}><Wordmark /></View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Scholar state="encourage" width={168} height={182} />
        <Text accessibilityLabel="Welcome to Focalpoint" style={{ fontFamily: 'Manrope_800ExtraBold', fontSize: 48, letterSpacing: -1.6, color: colors.scheme === 'dark' ? '#ffffff' : colors.ink }}>Focal<Text style={{ color: colors.accent }}>point</Text></Text>
        <Text style={{ marginTop: 12, color: colors.muted, fontFamily: 'Outfit_400Regular', fontSize: 14 }}>Your study room</Text>
      </View>
      <View style={{ width: '100%', maxWidth: 360, alignSelf: 'center', gap: 8 }}>
        <PrimaryButton label="Create account" onPress={() => go('signup')} />
        <TextButton label="Sign in" onPress={() => go('login')} />
      </View>
    </View>
  </Screen>;
}
