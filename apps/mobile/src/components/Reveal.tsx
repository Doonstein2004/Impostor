import { api } from '@impostor/backend/api';
import { Button, Card, Screen, Text } from '@impostor/ui';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, {
  BounceInDown,
  FadeIn,
  FadeInDown,
  FlipInXUp,
  ZoomIn,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSession } from '@/lib/session';
import { useChatInset } from '@/lib/useChatDock';
import { POSITION_COLORS } from './types';
import type { RoomView } from './types';

const MEDALS = ['🥇', '🥈', '🥉'];

function RankingRow({ player, rank, prevScore, animated }: {
  player: RoomView['players'][0];
  rank: number;
  prevScore: number;
  animated: boolean;
}) {
  const gained = player.score - prevScore;
  return (
    <Animated.View entering={animated ? BounceInDown.delay(rank * 120).springify() : undefined}>
      <Card className={`flex-row items-center justify-between mb-2
        ${rank === 0 ? 'border-yellow-500/40 bg-yellow-500/5' : ''}
      `}>
        <View className="flex-row items-center gap-3">
          <Text className="text-2xl w-8 text-center">
            {rank < 3 ? MEDALS[rank] : `${rank + 1}.`}
          </Text>
          <View className="h-10 w-10 rounded-full bg-surface-soft border border-surface-border items-center justify-center">
            <Text variant="body" className="text-base font-display">
              {player.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text variant="body">{player.name}</Text>
        </View>
        <View className="items-end">
          <Text variant="title" className={rank === 0 ? 'text-yellow-400' : 'text-pitch-400'}>
            {player.score}
          </Text>
          {gained > 0 && (
            <Animated.View entering={ZoomIn.delay(rank * 120 + 400)}>
              <Text variant="label" className="text-pitch-400">+{gained}</Text>
            </Animated.View>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

export function Reveal({ room }: { room: RoomView }) {
  const { clientId } = useSession();
  const isHost = room.hostClientId === clientId;
  const chatInset = useChatInset(24);
  const data = useQuery(
    api.game.getReveal,
    room.currentRoundId ? { roundId: room.currentRoundId } : 'skip',
  );
  const backToLobby = useMutation(api.game.backToLobby);
  const leave = useMutation(api.rooms.leave);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (data === undefined) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#10b981" size="large" />
        </View>
      </Screen>
    );
  }

  const impostorSet = new Set(data?.impostorClientIds ?? []);
  const impostors = room.players.filter((p) => impostorSet.has(p.clientId));
  const innocentsWin = data?.innocentsWin ?? false;
  const impostorWonGuess = data?.impostorWonGuess ?? null;

  const zone = data?.secretCharacter?.zone as keyof typeof POSITION_COLORS | undefined;
  const posColors = zone ? POSITION_COLORS[zone] : null;

  const maxRounds = room.config.maxRounds ?? 0;
  const isSessionOver = maxRounds > 0 && room.roundNumber >= maxRounds;

  // Ranking actual ordenado por score
  const ranking = [...room.players].sort((a, b) => b.score - a.score);

  // Detalle de votos: cada acusado, cuántos votos y quién lo votó.
  const nameById = new Map(room.players.map((p) => [p.clientId, p.name]));
  const voteEntries = Object.entries(data?.votersByTarget ?? {})
    .map(([target, voters]) => ({ target, voters, count: voters.length }))
    .sort((a, b) => b.count - a.count);

  return (
    <Screen scroll>
      {/* Resultado dramático */}
      <Animated.View entering={FadeIn.duration(300)} className="flex-row justify-center mb-2">
        <View className="px-3 py-1 rounded-full border border-gold-500/40 bg-gold-500/10">
          <Text variant="label" className="text-gold-400 tracking-widest text-xs">
            PARTIDA {room.roundNumber} TERMINADA
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(600)} className="items-center py-4">
        <Animated.Text entering={BounceInDown.delay(100).springify()} className="text-6xl mb-2">
          {innocentsWin ? '🏆' : impostorWonGuess ? '🎯' : '🕵️'}
        </Animated.Text>
        <Animated.View entering={FlipInXUp.delay(400).duration(500)}>
          <Text variant="display" className="text-center text-3xl">
            {innocentsWin
              ? '¡INOCENTES GANAN!'
              : impostorWonGuess
              ? '¡EL IMPOSTOR ADIVINÓ!'
              : '¡IMPOSTOR ESCAPA!'}
          </Text>
          <Text variant="muted" className="text-center mt-1">
            {innocentsWin
              ? 'Detectaron al impostor y no pudo adivinar el personaje'
              : impostorWonGuess
              ? 'El impostor fue detectado ¡pero adivinó el personaje secreto!'
              : 'El impostor pasó desapercibido'}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Resultado de la adivinanza */}
      {impostorWonGuess !== null && (
        <Animated.View entering={FadeIn.delay(500)} className="mb-2">
          <View className={`flex-row items-center gap-2 px-3 py-2 rounded-xl border
            ${impostorWonGuess
              ? 'border-impostor-500/40 bg-impostor-500/10'
              : 'border-pitch-500/30 bg-pitch-500/5'}`}
          >
            <Text className="text-xl">{impostorWonGuess ? '🎯' : '❌'}</Text>
            <Text variant="label" className={impostorWonGuess ? 'text-impostor-400' : 'text-pitch-400'}>
              {impostorWonGuess
                ? 'El impostor adivinó el personaje secreto'
                : 'El impostor falló la adivinanza'}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Carta del jugador secreto */}
      <Animated.View entering={ZoomIn.delay(600).springify()}>
        <Card className="items-center gap-1 border-pitch-500/30 bg-pitch-500/5 mb-3">
          <Text variant="label" className="text-zinc-500">El jugador secreto era</Text>
          {posColors && (
            <View className={`px-3 py-0.5 rounded-full border mt-1 ${posColors.bg} ${posColors.border}`}>
              <Text className={`text-xs font-display ${posColors.text}`}>{posColors.label}</Text>
            </View>
          )}
          <Text variant="display" className="text-pitch-400 text-2xl text-center mt-1">
            {data?.secretCharacter?.name ?? '—'}
          </Text>
          <Text variant="muted" className="text-center text-xs">
            {data?.secretCharacter?.fullName}
            {data?.secretCharacter?.club ? ` · ${data.secretCharacter.club}` : ''}
          </Text>
        </Card>
      </Animated.View>

      {/* Impostores revelados */}
      <Animated.View entering={FadeInDown.delay(800).duration(400)}>
        <Card className={`items-center gap-1 mb-4 ${impostors.length > 0 ? 'border-impostor-500/40 bg-impostor-500/5' : 'border-surface-border'}`}>
          <Text className="text-2xl mb-1">🕵️</Text>
          <Text variant="label" className="text-impostor-400">
            {impostors.length > 1 ? 'Los impostores eran' : 'El impostor era'}
          </Text>
          {impostors.map((p) => (
            <Text key={p.clientId} variant="title" className="text-white">
              {p.name}{p.clientId === clientId ? ' 😈 (vos)' : ''}
            </Text>
          ))}
        </Card>
      </Animated.View>

      {/* Detalle de votación */}
      {voteEntries.length > 0 && (
        <Animated.View entering={FadeInDown.delay(900).duration(400)} className="mb-4">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-lg">🗳️</Text>
            <Text variant="title">Votos</Text>
            <Text variant="muted" className="text-xs">· {data?.totalVotes ?? 0} en total</Text>
          </View>
          <Card className="gap-2.5">
            {voteEntries.map(({ target, voters, count }) => {
              const isImpostor = impostorSet.has(target);
              const isEjected = data?.ejectedClientId === target;
              return (
                <View
                  key={target}
                  className={`rounded-xl border px-3 py-2.5 gap-1.5
                    ${isImpostor ? 'border-impostor-500/40 bg-impostor-500/5' : 'border-surface-border bg-surface-soft'}`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1">
                      <Text variant="body" className="font-display" numberOfLines={1}>
                        {nameById.get(target) ?? '—'}
                        {target === clientId ? ' (vos)' : ''}
                      </Text>
                      {isImpostor && (
                        <View className="px-1.5 py-0.5 rounded-full bg-impostor-500/15 border border-impostor-500/40">
                          <Text variant="label" className="text-impostor-400 text-xs">IMPOSTOR</Text>
                        </View>
                      )}
                      {isEjected && (
                        <View className="px-1.5 py-0.5 rounded-full bg-gold-500/15 border border-gold-500/40">
                          <Text variant="label" className="text-gold-400 text-xs">EXPULSADO</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Text variant="title" className={isImpostor ? 'text-impostor-400' : 'text-pitch-400'}>
                        {count}
                      </Text>
                      <Text variant="muted" className="text-xs">voto{count !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-1.5">
                    {voters.map((voter) => (
                      <View key={voter} className="px-2 py-0.5 rounded-full border border-surface-border bg-surface-card">
                        <Text variant="label" className="text-zinc-400 text-xs">
                          {nameById.get(voter) ?? '—'}{voter === clientId ? ' (vos)' : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </Card>
        </Animated.View>
      )}

      {/* Ranking */}
      <Animated.View entering={FadeInDown.delay(1000)}>
        <View className="flex-row items-center gap-2 mb-3">
          <Text className="text-lg">📊</Text>
          <Text variant="title">Marcador</Text>
        </View>
        {ranking.map((p, i) => (
          <RankingRow
            key={p.clientId}
            player={p}
            rank={i}
            prevScore={p.score}
            animated
          />
        ))}
      </Animated.View>

      {/* Salir de la sala (no-host) */}
      {!isHost && (
        <Animated.View entering={FadeInDown.delay(1400)} className="mt-2 pb-2">
          {confirmLeave ? (
            <View className="flex-row justify-center gap-3 items-center">
              <Pressable
                onPress={async () => { await leave({ roomId: room._id, clientId }); router.replace('/'); }}
                className="px-4 py-2 rounded-lg border border-impostor-500/60 bg-impostor-500/10"
              >
                <Text className="text-impostor-400 text-sm font-display">Confirmar salida</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmLeave(false)} className="px-3 py-2">
                <Text className="text-zinc-500 text-sm">Cancelar</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmLeave(true)} className="items-center py-2">
              <Text className="text-zinc-600 text-xs tracking-widest">SALIR DE LA SALA</Text>
            </Pressable>
          )}
        </Animated.View>
      )}

      {/* Acciones */}
      <Animated.View entering={FadeInDown.delay(1200)} className="mt-4 pb-6 gap-2">
        {isSessionOver ? (
          /* Fin de sesión */
          <View className="items-center gap-3">
            <View className="px-4 py-2 rounded-full border border-gold-500/40 bg-gold-500/10">
              <Text variant="label" className="text-gold-400 tracking-widest">
                🏁 SESIÓN TERMINADA · {maxRounds} PARTIDA{maxRounds > 1 ? 'S' : ''}
              </Text>
            </View>
            <Text variant="muted" className="text-center text-sm">
              ¡{ranking[0]?.name ?? '—'} gana la sesión con {ranking[0]?.score ?? 0} punto{ranking[0]?.score !== 1 ? 's' : ''}!
            </Text>
            {isHost && (
              <Button
                title="🔄 Nueva sesión"
                variant="secondary"
                onPress={() => backToLobby({ roomId: room._id, clientId, newSession: true })}
              />
            )}
          </View>
        ) : isHost ? (
          <Button
            title={`⚽ Jugar partida ${room.roundNumber + 1}${maxRounds > 0 ? ` de ${maxRounds}` : ''}`}
            onPress={() => backToLobby({ roomId: room._id, clientId })}
          />
        ) : (
          <Card className="items-center">
            <Text variant="muted" className="text-center">El host decidirá si juegan otra ronda.</Text>
          </Card>
        )}
      </Animated.View>
      <View style={{ height: chatInset }} />
    </Screen>
  );
}
