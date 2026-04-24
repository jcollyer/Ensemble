import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../src/lib/AuthContext';

/**
 * Entry route. Shows a quick spinner while we hydrate the session from
 * SecureStore, then sends the user to either the signed-in stack or the
 * sign-in screen.
 */
export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return <Redirect href={session ? '/' : '/signin'} />;
}
