import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '@/components/ui/GlassCard';
import { theme } from '@/constants/theme';

const dark = theme.dark.colors;

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  subtitleIcon?: keyof typeof Ionicons.glyphMap;
  trendColor?: string;
}

export default function StatCard({
  label,
  value,
  subtitle,
  subtitleIcon,
  trendColor = dark.accent,
}: StatCardProps) {
  return (
    <GlassCard style={styles.card} padding={theme.spacing.md + 4}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{label}</Text>
        {subtitleIcon && (
          <View style={[styles.iconBg, { backgroundColor: `${trendColor}18` }]}>
            <Ionicons name={subtitleIcon} size={14} color={trendColor} />
          </View>
        )}
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={[styles.subtitle, { color: trendColor }]}>{subtitle}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {},
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
    fontWeight: '500',
  },
  iconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: dark.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
});
