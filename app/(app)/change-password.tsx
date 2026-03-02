import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';
import GlassInput from '@/components/ui/GlassInput';

const dark = theme.dark.colors;

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!newPassword || !confirmPassword) {
      setErrorMsg('Both fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setSubmitting(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.back();
    }, 1800);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Change Password</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={dark.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <GlassCard>
          <GlassInput
            label="New Password"
            icon="lock-closed-outline"
            placeholder="Min 8 characters"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoFocus
          />
          <GlassInput
            label="Confirm Password"
            icon="lock-closed-outline"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
          {success && <Text style={styles.successText}>Password updated!</Text>}
        </GlassCard>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={submitting || success}
        >
          {submitting ? (
            <ActivityIndicator color={dark.background} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={dark.background} />
              <Text style={styles.submitButtonText}>Update Password</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: theme.spacing.lg,
  },
  errorText: {
    fontSize: theme.fontSize.sm,
    color: dark.error,
    marginTop: theme.spacing.xs,
  },
  successText: {
    fontSize: theme.fontSize.sm,
    color: dark.successGreen,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: dark.accent,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: dark.background,
  },
});
