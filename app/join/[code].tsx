import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import ScreenBackground from '@/components/ui/ScreenBackground';
import GlassCard from '@/components/ui/GlassCard';

const dark = theme.dark.colors;

interface TeamData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  created_by: string;
  memberCount: number;
}

interface TrainerProfile {
  full_name: string | null;
  avatar_url: string | null;
}

type MembershipStatus = 'none' | 'pending' | 'active' | 'owner';

export default function JoinTeamScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, userType, setPendingInviteCode } = useAuth();
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as any);
    }
  };

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>('none');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Not logged in → store code and redirect to sign-in
  useEffect(() => {
    if (session === null && code) {
      setPendingInviteCode(code);
      router.replace('/sign-in');
    }
  }, [session, code, setPendingInviteCode, router]);

  // Redirect trainers to the edit-team page (or home if not the owner)
  useEffect(() => {
    if (userType !== 'trainer' || !team) return;
    if (session?.user?.id === team.created_by) {
      router.replace(`/edit-team?id=${team.id}` as any);
    } else {
      router.replace('/' as any);
    }
  }, [userType, team, session?.user?.id, router]);

  const loadTeamData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Fetch team by unique_code
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('id, name, description, category, image_url, created_by, team_members(count)')
      .eq('unique_code', code)
      .single();

    if (teamError || !teamData) {
      setError('Team not found');
      setLoading(false);
      return;
    }

    const memberCount =
      Array.isArray(teamData.team_members) && teamData.team_members.length > 0
        ? (teamData.team_members[0] as { count: number }).count
        : 0;

    const teamInfo: TeamData = {
      id: teamData.id,
      name: teamData.name,
      description: teamData.description,
      category: teamData.category,
      image_url: teamData.image_url,
      created_by: teamData.created_by,
      memberCount,
    };
    setTeam(teamInfo);

    // Fetch trainer profile
    const { data: trainerData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', teamData.created_by)
      .single();

    if (trainerData) setTrainer(trainerData);

    // Check existing membership if logged in
    if (session?.user?.id) {
      if (session.user.id === teamData.created_by) {
        setMembershipStatus('owner');
      } else {
        const { data: membership } = await supabase
          .from('team_members')
          .select('id, status')
          .eq('team_id', teamData.id)
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (membership) {
          setMembershipStatus(membership.status as MembershipStatus);
        } else {
          setMembershipStatus('none');
        }
      }
    }

    setLoading(false);
  }, [code, session]);

  useEffect(() => {
    if (!code || !session) return;
    loadTeamData();
  }, [code, session, loadTeamData]);

  const handleJoin = async () => {
    if (!team || !session?.user?.id) return;
    setJoining(true);
    try {
      const { error: insertError } = await supabase.from('team_members').insert({
        team_id: team.id,
        user_id: session.user.id,
        role: 'member',
        status: 'pending',
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
      setJoined(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  /* ─── Loading state (also wait for userType if logged in, to avoid flash before trainer redirect) ─── */
  if (loading || (session && !userType)) {
    return (
      <ScreenBackground>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={dark.accent} />
        </View>
      </ScreenBackground>
    );
  }

  /* ─── Trainer redirect in progress ─── */
  if (userType === 'trainer' && team) {
    return (
      <ScreenBackground>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={dark.accent} />
        </View>
      </ScreenBackground>
    );
  }

  /* ─── Error state ─── */
  if (error && !team) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={56} color={dark.error} />
            <Text style={styles.errorTitle}>Team Not Found</Text>
            <Text style={styles.errorHint}>
              This invite link is invalid or the team no longer exists.
            </Text>
            <TouchableOpacity style={styles.outlineButton} onPress={() => goBack()}>
              <Text style={styles.outlineButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  /* ─── Success state (just joined) ─── */
  if (joined) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <Ionicons name="checkmark-circle" size={64} color={dark.successGreen} />
            <Text style={styles.successTitle}>Request Sent!</Text>
            <Text style={styles.successHint}>
              The trainer will review your request.{'\n'}You'll be added once approved.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, styles.fullWidth]}
              activeOpacity={0.8}
              onPress={() => router.replace('/' as any)}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  /* ─── Main join screen ─── */
  return (
    <ScreenBackground
      gradientColors={[
        'rgba(11,17,32,0.70)',
        'rgba(11,17,32,0.85)',
        'rgba(11,17,32,0.95)',
      ] as const}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color={dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Team</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <GlassCard>
            {/* Team image */}
            {team!.image_url && (
              <View style={styles.teamImageWrap}>
                <Image
                  source={{ uri: team!.image_url }}
                  style={styles.teamImage}
                  contentFit="cover"
                />
              </View>
            )}

            {/* Team name */}
            <Text style={styles.teamName}>{team!.name}</Text>

            {/* Category badge */}
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {team!.category.charAt(0).toUpperCase() + team!.category.slice(1)}
                </Text>
              </View>
            </View>

            {/* Trainer info */}
            <View style={styles.trainerRow}>
              <View style={styles.trainerAvatar}>
                {trainer?.avatar_url ? (
                  <Image
                    source={{ uri: trainer.avatar_url }}
                    style={styles.trainerAvatarImg}
                  />
                ) : (
                  <Ionicons name="person" size={16} color={dark.textMuted} />
                )}
              </View>
              <Text style={styles.trainerText}>
                Trainer: {trainer?.full_name ?? 'Unknown'}
              </Text>
            </View>

            {/* Description */}
            {team!.description ? (
              <Text style={styles.description}>{team!.description}</Text>
            ) : null}

            {/* Member count */}
            <View style={styles.memberCountRow}>
              <Ionicons name="people-outline" size={16} color={dark.textMuted} />
              <Text style={styles.memberCountText}>
                {team!.memberCount} {team!.memberCount === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </GlassCard>

          {/* Action area */}
          <View style={styles.actionArea}>
            {membershipStatus === 'none' ? (
              /* Logged in, no membership */
              <>
                <TouchableOpacity
                  style={[styles.primaryButton, joining && styles.buttonDisabled]}
                  activeOpacity={0.8}
                  onPress={handleJoin}
                  disabled={joining}
                >
                  {joining ? (
                    <ActivityIndicator color={dark.accent} />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={20} color={dark.accent} />
                      <Text style={styles.primaryButtonText}>Join Team</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.outlineButton}
                  activeOpacity={0.8}
                  onPress={() =>
                    Alert.alert(
                      'Cancel',
                      'Are you sure you don\'t want to join this team?',
                      [
                        { text: 'Stay', style: 'cancel' },
                        { text: 'Leave', style: 'destructive', onPress: goBack },
                      ],
                    )
                  }
                >
                  <Text style={styles.outlineButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : membershipStatus === 'pending' ? (
              /* Pending request */
              <>
                <View style={[styles.primaryButton, styles.buttonDisabled]}>
                  <Ionicons name="time-outline" size={20} color={dark.textMuted} />
                  <Text style={[styles.primaryButtonText, { color: dark.textMuted }]}>
                    Request Pending
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.outlineButton}
                  activeOpacity={0.8}
                  onPress={() => goBack()}
                >
                  <Text style={styles.outlineButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : membershipStatus === 'active' ? (
              /* Already a member */
              <>
                <View style={[styles.primaryButton, styles.accentSolid]}>
                  <Ionicons name="checkmark-circle" size={20} color={dark.background} />
                  <Text style={[styles.primaryButtonText, { color: dark.background }]}>
                    Already a Member
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.outlineButton}
                  activeOpacity={0.8}
                  onPress={() => router.replace('/' as any)}
                >
                  <Text style={styles.outlineButtonText}>Go to Team</Text>
                </TouchableOpacity>
              </>
            ) : membershipStatus === 'owner' ? (
              /* Owner */
              <>
                <View style={[styles.primaryButton, styles.buttonDisabled]}>
                  <Ionicons name="shield-checkmark" size={20} color={dark.textMuted} />
                  <Text style={[styles.primaryButtonText, { color: dark.textMuted }]}>
                    This is Your Team
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.outlineButton}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.replace(`/edit-team?id=${team!.id}` as any)
                  }
                >
                  <Text style={styles.outlineButtonText}>Go to Team</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
  },
  backBtn: {
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
    flex: 1,
    textAlign: 'center',
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.text,
  },

  /* Scroll */
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 60,
  },

  /* Team image */
  teamImageWrap: {
    width: '100%',
    height: 160,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
  },
  teamImage: {
    width: '100%',
    height: '100%',
  },

  /* Team name */
  teamName: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: dark.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },

  /* Category badge */
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  categoryBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.full,
    backgroundColor: dark.glassButtonBg,
    borderWidth: 1,
    borderColor: dark.glassButtonBorder,
  },
  categoryBadgeText: {
    fontSize: theme.fontSize.sm,
    color: dark.accent,
    fontWeight: '600',
  },

  /* Trainer info */
  trainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  trainerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: dark.whiteOverlay6,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trainerAvatarImg: {
    width: '100%',
    height: '100%',
  },
  trainerText: {
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
    fontWeight: '500',
  },

  /* Description */
  description: {
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },

  /* Member count */
  memberCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  memberCountText: {
    fontSize: theme.fontSize.sm,
    color: dark.textMuted,
  },

  /* Action area */
  actionArea: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },

  /* Buttons */
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: dark.glassButtonBg,
    borderWidth: 1,
    borderColor: dark.glassButtonBorder,
    shadowColor: dark.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    color: dark.accent,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: dark.glassBorderStartStrong,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: dark.whiteOverlay5,
  },
  outlineButtonText: {
    color: dark.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  accentSolid: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
    shadowOpacity: 0,
    elevation: 0,
  },

  /* Error state */
  errorTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.text,
  },
  errorHint: {
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  /* Success state */
  successTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.text,
  },
  successHint: {
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  fullWidth: {
    alignSelf: 'stretch',
    marginHorizontal: theme.spacing.lg,
  },
});
