import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import ScreenBackground from '@/components/ui/ScreenBackground';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { pickImage, uploadImage } from '@/lib/image-utils';
import { theme } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';
import GlassInput from '@/components/ui/GlassInput';

const dark = theme.dark.colors;
const AVATAR_SIZE = 100;

export default function ProfileScreen() {
  const { session, profile, userType, signOut, refreshProfile } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(profile?.full_name ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset form from context whenever the tab gains focus
  useFocusEffect(
    useCallback(() => {
      setName(profile?.full_name ?? '');
      setAvatarUri(null);
      setSaveSuccess(false);
      setErrorMsg(null);
    }, [profile])
  );

  /* ─── Image picker ─── */
  const pickAvatar = async () => {
    const uri = await pickImage({ aspect: [1, 1] });
    if (uri) setAvatarUri(uri);
  };

  /* ─── Upload avatar to Supabase Storage ─── */
  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarUri || !session?.user?.id) return null;
    const ext = avatarUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filePath = `${session.user.id}/avatar.${ext}`;
    return uploadImage(avatarUri, 'avatars', filePath);
  };

  /* ─── Save changes ─── */
  const handleSave = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    setSaveSuccess(false);
    setErrorMsg(null);

    // Upload avatar if changed
    let newAvatarUrl: string | null = null;
    if (avatarUri) {
      newAvatarUrl = await uploadAvatar();
      if (!newAvatarUrl) {
        setErrorMsg('Avatar upload failed. Please try again.');
        setSaving(false);
        return;
      }
    }

    // Build update payload
    const updates: { full_name: string; avatar_url?: string } = {
      full_name: name.trim(),
    };
    if (newAvatarUrl) {
      updates.avatar_url = newAvatarUrl;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id);

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    await refreshProfile();
    setSaveSuccess(true);
    setAvatarUri(null);
  };

  // Resolve which avatar to display: local pick > persisted url > fallback
  const displayAvatarUri = avatarUri ?? profile?.avatar_url ?? null;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={dark.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{userType === 'client' ? 'Client' : 'Trainer'}</Text>
            </View>
          </View>

          {/* ── Avatar ── */}
          <TouchableOpacity
            style={styles.avatarSection}
            activeOpacity={0.8}
            onPress={pickAvatar}
          >
            <View style={styles.avatarRing}>
              {displayAvatarUri ? (
                <Image
                  source={{ uri: displayAvatarUri }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color={dark.textMuted} />
                </View>
              )}
              {/* Camera overlay */}
              <View style={styles.cameraOverlay}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </View>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>

          {/* ── Profile Fields ── */}
          <GlassCard style={styles.cardSpacing}>
            <GlassInput
              label="Full Name"
              icon="person-outline"
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            {/* Read-only email row */}
            <View style={styles.emailWrapper}>
              <Text style={styles.emailLabel}>Email</Text>
              <View style={styles.emailContainer}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={dark.textMuted}
                  style={styles.emailIcon}
                />
                <Text style={styles.emailText} numberOfLines={1}>
                  {session?.user?.email}
                </Text>
              </View>
            </View>
          </GlassCard>

          {/* ── Error / Success ── */}
          {errorMsg && (
            <Text style={styles.errorText}>{errorMsg}</Text>
          )}
          {saveSuccess && (
            <Text style={styles.successText}>Profile updated!</Text>
          )}

          {/* ── Save Button ── */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={dark.background} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={dark.background} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ── Account Section ── */}
          <GlassCard style={styles.cardSpacing}>
            <Text style={styles.sectionLabel}>Account</Text>

            {/* Change Password */}
            <TouchableOpacity
              style={styles.accountRow}
              activeOpacity={0.7}
              onPress={() => router.push('/change-password')}
            >
              <View style={styles.accountRowLeft}>
                <Ionicons name="lock-closed-outline" size={20} color={dark.textSecondary} />
                <Text style={styles.accountRowText}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={dark.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Sign Out */}
            <TouchableOpacity
              style={styles.accountRow}
              activeOpacity={0.7}
              onPress={signOut}
            >
              <View style={styles.accountRowLeft}>
                <Ionicons name="log-out-outline" size={20} color={dark.error} />
                <Text style={[styles.accountRowText, { color: dark.error }]}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 120,
  },
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: dark.glassCircleBg,
    borderWidth: 1,
    borderColor: dark.glassCircleBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.text,
  },
  badge: {
    backgroundColor: dark.badgeBg,
    paddingHorizontal: theme.spacing.sm + 4,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  badgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: dark.badgeText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  /* Avatar */
  avatarSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2.5,
    borderColor: dark.accent,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark.surface,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: dark.accent,
    fontWeight: '600',
  },
  /* Cards */
  cardSpacing: {
    marginBottom: theme.spacing.md,
  },
  /* Email (read-only, matches GlassInput styling) */
  emailWrapper: {
    marginBottom: theme.spacing.md,
  },
  emailLabel: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
    marginBottom: theme.spacing.xs + 2,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.inputBackgroundGlass,
    borderWidth: 1,
    borderColor: dark.inputBorderGlass,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    opacity: 0.6,
  },
  emailIcon: {
    marginRight: theme.spacing.sm,
  },
  emailText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
  },
  /* Error / Success */
  errorText: {
    fontSize: theme.fontSize.sm,
    color: dark.error,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  successText: {
    fontSize: theme.fontSize.sm,
    color: dark.successGreen,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  /* Save button */
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: dark.accent,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: dark.background,
  },
  /* Account section */
  sectionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: theme.spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm + 2,
  },
  accountRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm + 2,
  },
  accountRowText: {
    fontSize: theme.fontSize.md,
    color: dark.text,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: dark.surfaceBorder,
    marginVertical: theme.spacing.xs,
  },
});
