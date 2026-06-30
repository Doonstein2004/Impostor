import { api } from '@impostor/backend/api';
import { Button, Card, Screen, Text } from '@impostor/ui';
import { useMutation } from 'convex/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useSession } from '@/lib/session';
import { friendlyError } from '@/lib/errors';
import { DEFAULT_CONFIG } from '@impostor/core';

const TEAM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
const MIN_TEAMS = 2;
const MAX_TEAMS = 8;

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

type Team = { id: string; name: string; color: string };
type PlayerEntry = { clientId: string; playerName: string; teamId: string };

export default function CreateTournament() {
  const { clientId, name } = useSession(
    useShallow((s) => ({ clientId: s.clientId, name: s.name })),
  );
  const createTournament = useMutation(api.tournaments.create);

  const [tournamentName, setTournamentName] = useState('');
  const [format, setFormat] = useState<'elimination' | 'round_robin'>('elimination');
  const [teams, setTeams] = useState<Team[]>([
    { id: generateId(), name: 'Equipo Rojo', color: TEAM_COLORS[0]! },
    { id: generateId(), name: 'Equipo Azul', color: TEAM_COLORS[1]! },
  ]);
  const [playerTeams, setPlayerTeams] = useState<PlayerEntry[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El host se agrega automáticamente al primer equipo
  const hostAlreadyAdded = playerTeams.some(p => p.clientId === clientId);

  function addTeam() {
    if (teams.length >= MAX_TEAMS) return;
    setTeams(prev => [
      ...prev,
      { id: generateId(), name: `Equipo ${prev.length + 1}`, color: TEAM_COLORS[prev.length % TEAM_COLORS.length] ?? TEAM_COLORS[0]! },
    ]);
  }

  function removeTeam(id: string) {
    if (teams.length <= MIN_TEAMS) return;
    setTeams(prev => prev.filter(t => t.id !== id));
    setPlayerTeams(prev => prev.filter(p => p.teamId !== id));
  }

  function updateTeamName(id: string, name: string) {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  }

  function addPlayer(playerName: string, teamId: string) {
    if (!playerName.trim() || !teamId) return;
    setPlayerTeams(prev => [
      ...prev,
      { clientId: generateId(), playerName: playerName.trim(), teamId },
    ]);
    setNewPlayerName('');
  }

  function addHostToTeam(teamId: string) {
    if (hostAlreadyAdded) return;
    setPlayerTeams(prev => [
      ...prev,
      { clientId, playerName: name || 'Host', teamId },
    ]);
  }

  function removePlayer(clientId: string) {
    setPlayerTeams(prev => prev.filter(p => p.clientId !== clientId));
  }

  async function handleCreate() {
    setError(null);
    if (!tournamentName.trim()) { setError('Poné un nombre para el torneo.'); return; }
    if (playerTeams.length < teams.length) {
      setError('Cada equipo necesita al menos un jugador.');
      return;
    }
    setBusy(true);
    try {
      const { code } = await createTournament({
        name: tournamentName.trim(),
        hostClientId: clientId,
        format,
        teams,
        playerTeams,
        config: { ...DEFAULT_CONFIG },
      });
      router.replace(`/tournament/${code}` as never);
    } catch (e) {
      setError(friendlyError(e, 'No se pudo crear el torneo.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Text variant="display" className="text-2xl mb-1">Crear torneo</Text>
      <Text variant="muted" className="mb-6">Armá el bracket y jugá con amigos</Text>

      {error && (
        <Card className="mb-4 border-red-500/30 bg-red-500/10">
          <Text className="text-red-400 text-sm">{error}</Text>
        </Card>
      )}

      {/* Nombre del torneo */}
      <Card className="gap-3 mb-4">
        <Text variant="label">Nombre del torneo</Text>
        <TextInput
          value={tournamentName}
          onChangeText={setTournamentName}
          placeholder="Ej. Copa del Barrio 2026"
          placeholderTextColor="#52525b"
          maxLength={32}
          className="h-12 rounded-xl border border-surface-border bg-surface-soft px-4 text-white"
        />
      </Card>

      {/* Formato */}
      <Card className="gap-3 mb-4">
        <Text variant="label">Formato</Text>
        <View className="flex-row gap-2">
          {([['elimination', 'Eliminación'], ['round_robin', 'Round Robin']] as const).map(([val, label]) => (
            <Pressable
              key={val}
              onPress={() => setFormat(val)}
              className={`flex-1 py-2.5 rounded-xl border items-center ${
                format === val
                  ? 'border-gold-500 bg-gold-500/10'
                  : 'border-surface-border bg-surface-soft'
              }`}
            >
              <Text className={`text-sm font-medium ${format === val ? 'text-gold-400' : 'text-zinc-400'}`}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text variant="muted" className="text-xs">
          {format === 'elimination'
            ? 'Semis y final. El perdedor queda eliminado.'
            : 'Todos contra todos. Gana el que acumula más puntos.'}
        </Text>
      </Card>

      {/* Equipos */}
      <Card className="gap-3 mb-4">
        <View className="flex-row items-center justify-between">
          <Text variant="label">Equipos ({teams.length})</Text>
          {teams.length < MAX_TEAMS && (
            <Pressable onPress={addTeam} className="px-3 py-1 rounded-lg bg-surface-soft border border-surface-border">
              <Text className="text-zinc-400 text-sm">+ Agregar</Text>
            </Pressable>
          )}
        </View>
        {teams.map((team, i) => (
          <View key={team.id} className="flex-row items-center gap-2">
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: team.color }} />
            <TextInput
              value={team.name}
              onChangeText={n => updateTeamName(team.id, n)}
              maxLength={20}
              className="flex-1 h-10 rounded-xl border border-surface-border bg-surface-soft px-3 text-white text-sm"
            />
            {teams.length > MIN_TEAMS && (
              <Pressable onPress={() => removeTeam(team.id)} hitSlop={8}>
                <Text className="text-zinc-600 text-lg">×</Text>
              </Pressable>
            )}
          </View>
        ))}
      </Card>

      {/* Jugadores */}
      <Card className="gap-3 mb-6">
        <Text variant="label">Jugadores</Text>

        {/* Host se agrega a sí mismo */}
        {!hostAlreadyAdded && (
          <View className="gap-2">
            <Text variant="muted" className="text-xs">Elegí tu equipo:</Text>
            <View className="flex-row flex-wrap gap-2">
              {teams.map(team => (
                <Pressable
                  key={team.id}
                  onPress={() => addHostToTeam(team.id)}
                  className="px-3 py-1.5 rounded-lg border border-surface-border bg-surface-soft"
                >
                  <View className="flex-row items-center gap-2">
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: team.color }} />
                    <Text className="text-white text-sm">{team.name}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Lista de jugadores ya agregados */}
        {playerTeams.map(p => {
          const team = teams.find(t => t.id === p.teamId);
          return (
            <View key={p.clientId} className="flex-row items-center gap-2">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: team?.color ?? '#71717a' }} />
              <Text className="text-white text-sm flex-1">{p.playerName}</Text>
              <Text variant="muted" className="text-xs">{team?.name}</Text>
              <Pressable onPress={() => removePlayer(p.clientId)} hitSlop={8}>
                <Text className="text-zinc-600">×</Text>
              </Pressable>
            </View>
          );
        })}

        {/* Agregar jugador */}
        <View className="gap-2 pt-1 border-t border-surface-border">
          <Text variant="muted" className="text-xs">Agregar otro jugador:</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              placeholder="Nombre"
              placeholderTextColor="#52525b"
              maxLength={16}
              className="flex-1 h-10 rounded-xl border border-surface-border bg-surface-soft px-3 text-white text-sm"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {teams.map(team => (
                <Pressable
                  key={team.id}
                  onPress={() => addPlayer(newPlayerName, team.id)}
                  disabled={!newPlayerName.trim()}
                  style={{ backgroundColor: newPlayerName.trim() ? team.color + '33' : '#27272a', borderColor: team.color + '66' }}
                  className="px-3 h-10 rounded-xl border items-center justify-center mr-2"
                >
                  <Text style={{ color: team.color }} className="text-xs font-medium">{team.name.slice(0, 8)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Card>

      <Button title="Crear torneo" onPress={handleCreate} loading={busy} />
    </Screen>
  );
}
