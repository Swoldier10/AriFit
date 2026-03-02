import { useEffect, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';
import GlassInput from '@/components/ui/GlassInput';
import { teamFormStyles } from '@/components/ui/teamFormStyles';

const dark = theme.dark.colors;

const SESSION_OPTIONS = [1, 8, 12, 16, 24] as const;
const DURATION_OPTIONS = [1, 3, 6, 12] as const;

export default function EditPlanScreen() {
  const router = useRouter();
  const { id: planId } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<'session' | 'time'>('session');
  const [selectedValue, setSelectedValue] = useState<number>(12);
  const [price, setPrice] = useState('');

  const isSession = type === 'session';
  const options = isSession ? SESSION_OPTIONS : DURATION_OPTIONS;

  /* ─── Fetch plan data ─── */
  useEffect(() => {
    if (!planId) return;
    (async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('name, type, sessions, duration_months, price')
        .eq('id', planId)
        .single();

      if (error || !data) {
        Alert.alert('Error', 'Could not load plan');
        router.back();
        return;
      }

      setName(data.name);
      setType(data.type as 'session' | 'time');
      setSelectedValue(
        data.type === 'session'
          ? (data.sessions ?? 12)
          : (data.duration_months ?? 3),
      );
      setPrice(data.price != null ? String(data.price) : '');
      setLoading(false);
    })();
  }, [planId]);

  /* ─── Save ─── */
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Plan name is required');
      return;
    }
    if (!planId) return;
    setSaving(true);

    const updates: Record<string, any> = {
      name: name.trim(),
      sessions: isSession ? selectedValue : null,
      duration_months: !isSession ? selectedValue : null,
      price: parseFloat(price) || 0,
    };

    const { error } = await supabase
      .from('plans')
      .update(updates)
      .eq('id', planId);

    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    router.back();
  };

  /* ─── Delete ─── */
  const handleDelete = () => {
    Alert.alert(
      'Delete Plan',
      'This action cannot be undone. The plan will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!planId) return;
            setDeleting(true);
            const { error } = await supabase
              .from('plans')
              .delete()
              .eq('id', planId);
            setDeleting(false);
            if (error) {
              Alert.alert('Error', error.message);
              return;
            }
            router.back();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={dark.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {name || 'Edit Plan'}
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
        {/* Form */}
        <GlassCard>
          <GlassInput
            label="Plan Name"
            icon="document-text-outline"
            placeholder={isSession ? 'e.g. 12 Session Pack' : 'e.g. Monthly Subscription'}
            value={name}
            onChangeText={setName}
          />

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

        {/* Save button */}
        <TouchableOpacity
          style={[teamFormStyles.saveButton, styles.saveButtonMargin, saving && teamFormStyles.buttonDisabled]}
          activeOpacity={0.8}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={dark.background} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={dark.background} />
              <Text style={teamFormStyles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Danger zone */}
        <GlassCard style={styles.dangerCard}>
          <View style={styles.dangerHeader}>
            <Ionicons name="warning-outline" size={20} color={dark.error} />
            <Text style={styles.dangerTitle}>Danger Zone</Text>
          </View>
          <Text style={styles.dangerHint}>
            Deleting a plan is permanent and cannot be undone.
          </Text>
          <TouchableOpacity
            style={[styles.deleteButton, deleting && teamFormStyles.buttonDisabled]}
            activeOpacity={0.8}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color={dark.error} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={dark.error} />
                <Text style={styles.deleteButtonText}>Delete Plan</Text>
              </>
            )}
          </TouchableOpacity>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.text,
    marginRight: theme.spacing.md,
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
  saveButtonMargin: {
    marginTop: theme.spacing.lg,
  },
  dangerCard: {
    marginTop: theme.spacing.lg,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: 4,
  },
  dangerTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: dark.error,
  },
  dangerHint: {
    fontSize: theme.fontSize.sm,
    color: dark.textMuted,
    marginBottom: theme.spacing.md,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: dark.errorBg,
    borderWidth: 1,
    borderColor: dark.errorBorder,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm + 4,
  },
  deleteButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: dark.error,
  },
});
