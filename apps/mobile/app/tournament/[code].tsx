import { api } from '@impostor/backend/api';
import { Button, Card, Screen, Text } from '@impostor/ui';
import { useMutation, useQuery } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View, Share } from 'react-native';
import { useSession } from '@/lib/session';
import { friendlyError } from '@/lib/errors';
import { runAction } from '@/lib/useToast';

type MatchStatus = 'pending' | 'playing' | 'finished' | 'bye';

type BracketMatch = {
  matchId: string;
  round: number;
  matchNumber: number;
  team1Id?: string;
  team2Id?: string;
  winnerId?: string;
  roomCode?: string;
  team1Score?: number;
  team2Score?: number;
  status: MatchStatus;
};

function getTeamName(teams: { id: string; name: string; color: string }[], id?: string) {
  if (!id) return '?';
  return teams.find(t => t.id === id)?.name ?? id.slice(0, 6);
}

function getTeamColor(teams: { id: string; name: string; color: string }[], id?: string) {
  if (!id) return '#52525b';
  return teams.find(t => t.id === id)?.color ?? '#52525b';
}

function MatchCard({
  match,
  teams,
  isHost,
  onStartMatch,
  onRecordResult,
}: {
  match: BracketMatch;
  teams: { id: string; name: string; color: string }[];
  isHost: boolean;
  onStartMatch: (matchId: string) => void;
  onRecordResult: (match: BracketMatch) => void;
}) {
  const t1Name = getTeamName(teams, match.team1Id);
  const t2Name = match.team2Id ? getTeamName(teams, match.team2Id) : 'BYE';
  const t1Color = getTeamColor(teams, match.team1Id);
  const t2Color = match.team2Id ? getTeamColor(teams, match.team2Id) : '#52525b';
  const isFinished = match.status === 'finished' || match.status === 'bye';
  const isPlaying = match.status === 'playing';
  const isPending = match.status === 'pending';

  return (
    <Card className={`gap-2 ${isPlaying ? 'border-gold-500/40 bg-gold-500/5' : ''}`}>
      <View className="flex-row items-center gap-2">
        {/* Equipo 1 */}
        <View className="flex-1 flex-row items-center gap-2">
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t1Color }} />
          <Text className={`text-sm font-medium ${match.winnerId === match.team1Id ? 'text-gold-400' : 'text-white'}`}>
            {t1Name}
          </Text>
          {match.team1Score !== undefined && (
            <Text className="text-zinc-400 text-sm ml-auto">{match.team1Score} pts</Text>
          )}
        </View>

        <Text variant="muted" className="text-xs px-2">vs</Text>

        {/* Equipo 2 */}
        <View className="flex-1 flex-row items-center gap-2 justify-end">
          {match.team2Score !== undefined && (
            <Text className="text-zinc-400 text-sm mr-auto">{match.team2Score} pts</Text>
          )}
          <Text className={`text-sm font-medium ${match.winnerId === match.team2Id ? 'text-gold-400' : 'text-white'}`}>
            {t2Name}
          </Text>
          {match.team2Id && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t2Color }} />}
        </View>
      </View>

      {/* Estado / acciones */}
      {isFinished && match.winnerId && (
        <Text variant="label" className="text-gold-400 text-xs text-center">
          Ganador: {getTeamName(teams, match.winnerId)}
        </Text>
      )}

      {isPlaying && match.roomCode && (
        <View className="flex-row items-center gap-2">
          <Text variant="muted" className="text-xs flex-1">Sala: {match.roomCode}</Text>
          <Pressable
            onPress={() => router.push(`/room/${match.roomCode}`)}
            className="px-3 py-1 rounded-lg bg-pitch-500/20 border border-pitch-500/30"
          >
            <Text className="text-pitch-400 text-xs">Ver partida</Text>
          </Pressable>
        </View>
      )}

      {isHost && isPending && match.team1Id && match.team2Id && (
        <Button
          title="Iniciar match"
          variant="secondary"
          onPress={() => onStartMatch(match.matchId)}
        />
      )}

      {isHost && isPlaying && (
        <Button
          title="Registrar resultado"
          variant="ghost"
          onPress={() => onRecordResult(match)}
        />
      )}
    </Card>
  );
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

export default function TournamentBracket() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { clientId } = useSession();
  const createRoom = useMutation(api.rooms.create);
  const setMatchRoom = useMutation(api.tournaments.setMatchRoom);
  const recordResult = useMutation(api.tournaments.recordMatchResult);
  const startTournament = useMutation(api.tournaments.start);

  const tournament = useQuery(api.tournaments.get, { code: code ?? '' });
  const [recordingMatch, setRecordingMatch] = useState<BracketMatch | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [busy, setBusy] = useState(false);

  if (!tournament) {
    return (
      <Screen>
        <Text variant="muted" className="text-center mt-12">Cargando torneo...</Text>
      </Screen>
    );
  }

  const isHost = tournament.hostClientId === clientId;
  const rounds = [...new Set(tournament.bracket.map(m => m.round))].sort((a, b) => a - b);

  const roundLabels: Record<number, string> = {};
  const maxRound = Math.max(...rounds);
  rounds.forEach(r => {
    if (tournament.format === 'round_robin') {
      roundLabels[r] = 'Partidos';
    } else {
      const diff = maxRound - r;
      roundLabels[r] = diff === 0 ? 'Final' : diff === 1 ? 'Semifinal' : diff === 2 ? 'Cuartos' : `Ronda ${r}`;
    }
  });

  async function handleStartMatch(matchId: string) {
    if (!tournament) return;
    setBusy(true);
    try {
      const { name } = useSession.getState();
      const res = await createRoom({ clientId, name: name || 'Host', color: undefined });
      await setMatchRoom({
        tournamentId: tournament._id,
        matchId,
        roomCode: res.code,
        hostClientId: clientId,
      });
      router.push(`/room/${res.code}`);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleRecordResult() {
    if (!tournament || !recordingMatch) return;
    const s1 = parseInt(score1, 10);
    const s2 = parseInt(score2, 10);
    if (isNaN(s1) || isNaN(s2)) return;
    setBusy(true);
    try {
      await recordResult({
        tournamentId: tournament._id,
        matchId: recordingMatch.matchId,
        team1Score: s1,
        team2Score: s2,
        roomCode: recordingMatch.roomCode ?? '',
        hostClientId: clientId,
      });
      setRecordingMatch(null);
      setScore1('');
      setScore2('');
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  function handleShare() {
    const url = `${process.env.EXPO_PUBLIC_APP_URL ?? ''}/tournament/${code}`;
    Share.share({ message: `Seguí el bracket del torneo "${tournament?.name}": ${url}` }).catch(() => {});
  }

  // Puntos acumulados por equipo (round robin)
  const teamScores: Record<string, number> = {};
  if (tournament.format === 'round_robin') {
    for (const m of tournament.bracket) {
      if (m.status !== 'finished' || !m.winnerId) continue;
      teamScores[m.winnerId] = (teamScores[m.winnerId] ?? 0) + 1;
    }
  }

  const sortedTeams = tournament.format === 'round_robin'
    ? [...tournament.teams].sort((a, b) => (teamScores[b.id] ?? 0) - (teamScores[a.id] ?? 0))
    : tournament.teams;

  return (
    <Screen scroll>
      {/* Header */}
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1">
          <Text variant="label" className="text-gold-400 text-xs tracking-widest mb-1">TORNEO</Text>
          <Text variant="display" className="text-2xl">{tournament.name}</Text>
          <Text variant="muted" className="text-xs mt-1">
            {tournament.format === 'elimination' ? 'Eliminación directa' : 'Round Robin'} •{' '}
            {tournament.teams.length} equipos
          </Text>
        </View>
        <Pressable onPress={handleShare} className="p-2 rounded-xl border border-surface-border bg-surface-soft">
          <Text className="text-lg">📤</Text>
        </Pressable>
      </View>

      {/* Estado del torneo */}
      {tournament.status === 'finished' && (
        <Card className="mb-4 border-gold-500/30 bg-gold-500/5 items-center gap-2">
          <Text className="text-3xl">🏆</Text>
          <Text variant="label" className="text-gold-400">Campeón</Text>
          {(() => {
            const finalMatch = tournament.bracket.find(m => m.round === maxRound);
            const champion = finalMatch?.winnerId
              ? tournament.teams.find(t => t.id === finalMatch.winnerId)
              : null;
            return champion ? (
              <Text variant="display" className="text-2xl" style={{ color: champion.color }}>
                {champion.name}
              </Text>
            ) : null;
          })()}
        </Card>
      )}

      {/* Clasificación round robin */}
      {tournament.format === 'round_robin' && tournament.status !== 'setup' && (
        <Card className="mb-4 gap-2">
          <Text variant="label" className="text-xs text-zinc-500">CLASIFICACIÓN</Text>
          {sortedTeams.map((team, i) => (
            <View key={team.id} className="flex-row items-center gap-3">
              <Text variant="muted" className="w-5 text-center text-sm">{i + 1}</Text>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: team.color }} />
              <Text className="text-white text-sm flex-1">{team.name}</Text>
              <Text className="text-zinc-400 text-sm">{teamScores[team.id] ?? 0} victorias</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Bracket por ronda */}
      {isHost && tournament.status === 'setup' && (
        <Button
          title="Iniciar torneo"
          onPress={() => runAction(
            () => startTournament({ tournamentId: tournament._id, hostClientId: clientId }),
            'No se pudo iniciar el torneo.',
          )}
          className="mb-4"
        />
      )}

      {rounds.map(round => {
        const matches = tournament.bracket.filter(m => m.round === round);
        return (
          <View key={round} className="mb-5">
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-1 h-4 rounded-full bg-gold-500/60" />
              <Text variant="label" className="text-zinc-400 text-xs tracking-widest">
                {roundLabels[round]}
              </Text>
            </View>
            <View className="gap-3">
              {matches.map(match => (
                <MatchCard
                  key={match.matchId}
                  match={match}
                  teams={tournament.teams}
                  isHost={isHost}
                  onStartMatch={handleStartMatch}
                  onRecordResult={setRecordingMatch}
                />
              ))}
            </View>
          </View>
        );
      })}

      {/* Modal registro de resultado */}
      {recordingMatch && (
        <View className="fixed inset-0 flex items-center justify-center" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 50, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Card className="w-full gap-4">
            <Text variant="label">Registrar resultado</Text>
            <Text variant="muted" className="text-sm">
              {getTeamName(tournament.teams, recordingMatch.team1Id)} vs{' '}
              {getTeamName(tournament.teams, recordingMatch.team2Id)}
            </Text>
            <View className="flex-row gap-3">
              <View className="flex-1 gap-1">
                <Text variant="muted" className="text-xs">{getTeamName(tournament.teams, recordingMatch.team1Id)}</Text>
                <input
                  value={score1}
                  onChange={e => setScore1((e.target as HTMLInputElement).value)}
                  placeholder="0"
                  type="number"
                  min="0"
                  style={{ height: 44, borderRadius: 12, border: '1px solid #3f3f46', background: '#18181b', color: 'white', padding: '0 12px', fontSize: 20, textAlign: 'center', width: '100%' }}
                />
              </View>
              <View className="flex-1 gap-1">
                <Text variant="muted" className="text-xs">{getTeamName(tournament.teams, recordingMatch.team2Id)}</Text>
                <input
                  value={score2}
                  onChange={e => setScore2((e.target as HTMLInputElement).value)}
                  placeholder="0"
                  type="number"
                  min="0"
                  style={{ height: 44, borderRadius: 12, border: '1px solid #3f3f46', background: '#18181b', color: 'white', padding: '0 12px', fontSize: 20, textAlign: 'center', width: '100%' }}
                />
              </View>
            </View>
            <View className="flex-row gap-2">
              <Button title="Cancelar" variant="ghost" onPress={() => setRecordingMatch(null)} className="flex-1" />
              <Button title="Guardar" onPress={handleRecordResult} loading={busy} className="flex-1" />
            </View>
          </Card>
        </View>
      )}
    </Screen>
  );
}
