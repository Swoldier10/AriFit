import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

const dark = theme.dark.colors;

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface ClientRowData {
  id: string;
  client_id: string;
  full_name: string | null;
  avatar_url: string | null;
  team_name: string | null;
  team_id: string | null;
  plan_name: string | null;
  phone: string | null;
  email: string | null;
  schedules?: { day_of_week: number; start_time: string }[];
}

interface ClientRowProps {
  client: ClientRowData;
  showDivider?: boolean;
}

export default function ClientRow({ client, showDivider = true }: ClientRowProps) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.avatar}>
          {client.avatar_url ? (
            <Image source={{ uri: client.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="person" size={18} color={dark.textMuted} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{client.full_name ?? 'Unknown'}</Text>
          <View style={styles.pillRow}>
            {client.team_name ? (
              <View style={styles.teamPill}>
                <Text style={styles.teamPillText}>{client.team_name}</Text>
              </View>
            ) : (
              <Text style={styles.independent}>Independent</Text>
            )}
            {client.plan_name && (
              <View style={styles.planPill}>
                <Text style={styles.planPillText}>{client.plan_name}</Text>
              </View>
            )}
          </View>
          {client.schedules && client.schedules.length > 0 && (
            <View style={styles.scheduleRow}>
              <Ionicons name="calendar-outline" size={13} color={dark.textMuted} />
              <Text style={styles.scheduleText}>
                {(() => {
                  const days = [...new Set(client.schedules.map((s) => s.day_of_week))].sort();
                  const firstTime = client.schedules
                    .slice()
                    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))[0]
                    ?.start_time.slice(0, 5);
                  return `${days.map((d) => DAY_NAMES[d]).join(', ')} · ${firstTime}`;
                })()}
              </Text>
            </View>
          )}
        </View>
      </View>
      {showDivider && <View style={styles.divider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md + 2,
    paddingVertical: theme.spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: dark.whiteOverlay6,
    borderWidth: 1,
    borderColor: dark.whiteOverlay10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: dark.text,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  teamPill: {
    alignSelf: 'flex-start',
    backgroundColor: dark.accentBg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  teamPillText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: dark.accent,
  },
  planPill: {
    alignSelf: 'flex-start',
    backgroundColor: dark.successGreenBg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planPillText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: dark.successGreen,
  },
  independent: {
    fontSize: theme.fontSize.sm - 1,
    color: dark.textMuted,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  scheduleText: {
    fontSize: theme.fontSize.sm - 1,
    color: dark.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: theme.spacing.md + 2,
  },
});
