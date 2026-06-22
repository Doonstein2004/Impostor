import { api } from '@impostor/backend/api';
import { Button, Card, Screen, Text } from '@impostor/ui';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { BounceIn, FadeInDown, FadeInRight } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSession } from '@/lib/session';
import { useCountdown } from '@/lib/useCountdown';
import { useChatInset } from '@/lib/useChatDock';
import { runAction } from '@/lib/useToast';
import { useSounds } from '@/lib/useSounds';
import type { RoomView } from './types';

export function Voting({ room }: { room: RoomView }) {
  const { clientId, setLeaving } = useSession();
  const isHost = room.hostClientId === clientId;
  const roundId = room.currentRoundId;
  const chatInset = useChatInset(24);

  const castVote = useMutation(api.votes.cast);
  const reveal = useMutation(api.game.reveal);
  const leave = useMutation(api.rooms.leave);
  const { play } = useSounds();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const voteState = useQuery(api.votes.state, roundId ? { roundId } : 'skip');
  const round = useQuery(api.game.getRound, roundId ? { roundId } : 'skip');

  const iVoted = voteState?.votedClientIds.includes(clientId) ?? false;
  const total = voteState?.total ?? 0;
  const allVoted = total >= room.players.length;

  const voteSeconds = room.config.voteSeconds ?? 60;
  const votingStartedAt = round?.votingStartedAt ?? null;
  const { timeLeft, expired } = useCountdown(
    voteSeconds,
    votingStartedAt ?? Date.now(),
    voteSeconds > 0 && !!votingStartedAt,
  );

  const hasAutoRevealed = useRef(false);
  // Auto-revela al expirar el tiempo…
  useEffect(() => {
    if (expired && isHost && !hasAutoRevealed.current && roundId) {
      hasAutoRevealed.current = true;
      runAction(() => reveal({ roomId: room._id, clientId }), 'No se pudo revelar el resultado.');
    }
  }, [expired, isHost]);
  // …y también apenas votan todos (sin esperar al host).
  useEffect(() => {
    if (allVoted && isHost && !hasAutoRevealed.current && roundId) {
      hasAutoRevealed.current = true;
      runAction(() => reveal({ roomId: room._id, clientId }), 'No se pudo revelar el resultado.');
    }
  }, [allVoted, isHost]);

  return (
    <Screen scroll>
      {/* Botón salir */}
      <View className="flex-row justify-end mb-1">
        {confirmLeave ? (
          <View className="flex-row gap-2 items-center">
            <Pressable
              onPress={async () => { setLeaving(true); await leave({ roomId: room._id, clientId }); router.replace('/'); }}
              className="px-2.5 py-1 rounded-lg border border-impostor-500/60 bg-impostor-500/10"
            >
              <Text className="text-impostor-400 text-xs font-display">SALIR</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmLeave(false)} className="px-2 py-1">
              <Text className="text-zinc-500 text-xs">NO</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmLeave(true)} className="px-2 py-1">
            <Text className="text-zinc-700 text-xs tracking-widest">SALIR</Text>
          </Pressable>
        )}
      </View>

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} className="items-center py-4">
        <Text className="text-5xl mb-2">🟥</Text>
        <Text variant="display" className="text-impostor-400 text-2xl">¡VOTACIÓN!</Text>
        <Text variant="muted" className="mt-1">¿Quién es el impostor entre ustedes?</Text>

        {/* Temporizador de votación */}
        {voteSeconds > 0 && votingStartedAt && (
          <View className="mt-3 items-center">
            <Text
              variant="display"
              className={`text-5xl tabular-nums leading-none ${
                timeLeft <= 10 ? 'text-impostor-400' : timeLeft <= 20 ? 'text-yellow-400' : 'text-white'
              }`}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {String(timeLeft).padStart(2, '0')}
            </Text>
            <Text variant="label" className="text-zinc-600 text-xs">segundos para votar</Text>
          </View>
        )}

        {/* Barra de progreso de votos */}
        <View className="mt-4 w-full bg-surface-card rounded-full h-2 overflow-hidden">
          <Animated.View
            className="h-2 bg-impostor-500 rounded-full"
            style={{ width: `${(total / Math.max(room.players.length, 1)) * 100}%` }}
          />
        </View>
        <Text variant="label" className="mt-1 text-zinc-500">
          {total}/{room.players.length} votos emitidos
        </Text>
      </Animated.View>

      {/* Lista de jugadores para votar */}
      <View className="gap-2 mt-2">
        {room.players.map((p, i) => {
          const isMe = p.clientId === clientId;
          const hasVoted = voteState?.votedClientIds.includes(p.clientId);
          const iVotedFor = voteState?.votesByVoter?.[clientId] === p.clientId;

          return (
            <Animated.View key={p.clientId} entering={FadeInRight.delay(i * 80).duration(300).springify()}>
              <Pressable
                disabled={isMe || !roundId}
                onPress={() => {
                  play('vote');
                  roundId && runAction(
                    () => castVote({ roundId, voterClientId: clientId, targetClientId: p.clientId }),
                    'No se pudo registrar tu voto.',
                  );
                }}
              >
                <Card
                  className={`flex-row items-center justify-between
                    ${iVotedFor ? 'border-impostor-500 bg-impostor-500/10' : ''}
                    ${isMe ? 'opacity-40' : ''}
                  `}
                >
                  <View className="flex-row items-center gap-3">
                    {/* Avatar inicial */}
                    <View className={`h-9 w-9 rounded-full items-center justify-center
                      ${iVotedFor ? 'bg-impostor-500' : 'bg-surface-soft border border-surface-border'}`}
                    >
                      <Text variant="body" className="text-base font-display">
                        {p.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text variant="body">{p.name}{isMe ? ' (vos)' : ''}</Text>
                      {p.isHost && <Text variant="label" className="text-pitch-400 text-xs">HOST</Text>}
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    {hasVoted && (
                      <Animated.View entering={BounceIn}>
                        <Text className="text-base">✅</Text>
                      </Animated.View>
                    )}
                    {iVotedFor ? (
                      <Text variant="label" className="text-impostor-400">🎯 votado</Text>
                    ) : !isMe ? (
                      <Text variant="muted" className="text-xs">Votar</Text>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {/* Estado del propio voto */}
      {iVoted && (
        <Animated.View entering={FadeInDown.delay(300)} className="mt-4">
          <Card className="items-center gap-1 border-pitch-500/30 bg-pitch-500/5">
            <Text className="text-xl">✅</Text>
            <Text variant="muted" className="text-center text-xs">Voto registrado. Podés cambiar hasta que el host revele.</Text>
          </Card>
        </Animated.View>
      )}

      {/* Controles del host */}
      {isHost && (
        <Animated.View entering={FadeInDown.delay(400)} className="mt-5 gap-2 pb-4">
          {allVoted && (
            <Animated.View entering={BounceIn}>
              <Text variant="label" className="text-center text-pitch-400 mb-1">¡Todos votaron!</Text>
            </Animated.View>
          )}
          <Button
            title="🏆 Revelar resultado"
            variant="danger"
            onPress={() => runAction(() => reveal({ roomId: room._id, clientId }), 'No se pudo revelar el resultado.')}
          />
        </Animated.View>
      )}

      {!isHost && (
        <View className="mt-4 items-center">
          <Text variant="muted" className="text-center text-xs">El host revelará el resultado cuando esté listo.</Text>
        </View>
      )}
      <View style={{ height: chatInset }} />
    </Screen>
  );
}
