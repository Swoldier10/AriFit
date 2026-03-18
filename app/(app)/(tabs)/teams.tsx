import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import ScreenBackground from '@/components/ui/ScreenBackground';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import TeamCard, { type TeamData } from '@/components/trainer/TeamCard';
import ClientRow, { type ClientRowData } from '@/components/trainer/ClientRow';
import GlassCard from '@/components/ui/GlassCard';
import GlassInput from '@/components/ui/GlassInput';
import { teamFormStyles } from '@/components/ui/teamFormStyles';

const dark = theme.dark.colors;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type InnerTab = 'members' | 'teams';

/** Raw row shape returned by Supabase for teams with aggregate count */
interface RawTeamRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  team_members: { count: number }[];
  team_schedules: { day_of_week: number; start_time: string }[];
}

interface RawClientRow {
  id: string;
  client_id: string;
  status: string;
  profiles: { full_name: string | null; avatar_url: string | null; phone: string | null } | null;
  plans: { name: string } | null;
}

interface TeamMembershipRow {
  user_id: string;
  team_id: string;
  teams: { name: string } | null;
}

type SortOption =
  | 'newest'
  | 'oldest'
  | 'az'
  | 'za'
  | 'size_desc'
  | 'size_asc';

const SORT_OPTIONS: { key: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'newest', label: 'Newest first', icon: 'time-outline' },
  { key: 'oldest', label: 'Oldest first', icon: 'hourglass-outline' },
  { key: 'az', label: 'Name (A\u2013Z)', icon: 'text-outline' },
  { key: 'za', label: 'Name (Z\u2013A)', icon: 'text-outline' },
  { key: 'size_desc', label: 'Largest team', icon: 'people-outline' },
  { key: 'size_asc', label: 'Smallest team', icon: 'person-outline' },
];

/* ─── Sort sheet inner content ─── */
function ModalSheetContent({
  sort,
  onSelect,
}: {
  sort: SortOption;
  onSelect: (key: SortOption) => void;
}) {
  return (
    <View style={styles.modalContent}>
      <View style={styles.modalHandle} />
      <Text style={styles.modalTitle}>Sort by</Text>
      {SORT_OPTIONS.map((option) => {
        const isActive = sort === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.modalOption, isActive && styles.modalOptionActive]}
            activeOpacity={0.7}
            onPress={() => onSelect(option.key)}
          >
            <View style={[styles.modalIconCircle, isActive && styles.modalIconCircleActive]}>
              <Ionicons
                name={option.icon}
                size={18}
                color={isActive ? dark.accent : dark.textMuted}
              />
            </View>
            <Text
              style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}
            >
              {option.label}
            </Text>
            {isActive && (
              <Ionicons name="checkmark-circle" size={22} color={dark.accent} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ─── Client detail sheet inner content ─── */
function ClientDetailContent({
  client,
  teams: allTeams,
  teamDropdownOpen,
  onToggleDropdown,
  onTeamChange,
  changingTeam,
  schedules,
  setSchedules,
  addingSession,
  setAddingSession,
  newDay,
  setNewDay,
  newHour,
  setNewHour,
  newMinute,
  setNewMinute,
  onSaveSchedule,
  savingSchedule,
}: {
  client: ClientRowData | null;
  teams: TeamData[];
  teamDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onTeamChange: (teamId: string | null) => void;
  changingTeam: boolean;
  schedules: { id?: string; day_of_week: number; start_time: string }[];
  setSchedules: (s: { id?: string; day_of_week: number; start_time: string }[]) => void;
  addingSession: boolean;
  setAddingSession: (v: boolean) => void;
  newDay: number;
  setNewDay: (v: number) => void;
  newHour: string;
  setNewHour: (v: string) => void;
  newMinute: string;
  setNewMinute: (v: string) => void;
  onSaveSchedule: () => void;
  savingSchedule: boolean;
}) {
  if (!client) return null;

  const infoRows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null }[] = [
    { icon: 'call-outline', label: 'Phone', value: client.phone },
    { icon: 'mail-outline', label: 'Email', value: client.email },
  ];

  const sortedSchedules = [...schedules].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  const handleAddSession = () => {
    const h = parseInt(newHour, 10);
    const m = parseInt(newMinute, 10);
    if (isNaN(h) || h < 0 || h > 23) { Alert.alert('Invalid hour', 'Hour must be 0–23'); return; }
    if (isNaN(m) || m < 0 || m > 59) { Alert.alert('Invalid minute', 'Minute must be 0–59'); return; }
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const duplicate = schedules.some((s) => s.day_of_week === newDay && s.start_time.slice(0, 5) === time);
    if (duplicate) { Alert.alert('Duplicate', 'A session at this day and time already exists'); return; }
    setSchedules([...schedules, { day_of_week: newDay, start_time: time }]);
    setAddingSession(false);
    setNewHour('08');
    setNewMinute('00');
  };

  const handleDeleteSchedule = (index: number) => {
    setSchedules(sortedSchedules.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.modalContent}>
      <View style={styles.modalHandle} />

        {/* Avatar */}
        <View style={styles.clientAvatarWrap}>
          {client.avatar_url ? (
            <Image source={{ uri: client.avatar_url }} style={styles.clientAvatarImg} />
          ) : (
            <Ionicons name="person" size={32} color={dark.textMuted} />
          )}
        </View>

        {/* Name */}
        <Text style={styles.clientName}>{client.full_name ?? 'Unknown'}</Text>

        {/* Info rows */}
        {infoRows.map((row) => (
          <View key={row.label} style={styles.clientInfoRow}>
            <View style={styles.clientInfoIcon}>
              <Ionicons name={row.icon} size={18} color={dark.textMuted} />
            </View>
            <Text style={styles.clientInfoLabel}>{row.label}</Text>
            <Text
              style={[styles.clientInfoValue, !row.value && styles.clientInfoValueMuted]}
              numberOfLines={1}
            >
              {row.value ?? 'Not provided'}
            </Text>
          </View>
        ))}

        {/* Plan row */}
        <View style={styles.clientInfoRow}>
          <View style={styles.clientInfoIcon}>
            <Ionicons name="pricetag-outline" size={18} color={dark.textMuted} />
          </View>
          <Text style={styles.clientInfoLabel}>Plan</Text>
          {client.plan_name ? (
            <View style={styles.clientPlanPill}>
              <Text style={styles.clientPlanPillText}>{client.plan_name}</Text>
            </View>
          ) : (
            <Text style={[styles.clientInfoValue, styles.clientInfoValueMuted]}>No plan</Text>
          )}
        </View>

        {/* Team selector */}
        <View style={styles.clientSectionDivider} />
        <Text style={styles.clientSectionTitle}>Group</Text>

        <TouchableOpacity
          style={styles.teamSelector}
          activeOpacity={0.7}
          onPress={onToggleDropdown}
          disabled={changingTeam}
        >
          <Ionicons name="people-outline" size={18} color={dark.textSecondary} />
          <Text style={styles.teamSelectorText}>
            {client.team_name ?? 'No group'}
          </Text>
          {changingTeam ? (
            <ActivityIndicator size="small" color={dark.accent} />
          ) : (
            <Ionicons
              name={teamDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={dark.textMuted}
            />
          )}
        </TouchableOpacity>

        {teamDropdownOpen && (
          <View style={styles.teamDropdown}>
            <TouchableOpacity
              style={[
                styles.teamDropdownItem,
                !client.team_id && styles.teamDropdownItemActive,
              ]}
              onPress={() => onTeamChange(null)}
            >
              <Text
                style={[
                  styles.teamDropdownItemText,
                  !client.team_id && styles.teamDropdownItemTextActive,
                ]}
              >
                No group
              </Text>
              {!client.team_id && (
                <Ionicons name="checkmark-circle" size={18} color={dark.accent} />
              )}
            </TouchableOpacity>
            {allTeams.map((team) => {
              const isActive = client.team_id === team.id;
              return (
                <TouchableOpacity
                  key={team.id}
                  style={[
                    styles.teamDropdownItem,
                    isActive && styles.teamDropdownItemActive,
                  ]}
                  onPress={() => onTeamChange(team.id)}
                >
                  <Text
                    style={[
                      styles.teamDropdownItemText,
                      isActive && styles.teamDropdownItemTextActive,
                    ]}
                  >
                    {team.name}
                  </Text>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={18} color={dark.accent} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Schedule section */}
        <View style={styles.clientSectionDivider} />
        <Text style={styles.clientSectionTitle}>Schedule</Text>

        {sortedSchedules.length > 0 && (
          <View style={styles.csScheduleList}>
            {sortedSchedules.map((s, i) => (
              <View key={`${s.day_of_week}-${s.start_time}-${i}`}>
                <View style={styles.csScheduleRow}>
                  <Text style={styles.csScheduleDayText}>{DAY_NAMES[s.day_of_week]}</Text>
                  <Text style={styles.csScheduleTimeText}>{s.start_time.slice(0, 5)}</Text>
                  <TouchableOpacity style={styles.csScheduleDeleteBtn} onPress={() => handleDeleteSchedule(i)}>
                    <Ionicons name="close" size={14} color={dark.error} />
                  </TouchableOpacity>
                </View>
                {i < sortedSchedules.length - 1 && (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: theme.spacing.md }} />
                )}
              </View>
            ))}
          </View>
        )}

        {addingSession && (
          <View style={styles.csAddSessionCard}>
            <View style={[teamFormStyles.pillRow, { justifyContent: 'center', marginBottom: theme.spacing.sm }]}>
              {DAY_NAMES.map((d, i) => (
                <TouchableOpacity
                  key={d}
                  style={[teamFormStyles.pill, newDay === i && teamFormStyles.pillActive]}
                  onPress={() => setNewDay(i)}
                >
                  <Text style={[teamFormStyles.pillText, newDay === i && teamFormStyles.pillTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.csTimeInputRow}>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Hour"
                  placeholder="08"
                  value={newHour}
                  onChangeText={(t: string) => setNewHour(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={{ textAlign: 'center' }}
                />
              </View>
              <Text style={styles.csColonText}>:</Text>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Min"
                  placeholder="00"
                  value={newMinute}
                  onChangeText={(t: string) => setNewMinute(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={{ textAlign: 'center' }}
                />
              </View>
            </View>

            <View style={styles.csActionBtnRow}>
              <TouchableOpacity style={styles.csCancelBtn} activeOpacity={0.7} onPress={() => setAddingSession(false)}>
                <Text style={styles.csCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.csAddBtn} activeOpacity={0.8} onPress={handleAddSession}>
                <Ionicons name="checkmark" size={18} color={dark.background} />
                <Text style={styles.csAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!addingSession && (
          <TouchableOpacity
            style={styles.csAddSessionBtn}
            activeOpacity={0.8}
            onPress={() => setAddingSession(true)}
          >
            <Text style={styles.csAddBtnText}>Add Session</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.csSaveScheduleBtn, savingSchedule && { opacity: 0.6 }]}
          activeOpacity={0.8}
          onPress={onSaveSchedule}
          disabled={savingSchedule}
        >
          {savingSchedule ? (
            <ActivityIndicator color={dark.background} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color={dark.background} />
              <Text style={styles.csAddBtnText}>Save Schedule</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
  );
}

export default function TeamsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;

  const [activeTab, setActiveTab] = useState<InnerTab>('members');

  /* Teams state */
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsSearch, setTeamsSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  /* Members state */
  const [clients, setClients] = useState<ClientRowData[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersSearch, setMembersSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientRowData | null>(null);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [changingTeam, setChangingTeam] = useState(false);

  /* Client schedule state */
  const [clientSchedules, setClientSchedules] = useState<{ id?: string; day_of_week: number; start_time: string }[]>([]);
  const [addingClientSession, setAddingClientSession] = useState(false);
  const [clientNewDay, setClientNewDay] = useState(0);
  const [clientNewHour, setClientNewHour] = useState('08');
  const [clientNewMinute, setClientNewMinute] = useState('00');
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchTeams = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from('teams')
      .select('id, name, category, description, image_url, created_at, team_members(count), team_schedules(day_of_week, start_time)')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (data) {
      const mapped: TeamData[] = (data as RawTeamRow[]).map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        description: t.description,
        image_url: t.image_url,
        member_count: t.team_members?.[0]?.count ?? 0,
        created_at: t.created_at,
        schedules: t.team_schedules ?? [],
      }));
      setTeams(mapped);
    }

    setTeamsLoading(false);
  }, [userId]);

  const fetchClients = useCallback(async () => {
    if (!userId) return;

    // 1. Get all clients for this trainer
    const { data: clientRows } = await supabase
      .from('trainer_clients')
      .select('id, client_id, status, profiles!trainer_clients_client_id_fkey(full_name, avatar_url, phone), plans!trainer_clients_plan_id_fkey(name)')
      .eq('trainer_id', userId)
      .eq('status', 'active');

    if (!clientRows || clientRows.length === 0) {
      setClients([]);
      setMembersLoading(false);
      return;
    }

    const rows = clientRows as unknown as RawClientRow[];
    const clientIds = rows.map((c) => c.client_id);

    // 2. Get trainer's team IDs
    const { data: trainerTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('created_by', userId);

    const trainerTeamIds = (trainerTeams ?? []).map((t) => t.id);

    // 3. Get team memberships for trainer's own teams
    let teamMemberships: TeamMembershipRow[] = [];
    if (trainerTeamIds.length > 0 && clientIds.length > 0) {
      const { data: tmData } = await supabase
        .from('team_members')
        .select('user_id, team_id, teams(name)')
        .in('user_id', clientIds)
        .in('team_id', trainerTeamIds)
        .eq('status', 'active');

      teamMemberships = (tmData as unknown as TeamMembershipRow[]) ?? [];
    }

    // 4. Fetch emails via RPC
    const emailMap = new Map<string, string | null>();
    await Promise.all(
      rows.map(async (c) => {
        const { data: email } = await supabase.rpc('get_client_email', {
          client_user_id: c.client_id,
        });
        emailMap.set(c.client_id, email ?? null);
      })
    );

    // 5. Fetch client schedules for all trainer_client IDs
    const trainerClientIds = rows.map((c) => c.id);
    const { data: allClientSchedules } = await supabase
      .from('client_schedules')
      .select('trainer_client_id, day_of_week, start_time')
      .in('trainer_client_id', trainerClientIds);

    // 6. Merge: attach team name, phone, email, schedules to each client
    const merged: ClientRowData[] = rows.map((c) => {
      const membership = teamMemberships.find((tm) => tm.user_id === c.client_id);
      return {
        id: c.id,
        client_id: c.client_id,
        full_name: c.profiles?.full_name ?? null,
        avatar_url: c.profiles?.avatar_url ?? null,
        team_name: membership?.teams?.name ?? null,
        team_id: membership?.team_id ?? null,
        plan_name: c.plans?.name ?? null,
        phone: c.profiles?.phone ?? null,
        email: emailMap.get(c.client_id) ?? null,
        schedules: (allClientSchedules ?? [])
          .filter((s) => s.trainer_client_id === c.id)
          .map(({ day_of_week, start_time }) => ({ day_of_week, start_time })),
      };
    });

    setClients(merged);
    setMembersLoading(false);
  }, [userId]);

  const openClientModal = useCallback(async (client: ClientRowData) => {
    setSelectedClient(client);
    setTeamDropdownOpen(false);
    setAddingClientSession(false);
    setClientModalVisible(true);

    const { data: schedData } = await supabase
      .from('client_schedules')
      .select('id, day_of_week, start_time')
      .eq('trainer_client_id', client.id)
      .order('day_of_week')
      .order('start_time');
    if (schedData) setClientSchedules(schedData);
    else setClientSchedules([]);
  }, []);

  const closeClientModal = useCallback(() => {
    setClientModalVisible(false);
    setSelectedClient(null);
    setTeamDropdownOpen(false);
    setClientSchedules([]);
    setAddingClientSession(false);
  }, []);

  const handleTeamChange = useCallback(
    async (teamId: string | null) => {
      if (!selectedClient || !userId) return;
      setChangingTeam(true);

      // Get trainer's team IDs
      const { data: trainerTeams } = await supabase
        .from('teams')
        .select('id')
        .eq('created_by', userId);
      const trainerTeamIds = (trainerTeams ?? []).map((t) => t.id);

      // Remove existing memberships in trainer's teams for this client
      if (trainerTeamIds.length > 0) {
        await supabase
          .from('team_members')
          .delete()
          .eq('user_id', selectedClient.client_id)
          .in('team_id', trainerTeamIds);
      }

      // Insert new membership if a team was selected
      if (teamId) {
        await supabase.from('team_members').insert({
          team_id: teamId,
          user_id: selectedClient.client_id,
          status: 'active',
          role: 'member',
        });
      }

      // Find the new team name
      const newTeam = teams.find((t) => t.id === teamId);
      setSelectedClient({
        ...selectedClient,
        team_id: teamId,
        team_name: newTeam?.name ?? null,
      });

      setTeamDropdownOpen(false);
      setChangingTeam(false);

      // Refresh both lists
      fetchClients();
      fetchTeams();
    },
    [selectedClient, userId, teams, fetchClients, fetchTeams]
  );

  const handleSaveClientSchedule = useCallback(async () => {
    if (!selectedClient) return;
    setSavingSchedule(true);
    await supabase.from('client_schedules').delete().eq('trainer_client_id', selectedClient.id);
    if (clientSchedules.length > 0) {
      await supabase.from('client_schedules').insert(
        clientSchedules.map((s) => ({
          trainer_client_id: selectedClient.id,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
        }))
      );
    }
    setClients((prev) => prev.map((c) =>
      c.id === selectedClient.id ? { ...c, schedules: clientSchedules } : c
    ));
    setSavingSchedule(false);
  }, [selectedClient, clientSchedules]);

  useFocusEffect(
    useCallback(() => {
      setTeamsLoading(true);
      setMembersLoading(true);
      fetchTeams();
      fetchClients();
    }, [fetchTeams, fetchClients])
  );

  /* Filtered + sorted teams */
  const filteredTeams = useMemo(() => {
    let list = teams;
    if (teamsSearch.trim()) {
      const q = teamsSearch.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    const sorted = [...list];
    switch (sort) {
      case 'newest':
        sorted.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
        break;
      case 'oldest':
        sorted.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
        break;
      case 'az':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'za':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'size_desc':
        sorted.sort((a, b) => b.member_count - a.member_count);
        break;
      case 'size_asc':
        sorted.sort((a, b) => a.member_count - b.member_count);
        break;
    }
    return sorted;
  }, [teams, teamsSearch, sort]);

  /* Filtered clients */
  const filteredClients = useMemo(() => {
    if (!membersSearch.trim()) return clients;
    const q = membersSearch.trim().toLowerCase();
    return clients.filter((c) => (c.full_name ?? '').toLowerCase().includes(q));
  }, [clients, membersSearch]);

  const search = activeTab === 'members' ? membersSearch : teamsSearch;
  const setSearch = activeTab === 'members' ? setMembersSearch : setTeamsSearch;
  const placeholder = activeTab === 'members' ? 'Search clients...' : 'Search teams...';

  const TABS: { key: InnerTab; label: string }[] = [
    { key: 'members', label: 'Members' },
    { key: 'teams', label: 'Teams' },
  ];

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Clients</Text>
          <Text style={styles.headerCount}>
            {activeTab === 'members'
              ? `${clients.length} client${clients.length !== 1 ? 's' : ''}`
              : `${teams.length} team${teams.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        {/* Inner tab bar */}
        <View style={styles.innerTabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.innerTab, isActive && styles.innerTabActive]}
                activeOpacity={0.7}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.innerTabText, isActive && styles.innerTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search + Sort row */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={dark.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor={dark.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={dark.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {activeTab === 'teams' && (
            <TouchableOpacity
              style={styles.sortButton}
              activeOpacity={0.7}
              onPress={() => setSortModalVisible(true)}
            >
              <Ionicons name="swap-vertical" size={20} color={dark.accent} />
            </TouchableOpacity>
          )}
          {activeTab === 'teams' && (
            <TouchableOpacity
              style={styles.sortButton}
              activeOpacity={0.7}
              onPress={() => router.push('/create-team')}
            >
              <Ionicons name="add" size={22} color={dark.accent} />
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        {activeTab === 'members' ? (
          membersLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={dark.accent} size="large" />
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {filteredClients.length > 0 ? (
                <GlassCard padding={0}>
                  {filteredClients.map((client, i) => (
                    <TouchableOpacity
                      key={client.id}
                      activeOpacity={0.7}
                      onPress={() => openClientModal(client)}
                    >
                      <ClientRow
                        client={client}
                        showDivider={i < filteredClients.length - 1}
                      />
                    </TouchableOpacity>
                  ))}
                </GlassCard>
              ) : (
                <View style={styles.empty}>
                  <Ionicons
                    name={membersSearch ? 'search-outline' : 'people-outline'}
                    size={36}
                    color={dark.textMuted}
                  />
                  <Text style={styles.emptyTitle}>
                    {membersSearch ? 'No clients found' : 'No clients yet'}
                  </Text>
                  <Text style={styles.emptyHint}>
                    {membersSearch
                      ? `No results for "${membersSearch}"`
                      : 'Add clients from the dashboard'}
                  </Text>
                </View>
              )}
            </ScrollView>
          )
        ) : teamsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={dark.accent} size="large" />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredTeams.length > 0 ? (
              filteredTeams.map((team) => (
                <TeamCard key={team.id} team={team} onPress={() => router.push(`/edit-team?id=${team.id}`)} />
              ))
            ) : (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={36} color={dark.textMuted} />
                <Text style={styles.emptyTitle}>
                  {teamsSearch ? 'No teams found' : 'No teams yet'}
                </Text>
                <Text style={styles.emptyHint}>
                  {teamsSearch
                    ? `No results for "${teamsSearch}"`
                    : 'Create your first team from the dashboard'}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Sort modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSortModalVisible(false)}>
          <View style={styles.modalSheetOuter} onStartShouldSetResponder={() => true}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={60} tint="dark" style={styles.modalBlur}>
                <ModalSheetContent
                  sort={sort}
                  onSelect={(key) => { setSort(key); setSortModalVisible(false); }}
                />
              </BlurView>
            ) : (
              <View style={[styles.modalBlur, styles.modalAndroidBg]}>
                <ModalSheetContent
                  sort={sort}
                  onSelect={(key) => { setSort(key); setSortModalVisible(false); }}
                />
              </View>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Client detail modal */}
      <Modal
        visible={clientModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeClientModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={closeClientModal} />
          <View style={styles.modalSheetOuter}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={60} tint="dark" style={styles.modalBlur}>
                <ScrollView
                  style={styles.clientModalScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                >
                  <ClientDetailContent
                    client={selectedClient}
                    teams={teams}
                    teamDropdownOpen={teamDropdownOpen}
                    onToggleDropdown={() => setTeamDropdownOpen((v) => !v)}
                    onTeamChange={handleTeamChange}
                    changingTeam={changingTeam}
                    schedules={clientSchedules}
                    setSchedules={setClientSchedules}
                    addingSession={addingClientSession}
                    setAddingSession={setAddingClientSession}
                    newDay={clientNewDay}
                    setNewDay={setClientNewDay}
                    newHour={clientNewHour}
                    setNewHour={setClientNewHour}
                    newMinute={clientNewMinute}
                    setNewMinute={setClientNewMinute}
                    onSaveSchedule={handleSaveClientSchedule}
                    savingSchedule={savingSchedule}
                  />
                </ScrollView>
              </BlurView>
            ) : (
              <View style={[styles.modalBlur, styles.modalAndroidBg]}>
                <ScrollView
                  style={styles.clientModalScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                >
                  <ClientDetailContent
                    client={selectedClient}
                    teams={teams}
                    teamDropdownOpen={teamDropdownOpen}
                    onToggleDropdown={() => setTeamDropdownOpen((v) => !v)}
                    onTeamChange={handleTeamChange}
                    changingTeam={changingTeam}
                    schedules={clientSchedules}
                    setSchedules={setClientSchedules}
                    addingSession={addingClientSession}
                    setAddingSession={setAddingClientSession}
                    newDay={clientNewDay}
                    setNewDay={setClientNewDay}
                    newHour={clientNewHour}
                    setNewHour={setClientNewHour}
                    newMinute={clientNewMinute}
                    setNewMinute={setClientNewMinute}
                    onSaveSchedule={handleSaveClientSchedule}
                    savingSchedule={savingSchedule}
                  />
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl + 4,
    fontWeight: '800',
    color: dark.text,
  },
  headerCount: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
    fontWeight: '500',
  },
  /* Inner tab bar */
  innerTabBar: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: dark.whiteOverlay5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    padding: 4,
  },
  innerTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 16,
  },
  innerTabActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  innerTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: dark.textMuted,
  },
  innerTabTextActive: {
    color: dark.accent,
  },
  /* Toolbar */
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm + 2,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.inputBackgroundGlass,
    borderWidth: 1,
    borderColor: dark.inputBorderGlass,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: dark.text,
  },
  sortButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dark.inputBackgroundGlass,
    borderWidth: 1,
    borderColor: dark.inputBorderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* List */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Empty state */
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.xs,
  },
  emptyTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: dark.textSecondary,
    marginTop: theme.spacing.sm,
  },
  emptyHint: {
    fontSize: theme.fontSize.sm,
    color: dark.textMuted,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  /* Sort modal — liquid glass */
  modalBackdrop: {
    flex: 1,
    backgroundColor: dark.modalBackdrop,
    justifyContent: 'flex-end',
  },
  modalSheetOuter: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.5,
          shadowRadius: 24,
        }
      : { elevation: 24 }),
  },
  modalBlur: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  modalAndroidBg: {
    backgroundColor: 'rgba(14,22,42,0.92)',
  },
  modalContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl + 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.xs,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: dark.text,
    marginBottom: theme.spacing.md + 4,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: theme.spacing.md,
  },
  modalOptionActive: {},
  modalIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: dark.whiteOverlay6,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconCircleActive: {
    backgroundColor: dark.accentBg,
    borderColor: dark.accentBorder,
  },
  modalOptionText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
    fontWeight: '500',
  },
  modalOptionTextActive: {
    color: dark.accent,
    fontWeight: '600',
  },
  /* Client detail modal */
  clientAvatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: dark.whiteOverlay6,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  clientAvatarImg: {
    width: '100%',
    height: '100%',
  },
  clientName: {
    fontSize: theme.fontSize.lg + 2,
    fontWeight: '700',
    color: dark.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  clientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: theme.spacing.md,
  },
  clientInfoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: dark.whiteOverlay6,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientInfoLabel: {
    fontSize: theme.fontSize.md,
    color: dark.textMuted,
    fontWeight: '500',
    width: 52,
  },
  clientInfoValue: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: dark.text,
    fontWeight: '500',
    textAlign: 'right',
  },
  clientInfoValueMuted: {
    color: dark.textMuted,
    fontStyle: 'italic',
  },
  clientPlanPill: {
    marginLeft: 'auto',
    backgroundColor: dark.successGreenBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  clientPlanPillText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: dark.successGreen,
  },
  clientSectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginVertical: theme.spacing.md,
  },
  clientSectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: dark.text,
    marginBottom: theme.spacing.sm,
  },
  teamSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.whiteOverlay5,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: theme.spacing.sm,
  },
  teamSelectorText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: dark.text,
    fontWeight: '500',
  },
  teamDropdown: {
    marginTop: theme.spacing.xs,
    backgroundColor: dark.whiteOverlay5,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  teamDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  teamDropdownItemActive: {
    backgroundColor: dark.accentBg,
  },
  teamDropdownItemText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
    fontWeight: '500',
  },
  teamDropdownItemTextActive: {
    color: dark.accent,
    fontWeight: '600',
  },
  clientModalScroll: {
    maxHeight: Dimensions.get('window').height * 0.7,
  },
  /* Client schedule styles */
  csScheduleList: {
    backgroundColor: dark.whiteOverlay5,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  csScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  csScheduleDayText: {
    fontWeight: '700',
    color: dark.accent,
    fontSize: theme.fontSize.md,
    width: 44,
  },
  csScheduleTimeText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
  },
  csScheduleDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: dark.errorBg,
    borderWidth: 1,
    borderColor: dark.errorBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  csAddSessionCard: {
    backgroundColor: dark.whiteOverlay5,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  csTimeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  csColonText: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: dark.textSecondary,
    marginTop: theme.spacing.xs,
  },
  csActionBtnRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  csAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: dark.accent,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm + 2,
  },
  csAddBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: dark.background,
  },
  csCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: dark.whiteOverlay5,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
  },
  csCancelBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: dark.textMuted,
  },
  csAddSessionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: dark.accent,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  csSaveScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: dark.accent,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
});
