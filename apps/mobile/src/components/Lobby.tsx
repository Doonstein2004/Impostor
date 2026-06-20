import {
  ERAS,
  ERA_LABELS,
  ROLES,
  ROLE_LABELS,
  ZONES,
  ZONE_LABELS,
  filterPool,
  type Era,
  type GameConfig,
  type Role,
  type Zone,
} from '@impostor/core';
import type { RoomView } from './types';
import { api } from '@impostor/backend/api';
import { CHARACTERS, SELECTABLE_CLUBS } from '@impostor/data';
import { Button, Card, Screen, Text } from '@impostor/ui';
import * as Clipboard from 'expo-clipboard';
import { useMutation } from 'convex/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Share, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInLeft } from 'react-native-reanimated';
import { useSession } from '@/lib/session';
import { POSITION_COLORS } from './types';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Construye el enlace de invitación que precarga el código en el home.
 * En web usa el origin actual; en mobile usa EXPO_PUBLIC_APP_URL si está seteada.
 */
function buildJoinUrl(code: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/?code=${code}`;
  }
  const base = process.env.EXPO_PUBLIC_APP_URL;
  return base ? `${base.replace(/\/$/, '')}/?code=${code}` : null;
}

const INACTIVE_THRESHOLD_MS = 60_000;

/** Un jugador está inactivo si está desconectado o no tuvo actividad en el último minuto. */
function isInactive(p: RoomView['players'][0]): boolean {
  if (!p.connected) return true;
  if (p.lastActiveAt && Date.now() - p.lastActiveAt > INACTIVE_THRESHOLD_MS) return true;
  return false;
}

function presenceDot(p: RoomView['players'][0]) {
  if (!p.connected) return 'bg-zinc-600';
  if (p.lastActiveAt && Date.now() - p.lastActiveAt > INACTIVE_THRESHOLD_MS) return 'bg-yellow-500';
  return 'bg-pitch-500';
}

function presenceLabel(p: RoomView['players'][0]) {
  if (!p.connected) return 'Desconectado';
  if (p.lastActiveAt && Date.now() - p.lastActiveAt > INACTIVE_THRESHOLD_MS) return 'Inactivo';
  return null;
}

const ZONE_EMOJIS: Record<Zone, string> = { portero: '🧤', defensor: '🛡️', medio: '🎯', atacante: '⚽' };
const ERA_EMOJIS: Record<Era, string> = { antiguo: '📼', leyenda: '⭐', moderno: '🔥', experimentado: '💎', actual: '⚡', joven_promesa: '🌟' };
const MAX_ROUNDS_OPTIONS = [
  { value: 1, emoji: '1️⃣' }, { value: 2, emoji: '2️⃣' }, { value: 3, emoji: '3️⃣' },
  { value: 5, emoji: '5️⃣' }, { value: 0, emoji: '♾️' },
] as const;

const MAX_CLUE_ROUNDS_OPTIONS = [
  { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' },
  { value: 5, label: '5' }, { value: 0, label: '♾️' },
] as const;

type ConfigTab = 'partida' | 'pool' | 'reglas';
const TABS: { key: ConfigTab; label: string }[] = [
  { key: 'partida', label: '🃏 Partida' },
  { key: 'pool',    label: '👥 Jugadores' },
  { key: 'reglas',  label: '⏱️ Reglas' },
];

// ─── Inline config tabs ────────────────────────────────────────────────────

function ConfigTabs({
  config,
  onPatch,
}: {
  config: GameConfig;
  onPatch: (p: Partial<GameConfig>) => void;
}) {
  const [tab, setTab] = useState<ConfigTab>('partida');
  const maxRounds = config.maxRounds ?? 3;
  const maxClueRounds = config.maxClueRounds ?? 3;
  const voteSeconds = config.voteSeconds ?? 60;
  const commMode = config.commMode ?? 'texto';

  const [secondsDraft, setSecondsDraft] = useState(
    config.turnSeconds > 0 ? String(config.turnSeconds) : '',
  );

  const [voteDraft, setVoteDraft] = useState(
    voteSeconds > 0 ? String(voteSeconds) : '',
  );

  function handleVoteSecondsChange(raw: string) {
    const clean = raw.replace(/[^0-9]/g, '');
    setVoteDraft(clean);
    const n = parseInt(clean, 10);
    if (!isNaN(n) && n >= 0 && n <= 600) onPatch({ voteSeconds: n });
  }
  function handleVoteSecondsBlur() {
    const n = parseInt(voteDraft, 10);
    if (isNaN(n) || n < 0) { setVoteDraft('60'); onPatch({ voteSeconds: 60 }); }
  }

  function handleSecondsChange(raw: string) {
    const clean = raw.replace(/[^0-9]/g, '');
    setSecondsDraft(clean);
    const n = parseInt(clean, 10);
    if (!isNaN(n) && n >= 0 && n <= 600) onPatch({ turnSeconds: n });
  }
  function handleSecondsBlur() {
    const n = parseInt(secondsDraft, 10);
    if (isNaN(n) || n < 0) { setSecondsDraft('30'); onPatch({ turnSeconds: 30 }); }
  }
  function applyPreset(s: number) {
    setSecondsDraft(s > 0 ? String(s) : '');
    onPatch({ turnSeconds: s });
  }

  return (
    <View className="gap-3">
      {/* Tab bar */}
      <View className="flex-row rounded-xl overflow-hidden border border-surface-border">
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            className={`flex-1 items-center py-2 ${tab === t.key ? 'bg-pitch-500/20' : 'bg-surface-soft'}`}
          >
            <Text
              variant="label"
              className={`text-xs ${tab === t.key ? 'text-pitch-400' : 'text-zinc-500'}`}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      <Animated.View key={tab} entering={FadeIn.duration(200)} className="gap-4">

        {/* ── PARTIDA tab ── */}
        {tab === 'partida' && (
          <>
            <View className="gap-2">
              <Text variant="label" className="text-zinc-500 text-xs">🃏 Rondas por sesión</Text>
              <View className="flex-row gap-1.5">
                {MAX_ROUNDS_OPTIONS.map(({ value, emoji }) => {
                  const active = maxRounds === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => onPatch({ maxRounds: value })}
                      className={`flex-1 items-center py-2 rounded-xl border
                        ${active ? 'border-gold-500/40 bg-gold-500/15' : 'border-surface-border bg-surface-soft'}`}
                    >
                      <Text style={{ fontSize: 18 }}>{emoji}</Text>
                      <Text className={`text-xs font-display mt-0.5 ${active ? 'text-gold-400' : 'text-zinc-500'}`}>
                        {value === 0 ? '∞' : value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-2">
              <Text variant="label" className="text-zinc-500 text-xs">🕵️ Impostores</Text>
              <View className="flex-row gap-2">
                {[1, 2, 3].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => onPatch({ impostorCount: n })}
                    className={`flex-1 items-center py-2.5 rounded-xl border
                      ${config.impostorCount === n
                        ? 'border-impostor-500/40 bg-impostor-500/20'
                        : 'border-surface-border bg-surface-soft'}`}
                  >
                    <Text style={{ fontSize: 18 }}>{n === 1 ? '1️⃣' : n === 2 ? '2️⃣' : '3️⃣'}</Text>
                    <Text className={`text-xs font-body mt-0.5 ${config.impostorCount === n ? 'text-impostor-400' : 'text-zinc-500'}`}>
                      {n} imp.
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="gap-2">
              <Text variant="label" className="text-zinc-500 text-xs">🔄 Vueltas de pistas por partida</Text>
              <View className="flex-row gap-1.5">
                {MAX_CLUE_ROUNDS_OPTIONS.map(({ value, label }) => {
                  const active = maxClueRounds === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => onPatch({ maxClueRounds: value })}
                      className={`flex-1 items-center py-2 rounded-xl border
                        ${active ? 'border-pitch-500/40 bg-pitch-500/20' : 'border-surface-border bg-surface-soft'}`}
                    >
                      <Text className={`text-sm font-display ${active ? 'text-pitch-400' : 'text-zinc-500'}`}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* ── POOL tab ── */}
        {tab === 'pool' && (
          <>
            <View className="gap-2">
              <Text variant="label" className="text-zinc-500 text-xs">📍 Posición (vacío = todas)</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {ZONES.map((z: Zone) => {
                  const colors = POSITION_COLORS[z];
                  const active = config.zones.includes(z);
                  return (
                    <Pressable
                      key={z}
                      onPress={() => onPatch({ zones: toggle(config.zones, z) })}
                      className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1
                        ${active ? `${colors.bg} ${colors.border}` : 'border-surface-border bg-surface-soft'}`}
                    >
                      <Text style={{ fontSize: 12 }}>{ZONE_EMOJIS[z]}</Text>
                      <Text className={`text-xs font-body ${active ? colors.text : 'text-zinc-400'}`}>
                        {ZONE_LABELS[z]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-2">
              <Text variant="label" className="text-zinc-500 text-xs">🕰️ Época (vacío = todas)</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {ERAS.map((e: Era) => (
                  <Pressable
                    key={e}
                    onPress={() => onPatch({ eras: toggle(config.eras, e) })}
                    className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1
                      ${config.eras.includes(e)
                        ? 'border-pitch-500/40 bg-pitch-500/20'
                        : 'border-surface-border bg-surface-soft'}`}
                  >
                    <Text style={{ fontSize: 12 }}>{ERA_EMOJIS[e]}</Text>
                    <Text className={`text-xs font-body ${config.eras.includes(e) ? 'text-pitch-400' : 'text-zinc-400'}`}>
                      {ERA_LABELS[e]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="gap-2">
              <Text variant="label" className="text-zinc-500 text-xs">🏟️ Clubes (vacío = todos)</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {SELECTABLE_CLUBS.map((club) => {
                  const active = (config.clubs ?? []).includes(club);
                  return (
                    <Pressable
                      key={club}
                      onPress={() => onPatch({ clubs: toggle(config.clubs ?? [], club) })}
                      className={`rounded-full border px-2.5 py-1
                        ${active ? 'border-gold-500/40 bg-gold-500/15' : 'border-surface-border bg-surface-soft'}`}
                    >
                      <Text className={`text-xs font-body ${active ? 'text-gold-400' : 'text-zinc-400'}`}>
                        {club}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {(config.clubs ?? []).length > 0 && (
                <Pressable onPress={() => onPatch({ clubs: [] })} className="self-start">
                  <Text variant="label" className="text-zinc-600 text-xs">✕ Limpiar clubes</Text>
                </Pressable>
              )}
            </View>

            <View className="gap-2">
              <Text variant="label" className="text-zinc-500 text-xs">👤 Tipo de personaje</Text>
              <View className="flex-row gap-2">
                {ROLES.map((r: Role) => {
                  const active = config.roles.includes(r);
                  return (
                    <Pressable
                      key={r}
                      onPress={() => {
                        const next = toggle(config.roles, r);
                        if (next.length === 0) return;
                        onPatch({ roles: next });
                      }}
                      className={`flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl border
                        ${active
                          ? 'border-pitch-500/40 bg-pitch-500/20'
                          : 'border-surface-border bg-surface-soft'}`}
                    >
                      <Text style={{ fontSize: 16 }}>{r === 'jugador' ? '⚽' : '📋'}</Text>
                      <Text className={`text-xs font-body ${active ? 'text-pitch-400' : 'text-zinc-400'}`}>
                        {ROLE_LABELS[r]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* ── REGLAS tab ── */}
        {tab === 'reglas' && (
          <>
            <View className="gap-2">
              <Text variant="label" className="text-zinc-500 text-xs">💬 Comunicación</Text>
              <View className="flex-row gap-1.5">
                {([
                  { key: 'texto', emoji: '💬', label: 'Chat de texto' },
                  { key: 'audio', emoji: '🎙️', label: 'Sala de audio' },
                ] as const).map(({ key, emoji, label }) => {
                  const active = commMode === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => onPatch({ commMode: key })}
                      className={`flex-1 items-center py-2.5 rounded-xl border
                        ${active ? 'border-pitch-500/40 bg-pitch-500/20' : 'border-surface-border bg-surface-soft'}`}
                    >
                      <Text style={{ fontSize: 20 }}>{emoji}</Text>
                      <Text className={`text-xs font-body mt-0.5 ${active ? 'text-pitch-400' : 'text-zinc-400'}`}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {commMode === 'audio' && (
                <Text variant="label" className="text-zinc-600 text-xs">
                  🚧 La sala de audio está en construcción — por ahora muestra un aviso.
                </Text>
              )}
            </View>

            <View className="gap-2">
              <Text variant="label" className="text-zinc-500 text-xs">⏱️ Segundos por turno</Text>
              <View className="flex-row gap-1.5">
                {([15, 30, 60] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => applyPreset(s)}
                    className={`flex-1 items-center py-2.5 rounded-xl border
                      ${config.turnSeconds === s
                        ? 'border-pitch-500/40 bg-pitch-500/20'
                        : 'border-surface-border bg-surface-soft'}`}
                  >
                    <Text className={`text-sm font-display ${config.turnSeconds === s ? 'text-pitch-400' : 'text-zinc-400'}`}>
                      {s}s
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => applyPreset(0)}
                  className={`flex-1 items-center py-2.5 rounded-xl border
                    ${config.turnSeconds === 0
                      ? 'border-pitch-500/40 bg-pitch-500/20'
                      : 'border-surface-border bg-surface-soft'}`}
                >
                  <Text className={`text-sm font-display ${config.turnSeconds === 0 ? 'text-pitch-400' : 'text-zinc-400'}`}>
                    ♾️
                  </Text>
                </Pressable>
              </View>
              {config.turnSeconds !== 0 && (
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={secondsDraft}
                    onChangeText={handleSecondsChange}
                    onBlur={handleSecondsBlur}
                    placeholder="30"
                    placeholderTextColor="#52525b"
                    keyboardType="number-pad"
                    maxLength={3}
                    className="flex-1 h-10 rounded-xl border border-surface-border bg-surface-soft px-3 text-white text-sm"
                  />
                  <Text variant="label" className="text-zinc-500 text-sm">seg. personalizado</Text>
                </View>
              )}
            </View>

            <View className="gap-2">
              <Text variant="label" className="text-zinc-500 text-xs">🗳️ Tiempo de votación (segundos)</Text>
              <View className="flex-row gap-1.5">
                {([30, 60, 90] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => { setVoteDraft(String(s)); onPatch({ voteSeconds: s }); }}
                    className={`flex-1 items-center py-2.5 rounded-xl border
                      ${voteSeconds === s
                        ? 'border-pitch-500/40 bg-pitch-500/20'
                        : 'border-surface-border bg-surface-soft'}`}
                  >
                    <Text className={`text-sm font-display ${voteSeconds === s ? 'text-pitch-400' : 'text-zinc-400'}`}>
                      {s}s
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => { setVoteDraft(''); onPatch({ voteSeconds: 0 }); }}
                  className={`flex-1 items-center py-2.5 rounded-xl border
                    ${voteSeconds === 0
                      ? 'border-pitch-500/40 bg-pitch-500/20'
                      : 'border-surface-border bg-surface-soft'}`}
                >
                  <Text className={`text-sm font-display ${voteSeconds === 0 ? 'text-pitch-400' : 'text-zinc-400'}`}>
                    ♾️
                  </Text>
                </Pressable>
              </View>
              {voteSeconds !== 0 && (
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={voteDraft}
                    onChangeText={handleVoteSecondsChange}
                    onBlur={handleVoteSecondsBlur}
                    placeholder="60"
                    placeholderTextColor="#52525b"
                    keyboardType="number-pad"
                    maxLength={3}
                    className="flex-1 h-10 rounded-xl border border-surface-border bg-surface-soft px-3 text-white text-sm"
                  />
                  <Text variant="label" className="text-zinc-500 text-sm">seg. personalizado</Text>
                </View>
              )}
            </View>

            <View className="gap-2">
              <Text variant="label" className="text-zinc-500 text-xs">🔮 El impostor recibe</Text>
              <View className="flex-row gap-1.5">
                {([
                  { key: 'nada',    emoji: '🙈', label: 'Nada' },
                  { key: 'pista',   emoji: '💡', label: 'Pista' },
                  { key: 'similar', emoji: '👥', label: 'Similar' },
                ] as const).map(({ key, emoji, label }) => {
                  const active = config.impostorHint === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => onPatch({ impostorHint: key })}
                      className={`flex-1 items-center py-2.5 rounded-xl border
                        ${active
                          ? 'border-pitch-500/40 bg-pitch-500/20'
                          : 'border-surface-border bg-surface-soft'}`}
                    >
                      <Text style={{ fontSize: 20 }}>{emoji}</Text>
                      <Text className={`text-xs font-body mt-0.5 ${active ? 'text-pitch-400' : 'text-zinc-400'}`}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}

      </Animated.View>
    </View>
  );
}

// ─── Lobby ────────────────────────────────────────────────────────────────

export function Lobby({ room }: { room: RoomView }) {
  const { clientId } = useSession();
  const isHost = room.hostClientId === clientId;
  const updateConfig = useMutation(api.rooms.updateConfig);
  const startRound = useMutation(api.game.startRound);
  const leave = useMutation(api.rooms.leave);
  const kickPlayer = useMutation(api.rooms.kick);

  const [codeCopied, setCodeCopied] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmInactive, setConfirmInactive] = useState(false);
  const [kickConfirm, setKickConfirm] = useState<string | null>(null);

  const config = room.config;
  const usedIds = new Set(room.usedCharacterIds);
  const poolSize = useMemo(
    () => filterPool(CHARACTERS, config).filter((c) => !usedIds.has(c.id)).length,
    [config, room.usedCharacterIds],
  );
  const totalPoolSize = useMemo(() => filterPool(CHARACTERS, config).length, [config]);
  const maxRounds = config.maxRounds ?? 3;

  async function patch(partial: Partial<GameConfig>) {
    if (!isHost) return;
    setStartError(null);
    await updateConfig({ roomId: room._id, clientId, config: { ...config, ...partial } });
  }

  async function invite() {
    const url = buildJoinUrl(room.code);
    const message = url
      ? `¡Unite a mi sala de Impostor Fútbol! Entrá directo: ${url}\n(o usá el código ${room.code})`
      : `¡Unite a mi sala de Impostor Fútbol! Código: ${room.code}`;
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(url ?? room.code);
      Alert.alert('Enlace copiado', url ?? room.code);
    }
  }

  // Jugadores inactivos o desconectados (los que pueden trabar la partida).
  const inactivePlayers = room.players.filter(isInactive);

  async function handleStart() {
    setStartError(null);
    if (room.players.length < 3) {
      setStartError('Se necesitan al menos 3 jugadores para empezar.');
      return;
    }
    if (totalPoolSize === 0) {
      setStartError('Esta combinación de filtros no tiene personajes. Ajustá la configuración.');
      return;
    }
    // Si hay inactivos/desconectados, pedimos confirmación inline (Alert no funciona en web).
    if (inactivePlayers.length > 0 && !confirmInactive) {
      setConfirmInactive(true);
      return;
    }
    setConfirmInactive(false);
    await doStart();
  }

  async function doStart() {
    try {
      await startRound({ roomId: room._id, clientId });
    } catch (e) {
      setStartError(String(e instanceof Error ? e.message : e));
    }
  }

  async function handleKick(targetClientId: string) {
    setKickConfirm(null);
    try {
      await kickPlayer({ roomId: room._id, hostClientId: clientId, targetClientId });
      setConfirmInactive(false);
    } catch (e) {
      setStartError(String(e instanceof Error ? e.message : e));
    }
  }

  async function handleLeave() {
    await leave({ roomId: room._id, clientId });
    router.replace('/');
  }

  return (
    <Screen scroll>
      {/* Hero */}
      <Animated.View entering={FadeInDown.duration(400)} className="items-center py-4 gap-1">
        <Text className="text-5xl mb-1">⚽</Text>
        <Text variant="display" className="text-center text-2xl">IMPOSTOR FÚTBOL</Text>
        {room.roundNumber > 0 && (
          <View className="px-3 py-0.5 rounded-full border border-gold-500/40 bg-gold-500/10 mt-1">
            <Text variant="label" className="text-gold-400 tracking-widest text-xs">
              PRÓXIMA: PARTIDA {room.roundNumber + 1}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Código */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <Card className="items-center gap-2 mb-4 border-pitch-500/30 bg-pitch-500/5">
          <Text variant="label" className="text-zinc-500">Código de sala</Text>
          <Pressable
            onPress={async () => {
              await Clipboard.setStringAsync(room.code);
              setCodeCopied(true);
              setTimeout(() => setCodeCopied(false), 2000);
            }}
            className="active:opacity-70"
          >
            <Text variant="display" className="text-4xl tracking-[10px] text-pitch-400">{room.code}</Text>
          </Pressable>
          <View className="h-5 justify-center">
            {codeCopied ? (
              <Animated.View entering={FadeIn.duration(150)}>
                <Text variant="label" className="text-pitch-400 text-xs">✓ ¡Código copiado!</Text>
              </Animated.View>
            ) : (
              <Text variant="label" className="text-zinc-600 text-xs">Tocá el código para copiarlo</Text>
            )}
          </View>
          <Button title="📤 Invitar amigos" variant="secondary" onPress={invite} className="w-full mt-1" />
        </Card>
      </Animated.View>

      {/* Jugadores */}
      <Animated.View entering={FadeInDown.delay(130).duration(400)}>
        <View className="flex-row items-center justify-between mb-2">
          <Text variant="title">🏟️ En la cancha</Text>
          <View className={`px-2 py-0.5 rounded-full ${room.players.length >= 3 ? 'bg-pitch-500/20' : 'bg-yellow-500/20'}`}>
            <Text variant="label" className={room.players.length >= 3 ? 'text-pitch-400' : 'text-yellow-400'}>
              {room.players.length}/10
            </Text>
          </View>
        </View>
        <Card className="gap-0 mb-4">
          {room.players.map((p, i) => (
            <Animated.View
              key={p.clientId}
              entering={FadeInLeft.delay(i * 50).duration(300).springify()}
              className="flex-row items-center justify-between py-2.5 border-b border-surface-border last:border-b-0"
            >
              <View className="flex-row items-center gap-2">
                <View className={`h-2 w-2 rounded-full ${presenceDot(p)}`} />
                <View className="h-8 w-8 rounded-full bg-surface-soft items-center justify-center">
                  <Text className="text-sm font-display text-white">{p.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text variant="body">{p.name}</Text>
                  {presenceLabel(p) && (
                    <Text variant="label" className="text-yellow-500 text-xs leading-none">
                      {presenceLabel(p)}
                    </Text>
                  )}
                </View>
                {p.isHost && (
                  <View className="px-1.5 py-0.5 rounded-full bg-pitch-500/20 border border-pitch-500/30">
                    <Text variant="label" className="text-pitch-400 text-xs">HOST</Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center gap-2">
                <View className="flex-row items-center gap-1">
                  <Text className="text-sm">🏆</Text>
                  <Text variant="muted">{p.score}</Text>
                </View>
                {isHost && !p.isHost && (
                  kickConfirm === p.clientId ? (
                    <View className="flex-row items-center gap-1">
                      <Pressable
                        onPress={() => handleKick(p.clientId)}
                        className="px-2 py-1 rounded-lg border border-impostor-500/60 bg-impostor-500/10"
                      >
                        <Text className="text-impostor-400 text-xs font-display">Expulsar</Text>
                      </Pressable>
                      <Pressable onPress={() => setKickConfirm(null)} className="px-2 py-1">
                        <Text className="text-zinc-500 text-xs">No</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setKickConfirm(p.clientId)}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      className="h-7 w-7 items-center justify-center rounded-lg border border-surface-border active:opacity-70"
                    >
                      <Text className="text-zinc-500 text-sm">✕</Text>
                    </Pressable>
                  )
                )}
              </View>
            </Animated.View>
          ))}
          {room.players.length < 3 && (
            <Text variant="label" className="text-yellow-400 text-center pt-2">
              ⚠️ Faltan {3 - room.players.length} jugadores para empezar
            </Text>
          )}
        </Card>
      </Animated.View>

      {/* Configuración — sólo host */}
      {isHost && (
        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          <View className="flex-row items-center justify-between mb-2">
            <Text variant="title">⚙️ Configuración</Text>
            <Text variant="label" className="text-zinc-500 text-xs">
              {poolSize} pers. · {maxRounds > 0 ? `${maxRounds}r` : '∞r'} · {config.turnSeconds > 0 ? `${config.turnSeconds}s` : '♾️'}
            </Text>
          </View>
          <Card className="mb-4">
            <ConfigTabs config={config} onPatch={patch} />
          </Card>
        </Animated.View>
      )}

      {/* Acciones */}
      <Animated.View entering={FadeInDown.delay(230).duration(400)} className="gap-3 pb-6">
        {isHost ? (
          <>
            {startError && (
              <View className="rounded-xl border border-impostor-500/50 bg-impostor-500/10 px-3 py-2">
                <Text variant="label" className="text-impostor-400 text-xs">⚠️ {startError}</Text>
              </View>
            )}

            {confirmInactive && inactivePlayers.length > 0 ? (
              <View className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-3 gap-2">
                <Text variant="label" className="text-yellow-400 text-xs">
                  ⚠️ {inactivePlayers.map((p) => p.name).join(', ')} {inactivePlayers.length === 1 ? 'está inactivo/desconectado' : 'están inactivos/desconectados'}
                </Text>
                <Text variant="muted" className="text-xs">
                  Pueden trabar la partida si no responden. Podés expulsarlos en la lista de arriba.
                </Text>
                <Button title="▶️ Empezar igual" variant="secondary" onPress={doStart} />
                <Button title="Cancelar" variant="ghost" onPress={() => setConfirmInactive(false)} />
              </View>
            ) : (
              <Button
                title={
                  totalPoolSize === 0
                    ? 'Sin personajes en el pool'
                    : poolSize > 0
                    ? `⚽ ¡Partida ${room.roundNumber + 1}! (${poolSize} disponibles)`
                    : `⚽ ¡Partida ${room.roundNumber + 1}! (reinicia pool)`
                }
                onPress={handleStart}
              />
            )}
            {poolSize === 0 && totalPoolSize > 0 && (
              <Text variant="label" className="text-center text-zinc-500 text-xs -mt-1">
                Se usaron todos los personajes del pool — se vuelven a mezclar
              </Text>
            )}
            {poolSize > 0 && usedIds.size > 0 && (
              <Text variant="label" className="text-center text-zinc-600 text-xs -mt-1">
                {usedIds.size} ya usados esta sesión
              </Text>
            )}
          </>
        ) : (
          <Card className="items-center border-surface-border">
            <Text className="text-2xl mb-1">⏳</Text>
            <Text variant="muted" className="text-center">Esperando que el host inicie la partida…</Text>
          </Card>
        )}
        <Button title="Salir de la sala" variant="ghost" onPress={handleLeave} />
      </Animated.View>
    </Screen>
  );
}
