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
import GlassCard from '@/components/ui/GlassCard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { teamFormStyles } from '@/components/ui/teamFormStyles';

const dark = theme.dark.colors;

interface Plan {
  id: string;
  name: string;
  type: 'session' | 'time';
  sessions: number | null;
  duration_months: number | null;
  price: number;
  created_at: string;
}

const TYPE_PICKER_OPTIONS: {
  key: 'session' | 'time';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}[] = [
  { key: 'session', label: 'Session Based', icon: 'fitness-outline', description: 'Fixed number of sessions' },
  { key: 'time', label: 'Time Based', icon: 'calendar-outline', description: 'Fixed duration subscription' },
];

type FilterOption = 'all' | 'session' | 'time';

const FILTER_OPTIONS: { key: FilterOption; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'session', label: 'Session' },
  { key: 'time', label: 'Time' },
];

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'az' | 'za';

const SORT_OPTIONS: { key: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'newest', label: 'Newest first', icon: 'time-outline' },
  { key: 'price_asc', label: 'Price: Low → High', icon: 'trending-up-outline' },
  { key: 'price_desc', label: 'Price: High → Low', icon: 'trending-down-outline' },
  { key: 'az', label: 'Name: A → Z', icon: 'text-outline' },
  { key: 'za', label: 'Name: Z → A', icon: 'text-outline' },
];

/* ─── Type picker modal content (shared between iOS blur & Android fallback) ─── */
function TypePickerContent({
  onSelect,
}: {
  onSelect: (key: 'session' | 'time') => void;
}) {
  return (
    <View style={styles.modalContent}>
      <View style={styles.modalHandle} />
      <Text style={styles.modalTitle}>New Plan</Text>

      {TYPE_PICKER_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.key}
          style={styles.modalOption}
          activeOpacity={0.7}
          onPress={() => onSelect(option.key)}
        >
          <View style={styles.modalIconCircle}>
            <Ionicons name={option.icon} size={20} color={dark.accent} />
          </View>
          <View style={styles.modalOptionInfo}>
            <Text style={styles.modalOptionText}>{option.label}</Text>
            <Text style={styles.modalOptionDesc}>{option.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={dark.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ─── Sort modal content ─── */
function SortSheetContent({
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
            style={styles.sortOption}
            activeOpacity={0.7}
            onPress={() => onSelect(option.key)}
          >
            <View style={[styles.sortIconCircle, isActive && styles.sortIconCircleActive]}>
              <Ionicons
                name={option.icon}
                size={18}
                color={isActive ? dark.accent : dark.textMuted}
              />
            </View>
            <Text style={[styles.sortOptionText, isActive && styles.sortOptionTextActive]}>
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

/* ─── Plan card ─── */
function PlanCard({ plan, onPress }: { plan: Plan; onPress: () => void }) {
  const detail =
    plan.type === 'session'
      ? `${plan.sessions} Session${plan.sessions !== 1 ? 's' : ''}`
      : `${plan.duration_months} Month${plan.duration_months !== 1 ? 's' : ''}`;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <GlassCard style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>{plan.name}</Text>
          <View style={[styles.typeBadge, plan.type === 'time' && styles.typeBadgeTime]}>
            <Text style={[styles.typeBadgeText, plan.type === 'time' && styles.typeBadgeTextTime]}>
              {plan.type === 'session' ? 'SESSION' : 'TIME'}
            </Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.cardDetail}>{detail}</Text>
          <Text style={styles.cardPrice}>
            {Number(plan.price) > 0 ? `${Number(plan.price).toFixed(2)} RON` : 'Free'}
          </Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

export default function PlansScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [sort, setSort] = useState<SortOption>('newest');

  const fetchPlans = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from('plans')
      .select('id, name, type, sessions, duration_months, price, created_at')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setPlans(data as Plan[]);
    }

    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchPlans();
    }, [fetchPlans])
  );

  const handleTypeSelect = (type: 'session' | 'time') => {
    setModalVisible(false);
    router.push(`/create-plan?type=${type}`);
  };

  /* Filtered + sorted list */
  const filteredPlans = useMemo(() => {
    let list = plans;

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Type filter
    if (filter !== 'all') {
      list = list.filter((p) => p.type === filter);
    }

    // Sort
    const sorted = [...list];
    switch (sort) {
      case 'newest':
        sorted.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
        break;
      case 'price_asc':
        sorted.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case 'price_desc':
        sorted.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case 'az':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'za':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return sorted;
  }, [plans, search, filter, sort]);

  const hasFiltersActive = search.trim() !== '' || filter !== 'all';

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Plans</Text>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.7}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={22} color={dark.accent} />
          </TouchableOpacity>
        </View>

        {/* Search + Sort row */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={dark.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search plans..."
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

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                teamFormStyles.pill,
                filter === opt.key && teamFormStyles.pillActive,
              ]}
              onPress={() => setFilter(opt.key)}
            >
              <Text
                style={[
                  teamFormStyles.pillText,
                  filter === opt.key && teamFormStyles.pillTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
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
            {filteredPlans.length > 0 ? (
              filteredPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onPress={() => router.push(`/edit-plan?id=${plan.id}`)}
                />
              ))
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name={hasFiltersActive ? 'search-outline' : 'clipboard-outline'}
                    size={40}
                    color={dark.textMuted}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {hasFiltersActive ? 'No results found' : 'No plans yet'}
                </Text>
                <Text style={styles.emptyHint}>
                  {hasFiltersActive
                    ? 'Try adjusting your search or filters'
                    : 'Tap the "+" button to create your first training plan'}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Type picker modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <View style={styles.modalSheetOuter} onStartShouldSetResponder={() => true}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={60} tint="dark" style={styles.modalBlur}>
                <TypePickerContent onSelect={handleTypeSelect} />
              </BlurView>
            ) : (
              <View style={[styles.modalBlur, styles.modalAndroidBg]}>
                <TypePickerContent onSelect={handleTypeSelect} />
              </View>
            )}
          </View>
        </Pressable>
      </Modal>

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
                <SortSheetContent
                  sort={sort}
                  onSelect={(key) => { setSort(key); setSortModalVisible(false); }}
                />
              </BlurView>
            ) : (
              <View style={[styles.modalBlur, styles.modalAndroidBg]}>
                <SortSheetContent
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
    alignItems: 'center',
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: dark.glassCircleBg,
    borderWidth: 1,
    borderColor: dark.glassCircleBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: dark.glassShadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
        }
      : { elevation: 6 }),
  },
  /* Toolbar */
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
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
  /* Filter row */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
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
  /* Plan card */
  card: {
    marginBottom: theme.spacing.sm + 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  cardName: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: dark.text,
    marginRight: theme.spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: dark.accentBg,
    borderWidth: 1,
    borderColor: dark.accentBorder,
  },
  typeBadgeTime: {
    backgroundColor: dark.successGreenBg,
    borderColor: dark.successBorder,
  },
  typeBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: dark.accent,
    letterSpacing: 0.5,
  },
  typeBadgeTextTime: {
    color: dark.successGreen,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDetail: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
  },
  cardPrice: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: dark.accent,
  },
  /* Empty state */
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.xs,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: dark.whiteOverlay5,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: dark.textSecondary,
  },
  emptyHint: {
    fontSize: theme.fontSize.sm,
    color: dark.textMuted,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  /* Modal — liquid glass bottom sheet (shared by type picker + sort) */
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
  /* Type picker options */
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: theme.spacing.md,
  },
  modalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: dark.accentBg,
    borderWidth: 1,
    borderColor: dark.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionInfo: {
    flex: 1,
  },
  modalOptionText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: dark.text,
  },
  modalOptionDesc: {
    fontSize: theme.fontSize.sm - 1,
    color: dark.textSecondary,
    marginTop: 2,
  },
  /* Sort options */
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: theme.spacing.md,
  },
  sortIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: dark.whiteOverlay6,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortIconCircleActive: {
    backgroundColor: dark.accentBg,
    borderColor: dark.accentBorder,
  },
  sortOptionText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: dark.accent,
    fontWeight: '600',
  },
});
