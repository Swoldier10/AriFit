import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { theme } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';
import GlassInput from '@/components/ui/GlassInput';
import AuthBackground from '@/components/ui/AuthBackground';

const dark = theme.dark.colors;
type UserType = 'trainer' | 'client';

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ userType?: string }>();

  const userType: UserType =
    params.userType === 'trainer' ? 'trainer' : 'client';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim() || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, userType, name.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Sign Up Error', error);
    }
  };

  const subtitle =
    userType === 'trainer' ? 'Create your trainer account' : 'Join the community';

  return (
    <AuthBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>{'‹ Back'}</Text>
          </TouchableOpacity>

          <Image
            source={require('@/assets/images/AriFit-Logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <GlassCard style={styles.card}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <GlassInput
              icon="person-outline"
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <GlassInput
              icon="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <GlassInput
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="oneTimeCode"
            />

            <GlassInput
              icon="lock-closed-outline"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="oneTimeCode"
            />

            {/* Sign Up button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSignUp}
              disabled={loading}
              style={[styles.buttonWrap, loading && styles.buttonDisabled]}
            >
              <View style={styles.button}>
                <Text style={styles.buttonText}>
                  {loading ? 'Creating account...' : 'Sign Up'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Footer link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/sign-in')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 60,
    paddingBottom: theme.spacing.xl,
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  backText: {
    fontSize: theme.fontSize.lg,
    color: dark.textSecondary,
  },
  logo: {
    width: 160,
    height: 160,
    alignSelf: 'center',
    marginBottom: theme.spacing.xl,
  },
  card: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  buttonWrap: {
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
    shadowColor: dark.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  button: {
    paddingVertical: theme.spacing.sm + 6,
    alignItems: 'center',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: dark.glassButtonBg,
    borderWidth: 1,
    borderColor: dark.glassButtonBorder,
  },
  buttonText: {
    color: dark.accent,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
  },
  footerText: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
  },
  footerLink: {
    fontSize: theme.fontSize.sm,
    color: dark.accent,
    fontWeight: '600',
  },
});
