import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="create-team"
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="create-plan"
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="edit-team" />
      <Stack.Screen
        name="edit-plan"
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="profile" />
      <Stack.Screen
        name="change-password"
        options={{ presentation: 'modal' }}
      />
    </Stack>
  );
}
