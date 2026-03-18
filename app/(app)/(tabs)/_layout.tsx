import { Tabs } from 'expo-router';
import { Platform, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { theme } from '@/constants/theme';

const dark = theme.dark.colors;

const TAB_BAR_RADIUS = 32;
const TAB_BAR_H_MARGIN = 24;

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  teams: 'people',
  messages: 'chatbubble',
  plans: 'clipboard',
};

/** Fully custom floating liquid-glass tab bar */
function LiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 16);

  const content = (
    <View style={tabStyles.inner}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = (options.title ?? route.name).toUpperCase();
        const isFocused = state.index === index;
        const color = isFocused ? dark.accent : dark.textMuted;
        const iconName = TAB_ICONS[route.name] ?? 'ellipse';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            activeOpacity={0.7}
            style={tabStyles.item}
          >
            <Ionicons name={iconName} size={22} color={color} />
            <Text style={[tabStyles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View
      style={[tabStyles.container, { bottom: bottomOffset }]}
      pointerEvents="box-none"
    >
      <View style={tabStyles.pill}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={70} tint="dark" style={tabStyles.blur}>
            {/* Top highlight for glass refraction */}
            <LinearGradient
              colors={['rgba(255,255,255,0.16)', 'transparent']}
              style={tabStyles.glow}
            />
            {content}
          </BlurView>
        ) : (
          <View style={[tabStyles.blur, { backgroundColor: dark.tabBarBgAndroid }]}>
            {content}
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <LiquidGlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="teams" options={{ title: 'Clients' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans' }} />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: TAB_BAR_H_MARGIN,
    right: TAB_BAR_H_MARGIN,
  },
  pill: {
    borderRadius: TAB_BAR_RADIUS,
    borderWidth: 1,
    borderColor: dark.tabBarBorder,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.65,
          shadowRadius: 30,
        }
      : { elevation: 20 }),
  },
  blur: {
    borderRadius: TAB_BAR_RADIUS,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
});
