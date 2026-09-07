import { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password, name.trim());
      Alert.alert('Verify your email', 'Check your inbox and tap the link to confirm your account.', [
        { text: 'OK', onPress: () => router.replace('/auth/login') },
      ]);
    } catch (e: any) {
      Alert.alert('Sign up failed', e.message ?? 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Create account</Text>
        <Text style={s.sub}>Join the rodeo community</Text>
        <TextInput
          style={s.input}
          placeholder="Full name"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={s.input}
          placeholder="Password (min 8 chars)"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleSignup} disabled={loading}>
          <Text style={s.btnText}>{loading ? 'Creating account…' : 'Create account'}</Text>
        </TouchableOpacity>
        <Link href="/auth/login" style={s.link}>
          Already have an account? Sign in
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.screenX, justifyContent: 'center', gap: 16 },
  title: { fontSize: 30, fontWeight: '700', color: colors.text },
  sub: { fontSize: 15, color: colors.muted, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: 14,
    color: colors.text,
    fontSize: 15,
  },
  btn: { backgroundColor: colors.accent, borderRadius: radius.control, padding: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: colors.accent, textAlign: 'center', padding: 8, fontSize: 14 },
});
