import { api } from '@impostor/backend/api';
import { CHARACTER_COUNT } from '@impostor/data';
import { Button, Card, Screen, Text } from '@impostor/ui';
import { useMutation } from 'convex/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useSession } from '@/lib/session';

export default function Home() {
  const { clientId, name, setName, currentRoomCode } = useSession();
  const createRoom = useMutation(api.rooms.create);
  const joinRoom = useMutation(api.rooms.join);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const needName = name.trim().length < 2;

  async function handleCreate() {
    if (needName) return Alert.alert('Falta tu nombre', 'Ingresá un nombre para jugar.');
    setBusy(true);
    try {
      const res = await createRoom({ clientId, name: name.trim() });
      router.push(`/room/${res.code}`);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (needName) return Alert.alert('Falta tu nombre', 'Ingresá un nombre para jugar.');
    if (code.trim().length < 4) return Alert.alert('Código inválido', 'Revisá el código de la sala.');
    setBusy(true);
    try {
      const res = await joinRoom({ code: code.trim().toUpperCase(), clientId, name: name.trim() });
      router.push(`/room/${res.code}`);
    } catch (e) {
      Alert.alert('No se pudo unir', String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      {/* Banner de reconexión si había una sala activa */}
      {currentRoomCode && (
        <Pressable
          onPress={() => router.push(`/room/${currentRoomCode}`)}
          className="mb-4 mt-4 flex-row items-center justify-between rounded-2xl border border-pitch-500/40 bg-pitch-500/10 px-4 py-3 active:opacity-70"
        >
          <View>
            <Text variant="label" className="text-pitch-400 text-xs">SALA ACTIVA</Text>
            <Text variant="body" className="text-white">Volver a sala {currentRoomCode}</Text>
          </View>
          <Text className="text-pitch-400 text-xl">→</Text>
        </Pressable>
      )}

      <View className={`${currentRoomCode ? 'mt-4' : 'mt-12'} mb-8 items-center`}>
        <Text variant="label" className="text-pitch-400">⚽ El juego del</Text>
        <Text variant="display" className="text-center text-4xl">IMPOSTOR{'\n'}FÚTBOL</Text>
        <Text variant="muted" className="mt-2 text-center">
          {CHARACTER_COUNT} jugadores y DTs · descubrí quién no sabe de quién hablan
        </Text>
      </View>

      <Card className="gap-3">
        <Text variant="label">Tu nombre</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ej. Dani"
          placeholderTextColor="#52525b"
          maxLength={16}
          className="h-12 rounded-2xl border border-surface-border bg-surface-soft px-4 text-white"
        />
        <Button title="Crear sala" onPress={handleCreate} loading={busy} className="mt-2" />
      </Card>

      <View className="my-5 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-surface-border" />
        <Text variant="muted">o unite a una</Text>
        <View className="h-px flex-1 bg-surface-border" />
      </View>

      <Card className="gap-3">
        <Text variant="label">Código de sala</Text>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="ABC123"
          placeholderTextColor="#52525b"
          autoCapitalize="characters"
          maxLength={6}
          className="h-12 rounded-2xl border border-surface-border bg-surface-soft px-4 text-center text-2xl tracking-[8px] text-white"
        />
        <Button title="Unirme" variant="secondary" onPress={handleJoin} loading={busy} className="mt-2" />
      </Card>
    </Screen>
  );
}
