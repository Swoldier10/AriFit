import { type ReactNode } from 'react';
import { View, Platform, type ViewStyle, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';

const dark = theme.dark.colors;

interface GlassCardProps {
  children: ReactNode;
  style?: ViewStyle;
  borderRadius?: number;
  blurIntensity?: number;
  padding?: number;
  /** Use a lighter, more translucent variant (e.g. for small pill buttons) */
  variant?: 'default' | 'light';
}

export default function GlassCard({
  children,
  style,
  borderRadius = theme.borderRadius.xxl,
  blurIntensity = 30,
  padding = theme.spacing.lg,
  variant = 'default',
}: GlassCardProps) {
  const surfaceColor =
    variant === 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)';

  const inner = (
    <View style={[styles.surface, { padding, borderRadius: borderRadius - 1, backgroundColor: surfaceColor }]}>
      {/* Top highlight – simulates light refracting across the glass edge */}
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.highlightLine,
          {
            borderTopLeftRadius: borderRadius - 1,
            borderTopRightRadius: borderRadius - 1,
          },
        ]}
      />
      {/* Inner glow layer */}
      <LinearGradient
        colors={[dark.glassInnerGlow, 'transparent']}
        style={[styles.innerGlow, { borderRadius: borderRadius - 1 }]}
      />
      {children}
    </View>
  );

  return (
    <View style={[styles.shadowWrap, { borderRadius }, style]}>
      <LinearGradient
        colors={[dark.glassBorderStartStrong, dark.glassBorderEnd]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.border, { borderRadius }]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={blurIntensity}
            tint="dark"
            style={[styles.blur, { borderRadius: borderRadius - 1 }]}
          >
            {inner}
          </BlurView>
        ) : (
          <View style={[styles.androidFallback, { borderRadius: borderRadius - 1 }]}>
            {inner}
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    // Soft shadow beneath the glass
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: dark.glassShadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 24,
        }
      : {
          elevation: 12,
        }),
  },
  border: {
    padding: 1,
  },
  blur: {
    overflow: 'hidden',
  },
  surface: {},
  highlightLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  innerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  androidFallback: {
    backgroundColor: dark.glassSurfaceAndroid,
    overflow: 'hidden',
  },
});
