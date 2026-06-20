import { api } from '@impostor/backend/api';
import { Screen, Text } from '@impostor/ui';
import { useQuery } from 'convex/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GameChat } from '@/components/Chat';
import { GameRound } from '@/components/GameRound';
import { ImpostorGuess } from '@/components/ImpostorGuess';
import { Lobby } from '@/components/Lobby';
import { Reveal } from '@/components/Reveal';
import { Voting } from '@/components/Voting';
import { useSession } from '@/lib/session';
import { usePresence } from '@/lib/usePresence';

export default function RoomScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { clientId, setCurrentRoomCode } = useSession();
  const room = useQuery(api.rooms.get, code ? { code } : 'skip');

  // Guarda el código en sesión para poder volver tras recargar
  useEffect(() => {
    if (code) setCurrentRoomCode(code);
    return () => setCurrentRoomCode(null);
  }, [code]);

  // Mantiene presencia (connected / lastActiveAt) sincronizada
  usePresence(room?._id, clientId);

  if (room === undefined) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#10b981" />
        </View>
      </Screen>
    );
  }

  if (room === null) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text variant="title">Sala no encontrada</Text>
          <Text variant="muted" className="mt-1">El código {code} no existe o expiró.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Sala ${room.code}` }} />
      {room.status === 'lobby' && <Lobby room={room} />}
      {room.status === 'playing' && <GameRound room={room} />}
      {room.status === 'voting' && <Voting room={room} />}
      {room.status === 'impostorGuessing' && <ImpostorGuess room={room} />}
      {(room.status === 'reveal' || room.status === 'finished') && <Reveal room={room} />}
      {/* Chat de sala — disponible en todas las fases salvo el lobby */}
      {room.status !== 'lobby' && <GameChat room={room} />}
    </>
  );
}
