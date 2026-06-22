import { api } from '@impostor/backend/api';
import { Card, Screen, Text } from '@impostor/ui';
import { useQuery } from 'convex/react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { PlayerAvatar } from './PlayerAvatar';
import type { RoomView } from './types';

function StatusBadge({ status }: { status: RoomView['status'] }) {
  const MAP = {
    lobby: { label: 'LOBBY', color: 'text-zinc-400 border-zinc-600 bg-zinc-600/10' },
    playing: { label: 'PISTAS', color: 'text-pitch-400 border-pitch-500/50 bg-pitch-500/10' },
    voting: { label: 'VOTACIÓN', color: 'text-gold-400 border-gold-500/50 bg-gold-500/10' },
    impostorGuessing: { label: 'ADIVINANDO', color: 'text-impostor-400 border-impostor-500/50 bg-impostor-500/10' },
    reveal: { label: 'RESULTADO', color: 'text-white border-white/20 bg-white/5' },
    finished: { label: 'FINALIZADO', color: 'text-zinc-500 border-zinc-700 bg-zinc-700/10' },
  } as const;
  const s = MAP[status] ?? MAP.lobby;
  return (
    <View className={`px-2 py-0.5 rounded-full border ${s.color}`}>
      <Text variant="label" className={`text-xs ${s.color.split(' ')[0]}`}>{s.label}</Text>
    </View>
  );
}

export function SpectatorView({ room }: { room: RoomView }) {
  const roundId = room.currentRoundId ?? undefined;
  const round = useQuery(api.game.getRound, roundId ? { roundId } : 'skip');
  const clues = useQuery(api.clues.listByRound, roundId ? { roundId } : 'skip');

  const currentSpeaker = room.players.find((p) => p.clientId === round?.currentSpeakerId);
  const activePlayers = room.players.filter((p) => !p.isSpectator);
  const spectators = room.players.filter((p) => p.isSpectator);
  const colorByClient = new Map(room.players.map((p) => [p.clientId, p.color]));

  // Agrupar pistas por vuelta
  const cluesByTurn = (clues ?? []).reduce<Record<number, typeof clues>>((acc, c) => {
    (acc[c.turn] ??= []).push(c);
    return acc;
  }, {});
  const turns = Object.keys(cluesByTurn).map(Number).sort((a, b) => b - a);

  return (
    <Screen scroll>
      {/* Header espectador */}
      <Animated.View entering={FadeIn} className="flex-row items-center justify-between py-4 mb-2">
        <View>
          <Text variant="label" className="text-zinc-500 text-xs">SALA {room.code} · ESPECTADOR</Text>
          <Text variant="title" className="text-white">Partida {room.roundNumber}</Text>
        </View>
        <StatusBadge status={room.status} />
      </Animated.View>

      {/* Turno actual */}
      {room.status === 'playing' && round && (
        <Animated.View entering={FadeInDown.delay(100)} className="mb-3">
          <Card className="border-pitch-500/30 bg-pitch-500/5">
            {round.allSpoke ? (
              <Text variant="muted" className="text-center text-sm">Todos hablaron en la vuelta {round.currentTurn}</Text>
            ) : (
              <View className="flex-row items-center gap-3">
                <PlayerAvatar
                  name={currentSpeaker?.name ?? '?'}
                  color={currentSpeaker?.color}
                  seed={currentSpeaker?.clientId ?? 'spectator'}
                  size={40}
                />
                <View className="flex-1">
                  <Text variant="label" className="text-pitch-400 text-xs">DANDO PISTA</Text>
                  <Text variant="body">{currentSpeaker?.name ?? '…'}</Text>
                </View>
                <View className="px-2 py-0.5 rounded-full bg-surface-soft border border-surface-border">
                  <Text variant="label" className="text-xs text-zinc-400">Vuelta {round.currentTurn}</Text>
                </View>
              </View>
            )}
          </Card>
        </Animated.View>
      )}

      {/* Pistas del juego */}
      {turns.length > 0 && (
        <Animated.View entering={FadeInDown.delay(150)} className="mb-3">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-base">💬</Text>
            <Text variant="title">Pistas</Text>
          </View>
          {turns.map((turn) => (
            <View key={turn} className="mb-2">
              {turns.length > 1 && (
                <Text variant="label" className="text-zinc-500 text-xs mb-1.5">VUELTA {turn}</Text>
              )}
              {cluesByTurn[turn]?.map((clue) => (
                <Card key={clue._id} className="mb-1.5 flex-row items-start gap-3">
                  <View className="mt-0.5">
                    <PlayerAvatar
                      name={clue.playerName}
                      color={colorByClient.get(clue.clientId)}
                      seed={clue.clientId}
                      size={28}
                    />
                  </View>
                  <View className="flex-1">
                    <Text variant="label" className="text-zinc-500 text-xs">{clue.playerName}</Text>
                    <Text variant="body" className="text-lg">{clue.text}</Text>
                  </View>
                </Card>
              ))}
            </View>
          ))}
        </Animated.View>
      )}

      {/* Jugadores activos */}
      <Animated.View entering={FadeInDown.delay(200)} className="mb-3">
        <View className="flex-row items-center gap-2 mb-2">
          <Text className="text-base">🏃</Text>
          <Text variant="title">Jugadores</Text>
          <Text variant="muted" className="text-xs">({activePlayers.length})</Text>
        </View>
        <Card className="gap-1.5">
          {activePlayers.map((p) => (
            <View key={p.clientId} className="flex-row items-center gap-2.5">
              <View className={`h-2 w-2 rounded-full ${p.connected ? 'bg-green-400' : 'bg-zinc-600'}`} />
              <PlayerAvatar name={p.name} color={p.color} seed={p.clientId} size={24} />
              <Text variant="body" className="flex-1">{p.name}</Text>
              {p.isHost && (
                <View className="px-1.5 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/30">
                  <Text variant="label" className="text-gold-400 text-xs">HOST</Text>
                </View>
              )}
              <Text variant="muted" className="text-xs">{p.score} pts</Text>
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* Otros espectadores */}
      {spectators.length > 1 && (
        <Animated.View entering={FadeInDown.delay(250)} className="mb-3">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-base">👀</Text>
            <Text variant="title">Espectadores</Text>
          </View>
          <Card className="gap-1">
            {spectators.map((p) => (
              <Text key={p.clientId} variant="muted" className="text-sm">{p.name}</Text>
            ))}
          </Card>
        </Animated.View>
      )}

      {/* Estado de votación */}
      {room.status === 'voting' && (
        <Animated.View entering={FadeInDown.delay(300)}>
          <Card className="items-center gap-1 border-gold-500/30 bg-gold-500/5">
            <Text className="text-3xl">🗳️</Text>
            <Text variant="title">Votación en curso</Text>
            <Text variant="muted" className="text-sm text-center">Los jugadores están decidiendo quién es el impostor.</Text>
          </Card>
        </Animated.View>
      )}

      {room.status === 'impostorGuessing' && (
        <Animated.View entering={FadeInDown.delay(300)}>
          <Card className="items-center gap-1 border-impostor-500/30 bg-impostor-500/5">
            <Text className="text-3xl">🎯</Text>
            <Text variant="title">El impostor adivina</Text>
            <Text variant="muted" className="text-sm text-center">El impostor detectado intenta adivinar el personaje secreto.</Text>
          </Card>
        </Animated.View>
      )}

      <View className="h-8" />
    </Screen>
  );
}
