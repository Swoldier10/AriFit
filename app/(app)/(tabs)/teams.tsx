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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import ScreenBackground from '@/components/ui/ScreenBackground';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import TeamCard, { type TeamData } from '@/components/trainer/TeamCard';

const dark = theme.dark.colors;

/** Raw row shape returned by Supabase for teams with aggregate count */
interface RawTeamRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  team_members: { count: number }[];
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

/* ─── Sort sheet inner content (shared between iOS blur & Android fallback) ─── */
function ModalSheetContent({
  sort,
  onSelect,
}: {
  sort: SortOption;
  onSelect: (key: SortOption) => void;
}) {
  return (
    <View style={styles.modalContent}>
      {/* Drag handle */}
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

export default function TeamsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;

  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const fetchTeams = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from('teams')
      .select('id, name, category, description, image_url, created_at, team_members(count)')
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
      }));
      setTeams(mapped);
    }

    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchTeams();
    }, [fetchTeams])
  );

  /* Filtered + sorted list */
  const filteredTeams = useMemo(() => {
    let list = teams;

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }

    // Sort
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
  }, [teams, search, sort]);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Teams</Text>
          <Text style={styles.headerCount}>
            {teams.length} team{teams.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Search + Sort row */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={dark.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search teams..."
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
          <TouchableOpacity
            style={styles.sortButton}
            activeOpacity={0.7}
            onPress={() => setSortModalVisible(true)}
          >
            <Ionicons name="swap-vertical" size={20} color={dark.accent} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
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
                  {search ? 'No teams found' : 'No teams yet'}
                </Text>
                <Text style={styles.emptyHint}>
                  {search
                    ? `No results for "${search}"`
                    : 'Create your first team from the dashboard'}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Sort modal — liquid glass bottom sheet (rendered inside ScreenBackground) */}
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
    // Subtle glass surface tint
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
});
