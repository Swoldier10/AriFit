import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';
import GlassInput from '@/components/ui/GlassInput';
import { teamFormStyles } from '@/components/ui/teamFormStyles';

const dark = theme.dark.colors;

const SESSION_OPTIONS = [1, 8, 12, 16, 24] as const;
const DURATION_OPTIONS = [1, 3, 6, 12] as const;

export default function CreatePlanScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: 'session' | 'time' }>();

  const isSession = type === 'session';

  const [name, setName] = useState('');
  const [selectedValue, setSelectedValue] = useState<number>(isSession ? 12 : 3);
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const options = isSession ? SESSION_OPTIONS : DURATION_OPTIONS;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Plan name is required');
      return;
    }
    if (!session?.user?.id) return;

    setSubmitting(true);

    const { error } = await supabase.from('plans').insert({
      created_by: session.user.id,
      name: name.trim(),
      type: type ?? 'session',
      sessions: isSession ? selectedValue : null,
      duration_months: !isSession ? selectedValue : null,
      price: parseFloat(price) || 0,
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isSession ? 'New Session Plan' : 'New Time Plan'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={dark.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard>
          <GlassInput
            label="Plan Name"
            icon="document-text-outline"
            placeholder={isSession ? 'e.g. 12 Session Pack' : 'e.g. Monthly Subscription'}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {/* Value selector */}
          <Text style={teamFormStyles.label}>
            {isSession ? 'Number of Sessions' : 'Duration'}
          </Text>
          <View style={teamFormStyles.pillRow}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  teamFormStyles.pill,
                  selectedValue === opt && teamFormStyles.pillActive,
                ]}
                onPress={() => setSelectedValue(opt)}
              >
                <Text
                  style={[
                    teamFormStyles.pillText,
                    selectedValue === opt && teamFormStyles.pillTextActive,
                  ]}
                >
                  {isSession ? `${opt}` : `${opt} Mo`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <GlassInput
            label="Price (RON)"
            icon="cash-outline"
            placeholder="0.00"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        </GlassCard>

        {/* Button row */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, submitting && styles.buttonDisabled]}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={dark.background} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={dark.background} />
                <Text style={styles.saveButtonText}>Save Plan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: dark.inputBackgroundGlass,
    borderWidth: 1,
    borderColor: dark.inputBorderGlass,
  },
  cancelButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: dark.textSecondary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: dark.accent,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
  },
  saveButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: dark.background,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
