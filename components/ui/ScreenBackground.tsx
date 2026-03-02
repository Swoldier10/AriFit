import { type ReactNode } from 'react';
import { View, StyleSheet, type ColorValue } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';

const dark = theme.dark.colors;

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

const DEFAULT_GRADIENT: GradientColors = [
  dark.overlayLight,
  dark.overlayMid,
  dark.overlayHeavy,
];

interface ScreenBackgroundProps {
  children: ReactNode;
  gradientColors?: GradientColors;
}

export default function ScreenBackground({
  children,
  gradientColors = DEFAULT_GRADIENT,
}: ScreenBackgroundProps) {
  return (
    <View style={styles.root}>
      <Image
        source={require('@/assets/images/app-bg.jpeg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dark.background,
  },
});
