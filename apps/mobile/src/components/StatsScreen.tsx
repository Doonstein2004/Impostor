import { api } from '@impostor/backend/api';
import { Card, Screen, Text } from '@impostor/ui';
import { useQuery } from 'convex/react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSession } from '@/lib/session';

function StatRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View className="flex-row items-center justify-between py-2.5 border-b border-surface-border last:border-0">
      <Text variant="body" className="text-zinc-300">{label}</Text>
      <View className="items-end">
        <Text variant="title" className="text-pitch-400">{value}</Text>
        {sub && <Text variant="label" className="text-zinc-500 text-xs">{sub}</Text>}
      </View>
    </View>
  );
}

function WinRateBar({ rate, color }: { rate: number; color: string }) {
  return (
    <View className="h-2 bg-surface-soft rounded-full overflow-hidden mt-1">
      <View style={{ width: `${rate}%` }} className={`h-full rounded-full ${color}`} />
    </View>
  );
}

export function StatsScreen() {
  const clientId = useSession((s) => s.clientId);
  const stats = useQuery(api.stats.get, { clientId });

  if (stats === undefined) {
    return (
      <Screen scroll>
        <View className="flex-1 items-center justify-center py-20">
          <Text variant="muted">Cargando estadísticas...</Text>
        </View>
      </Screen>
    );
  }

  if (!stats || stats.gamesPlayed === 0) {
    return (
      <Screen scroll>
        <View className="flex-1 items-center justify-center py-20 gap-3">
          <Text className="text-5xl">📊</Text>
          <Text variant="title" className="text-center">Sin partidas todavía</Text>
          <Text variant="muted" className="text-center text-sm px-8">
            Tus estadísticas aparecerán aquí después de tu primera partida.
          </Text>
        </View>
      </Screen>
    );
  }

  const totalWins = stats.impostorWins + stats.innocentWins;

  return (
    <Screen scroll>
      <Animated.View entering={FadeInDown.duration(300)} className="py-4 items-center gap-1 mb-2">
        <Text className="text-5xl">📊</Text>
        <Text variant="display" className="text-2xl text-center">Tus estadísticas</Text>
        <Text variant="muted" className="text-xs">{stats.gamesPlayed} partidas jugadas</Text>
      </Animated.View>

      {/* Resumen general */}
      <Animated.View entering={FadeInDown.delay(100)}>
        <View className="flex-row gap-2 mb-3">
          <Card className="flex-1 items-center gap-0.5">
            <Text variant="display" className="text-3xl text-pitch-400">{totalWins}</Text>
            <Text variant="label" className="text-zinc-400 text-xs text-center">Partidas ganadas</Text>
          </Card>
          <Card className="flex-1 items-center gap-0.5">
            <Text variant="display" className="text-3xl text-gold-400">{stats.totalScore}</Text>
            <Text variant="label" className="text-zinc-400 text-xs text-center">Puntos totales</Text>
          </Card>
          <Card className="flex-1 items-center gap-0.5">
            <Text variant="display" className="text-3xl text-white">{stats.winRate}%</Text>
            <Text variant="label" className="text-zinc-400 text-xs text-center">Win rate</Text>
          </Card>
        </View>
      </Animated.View>

      {/* Como impostor */}
      <Animated.View entering={FadeInDown.delay(200)} className="mb-3">
        <View className="flex-row items-center gap-2 mb-2">
          <Text className="text-lg">🕵️</Text>
          <Text variant="title">Como impostor</Text>
          <View className="flex-1 h-px bg-surface-border" />
          <Text variant="muted" className="text-xs">{stats.timesImpostor} veces</Text>
        </View>
        <Card className="gap-0">
          <StatRow
            label="Partidas ganadas"
            value={`${stats.impostorWins} / ${stats.timesImpostor}`}
            sub={`${stats.impostorWinRate}% de win rate`}
          />
          <StatRow label="Veces detectado" value={stats.timesDetected} />
          <StatRow label="Personaje adivinado" value={stats.timesGuessedSecret} />
        </Card>
        {stats.timesImpostor > 0 && (
          <WinRateBar rate={stats.impostorWinRate} color="bg-impostor-500" />
        )}
      </Animated.View>

      {/* Como inocente */}
      <Animated.View entering={FadeInDown.delay(300)} className="mb-3">
        <View className="flex-row items-center gap-2 mb-2">
          <Text className="text-lg">🏃</Text>
          <Text variant="title">Como inocente</Text>
          <View className="flex-1 h-px bg-surface-border" />
          <Text variant="muted" className="text-xs">{stats.timesInnocent} veces</Text>
        </View>
        <Card className="gap-0">
          <StatRow
            label="Impostores detectados"
            value={`${stats.innocentWins} / ${stats.timesInnocent}`}
            sub={stats.timesInnocent > 0
              ? `${Math.round((stats.innocentWins / stats.timesInnocent) * 100)}% de éxito`
              : undefined}
          />
        </Card>
        {stats.timesInnocent > 0 && (
          <WinRateBar
            rate={Math.round((stats.innocentWins / stats.timesInnocent) * 100)}
            color="bg-pitch-500"
          />
        )}
      </Animated.View>
    </Screen>
  );
}
