import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useAuth } from '@/lib/auth-context';
import { ActivityIndicator, View } from 'react-native';
import { theme } from '@/constants/theme';

function RootNavigator() {
  const { session, isLoading, pendingInviteCode, setPendingInviteCode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session && pendingInviteCode) {
      const code = pendingInviteCode;
      setPendingInviteCode(null);
      router.replace(`/join/${code}`);
    }
  }, [session, pendingInviteCode, setPendingInviteCode, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.dark.colors.background }}>
        <ActivityIndicator size="large" color={theme.dark.colors.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
      <Stack.Screen name="join" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
      <StatusBar style="light" />
    </SessionProvider>
  );
}
