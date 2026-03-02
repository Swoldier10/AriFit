import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';

const dark = theme.dark.colors;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.55;

export default function Welcome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Hero image with gradient fade */}
      <View style={styles.heroContainer}>
        <Image
          source={require('@/assets/images/hero-fitness.jpg')}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', dark.background]}
          style={styles.heroGradient}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.headline}>
          Elevate Your{'\n'}
          <Text style={styles.headlineAccent}>Fitness</Text> Journey
        </Text>

        <Text style={styles.subtitle}>
          Train smarter, track progress, and achieve your goals with personalized coaching.
        </Text>

        {/* Get Started — glass button with gold accent */}
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.8}
          onPress={() => router.push('/sign-up?userType=client')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>

        {/* I'm a Trainer — glass outlined button */}
        <TouchableOpacity
          style={styles.outlineButton}
          activeOpacity={0.8}
          onPress={() => router.push('/sign-up?userType=trainer')}
        >
          <Text style={styles.outlineButtonText}>{"I'm a Trainer"}</Text>
        </TouchableOpacity>

        {/* Sign In link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/sign-in')}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  heroContainer: {
    height: HERO_HEIGHT,
    width: '100%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    marginTop: -theme.spacing.lg,
  },
  headline: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: '800',
    color: dark.text,
    lineHeight: 44,
    marginBottom: theme.spacing.md,
  },
  headlineAccent: {
    color: dark.accent,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: dark.textSecondary,
    lineHeight: 24,
    marginBottom: theme.spacing.xl,
  },
  primaryButton: {
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: dark.glassButtonBg,
    borderWidth: 1,
    borderColor: dark.glassButtonBorder,
    shadowColor: dark.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    color: dark.accent,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: dark.glassBorderStartStrong,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: dark.whiteOverlay5,
    marginBottom: theme.spacing.lg,
  },
  outlineButtonText: {
    color: dark.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: theme.fontSize.sm,
    color: dark.textSecondary,
  },
  footerLink: {
    fontSize: theme.fontSize.sm,
    color: dark.accent,
    fontWeight: '600',
  },
});
