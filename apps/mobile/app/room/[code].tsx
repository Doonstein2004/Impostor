import { api } from '@impostor/backend/api';
import { Screen, Text } from '@impostor/ui';

import { useQuery } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { AudioRoom } from '@/components/AudioRoom';
import { GameChat } from '@/components/Chat';
import { GameRound } from '@/components/GameRound';
import { ImpostorGuess } from '@/components/ImpostorGuess';
import { Lobby } from '@/components/Lobby';
import { Reveal } from '@/components/Reveal';
import { SpectatorView } from '@/components/SpectatorView';
import { TutorialModal } from '@/components/TutorialModal';
import { Voting } from '@/components/Voting';
import { SkeletonRoomLoading } from '@/components/Skeleton';
import { useSession } from '@/lib/session';
import { usePresence } from '@/lib/usePresence';
import { toast } from '@/lib/useToast';

export default function RoomScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { clientId, setCurrentRoomCode, leaving, setLeaving, setNotice } = useSession();
  const room = useQuery(api.rooms.get, code ? { code } : 'skip');

  // Guarda el código en sesión para poder volver tras recargar
  useEffect(() => {
    if (code) setCurrentRoomCode(code);
    return () => setCurrentRoomCode(null);
  }, [code]);

  // Mantiene presencia (connected / lastActiveAt) sincronizada
  usePresence(room?._id, clientId);

  // Detecta expulsión: si estuvimos en la sala y ya no figuramos en players,
  // alguien nos sacó → volvemos al home con aviso (salvo que salgamos por gusto).
  const wasPresent = useRef(false);
  useEffect(() => {
    if (!room) return; // undefined (cargando) o null (no existe)
    const present = room.players.some((p) => p.clientId === clientId);
    if (present) {
      wasPresent.current = true;
      if (leaving) setLeaving(false);
      return;
    }
    if (wasPresent.current) {
      if (!leaving) setNotice('Te expulsaron de la sala 👋');
      setLeaving(false);
      router.replace('/');
    }
  }, [room, clientId, leaving]);

  // Avisos de eventos: cambio de host y cancelación de ronda.
  const prevHost = useRef<string | null>(null);
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!room) return;
    if (prevHost.current && prevHost.current !== room.hostClientId && room.hostClientId === clientId) {
      toast.info('Ahora sos el host 👑');
    }
    prevHost.current = room.hostClientId;

    const wasMidGame =
      prevStatus.current === 'playing' ||
      prevStatus.current === 'voting' ||
      prevStatus.current === 'impostorGuessing';
    if (wasMidGame && room.status === 'lobby' && room.hostClientId !== clientId) {
      toast.info('El host canceló la ronda. Volvieron al lobby.');
    }
    prevStatus.current = room.status;
  }, [room, clientId]);

  if (room === undefined) {
    return <SkeletonRoomLoading />;
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

  const isSpectator = room.players.find((p) => p.clientId === clientId)?.isSpectator ?? false;

  if (isSpectator) {
    return (
      <>
        <TutorialModal />
        <SpectatorView room={room} />
        <GameChat room={room} />
      </>
    );
  }

  return (
    <>
      <TutorialModal />
      {room.status === 'lobby' && <Lobby room={room} />}
      {room.status === 'playing' && <GameRound room={room} />}
      {room.status === 'voting' && <Voting room={room} />}
      {room.status === 'impostorGuessing' && <ImpostorGuess room={room} />}
      {(room.status === 'reveal' || room.status === 'finished') && <Reveal room={room} />}
      {/* Comunicación de sala (todas las fases salvo lobby): audio o chat de texto */}
      {room.status !== 'lobby' &&
        (room.config.commMode === 'audio' ? <AudioRoom room={room} /> : <GameChat room={room} />)}
    </>
  );
}
