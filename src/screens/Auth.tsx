import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../theme/Theme';
import { Field, PrimaryButton, Screen, TextButton } from '../ui/ui';
import { useApp } from '../state/AppState';
import { loginUser, loginWithGoogle, registerUser, sendPasswordReset, updatePassword } from '../services/auth';
import { getSupabase } from '../lib/supabase';

export function AuthScreen({ mode }: { mode: 'login' | 'signup' | 'reset' | 'recovery' }) {
  const { colors } = useTheme();
  const { go, replace } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const signup = mode === 'signup', reset = mode === 'reset', recovery = mode === 'recovery';
  const title = sent ? recovery ? 'Password updated.' : 'Check your inbox.' : recovery ? 'Your new password.' : reset ? 'Forgot password?' : signup ? 'Create account.' : 'Welcome back.';

  async function submit() {
    if (pending) return;
    setError('');
    if (signup && !name.trim()) { setError('Please enter your name.'); return; }
    setPending('email');
    try {
      if (recovery) { await updatePassword(password); setSent(true); }
      else if (reset) { await sendPasswordReset(email.trim()); setSent(true); }
      else if (signup) {
        await registerUser(email.trim(), password, name.trim());
        const { data } = await getSupabase().auth.getSession();
        if (data.session) replace('onboarding'); else setSent(true);
      } else await loginUser(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally { setPending(null); }
  }

  return <Screen>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityLabel="Back" onPress={() => go('splash')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><ArrowLeft color={colors.muted} size={20} /></Pressable>
      <View style={{ marginTop: 12, padding: 24, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, gap: 16 }}>
        <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 26, letterSpacing: -0.6 }}>{title}</Text>
        {sent ? <View style={{ gap: 12 }}>
          <Text style={{ color: colors.muted, fontFamily: 'Outfit_400Regular', fontSize: 13 }}>{recovery ? 'Sign in with your new password.' : signup ? 'Confirm your email to continue.' : 'If an account exists, a reset link will arrive shortly.'}</Text>
          <TextButton label="Back to sign in" onPress={() => go('login')} />
        </View> : <>
          {signup && <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" placeholder="Your full name" />}
          {!recovery && <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />}
          {!reset && <View>
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry={!show} placeholder={signup ? 'Create a password' : 'Your password'} />
            <Pressable accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow(value => !value)} style={{ position: 'absolute', right: 8, top: 30, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>{show ? <EyeOff color={colors.muted} size={18} /> : <Eye color={colors.muted} size={18} />}</Pressable>
            {(signup || recovery) && <Text style={{ marginTop: 6, color: colors.muted, fontSize: 11, fontFamily: 'Outfit_400Regular' }}>At least 8 characters.</Text>}
          </View>}
          {!signup && !reset && !recovery && <TextButton label="Forgot password?" onPress={() => go('forgot-password')} />}
          {error ? <Text style={{ color: colors.ink, backgroundColor: colors.control, padding: 12, borderLeftWidth: 2, borderLeftColor: colors.accent, fontSize: 12 }}>{error}</Text> : null}
          <PrimaryButton label={pending === 'email' ? 'Please wait…' : recovery ? 'Update password' : reset ? 'Send reset link' : signup ? 'Create account' : 'Sign in'} disabled={pending !== null || (!reset && password.length < (signup || recovery ? 8 : 1))} onPress={() => void submit()} />
          {!reset && !recovery && <>
            <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 11 }}>or</Text>
            <Pressable disabled={pending !== null} onPress={() => { setPending('google'); setError(''); void loginWithGoogle().catch(err => setError(err instanceof Error ? err.message : 'Could not connect.')).finally(() => setPending(null)); }} style={{ minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 13 }}>{pending === 'google' ? 'Connecting…' : 'Continue with Google'}</Text>
            </Pressable>
            <TextButton label={signup ? 'Sign in' : 'Create an account'} onPress={() => go(signup ? 'login' : 'signup')} />
          </>}
        </>}
      </View>
    </ScrollView>
  </Screen>;
}
