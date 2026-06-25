import { api } from '@impostor/backend/api';
import { Button, Card, Screen, Text } from '@impostor/ui';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type TextInput as TIType,
} from 'react-native';
import Animated, {
  BounceIn,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInUp,
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSession } from '@/lib/session';
import { useCountdown } from '@/lib/useCountdown';
import { useChatInset } from '@/lib/useChatDock';
import { runAction, toast } from '@/lib/useToast';
import { useSounds } from '@/lib/useSounds';
import { friendlyError } from '@/lib/errors';
import { avatarHex } from '@/lib/avatars';
import { CLUE_EMOJIS, POSITION_COLORS } from './types';
import type { RoomView } from './types';
import { LiveReactionOverlay } from './LiveReactionOverlay';

type ReactionEntry = { emoji: string; count: number };

// ─── Shot clock ─────────────────────────────────────────────────────────────

function ShotClock({ timeLeft, animatedProgress }: {
  timeLeft: number;
  animatedProgress: ReturnType<typeof useSharedValue<number>>;
}) {
  const [barWidth, setBarWidth] = useState(0);

  const barStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      animatedProgress.value,
      [0, 0.25, 0.6, 1],
      ['#ef4444', '#f97316', '#eab308', '#10b981'],
    );
    return { width: animatedProgress.value * barWidth, backgroundColor: color };
  });

  const clockColor =
    timeLeft <= 5 ? 'text-impostor-400' :
    timeLeft <= 15 ? 'text-yellow-400' :
    'text-white';

  return (
    <View className="flex-row items-center gap-3 py-1.5">
      <Text
        variant="display"
        className={`text-3xl tabular-nums leading-none ${clockColor}`}
        style={{ fontVariant: ['tabular-nums'], minWidth: 44 }}
      >
        {String(timeLeft).padStart(2, '0')}
      </Text>
      <View
        className="flex-1 h-1.5 rounded-full bg-surface-soft overflow-hidden"
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[{ height: 6, borderRadius: 3 }, barStyle]} />
      </View>
    </View>
  );
}

// ─── Poker card ───────────────────────────────────────────────────────────

function PokerCard({ card, speakerIndex }: { card: any; speakerIndex: number }) {
  // Empieza revelado — el jugador ve su personaje de inmediato
  const [revealed, setRevealed] = useState(true);
  const scaleX = useSharedValue(1);

  useEffect(() => {
    setRevealed(true);
    scaleX.value = 1;
  }, [speakerIndex]);

  function flip() {
    scaleX.value = withSequence(
      withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
    );
    setTimeout(() => setRevealed((r) => !r), 180);
  }

  const flipStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: scaleX.value }] }));
  const zone = card?.character?.zone as keyof typeof POSITION_COLORS | undefined;
  const colors = zone ? POSITION_COLORS[zone] : null;
  const suit = card?.isImpostor ? '♠' : '♣';

  return (
    <Animated.View key={speakerIndex} entering={BounceIn.springify().damping(14)}>
      <Pressable onPress={flip} className="active:opacity-90">
        <Animated.View style={flipStyle}>
          {revealed ? (
            <View
              className={`rounded-2xl items-center py-8 px-6 gap-3 border-2
                ${card?.isImpostor ? 'border-impostor-500 bg-impostor-500/10' : 'border-gold-400 bg-gold-400/5'}`}
            >
              <View className="absolute top-3 left-4 opacity-40">
                <Text className="text-gold-400 text-xl">{suit}</Text>
              </View>
              <View className="absolute top-3 right-4 opacity-40">
                <Text className="text-gold-400 text-xl">{suit}</Text>
              </View>

              {card?.isImpostor ? (
                <>
                  <View className="h-16 w-16 rounded-full bg-impostor-500/20 border-2 border-impostor-500 items-center justify-center">
                    <Text className="text-impostor-400 font-display" style={{ fontSize: 36 }}>?</Text>
                  </View>
                  <Text variant="display" className="text-impostor-400 text-2xl tracking-widest">
                    IMPOSTOR
                  </Text>
                  {card?.character ? (
                    <View className="items-center gap-0.5">
                      <Text variant="label" className="text-zinc-500">Disimulá con:</Text>
                      <Text variant="title" className="text-impostor-300 text-center">{card.character.name}</Text>
                    </View>
                  ) : card?.hint ? (
                    <Text variant="muted" className="text-center text-xs">Pista: {card.hint}</Text>
                  ) : (
                    <Text variant="muted" className="text-xs text-center">Improvisá. No tenés pista.</Text>
                  )}
                </>
              ) : (
                <>
                  {colors && (
                    <View className={`px-3 py-0.5 rounded-full border ${colors.bg} ${colors.border}`}>
                      <Text className={`text-xs font-display tracking-widest ${colors.text}`}>{colors.label}</Text>
                    </View>
                  )}
                  <Text variant="display" className="text-gold-400 text-3xl text-center leading-tight">
                    {card?.character?.name ?? '—'}
                  </Text>
                  <Text variant="muted" className="text-xs text-center">
                    {card?.character?.nationality}
                    {card?.character?.club ? ` · ${card.character.club}` : ''}
                  </Text>
                </>
              )}

              <Text variant="label" className="text-zinc-700 text-xs mt-2">Tocá para ocultar</Text>

              <View className="absolute bottom-3 left-4 opacity-40 rotate-180">
                <Text className="text-gold-400 text-xl">{suit}</Text>
              </View>
              <View className="absolute bottom-3 right-4 opacity-40 rotate-180">
                <Text className="text-gold-400 text-xl">{suit}</Text>
              </View>
            </View>
          ) : (
            <View className="rounded-2xl items-center py-8 px-6 gap-2 border-2 border-zinc-700 bg-zinc-900">
              <View className="absolute top-3 left-4 opacity-25">
                <Text className="text-zinc-400 text-base">◆</Text>
              </View>
              <View className="absolute top-3 right-4 opacity-25">
                <Text className="text-zinc-400 text-base">◆</Text>
              </View>
              <View className="opacity-10 my-1">
                {['◆ ◆ ◆ ◆', '  ◆ ◆ ◆ ◆', '◆ ◆ ◆ ◆'].map((row, i) => (
                  <Text key={i} className="text-zinc-300 text-xs text-center tracking-[6px]">{row}</Text>
                ))}
              </View>
              <Text variant="display" className="text-zinc-400 tracking-[0.4em]" style={{ fontSize: 26 }}>
                IMP
              </Text>
              <Text variant="label" className="text-zinc-600 tracking-widest text-xs">TOCÁ PARA VER</Text>
              <View className="absolute bottom-3 left-4 opacity-25 rotate-180">
                <Text className="text-zinc-400 text-base">◆</Text>
              </View>
              <View className="absolute bottom-3 right-4 opacity-25 rotate-180">
                <Text className="text-zinc-400 text-base">◆</Text>
              </View>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Speaker spotlight ─────────────────────────────────────────────────────

function SpeakerSpotlight({ name, speakerIndex }: { name: string; speakerIndex: number }) {
  return (
    <Animated.View key={speakerIndex} entering={BounceIn.springify().damping(12)}>
      <View className="flex-row items-center gap-3 rounded-2xl py-3 px-4 border border-gold-500/20 bg-surface-card">
        <Animated.View
          entering={ZoomIn.delay(150)}
          className="h-11 w-11 rounded-full bg-gold-500/10 border-2 border-gold-500/40 items-center justify-center"
        >
          <Text className="text-gold-400 font-display" style={{ fontSize: 20 }}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </Animated.View>
        <View className="flex-1">
          <Text variant="label" className="text-zinc-500 tracking-widest text-xs">TURNO DE</Text>
          <Text variant="display" className="text-xl text-white leading-tight" numberOfLines={1}>{name}</Text>
        </View>
        <Text variant="muted" className="text-xs">Escuchá</Text>
      </View>
    </Animated.View>
  );
}

// ─── Always-visible character strip ──────────────────────────────────────

function MyCardStrip({ card }: { card: any }) {
  if (!card) return null;
  const isImpostor = card.isImpostor;
  const charName = card.character?.name as string | undefined;
  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 12, borderWidth: 1, marginBottom: 12,
        borderColor: isImpostor ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.22)',
        backgroundColor: isImpostor ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.05)',
      }}
    >
      <View
        style={{
          paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, borderWidth: 1,
          borderColor: isImpostor ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.35)',
          backgroundColor: isImpostor ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.10)',
        }}
      >
        <Text style={{ fontSize: 9, letterSpacing: 2, fontWeight: '700', color: isImpostor ? '#f87171' : '#d97706' }}>
          {isImpostor ? 'IMPOSTOR' : 'VOS'}
        </Text>
      </View>
      <View style={{ width: 1, height: 14, backgroundColor: '#27272a' }} />
      <Text
        style={{ flex: 1, fontSize: 14, fontWeight: '700', letterSpacing: 0.3,
          color: isImpostor ? '#fca5a5' : '#fde68a' }}
        numberOfLines={1}
      >
        {isImpostor
          ? (charName
              ? `Disimulá con: ${charName}`
              : card.hint
              ? `Pista: ${card.hint}`
              : 'Sin pista — improvisá')
          : (charName ?? '—')}
      </Text>
    </Animated.View>
  );
}

// ─── My turn banner ───────────────────────────────────────────────────────

function MyTurnBanner({ isImpostor }: { isImpostor: boolean }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View
      entering={BounceIn.springify().damping(12)}
      style={{ marginBottom: 10 }}
    >
      <Animated.View
        style={[
          pulseStyle,
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: isImpostor ? 'rgba(239,68,68,0.7)' : 'rgba(245,158,11,0.7)',
            backgroundColor: isImpostor ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
            paddingVertical: 9,
            paddingHorizontal: 14,
          },
        ]}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: '900',
            letterSpacing: 1.5,
            lineHeight: 22,
            color: isImpostor ? '#f87171' : '#fbbf24',
          }}
        >
          ¡TU TURNO!
        </Text>
        <Text
          style={{
            fontSize: 12,
            flex: 1,
            color: isImpostor ? '#fca5a5' : '#fde68a',
            opacity: 0.9,
          }}
          numberOfLines={1}
        >
          {isImpostor ? 'disimulá con tu pista' : 'describí a tu personaje'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Player order strip (horizontal, scrollable) ──────────────────────────

function PlayerRow({
  players, speakerOrder, currentIndex, clues, currentTurn,
}: {
  players: RoomView['players'];
  speakerOrder: string[];
  currentIndex: number;
  clues: any[];
  currentTurn: number;
}) {
  const playerMap = new Map(players.map((p) => [p.clientId, p]));
  const nextIndex = currentIndex + 1;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 2, paddingBottom: 4 }}
    >
      {speakerOrder.map((id, idx) => {
        const p = playerMap.get(id);
        const isCurrent = idx === currentIndex;
        const isNext = idx === nextIndex;
        const hasSpoken = idx < currentIndex;
        const hasSentClue = clues.some((c) => c.clientId === id && c.turn === currentTurn);

        const avatarBorder = isCurrent ? '#f59e0b' : isNext ? '#52525b' : hasSpoken ? '#27272a' : '#3f3f46';
        const avatarBg = isCurrent ? 'rgba(245,158,11,0.1)' : 'transparent';
        const nameColor = isCurrent ? '#fbbf24' : isNext ? '#a1a1aa' : hasSpoken ? '#3f3f46' : '#71717a';
        const initColor = isCurrent ? '#fbbf24' : isNext ? '#d4d4d8' : hasSpoken ? '#3f3f46' : '#a1a1aa';

        return (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Player block */}
            <Animated.View
              entering={FadeIn.delay(idx * 40)}
              style={{ alignItems: 'center', width: 60, gap: 3 }}
            >
              {/* TURNO / PRÓX label */}
              <View style={{ height: 13, justifyContent: 'center' }}>
                {isCurrent && (
                  <Text style={{ fontSize: 8, color: '#f59e0b', letterSpacing: 2, fontWeight: '700' }}>
                    TURNO
                  </Text>
                )}
                {isNext && (
                  <Text style={{ fontSize: 8, color: '#52525b', letterSpacing: 1 }}>PRÓX</Text>
                )}
              </View>

              {/* Avatar circle */}
              <View style={{ position: 'relative' }}>
                <View
                  style={{
                    height: 44, width: 44, borderRadius: 22,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: isCurrent ? 2 : 1,
                    borderColor: avatarBorder,
                    backgroundColor: avatarBg,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: initColor }}>
                    {p?.name.charAt(0).toUpperCase() ?? '?'}
                  </Text>
                </View>
                {/* Speaking dot */}
                {isCurrent && (
                  <Animated.View entering={BounceIn} style={{ position: 'absolute', top: -2, right: -2 }}>
                    <View style={{ height: 14, width: 14, borderRadius: 7, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 7, fontWeight: '900', color: '#000' }}>M</Text>
                    </View>
                  </Animated.View>
                )}
                {/* Clue sent dot */}
                {hasSentClue && !isCurrent && (
                  <View style={{ position: 'absolute', bottom: -2, right: -2, height: 8, width: 8, borderRadius: 4, backgroundColor: '#10b981', borderWidth: 1.5, borderColor: '#18181b' }} />
                )}
              </View>

              {/* Full player name */}
              <Text
                style={{ fontSize: 9, fontWeight: '600', letterSpacing: 0.3, color: nameColor, maxWidth: 58, textAlign: 'center' }}
                numberOfLines={1}
              >
                {p?.name ?? '?'}
              </Text>
            </Animated.View>

            {/* Arrow to next player */}
            {idx < speakerOrder.length - 1 && (
              <Text style={{ fontSize: 16, color: hasSpoken ? '#27272a' : '#3f3f46', marginTop: 8, marginHorizontal: 2 }}>
                ›
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Clue card (compact, color-accent left bar, animated entry) ──────────

function ClueCard({ clue, myClientId, playerColor, isLatest }: {
  clue: any;
  myClientId: string;
  playerColor?: string | null;
  isLatest?: boolean;
}) {
  const react = useMutation(api.clues.react);
  const myEmoji: string | undefined = clue.reactorEmojis?.[myClientId];
  const isMe = clue.clientId === myClientId;
  const [showAll, setShowAll] = useState(false);

  const accentColor = playerColor ?? (isMe ? '#d97706' : '#52525b');
  const reactionCounts = (clue.reactionCounts as ReactionEntry[] | undefined) ?? [];
  const activeEmojis = CLUE_EMOJIS.filter(
    (e) => myEmoji === e || (reactionCounts.find((r) => r.emoji === e)?.count ?? 0) > 0,
  );
  const visibleEmojis = showAll ? CLUE_EMOJIS : activeEmojis;
  const hasHidden = !showAll && activeEmojis.length < CLUE_EMOJIS.length;

  return (
    <Animated.View
      entering={FadeInLeft.springify().damping(18).stiffness(120)}
      style={{
        flexDirection: 'row',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isLatest ? '#3f3f46' : '#27272a',
        backgroundColor: '#18181b',
        overflow: 'hidden',
      }}
    >
      {/* Left accent bar — color único del jugador */}
      <View style={{ width: 4, backgroundColor: accentColor, opacity: isMe ? 1 : 0.55 }} />

      {/* Content */}
      <View style={{ flex: 1, paddingHorizontal: 11, paddingTop: 8, paddingBottom: 9, gap: 4 }}>
        {/* Author */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: '700', color: isMe ? '#d97706' : '#71717a' }}>
            {(clue.playerName ?? '?').toUpperCase()}{isMe ? ' · VOS' : ''}
          </Text>
          {isLatest && (
            <View style={{
              marginLeft: 'auto',
              paddingHorizontal: 6, paddingVertical: 1,
              borderRadius: 999,
              backgroundColor: 'rgba(245,158,11,0.12)',
              borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
            }}>
              <Text style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: '700', color: '#d97706' }}>NUEVA</Text>
            </View>
          )}
        </View>

        {/* Clue text */}
        <Text style={{ fontSize: 18, fontWeight: '700', letterSpacing: 0.2, lineHeight: 23, color: isMe ? '#fde68a' : '#f4f4f5' }}>
          {clue.text}
        </Text>

        {/* Reactions — solo las activas + botón para ver todas */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 1 }}>
          {visibleEmojis.map((emoji) => {
            const count = reactionCounts.find((r) => r.emoji === emoji)?.count ?? 0;
            const active = myEmoji === emoji;
            return (
              <Pressable
                key={emoji}
                onPress={() => react({ clueId: clue._id, reactorClientId: myClientId, emoji })}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 3,
                  borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3,
                  borderWidth: active ? 1.5 : 1,
                  borderColor: active ? accentColor : '#3f3f46',
                  backgroundColor: active ? `${accentColor}30` : 'transparent',
                }}
              >
                <Text style={{ fontSize: 12 }}>{emoji}</Text>
                {count > 0 && (
                  <Text style={{ fontSize: 10, fontWeight: '700', color: active ? '#fbbf24' : '#a1a1aa' }}>{count}</Text>
                )}
              </Pressable>
            );
          })}
          {hasHidden && (
            <Pressable
              onPress={() => setShowAll(true)}
              style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#3f3f46' }}
            >
              <Text style={{ fontSize: 11, color: '#71717a' }}>+</Text>
            </Pressable>
          )}
          {showAll && (
            <Pressable
              onPress={() => setShowAll(false)}
              style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#3f3f46' }}
            >
              <Text style={{ fontSize: 11, color: '#71717a' }}>−</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Clues feed (persistente, agrupado por vuelta) ────────────────────────
// Muestra TODAS las pistas de la ronda, agrupadas por vuelta, para tenerlas
// siempre presentes durante la discusión.

function CluesFeed({ clues, myClientId, currentTurn, players }: {
  clues: any[];
  myClientId: string;
  currentTurn: number;
  players: RoomView['players'];
}) {
  if (!clues.length) return null;
  const colorMap = new Map(players.map((p) => [p.clientId, avatarHex(p.color, p.clientId)]));
  // Más recientes primero: vueltas desc y, dentro de cada vuelta, pistas desc.
  const turns = [...new Set(clues.map((c) => c.turn as number))].sort((a, b) => b - a);
  // Con una sola vuelta el header "VUELTA n" es redundante (ya hay título arriba).
  const showTurnHeader = turns.length > 1;

  return (
    <View style={{ gap: 14 }}>
      {turns.map((turn) => {
        const turnClues = clues
          .filter((c) => c.turn === turn)
          .sort((a, b) => b._creationTime - a._creationTime);
        if (!turnClues.length) return null;
        const isCurrent = turn === currentTurn;
        return (
          <View key={turn} style={{ gap: 8 }}>
            {showTurnHeader && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: isCurrent ? 'rgba(245,158,11,0.7)' : '#3f3f46' }} />
                <Text style={{ fontSize: 11, letterSpacing: 2, fontWeight: '700', color: isCurrent ? '#d97706' : '#52525b' }}>
                  VUELTA {turn}
                </Text>
                <Text style={{ fontSize: 11, color: '#3f3f46' }}>{turnClues.length}</Text>
              </View>
            )}
            <View style={{ gap: 8 }}>
              {turnClues.map((clue, i) => (
                <ClueCard
                  key={clue._id}
                  clue={clue}
                  myClientId={myClientId}
                  playerColor={colorMap.get(clue.clientId) ?? null}
                  isLatest={isCurrent && i === 0}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function GameRound({ room }: { room: RoomView }) {
  const { clientId, name, setLeaving } = useSession();
  const isHost = room.hostClientId === clientId;
  const roundId = room.currentRoundId!;
  const chatInset = useChatInset(24);
  const { play } = useSounds();

  const card = useQuery(api.game.getMyCard, { roundId, clientId });
  const round = useQuery(api.game.getRound, { roundId });
  const clues = useQuery(api.clues.listByRound, { roundId });

  const submitClue = useMutation(api.game.submitClueAndAdvance);
  const skipSpeaker = useMutation(api.game.skipSpeaker);
  const nextClueRound = useMutation(api.game.nextClueRound);
  const startVoting = useMutation(api.game.startVoting);
  const backToLobby = useMutation(api.game.backToLobby);
  const leave = useMutation(api.rooms.leave);

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const inputRef = useRef<TIType>(null);

  const currentTurn = round?.currentTurn ?? 1;
  const speakerOrder = round?.speakerOrder ?? [];
  const currentIndex = round?.currentSpeakerIndex ?? 0;
  const currentSpeakerId = round?.currentSpeakerId ?? null;
  const allSpoke = round?.allSpoke ?? false;
  const turnStartedAt = round?.turnStartedAt ?? Date.now();
  const turnSeconds = room.config.turnSeconds;
  const maxClueRounds = room.config.maxClueRounds ?? 3;
  // Si hay límite: no se puede hacer más vueltas una vez alcanzado, y no se puede votar antes de completarlas
  const clueRoundLimitReached = maxClueRounds > 0 && currentTurn >= maxClueRounds;
  const mustDoMoreVueltas = maxClueRounds > 0 && currentTurn < maxClueRounds;

  const isMyTurn = currentSpeakerId === clientId;
  const currentSpeakerName =
    room.players.find((p) => p.clientId === currentSpeakerId)?.name ?? '…';

  const { timeLeft, animatedProgress, expired } = useCountdown(
    turnSeconds,
    turnStartedAt,
    !allSpoke && !!currentSpeakerId && turnSeconds > 0,
  );

  // Sonido al empezar el turno propio
  const prevSpeakerId = useRef<string | null>(null);
  useEffect(() => {
    if (isMyTurn && currentSpeakerId !== prevSpeakerId.current) {
      play('myTurn');
    }
    prevSpeakerId.current = currentSpeakerId;
  }, [currentSpeakerId, isMyTurn]);

  // Tick del timer (últimos 10s = urgente, resto = normal)
  const prevTimeLeft = useRef(timeLeft);
  useEffect(() => {
    if (turnSeconds <= 0 || !isMyTurn) return;
    if (timeLeft > 0 && timeLeft < prevTimeLeft.current) {
      if (timeLeft <= 5) play('tickUrgent');
      else if (timeLeft <= 10) play('tick');
    }
    prevTimeLeft.current = timeLeft;
  }, [timeLeft, isMyTurn, turnSeconds]);

  const hasAutoSkipped = useRef(false);
  useEffect(() => {
    if (expired && isMyTurn && !hasAutoSkipped.current) {
      hasAutoSkipped.current = true;
      runAction(() => skipSpeaker({ roundId, clientId }), 'No se pudo saltar el turno.');
    }
  }, [expired, isMyTurn]);

  // Auto-avanza a la siguiente vuelta cuando todos hablaron y aún no se llegó al límite
  const hasAutoAdvanced = useRef(false);
  useEffect(() => {
    hasAutoAdvanced.current = false;
  }, [currentTurn]);
  useEffect(() => {
    if (allSpoke && mustDoMoreVueltas && isHost && !hasAutoAdvanced.current) {
      hasAutoAdvanced.current = true;
      runAction(() => nextClueRound({ roomId: room._id, clientId }), 'No se pudo avanzar de vuelta.');
    }
  }, [allSpoke, mustDoMoreVueltas, isHost]);

  // Reset per-turn state when speaker changes
  useEffect(() => {
    hasAutoSkipped.current = false;
    setText('');
    setConfirmCancel(false);
    setShowCard(false);
    inputRef.current?.clear();
  }, [currentSpeakerId]);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await submitClue({ roundId, clientId, playerName: name, text: trimmed });
      setText('');
    } catch (e) {
      toast.error(friendlyError(e, 'No se pudo enviar tu pista (quizás cambió el turno).'));
    } finally {
      setBusy(false);
    }
  }

  if (card === undefined || round === undefined || clues === undefined) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color="#f59e0b" size="large" />
          <Text variant="muted">Repartiendo cartas…</Text>
        </View>
      </Screen>
    );
  }

  // ── Header with inline cancel ──────────────────────────────────────────
  const Header = (
    <Animated.View entering={FadeIn.duration(300)} className="flex-row items-center justify-between mb-3">
      <View className="flex-row items-center gap-2">
        <View className="px-3 py-1 rounded-full border border-gold-500/40 bg-gold-500/10">
          <Text variant="label" className="text-gold-400 tracking-widest text-xs">
            PARTIDA {room.roundNumber}
          </Text>
        </View>
        <View className="px-2 py-1 rounded-full border border-surface-border bg-surface-card">
          <Text variant="label" className="text-zinc-500 text-xs">
            Vuelta {currentTurn}{maxClueRounds > 0 ? `/${maxClueRounds}` : ''} · {currentIndex + 1}/{speakerOrder.length}
          </Text>
        </View>
      </View>
      {isHost ? (
        confirmCancel ? (
          <View className="flex-row gap-2 items-center">
            <Pressable
              onPress={() => runAction(() => backToLobby({ roomId: room._id, clientId }), 'No se pudo cancelar la ronda.')}
              className="px-2.5 py-1 rounded-lg border border-impostor-500/60 bg-impostor-500/10"
            >
              <Text className="text-impostor-400 text-xs font-display tracking-wide">CANCELAR RONDA</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmCancel(false)} className="px-2 py-1">
              <Text className="text-zinc-500 text-xs">NO</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmCancel(true)} className="px-2 py-1">
            <Text className="text-zinc-600 text-xs tracking-widest">CANCELAR</Text>
          </Pressable>
        )
      ) : (
        confirmLeave ? (
          <View className="flex-row gap-2 items-center">
            <Pressable
              onPress={async () => {
                setLeaving(true);
                await leave({ roomId: room._id, clientId });
                router.replace('/');
              }}
              className="px-2.5 py-1 rounded-lg border border-impostor-500/60 bg-impostor-500/10"
            >
              <Text className="text-impostor-400 text-xs font-display tracking-wide">SALIR</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmLeave(false)} className="px-2 py-1">
              <Text className="text-zinc-500 text-xs">NO</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmLeave(true)} className="px-2 py-1">
            <Text className="text-zinc-700 text-xs tracking-widest">SALIR</Text>
          </Pressable>
        )
      )}
    </Animated.View>
  );

  // ── allSpoke — auto-avance o pantalla de decisión ────────────────────
  if (allSpoke) {
    // Si hay más vueltas por hacer, solo mostrar transición (el host auto-avanza)
    if (mustDoMoreVueltas) {
      return (
        <Screen>
          <View className="flex-1 items-center justify-center gap-4">
            <ActivityIndicator color="#f59e0b" size="large" />
            <Text variant="display" className="text-gold-400 text-xl">
              Vuelta {currentTurn}/{maxClueRounds} completa
            </Text>
            <Text variant="muted" className="text-center text-sm">
              Comenzando vuelta {currentTurn + 1}…
            </Text>
          </View>
        </Screen>
      );
    }

    return (
      <Screen scroll>
        {Header}

        {/* Encabezado compacto */}
        <Animated.View entering={FadeIn.duration(250)} className="flex-row items-center gap-2 mb-2">
          <Text variant="display" className="text-gold-400 tracking-widest" style={{ fontSize: 15 }}>
            MESA COMPLETA
          </Text>
          <Text variant="muted" className="text-xs flex-1" numberOfLines={1}>
            · {maxClueRounds > 0 ? 'hora de votar' : `vuelta ${currentTurn} lista`}
          </Text>
        </Animated.View>

        <MyCardStrip card={card} />

        {/* Pistas primero — lo importante para discutir, sin scroll */}
        {clues.length > 0 && (
          <Animated.View entering={FadeIn.duration(250)} className="mb-3">
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-0.5 h-4 rounded-full bg-gold-500/60" />
              <Text variant="label" className="text-zinc-500 text-xs tracking-widest">
                PISTAS DE LA RONDA
              </Text>
              <Text variant="label" className="text-zinc-700 text-xs">{clues.length}</Text>
            </View>
            <CluesFeed clues={clues} myClientId={clientId} currentTurn={currentTurn} players={room.players} />
          </Animated.View>
        )}

        {/* Acciones del host / aviso */}
        {isHost ? (
          <Animated.View entering={FadeInDown.delay(150)} className="gap-2.5 mb-2">
            {maxClueRounds === 0 && (
              <Button
                title={`🔄 Nueva vuelta (vuelta ${currentTurn + 1})`}
                variant="secondary"
                onPress={() => runAction(() => nextClueRound({ roomId: room._id, clientId }), 'No se pudo iniciar la nueva vuelta.')}
              />
            )}
            <Button
              title="🗳️ Abrir votación"
              variant="danger"
              onPress={() => runAction(() => startVoting({ roomId: room._id, clientId }), 'No se pudo abrir la votación.')}
            />
          </Animated.View>
        ) : (
          <Card className="items-center mb-2 py-2.5 gap-0.5">
            <Text variant="muted" className="text-center text-xs">
              El host abrirá la votación — discutan quién es el impostor
            </Text>
          </Card>
        )}

        <View style={{ height: chatInset }} />
      </Screen>
    );
  }

  // ── Active turn — feed persistente de pistas (arriba, para no perderlas) ──
  const cluesFeed = clues.length > 0 ? (
    <View className="mt-4">
      <View className="flex-row items-center gap-2 mb-2">
        <View className="w-0.5 h-4 rounded-full bg-gold-500/60" />
        <Text variant="label" className="text-zinc-500 text-xs tracking-widest">
          PISTAS HASTA AHORA
        </Text>
        <Text variant="label" className="text-zinc-700 text-xs">{clues.length}</Text>
      </View>
      <CluesFeed clues={clues} myClientId={clientId} currentTurn={currentTurn} players={room.players} />
    </View>
  ) : null;

  // Alto de la barra de reacciones (46px) + el inset del chat
  const reactionBarHeight = 46;

  return (
    <Screen noPadding>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16, paddingTop: 8,
          paddingBottom: chatInset + reactionBarHeight,
        }}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        keyboardShouldPersistTaps="handled"
      >
        {Header}

        {/* Orden de jugadores — siempre visible arriba */}
        <Animated.View entering={FadeIn.duration(300)} className="mb-3">
          <PlayerRow
            players={room.players}
            speakerOrder={speakerOrder}
            currentIndex={currentIndex}
            clues={clues}
            currentTurn={currentTurn}
          />
        </Animated.View>

        {isMyTurn ? (
          <>
            {/* Banner pulsante — deja MUY claro que es tu turno */}
            <MyTurnBanner isImpostor={card?.isImpostor ?? false} />

            {/* Timer */}
            {turnSeconds > 0 && (
              <ShotClock timeLeft={timeLeft} animatedProgress={animatedProgress} />
            )}

            {/* Tu personaje — referencia compacta (sin scroll) */}
            <MyCardStrip card={card} />

            {/* Input de pista — arriba, accesible al instante */}
            <Animated.View entering={FadeInUp.delay(120).springify()}>
              <Card className="gap-2 border-gold-500/30 bg-gold-500/5">
                <Text variant="label" className="text-gold-500 tracking-widest text-xs">
                  ✍️ ESCRIBÍ TU PISTA
                </Text>
                <View className="flex-row gap-2">
                  <TextInput
                    ref={inputRef}
                    value={text}
                    onChangeText={setText}
                    placeholder={
                      card?.isImpostor
                        ? 'Disimulá bien… una sola palabra'
                        : 'Ej: "zurdo", "europeo", "campeón del mundo"'
                    }
                    placeholderTextColor="#52525b"
                    maxLength={60}
                    returnKeyType="send"
                    autoFocus
                    onSubmitEditing={handleSubmit}
                    className="flex-1 h-12 rounded-xl border border-gold-500/20 bg-surface-soft px-3 text-white text-base"
                  />
                  <Pressable
                    onPress={handleSubmit}
                    disabled={busy || !text.trim()}
                    className={`h-12 w-12 rounded-xl items-center justify-center ${text.trim() ? 'bg-gold-500' : 'bg-surface-soft'}`}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text className="text-xl font-display">→</Text>
                    )}
                  </Pressable>
                </View>
                <Text variant="label" className="text-zinc-700 text-xs">{60 - text.length} restantes</Text>
              </Card>
            </Animated.View>

            {/* Ver carta completa — opcional, colapsado por defecto */}
            <Pressable onPress={() => setShowCard((s) => !s)} className="items-center py-2">
              <Text variant="label" className="text-zinc-600 text-xs tracking-widest">
                {showCard ? '▾ OCULTAR CARTA' : '▸ VER MI CARTA'}
              </Text>
            </Pressable>
            {showCard && (
              <View className="mb-2">
                <PokerCard card={card} speakerIndex={currentIndex} />
              </View>
            )}

            {/* Pistas ya dadas — debajo de tu input */}
            {cluesFeed}
          </>
        ) : (
          <>
            {/* Timer cuando NO es tu turno */}
            {turnSeconds > 0 && (
              <ShotClock timeLeft={timeLeft} animatedProgress={animatedProgress} />
            )}

            {/* Spotlight del hablante actual — compacto */}
            <View className="mt-1 mb-2">
              <SpeakerSpotlight name={currentSpeakerName} speakerIndex={currentIndex} />
            </View>

            {/* Tu personaje — referencia discreta en strip */}
            <MyCardStrip card={card} />

            {/* Pistas ya dadas — arriba, para tenerlas presentes mientras se escucha */}
            {cluesFeed}

            {isHost && (
              <Animated.View entering={FadeInDown.delay(400)} className="mt-3">
                <Button
                  title="SALTAR TURNO"
                  variant="ghost"
                  onPress={() => runAction(() => skipSpeaker({ roundId, clientId }), 'No se pudo saltar el turno.')}
                />
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      {/* Reacciones en tiempo real — overlay absoluto encima del chat */}
      <LiveReactionOverlay
        roomId={room._id}
        clientId={clientId}
        playerName={name ?? ''}
        bottomOffset={chatInset}
      />
    </Screen>
  );
}
