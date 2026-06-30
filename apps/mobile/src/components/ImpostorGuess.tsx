import { api } from '@impostor/backend/api';
import { filterPool } from '@impostor/core';
import { CHARACTERS } from '@impostor/data';
import { Button, Card, Screen, Text } from '@impostor/ui';
import { useMutation, useQuery } from 'convex/react';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { BounceIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSession } from '@/lib/session';
import { useChatInset } from '@/lib/useChatDock';
import { toast } from '@/lib/useToast';
import { friendlyError } from '@/lib/errors';
import type { RoomView } from './types';

/** Normaliza para comparar/buscar sin tildes ni mayúsculas. */
function norm(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function ImpostorGuess({ room }: { room: RoomView }) {
  const clientId = useSession((s) => s.clientId);
  const isHost = room.hostClientId === clientId;
  const roundId = room.currentRoundId!;
  const chatInset = useChatInset(24);

  const state = useQuery(api.game.getImpostorGuessState, roundId ? { roundId } : 'skip');
  const submitGuess = useMutation(api.game.submitImpostorGuess);

  const [guess, setGuess] = useState('');
  const [busy, setBusy] = useState(false);

  // Pool de personajes posibles (mismo filtro que el secreto), para sugerir y
  // que el impostor seleccione en vez de tipear (evita errores de digitación).
  const pool = useMemo(() => filterPool(CHARACTERS, room.config), [room.config]);
  const suggestions = useMemo(() => {
    const q = norm(guess);
    if (q.length < 1) return [];
    return pool
      .filter((c) => norm(c.name).includes(q) || norm(c.fullName).includes(q))
      .slice(0, 8);
  }, [guess, pool]);

  if (state === undefined) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#f59e0b" size="large" />
        </View>
      </Screen>
    );
  }

  if (state === null) return null;

  const isEjected = state.ejectedClientId === clientId;
  const ejectedPlayer = room.players.find((p) => p.clientId === state.ejectedClientId);

  async function handleSubmit(value: string) {
    if (busy) return;
    setBusy(true);
    try {
      await submitGuess({ roundId, clientId, guess: value });
    } catch (e) {
      toast.error(friendlyError(e, 'No se pudo enviar la adivinanza.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} className="items-center py-4 gap-2">
        <Animated.Text entering={BounceIn.delay(100).springify()} className="text-6xl">
          🎯
        </Animated.Text>
        <Text variant="display" className="text-impostor-400 text-2xl text-center">
          ¡IMPOSTOR DETECTADO!
        </Text>
        {ejectedPlayer && (
          <Text variant="muted" className="text-center">
            {ejectedPlayer.name} fue el más votado
          </Text>
        )}
      </Animated.View>

      {/* Explanation */}
      <Animated.View entering={FadeInDown.delay(200)}>
        <Card className="items-center gap-2 mb-4 border-impostor-500/40 bg-impostor-500/5">
          <Text className="text-2xl">⚡</Text>
          <Text variant="label" className="text-impostor-400 tracking-widest">ÚLTIMA OPORTUNIDAD</Text>
          <Text variant="muted" className="text-center text-sm">
            {isEjected
              ? 'Podés adivinar el personaje secreto. Si acertás, ¡ganás vos!'
              : `${ejectedPlayer?.name ?? 'El impostor'} tiene una última oportunidad de adivinar el personaje secreto.`}
          </Text>
        </Card>
      </Animated.View>

      {/* Ejected impostor sees input + autocompletar */}
      {isEjected && (
        <Animated.View entering={FadeInUp.delay(300).springify()} className="gap-3">
          <Card className="gap-3 border-gold-500/20 bg-gold-500/5">
            <Text variant="label" className="text-gold-500 tracking-widest text-xs">TU ADIVINANZA</Text>
            <TextInput
              value={guess}
              onChangeText={setGuess}
              placeholder="Escribí para buscar al jugador…"
              placeholderTextColor="#52525b"
              maxLength={80}
              autoFocus
              autoCorrect={false}
              className="h-12 rounded-xl border border-gold-500/20 bg-surface-soft px-3 text-white text-base"
            />

            {/* Sugerencias — tocá para elegir (sin riesgo de typo) */}
            {suggestions.length > 0 ? (
              <View className="rounded-xl border border-surface-border overflow-hidden">
                <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
                  {suggestions.map((c, i) => (
                    <Pressable
                      key={c.id}
                      onPress={() => handleSubmit(c.name)}
                      disabled={busy}
                      className={`flex-row items-center justify-between px-3 py-2.5 active:bg-gold-500/10
                        ${i > 0 ? 'border-t border-surface-border' : ''}`}
                    >
                      <View className="flex-1">
                        <Text variant="body" className="text-white">{c.name}</Text>
                        <Text variant="label" className="text-zinc-500 text-xs" numberOfLines={1}>
                          {c.fullName}{c.club ? ` · ${c.club}` : ''}
                        </Text>
                      </View>
                      <Text className="text-gold-400 text-lg ml-2">→</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : guess.trim().length > 0 ? (
              <View className="gap-2">
                <Text variant="muted" className="text-xs text-center">
                  Ninguno coincide. Podés arriesgar con lo que escribiste:
                </Text>
                <Button
                  title={`Arriesgar “${guess.trim()}”`}
                  variant="secondary"
                  loading={busy}
                  onPress={() => handleSubmit(guess)}
                />
              </View>
            ) : (
              <Text variant="label" className="text-zinc-600 text-xs">
                Empezá a escribir y elegí de la lista. No te preocupes por tildes ni mayúsculas.
              </Text>
            )}
          </Card>

          <Button
            title="Rendirse (no adivino)"
            variant="ghost"
            onPress={() => handleSubmit('')}
          />
        </Animated.View>
      )}

      {/* Others wait */}
      {!isEjected && (
        <Animated.View entering={FadeInDown.delay(300)}>
          <Card className="items-center gap-3 py-6">
            <ActivityIndicator color="#f59e0b" size="large" />
            <Text variant="muted" className="text-center text-sm">
              Esperando que {ejectedPlayer?.name ?? 'el impostor'} adivine el personaje…
            </Text>
          </Card>
        </Animated.View>
      )}

      {/* Host force-skip (when host is not the ejected player) */}
      {isHost && !isEjected && (
        <Animated.View entering={FadeInDown.delay(500)} className="mt-4">
          <Button
            title="Forzar resultado (cuenta como error)"
            variant="ghost"
            onPress={() => handleSubmit('')}
          />
        </Animated.View>
      )}
      <View style={{ height: chatInset }} />
    </Screen>
  );
}
