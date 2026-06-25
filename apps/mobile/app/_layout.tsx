import '../global.css';

import { Inter_400Regular, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { ConvexProvider } from 'convex/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toast } from '@/components/Toast';
import { convex } from '@/lib/convex';
import { useSession } from '@/lib/session';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_700Bold });
  const hydrated = useSession((s) => s.hydrated);

  useEffect(() => {
    // Re-hidratación de zustand: marca cuando AsyncStorage terminó.
    useSession.persist.rehydrate();
  }, []);

  if (!fontsLoaded || !hydrated) {
    return <View className="flex-1 bg-surface" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
        <ConvexProvider client={convex}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#0b0f0e' },
              headerTintColor: '#fff',
              contentStyle: { backgroundColor: '#0b0f0e' },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            {/* Sin header nativo: cada fase tiene su propia barra/salir y así no
                se duplica el inset del status bar (espacio vacío arriba). */}
            <Stack.Screen name="room/[code]" options={{ headerShown: false }} />
            <Stack.Screen name="stats" options={{ title: 'Mis estadísticas', headerBackTitle: 'Volver' }} />
            <Stack.Screen name="leaderboard" options={{ title: 'Ranking', headerBackTitle: 'Volver' }} />
            <Stack.Screen name="tournament/create" options={{ title: 'Crear torneo', headerBackTitle: 'Volver' }} />
            <Stack.Screen name="tournament/[code]" options={{ title: 'Bracket', headerBackTitle: 'Volver' }} />
          </Stack>
          {/* Toast global por encima de todo */}
          <Toast />
        </ConvexProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
