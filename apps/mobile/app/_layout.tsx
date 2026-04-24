import 'react-native-gesture-handler';
import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/lib/AuthContext';
import { TRPCProvider } from '../src/lib/TRPCProvider';

/**
 * Root layout. Order matters:
 *   SafeAreaProvider  — geometry for notches / home indicators
 *     AuthProvider    — session state (needs to exist before tRPC reads it)
 *       TRPCProvider  — tRPC + React Query, reads the session token
 *         Stack       — navigation
 *
 * `index.tsx` handles the signed-in/out split, so this file just lays out
 * the three top-level routes and lets individual screens pick their own
 * header behavior.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TRPCProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="signin" />
            <Stack.Screen name="(app)" />
          </Stack>
        </TRPCProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
