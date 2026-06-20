import { api } from '@impostor/backend/api';
import { Button, Card, Screen, Text } from '@impostor/ui';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import Animated, { BounceIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSession } from '@/lib/session';
import { useChatInset } from '@/lib/useChatDock';
import type { RoomView } from './types';

export function ImpostorGuess({ room }: { room: RoomView }) {
  const { clientId } = useSession();
  const isHost = room.hostClientId === clientId;
  const roundId = room.currentRoundId!;
  const chatInset = useChatInset(24);

  const state = useQuery(api.game.getImpostorGuessState, roundId ? { roundId } : 'skip');
  const submitGuess = useMutation(api.game.submitImpostorGuess);

  const [guess, setGuess] = useState('');
  const [busy, setBusy] = useState(false);

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

  async function handleSubmit(forceEmpty = false) {
    if (busy) return;
    setBusy(true);
    try {
      await submitGuess({ roundId, clientId, guess: forceEmpty ? '' : guess });
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

      {/* Ejected impostor sees input */}
      {isEjected && (
        <Animated.View entering={FadeInUp.delay(300).springify()} className="gap-3">
          <Card className="gap-3 border-gold-500/20 bg-gold-500/5">
            <Text variant="label" className="text-gold-500 tracking-widest text-xs">TU ADIVINANZA</Text>
            <View className="flex-row gap-2">
              <TextInput
                value={guess}
                onChangeText={setGuess}
                placeholder="Nombre del jugador secreto..."
                placeholderTextColor="#52525b"
                maxLength={80}
                returnKeyType="send"
                autoFocus
                onSubmitEditing={() => guess.trim() && handleSubmit(false)}
                className="flex-1 h-12 rounded-xl border border-gold-500/20 bg-surface-soft px-3 text-white text-base"
              />
              <Pressable
                onPress={() => handleSubmit(false)}
                disabled={busy || !guess.trim()}
                className={`h-12 w-12 rounded-xl items-center justify-center
                  ${guess.trim() ? 'bg-gold-500' : 'bg-surface-soft'}`}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-xl font-display">→</Text>
                )}
              </Pressable>
            </View>
            <Text variant="label" className="text-zinc-600 text-xs">
              Vale el nombre o apellido. No es sensible a mayúsculas ni acentos.
            </Text>
          </Card>

          <Button
            title="Rendirse (no adivino)"
            variant="ghost"
            onPress={() => handleSubmit(true)}
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
            onPress={() => handleSubmit(true)}
          />
        </Animated.View>
      )}
      <View style={{ height: chatInset }} />
    </Screen>
  );
}
