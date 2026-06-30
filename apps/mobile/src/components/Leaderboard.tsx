import { api } from '@impostor/backend/api';
import { Card, Screen, Text } from '@impostor/ui';
import { useQuery } from 'convex/react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSession } from '@/lib/session';

const MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard() {
  const clientId = useSession((s) => s.clientId);
  const rows = useQuery(api.stats.top, { limit: 50 });

  if (rows === undefined) {
    return (
      <Screen scroll>
        <View className="flex-1 items-center justify-center py-20">
          <Text variant="muted">Cargando ranking…</Text>
        </View>
      </Screen>
    );
  }

  if (rows.length === 0) {
    return (
      <Screen scroll>
        <View className="flex-1 items-center justify-center py-20 gap-3">
          <Text className="text-5xl">🏆</Text>
          <Text variant="title" className="text-center">Ranking vacío</Text>
          <Text variant="muted" className="text-center text-sm px-8">
            Jugá algunas partidas y aparecé en el ranking entre tus amigos.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Animated.View entering={FadeInDown.duration(300)} className="py-4 items-center gap-1 mb-2">
        <Text className="text-5xl">🏆</Text>
        <Text variant="display" className="text-2xl text-center">Ranking</Text>
        <Text variant="muted" className="text-xs">Por partidas ganadas</Text>
      </Animated.View>

      {rows.map((r, i) => {
        const isMe = r.clientId === clientId;
        return (
          <Animated.View key={r.clientId} entering={FadeInDown.delay(Math.min(i, 12) * 40)}>
            <Card className={`flex-row items-center justify-between mb-2
              ${isMe ? 'border-pitch-500/50 bg-pitch-500/5' : ''}`}
            >
              <View className="flex-row items-center gap-3 flex-1">
                <Text className="text-xl w-8 text-center">
                  {i < 3 ? MEDALS[i] : `${i + 1}.`}
                </Text>
                <View className="flex-1">
                  <Text variant="body" numberOfLines={1}>
                    {r.name}{isMe ? ' (vos)' : ''}
                  </Text>
                  <Text variant="muted" className="text-xs">
                    {r.gamesPlayed} partidas · {r.winRate}% win · {r.totalScore} pts
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text variant="title" className={i === 0 ? 'text-gold-400' : 'text-pitch-400'}>
                  {r.wins}
                </Text>
                <Text variant="label" className="text-zinc-500 text-xs">ganadas</Text>
              </View>
            </Card>
          </Animated.View>
        );
      })}
      <View className="h-8" />
    </Screen>
  );
}
