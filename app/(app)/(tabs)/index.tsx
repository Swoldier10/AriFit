import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenBackground from '@/components/ui/ScreenBackground';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import StatCard from '@/components/trainer/StatCard';
import TeamCard, { type TeamData } from '@/components/trainer/TeamCard';
import GlassCard from '@/components/ui/GlassCard';

const dark = theme.dark.colors;

/** Raw row shape returned by Supabase for teams with aggregate count */
interface RawTeamRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  team_members: { count: number }[];
}

/** Raw row shape for team_members join query (client dashboard) */
interface RawTeamMemberRow {
  team_id: string;
  teams: ClientTeam | null;
}

/** Raw row shape for assigned_workouts join query */
interface RawAssignedWorkoutRow {
  id: string;
  scheduled_date: string | null;
  status: string;
  notes: string | null;
  workouts: { name: string; difficulty: string | null; estimated_duration_min: number | null } | null;
  profiles: { full_name: string | null } | null;
}

/* ─── Liquid glass circle button (notification/settings icons) ─── */
function GlassIconButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const inner = (
    <View style={glassBtn.surface}>
      <Ionicons name={icon} size={20} color={dark.textSecondary} />
    </View>
  );

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={glassBtn.wrap}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={50} tint="dark" style={glassBtn.blur}>
          {inner}
        </BlurView>
      ) : (
        <View style={[glassBtn.blur, { backgroundColor: dark.glassCircleBg }]}>{inner}</View>
      )}
    </TouchableOpacity>
  );
}

const GLASS_BTN_SIZE = 40;
const glassBtn = StyleSheet.create({
  wrap: {
    width: GLASS_BTN_SIZE,
    height: GLASS_BTN_SIZE,
    borderRadius: GLASS_BTN_SIZE / 2,
    borderWidth: 1,
    borderColor: dark.glassCircleBorder,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: dark.glassShadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
        }
      : { elevation: 6 }),
  },
  blur: {
    flex: 1,
    borderRadius: GLASS_BTN_SIZE / 2,
    overflow: 'hidden',
  },
  surface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark.whiteOverlay4,
  },
});

/* ─── Liquid glass avatar ─── */
function GlassAvatar({ avatarUrl }: { avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <View style={styles.avatarWrap}>
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatarImg}
          contentFit="cover"
        />
      </View>
    );
  }

  return (
    <View style={styles.avatarWrap}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={50} tint="dark" style={styles.avatarBlur}>
          <View style={styles.avatarInner}>
            <Ionicons name="person" size={18} color={dark.textMuted} />
          </View>
        </BlurView>
      ) : (
        <View style={[styles.avatarBlur, { backgroundColor: dark.glassCircleBg }]}>
          <View style={styles.avatarInner}>
            <Ionicons name="person" size={18} color={dark.textMuted} />
          </View>
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Route entry – pick the right dashboard based on userType         */
/* ═══════════════════════════════════════════════════════════════════ */

export default function DashboardScreen() {
  const { userType } = useAuth();

  if (userType === 'client') return <ClientDashboard />;
  return <TrainerDashboard />;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  TRAINER DASHBOARD                                                */
/* ═══════════════════════════════════════════════════════════════════ */

function TrainerDashboard() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;

  const [teams, setTeams] = useState<TeamData[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!userId) return;

    const [teamsRes, teamCountRes, clientsRes] = await Promise.all([
      supabase
        .from('teams')
        .select('id, name, category, description, image_url, team_members(count)')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('teams')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', userId),
      supabase
        .from('team_members')
        .select('id, teams!inner(created_by)', { count: 'exact', head: true })
        .eq('teams.created_by', userId)
        .eq('status', 'active')
        .neq('role', 'owner'),
    ]);

    if (teamsRes.data) {
      const mapped: TeamData[] = (teamsRes.data as RawTeamRow[]).map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        description: t.description,
        image_url: t.image_url,
        member_count: t.team_members?.[0]?.count ?? 0,
      }));
      setTeams(mapped);
    }
    setTeamCount(teamCountRes.count ?? 0);
    if (clientsRes.count !== null) {
      setClientCount(clientsRes.count);
    }

    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const displayName = profile?.full_name?.split(' ')[0] ?? 'Coach';

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <GlassAvatar avatarUrl={profile?.avatar_url} />
            <View>
              <Text style={styles.headerTitle}>Dashboard</Text>
              <Text style={styles.headerSubtitle}>Welcome back, {displayName}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <GlassIconButton icon="notifications-outline" />
            <GlassIconButton icon="settings-outline" onPress={() => router.push('/profile')} />
          </View>
        </View>

        {/* ── Stat Cards ── */}
        {loading ? (
          <ActivityIndicator color={dark.accent} style={styles.loader} />
        ) : (
          <View style={styles.statsRow}>
            <StatCard
              label="Active Teams"
              value={teamCount}
              subtitle={teamCount > 0 ? 'Managing teams' : 'Create your first team'}
              subtitleIcon="people-outline"
              trendColor={dark.accent}
            />
            <StatCard
              label="Total Clients"
              value={clientCount}
              subtitle={clientCount > 0 ? 'Active clients' : 'No clients yet'}
              subtitleIcon="person-outline"
              trendColor={dark.successGreen}
            />
            <StatCard
              label="Daily Activity"
              value="85%"
              subtitle="On track this week"
              subtitleIcon="trending-up-outline"
              trendColor={dark.successGreen}
            />
          </View>
        )}

        {/* ── Create New Team ── */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/create-team')}
          style={styles.createWrap}
        >
          <LinearGradient
            colors={['rgba(0,212,255,0.25)', 'rgba(0,212,255,0.10)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.createGradient}
          >
            <Ionicons name="add-circle" size={24} color={dark.accent} />
            <Text style={styles.createText}>Create New Team</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Current Teams ── */}
        {!loading && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Current Teams</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/teams')}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            {teams.length > 0 ? (
              teams.map((team) => (
                <TeamCard key={team.id} team={team} onPress={() => router.push(`/edit-team?id=${team.id}`)} />
              ))
            ) : (
              <View style={styles.emptyTeams}>
                <Ionicons name="people-outline" size={32} color={dark.textMuted} />
                <Text style={styles.emptyTeamsText}>No teams yet</Text>
                <Text style={styles.emptyTeamsHint}>
                  Create your first team to get started
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  CLIENT DASHBOARD                                                 */
/* ═══════════════════════════════════════════════════════════════════ */

interface ClientTeam {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
}

interface UpcomingWorkout {
  id: string;
  scheduled_date: string | null;
  status: string;
  notes: string | null;
  workout: { name: string; difficulty: string | null; estimated_duration_min: number | null } | null;
  trainer: { full_name: string | null } | null;
}

function ClientDashboard() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [teamCount, setTeamCount] = useState(0);
  const [assignedCount, setAssignedCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [myTeams, setMyTeams] = useState<ClientTeam[]>([]);
  const [upcomingWorkouts, setUpcomingWorkouts] = useState<UpcomingWorkout[]>([]);

  const fetchClientData = useCallback(async () => {
    if (!userId) return;

    const [teamsRes, assignedRes, completedRes, upcomingRes] = await Promise.all([
      // Teams the client belongs to
      supabase
        .from('team_members')
        .select('team_id, teams(id, name, category, image_url)')
        .eq('user_id', userId)
        .eq('status', 'active'),
      // Total assigned workouts
      supabase
        .from('assigned_workouts')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', userId),
      // Completed workout logs
      supabase
        .from('workout_logs')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', userId),
      // Upcoming / pending assigned workouts
      supabase
        .from('assigned_workouts')
        .select('id, scheduled_date, status, notes, workouts(name, difficulty, estimated_duration_min), profiles!assigned_workouts_trainer_id_fkey(full_name)')
        .eq('client_id', userId)
        .in('status', ['pending', 'assigned'])
        .order('scheduled_date', { ascending: true, nullsFirst: false })
        .limit(5),
    ]);

    if (teamsRes.data) {
      const teams: ClientTeam[] = (teamsRes.data as RawTeamMemberRow[])
        .map((row) => row.teams)
        .filter((t): t is ClientTeam => t !== null);
      setMyTeams(teams);
      setTeamCount(teams.length);
    }

    setAssignedCount(assignedRes.count ?? 0);
    setCompletedCount(completedRes.count ?? 0);

    if (upcomingRes.data) {
      const mapped: UpcomingWorkout[] = (upcomingRes.data as RawAssignedWorkoutRow[]).map((row) => ({
        id: row.id,
        scheduled_date: row.scheduled_date,
        status: row.status,
        notes: row.notes,
        workout: row.workouts ?? null,
        trainer: row.profiles ?? null,
      }));
      setUpcomingWorkouts(mapped);
    }

    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchClientData();
    }, [fetchClientData])
  );

  const displayName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <GlassAvatar avatarUrl={profile?.avatar_url} />
              <View>
                <Text style={styles.headerTitle}>Dashboard</Text>
                <Text style={styles.headerSubtitle}>Welcome back, {displayName}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <GlassIconButton icon="notifications-outline" />
              <GlassIconButton icon="settings-outline" onPress={() => router.push('/profile')} />
            </View>
          </View>

          {/* ── Stat Cards ── */}
          {loading ? (
            <ActivityIndicator color={dark.accent} style={styles.loader} />
          ) : (
            <View style={styles.statsRow}>
              <StatCard
                label="My Teams"
                value={teamCount}
                subtitle={teamCount > 0 ? 'Active memberships' : 'No teams yet'}
                subtitleIcon="people-outline"
                trendColor={dark.accent}
              />
              <StatCard
                label="Workouts"
                value={assignedCount}
                subtitle={assignedCount > 0 ? 'Total assigned' : 'No workouts yet'}
                subtitleIcon="barbell-outline"
                trendColor={dark.accent}
              />
              <StatCard
                label="Completed"
                value={completedCount}
                subtitle={completedCount > 0 ? 'Workouts done' : 'Start your first workout'}
                subtitleIcon="checkmark-circle-outline"
                trendColor={dark.successGreen}
              />
            </View>
          )}

          {/* ── Upcoming Workouts ── */}
          {!loading && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming Workouts</Text>
              </View>
              {upcomingWorkouts.length > 0 ? (
                upcomingWorkouts.map((w) => (
                  <GlassCard key={w.id} style={clientStyles.workoutCard}>
                    <View style={clientStyles.workoutRow}>
                      <View style={clientStyles.workoutIconWrap}>
                        <Ionicons name="barbell-outline" size={20} color={dark.accent} />
                      </View>
                      <View style={clientStyles.workoutInfo}>
                        <Text style={clientStyles.workoutName} numberOfLines={1}>
                          {w.workout?.name ?? 'Workout'}
                        </Text>
                        <View style={clientStyles.workoutMeta}>
                          {w.scheduled_date && (
                            <Text style={clientStyles.workoutMetaText}>
                              {new Date(w.scheduled_date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                          )}
                          {w.workout?.estimated_duration_min && (
                            <Text style={clientStyles.workoutMetaText}>
                              {w.workout.estimated_duration_min} min
                            </Text>
                          )}
                          {w.trainer?.full_name && (
                            <Text style={clientStyles.workoutMetaText}>
                              by {w.trainer.full_name.split(' ')[0]}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={clientStyles.statusBadge}>
                        <Text style={clientStyles.statusText}>
                          {w.status === 'pending' ? 'Pending' : 'Assigned'}
                        </Text>
                      </View>
                    </View>
                  </GlassCard>
                ))
              ) : (
                <View style={styles.emptyTeams}>
                  <Ionicons name="barbell-outline" size={32} color={dark.textMuted} />
                  <Text style={styles.emptyTeamsText}>No upcoming workouts</Text>
                  <Text style={styles.emptyTeamsHint}>
                    Your trainer will assign workouts to you
                  </Text>
                </View>
              )}
            </>
          )}

          {/* ── My Teams ── */}
          {!loading && (
            <>
              <View style={[styles.sectionHeader, { marginTop: theme.spacing.lg }]}>
                <Text style={styles.sectionTitle}>My Teams</Text>
              </View>
              {myTeams.length > 0 ? (
                myTeams.map((team) => (
                  <GlassCard key={team.id} style={clientStyles.teamCard}>
                    <View style={clientStyles.teamRow}>
                      {team.image_url ? (
                        <Image
                          source={{ uri: team.image_url }}
                          style={clientStyles.teamImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={clientStyles.teamImagePlaceholder}>
                          <Ionicons name="people" size={20} color={dark.textMuted} />
                        </View>
                      )}
                      <View style={clientStyles.teamInfo}>
                        <Text style={clientStyles.teamName} numberOfLines={1}>
                          {team.name}
                        </Text>
                        <Text style={clientStyles.teamCategory}>
                          {team.category.charAt(0).toUpperCase() + team.category.slice(1)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={dark.textMuted} />
                    </View>
                  </GlassCard>
                ))
              ) : (
                <View style={styles.emptyTeams}>
                  <Ionicons name="people-outline" size={32} color={dark.textMuted} />
                  <Text style={styles.emptyTeamsText}>No teams yet</Text>
                  <Text style={styles.emptyTeamsHint}>
                    Ask your trainer for an invite link to join a team
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  SHARED STYLES                                                    */
/* ═══════════════════════════════════════════════════════════════════ */

const AVATAR_SIZE = 44;

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
    marginBottom: theme.spacing.lg + 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm + 4,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1,
    borderColor: dark.glassCircleBorder,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: dark.glassShadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
        }
      : { elevation: 6 }),
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarBlur: {
    flex: 1,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
  },
  avatarInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark.whiteOverlay4,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.text,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  /* Stats */
  statsRow: {
    gap: theme.spacing.sm + 4,
    marginBottom: theme.spacing.lg,
  },
  loader: {
    marginVertical: theme.spacing.xl,
  },
  /* Create button (trainer) */
  createWrap: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(0,212,255,0.45)',
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: 'rgba(0,212,255,0.55)',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.6,
          shadowRadius: 20,
        }
      : { elevation: 12 }),
  },
  createGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: theme.spacing.sm + 2,
  },
  createText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: dark.accent,
    letterSpacing: 0.3,
  },
  /* Section */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: dark.text,
  },
  viewAll: {
    fontSize: theme.fontSize.sm,
    color: dark.accent,
    fontWeight: '600',
  },
  emptyTeams: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  emptyTeamsText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: dark.textSecondary,
    marginTop: theme.spacing.xs,
  },
  emptyTeamsHint: {
    fontSize: theme.fontSize.sm,
    color: dark.textMuted,
    textAlign: 'center',
  },
});

/* ── Client-specific styles ── */
const clientStyles = StyleSheet.create({
  /* Workout card */
  workoutCard: {
    marginBottom: theme.spacing.sm + 2,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  workoutIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dark.accentBg,
    borderWidth: 1,
    borderColor: dark.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: dark.text,
  },
  workoutMeta: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: 3,
  },
  workoutMetaText: {
    fontSize: theme.fontSize.sm - 1,
    color: dark.textSecondary,
  },
  statusBadge: {
    backgroundColor: 'rgba(0,212,255,0.15)',
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: dark.accent,
  },
  /* Team card */
  teamCard: {
    marginBottom: theme.spacing.sm + 2,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  teamImage: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
  },
  teamImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: dark.whiteOverlay6,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: dark.text,
  },
  teamCategory: {
    fontSize: theme.fontSize.sm - 1,
    color: dark.textSecondary,
    marginTop: 2,
  },
});
