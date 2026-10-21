import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './theme/Theme';
import { AppStore, useApp } from './state/AppState';
import { WelcomeScreen } from './screens/Welcome';
import { AuthScreen } from './screens/Auth';
import { OnboardingScreen } from './screens/Onboarding';
import { MainScreen } from './screens/Main';
import { CustomizeScreen, ExamScreen, ResultsScreen } from './screens/StudyFlow';
import { DownloadsScreen, HistoryScreen, ManualScreen, NotificationsScreen, ProcessingScreen, ProfileScreen, RemindersScreen, ReportsScreen, ReviewScreen, SavedScreen, SnapScreen, StorageScreen, ThemeScreen } from './screens/More';
import { Notice } from './ui/ui';

function Router() {
  const app = useApp();
  const { colors } = useTheme();
  if (!app.configured) return <View style={{ flex: 1, backgroundColor: '#151515', justifyContent: 'center', padding: 28 }}>
    <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: '600' }}>Focal<Text style={{ color: '#c7927d' }}>point</Text></Text>
    <Text style={{ color: '#aaa49b', marginTop: 16, lineHeight: 22 }}>{__DEV__ ? 'This development build is missing its public Supabase and API settings. Add them to mobile/.env, then restart Expo.' : 'Focalpoint could not start. Install the latest build.'}</Text>
  </View>;
  if (!app.ready) return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>;
  const screen = app.user || ['splash', 'signup', 'login', 'forgot-password', 'change-password'].includes(app.screen) ? app.screen : 'login';
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <StatusBar style={colors.scheme === 'dark' ? 'light' : 'dark'} />
    {app.notice ? <Notice message={app.notice} onRetry={() => app.setNotice('')} /> : null}
    {screen === 'splash' && <WelcomeScreen />}
    {screen === 'signup' && <AuthScreen mode="signup" />}
    {screen === 'login' && <AuthScreen mode="login" />}
    {screen === 'forgot-password' && <AuthScreen mode="reset" />}
    {screen === 'change-password' && <AuthScreen mode="recovery" />}
    {screen === 'onboarding' && <OnboardingScreen />}
    {screen === 'home' && <MainScreen />}
    {screen === 'snap' && <SnapScreen />}
    {screen === 'manual-entry' && <ManualScreen />}
    {screen === 'processing' && <ProcessingScreen />}
    {screen === 'review-questions' && <ReviewScreen />}
    {screen === 'customize-cbt' && <CustomizeScreen />}
    {screen === 'exam' && <ExamScreen />}
    {screen === 'results' && <ResultsScreen />}
    {screen === 'review-answers' && <ExamScreen review />}
    {screen === 'downloads' && <DownloadsScreen />}
    {screen === 'practice-history' && <HistoryScreen />}
    {screen === 'saved-questions' && <SavedScreen />}
    {screen === 'settings-storage' && <StorageScreen />}
    {screen === 'question-reports' && <ReportsScreen />}
    {screen === 'settings-preferences' && <ThemeScreen />}
    {screen === 'settings-reminders' && <RemindersScreen />}
    {screen === 'settings-notifications' && <NotificationsScreen />}
    {screen === 'profile-edit' && <ProfileScreen />}
  </View>;
}

function Gate() {
  const { fontsReady, colors } = useTheme();
  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <AppStore><Router /></AppStore>;
}

export default function PastQ() {
  return <SafeAreaProvider><ThemeProvider><Gate /></ThemeProvider></SafeAreaProvider>;
}
