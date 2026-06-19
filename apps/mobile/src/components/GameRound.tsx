import { api } from '@impostor/backend/api';
import { Button, Card, Screen, Text } from '@impostor/ui';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  FadeInUp,
  FadeOutDown,
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSession } from '@/lib/session';
import { useCountdown } from '@/lib/useCountdown';
import { CLUE_EMOJIS, POSITION_COLORS } from './types';
import type { RoomView } from './types';

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
    <View className="items-center gap-1 py-2">
      <Text
        variant="display"
        className={`text-8xl tabular-nums leading-none ${clockColor}`}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {String(timeLeft).padStart(2, '0')}
      </Text>
      <View
        className="h-1.5 w-full rounded-full bg-surface-soft overflow-hidden"
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[{ height: 6, borderRadius: 3 }, barStyle]} />
      </View>
    </View>
  );
}

// ─── Poker card ───────────────────────────────────────────────────────────

function PokerCard({ card, speakerIndex }: { card: any; speakerIndex: number }) {
  const [revealed, setRevealed] = useState(false);
  const scaleX = useSharedValue(1);

  useEffect(() => {
    setRevealed(false);
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

              <Text variant="label" className="text-zinc-700 text-xs mt-2">Tocá para voltear</Text>

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
      <View className="rounded-2xl items-center py-8 px-6 gap-3 border border-gold-500/20 bg-surface-card">
        <Animated.View
          entering={ZoomIn.delay(150)}
          className="h-16 w-16 rounded-full bg-gold-500/10 border-2 border-gold-500/40 items-center justify-center"
        >
          <Text className="text-gold-400 font-display" style={{ fontSize: 30 }}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </Animated.View>
        <Text variant="label" className="text-zinc-500 tracking-widest text-xs">TURNO DE</Text>
        <Text variant="display" className="text-3xl text-center text-white leading-tight">{name}</Text>
        <View className="h-px w-12 bg-gold-500/40" />
        <Text variant="muted" className="text-xs text-center">Escuchá su pista</Text>
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
          ? (charName ? `Disimulá con: ${charName}` : 'Sin pista — improvisá')
          : (charName ?? '—')}
      </Text>
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

// ─── Clue notification toast ───────────────────────────────────────────────
// Floats above the screen — one at a time, replaces when a new clue comes in

function ClueNotification({ clue, myClientId, onDismiss }: {
  clue: any;
  myClientId: string;
  onDismiss: () => void;
}) {
  const react = useMutation(api.clues.react);
  const myEmoji: string | undefined = clue.reactorEmojis?.[myClientId];
  const isMe = clue.clientId === myClientId;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(14)}
      exiting={FadeOutDown.duration(150)}
      style={{ borderRadius: 20, overflow: 'hidden', elevation: 12 }}
    >
      {/* Thick accent border via colored container */}
      <View
        style={{
          borderWidth: 2,
          borderColor: isMe ? '#f59e0b' : '#3f3f46',
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: '#18181b',
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16, paddingVertical: 8,
            backgroundColor: isMe ? 'rgba(245,158,11,0.12)' : '#27272a',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                height: 24, width: 24, borderRadius: 12,
                backgroundColor: isMe ? 'rgba(245,158,11,0.2)' : '#3f3f46',
                borderWidth: 1, borderColor: isMe ? 'rgba(245,158,11,0.4)' : '#52525b',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 10, color: isMe ? '#fbbf24' : '#fff', fontWeight: '700' }}>
                {clue.playerName?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: isMe ? '#fbbf24' : '#a1a1aa', letterSpacing: 2, fontWeight: '600' }}>
              {(clue.playerName ?? '').toUpperCase()}{isMe ? ' · VOS' : ''}
            </Text>
          </View>
          <Pressable onPress={onDismiss} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Text style={{ fontSize: 20, color: '#52525b', lineHeight: 24 }}>×</Text>
          </Pressable>
        </View>

        {/* Clue word — main focus */}
        <View style={{ alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, backgroundColor: '#18181b' }}>
          <Text
            style={{
              fontSize: 38, fontWeight: '700', letterSpacing: 1, textAlign: 'center',
              color: isMe ? '#fde68a' : '#ffffff',
            }}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {clue.text}
          </Text>
        </View>

        {/* Reaction row */}
        <View style={{ borderTopWidth: 1, borderTopColor: '#27272a', backgroundColor: '#18181b', paddingVertical: 4 }}>
          <Text style={{ fontSize: 9, color: '#52525b', letterSpacing: 1.5, textAlign: 'center', paddingTop: 4, paddingBottom: 2 }}>
            REACCIONAR
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            {CLUE_EMOJIS.map((emoji) => {
              const count = (clue.reactionCounts as ReactionEntry[] | undefined)
                ?.find((r) => r.emoji === emoji)?.count ?? 0;
              const active = myEmoji === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => react({ clueId: clue._id, reactorClientId: myClientId, emoji })}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
                    borderWidth: active ? 1.5 : 1,
                    borderColor: active ? '#f59e0b' : '#3f3f46',
                    backgroundColor: active ? 'rgba(245,158,11,0.22)' : 'rgba(39,39,42,0.9)',
                    minWidth: 44,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                  <Text style={{ fontSize: 13, color: active ? '#fbbf24' : count > 0 ? '#d4d4d8' : '#52525b', fontWeight: '700', minWidth: 14, textAlign: 'center' }}>
                    {count > 0 ? count : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Compact clue row (allSpoke summary list) ─────────────────────────────

function ClueRow({ clue, myClientId, index }: {
  clue: any;
  myClientId: string;
  index: number;
}) {
  const react = useMutation(api.clues.react);
  const myEmoji: string | undefined = clue.reactorEmojis?.[myClientId];
  const isMe = clue.clientId === myClientId;
  const topReactions = ((clue.reactionCounts as ReactionEntry[] | undefined) ?? [])
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 45).springify()}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 10, gap: 10,
        backgroundColor: isMe ? 'rgba(245,158,11,0.05)' : index % 2 === 0 ? '#1c1c1e' : '#18181b',
        borderTopWidth: index > 0 ? 1 : 0,
        borderTopColor: '#27272a',
      }}
    >
      {/* Name + clue stacked */}
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.5,
            color: isMe ? '#d97706' : '#71717a' }}
          numberOfLines={1}
        >
          {(clue.playerName ?? '?').toUpperCase()}{isMe ? ' · VOS' : ''}
        </Text>
        <Text
          style={{ fontSize: 17, fontWeight: '700', letterSpacing: 0.3,
            color: isMe ? '#fde68a' : '#ffffff' }}
          numberOfLines={1}
        >
          {clue.text}
        </Text>
      </View>

      {/* Reaction chips — tap to react, shows existing counts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexShrink: 0, maxWidth: 110 }}
        contentContainerStyle={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}
      >
        {topReactions.length > 0 ? (
          topReactions.map((r) => (
            <Pressable
              key={r.emoji}
              onPress={() => react({ clueId: clue._id, reactorClientId: myClientId, emoji: r.emoji })}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 2,
                paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999,
                borderWidth: 1,
                borderColor: myEmoji === r.emoji ? '#f59e0b' : '#3f3f46',
                backgroundColor: myEmoji === r.emoji ? 'rgba(245,158,11,0.15)' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 11 }}>{r.emoji}</Text>
              <Text style={{ fontSize: 10, color: '#71717a' }}>{r.count}</Text>
            </Pressable>
          ))
        ) : (
          /* No reactions yet — show a dim first emoji as invite */
          !isMe && (
            <Pressable
              onPress={() => react({ clueId: clue._id, reactorClientId: myClientId, emoji: CLUE_EMOJIS[0]! })}
              style={{ opacity: 0.3 }}
            >
              <Text style={{ fontSize: 14 }}>{CLUE_EMOJIS[0]}</Text>
            </Pressable>
          )
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function GameRound({ room }: { room: RoomView }) {
  const { clientId, name } = useSession();
  const isHost = room.hostClientId === clientId;
  const roundId = room.currentRoundId!;

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
  // Solo guardamos el ID de la pista a mostrar; el objeto completo se lee siempre del live query
  const [notifClueId, setNotifClueId] = useState<string | null>(null);
  const [notifDismissed, setNotifDismissed] = useState(false);
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

  const hasAutoSkipped = useRef(false);
  useEffect(() => {
    if (expired && isMyTurn && !hasAutoSkipped.current) {
      hasAutoSkipped.current = true;
      skipSpeaker({ roundId, clientId });
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
      nextClueRound({ roomId: room._id, clientId });
    }
  }, [allSpoke, mustDoMoreVueltas, isHost]);

  // Reset per-turn state when speaker changes
  useEffect(() => {
    hasAutoSkipped.current = false;
    setText('');
    setConfirmCancel(false);
    setNotifClueId(null);
    setNotifDismissed(false);
    inputRef.current?.clear();
  }, [currentSpeakerId]);

  // Track latest clue ID (only advance when a new clue is added, reset dismissed flag)
  useEffect(() => {
    if (!clues) return;
    const turnClues = clues.filter((c) => c.turn === currentTurn);
    const latest = turnClues[turnClues.length - 1];
    if (!latest) return;
    if (latest._id !== notifClueId) {
      setNotifClueId(latest._id);
      setNotifDismissed(false);
    }
  }, [clues?.length, currentTurn]);

  // Always read the live clue object from Convex (reactions update in real-time)
  const notifClue = notifClueId && !notifDismissed
    ? (clues?.find((c) => c._id === notifClueId) ?? null)
    : null;

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await submitClue({ roundId, clientId, playerName: name, text: trimmed });
      setText('');
    } catch {
      // Turn may have advanced already
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
              onPress={() => backToLobby({ roomId: room._id, clientId })}
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
    const turnClues = clues.filter((c) => c.turn === currentTurn);

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
        <MyCardStrip card={card} />

        <Animated.View entering={BounceIn.springify()} className="items-center py-3 gap-2">
          <View className="flex-row gap-3 items-center w-full">
            <View className="h-px flex-1 bg-gold-500/20" />
            <Text variant="display" className="text-gold-400 tracking-widest px-2" style={{ fontSize: 17 }}>
              MESA COMPLETA
            </Text>
            <View className="h-px flex-1 bg-gold-500/20" />
          </View>
          <Text variant="muted" className="text-center text-xs">
            {maxClueRounds > 0
              ? `${maxClueRounds} vuelta${maxClueRounds > 1 ? 's' : ''} completadas — hora de votar`
              : `Vuelta ${currentTurn} completa — todos dieron su pista`}
          </Text>
        </Animated.View>

        {isHost && (
          <Animated.View entering={FadeInDown.delay(300)} className="gap-2.5 mb-4">
            {maxClueRounds === 0 && (
              <Button
                title={`🔄 Nueva vuelta de pistas (vuelta ${currentTurn + 1})`}
                variant="secondary"
                onPress={() => nextClueRound({ roomId: room._id, clientId })}
              />
            )}
            <Button
              title="🗳️ Abrir votación"
              variant="danger"
              onPress={() => startVoting({ roomId: room._id, clientId })}
            />
          </Animated.View>
        )}

        {!isHost && (
          <Card className="items-center mb-4 py-3 gap-1">
            <Text variant="muted" className="text-center text-sm">
              El host abrirá la votación
            </Text>
            <Text variant="label" className="text-zinc-600 text-xs text-center">
              Discutan entre ustedes quién es el impostor
            </Text>
          </Card>
        )}


        {/* Compact clue rows — fixed height per player, no accumulation */}
        {turnClues.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400)}>
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-0.5 h-4 rounded-full bg-gold-500/60" />
              <Text variant="label" className="text-zinc-500 text-xs tracking-widest">
                PISTAS · VUELTA {currentTurn}
              </Text>
              <Text variant="label" className="text-zinc-700 text-xs">{turnClues.length}</Text>
            </View>
            <View
              style={{
                borderRadius: 16, overflow: 'hidden',
                borderWidth: 1, borderColor: '#27272a',
              }}
            >
              {turnClues.map((clue, i) => (
                <ClueRow key={clue._id} clue={clue} myClientId={clientId} index={i} />
              ))}
            </View>
          </Animated.View>
        )}
      </Screen>
    );
  }

  // ── Active turn — notification floats above content ────────────────────
  const showNotif = !!notifClue && !allSpoke && !notifDismissed;

  return (
    <Screen noPadding>
      {/* Main scroll content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16, paddingTop: 8,
          paddingBottom: showNotif ? 200 : 32,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {Header}
        <MyCardStrip card={card} />

        <Animated.View entering={FadeIn.duration(300)} className="mb-3">
          <PlayerRow
            players={room.players}
            speakerOrder={speakerOrder}
            currentIndex={currentIndex}
            clues={clues}
            currentTurn={currentTurn}
          />
        </Animated.View>

        {turnSeconds > 0 && (
          <ShotClock timeLeft={timeLeft} animatedProgress={animatedProgress} />
        )}

        <View className="my-2">
          {isMyTurn ? (
            <PokerCard card={card} speakerIndex={currentIndex} />
          ) : (
            <SpeakerSpotlight name={currentSpeakerName} speakerIndex={currentIndex} />
          )}
        </View>

        {isMyTurn && (
          <Animated.View entering={FadeInUp.delay(200).springify()} className="mt-2">
            <Card className="gap-2 border-gold-500/20 bg-gold-500/5">
              <Text variant="label" className="text-gold-500 tracking-widest text-xs">TU PISTA</Text>
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
        )}

        {!isMyTurn && (
          <Animated.View entering={FadeInDown.delay(200)} className="mt-2">
            <Card className="items-center gap-2 border-surface-border py-3">
              <Text variant="muted" className="text-center text-sm">
                <Text className="text-white font-display">{currentSpeakerName}</Text> está dando su pista
              </Text>
              <Text variant="label" className="text-zinc-600 text-xs text-center">
                Escuchá atentamente — ¿es coherente con el personaje o está improvisando?
              </Text>
            </Card>
          </Animated.View>
        )}

        {isHost && !isMyTurn && (
          <Animated.View entering={FadeInDown.delay(400)} className="mt-2">
            <Button
              title="SALTAR TURNO"
              variant="ghost"
              onPress={() => skipSpeaker({ roundId, clientId })}
            />
          </Animated.View>
        )}
      </ScrollView>

      {/* Floating notification — absolutely positioned, never contributes to scroll */}
      {showNotif && (
        <View
          style={{ position: 'absolute', bottom: 20, left: 16, right: 16 }}
          pointerEvents="box-none"
        >
          <ClueNotification
            key={notifClue._id}
            clue={notifClue}
            myClientId={clientId}
            onDismiss={() => setNotifDismissed(true)}
          />
        </View>
      )}
    </Screen>
  );
}
