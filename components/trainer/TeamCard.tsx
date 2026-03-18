import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '@/components/ui/GlassCard';
import { theme } from '@/constants/theme';

const dark = theme.dark.colors;

const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface TeamData {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  member_count: number;
  created_at?: string;
  schedules?: { day_of_week: number; start_time: string }[];
}

interface TeamCardProps {
  team: TeamData;
  onPress: () => void;
}

export default function TeamCard({ team, onPress }: TeamCardProps) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <GlassCard padding={0} style={styles.card} blurIntensity={25}>
        {/* Cover image */}
        <View style={styles.imageContainer}>
          {team.image_url ? (
            <Image
              source={{ uri: team.image_url }}
              style={styles.image}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="people" size={36} color={dark.textMuted} />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(11,17,32,0.85)']}
            style={styles.gradient}
          />
          {/* Category badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{team.category.toUpperCase()}</Text>
          </View>
        </View>

        {/* Info row */}
        <View style={styles.content}>
          <View style={styles.textCol}>
            <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
            <Text style={styles.memberText}>
              {team.member_count} Member{team.member_count !== 1 ? 's' : ''}
              {' \u00B7 Active'}
            </Text>
            {team.schedules && team.schedules.length > 0 && (() => {
              const sorted = [...team.schedules].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
              const days = sorted.map((s) => DAY_NAMES_SHORT[s.day_of_week]);
              const firstTime = sorted[0].start_time.slice(0, 5);
              return (
                <View style={styles.scheduleRow}>
                  <Ionicons name="calendar-outline" size={14} color={dark.textMuted} />
                  <Text style={styles.scheduleText}>
                    {days.join(', ')} {'\u00B7'} {firstTime}
                  </Text>
                </View>
              );
            })()}
          </View>

          {/* Circular chevron button */}
          <View style={styles.chevronCircle}>
            <Ionicons name="chevron-forward" size={20} color={dark.accent} />
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const CHEVRON_SIZE = 40;

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 190,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  badge: {
    position: 'absolute',
    top: theme.spacing.sm + 2,
    left: theme.spacing.sm + 2,
    backgroundColor: dark.badgeBg,
    borderWidth: 1,
    borderColor: dark.glassButtonBorder,
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: dark.badgeText,
    letterSpacing: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md + 2,
    paddingVertical: theme.spacing.md,
  },
  textCol: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  teamName: {
    fontSize: theme.fontSize.lg + 1,
    fontWeight: '700',
    color: dark.text,
    marginBottom: 4,
  },
  memberText: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  scheduleText: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
  },
  chevronCircle: {
    width: CHEVRON_SIZE,
    height: CHEVRON_SIZE,
    borderRadius: CHEVRON_SIZE / 2,
    backgroundColor: dark.accentBg,
    borderWidth: 1,
    borderColor: dark.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
