import { api } from '@impostor/backend/api';
import { Button, Card, Screen, Text } from '@impostor/ui';
import { useMutation } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useSession } from '@/lib/session';
import { friendlyError } from '@/lib/errors';
import { ColorPicker } from '@/components/ColorPicker';
import { PlayerAvatar } from '@/components/PlayerAvatar';

export default function Home() {
  const { clientId, name, setName, avatarColor, setAvatarColor, currentRoomCode, setCurrentRoomCode, setSessionToken, notice, setNotice } = useSession(
    useShallow((s) => ({
      clientId: s.clientId,
      name: s.name,
      setName: s.setName,
      avatarColor: s.avatarColor,
      setAvatarColor: s.setAvatarColor,
      currentRoomCode: s.currentRoomCode,
      setCurrentRoomCode: s.setCurrentRoomCode,
      setSessionToken: s.setSessionToken,
      notice: s.notice,
      setNotice: s.setNotice,
    })),
  );
  const createRoom = useMutation(api.rooms.create);
  const joinRoom = useMutation(api.rooms.join);
  const joinAsSpectator = useMutation(api.rooms.joinAsSpectator);

  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spectatorCode, setSpectatorCode] = useState<string | null>(null);

  // Si llegan por enlace de invitación (?code=XXXX), precargamos el código.
  useEffect(() => {
    if (codeParam) setCode(String(codeParam).toUpperCase());
  }, [codeParam]);

  const invited = !!codeParam && !currentRoomCode;
  const needName = name.trim().length < 2;

  async function handleCreate() {
    setError(null);
    setNotice(null);
    if (needName) { setError('Ingresá tu nombre (mínimo 2 letras) para jugar.'); return; }
    setBusy(true);
    try {
      const res = await createRoom({ clientId, name: name.trim(), color: avatarColor });
      setSessionToken(res.sessionToken);
      router.push(`/room/${res.code}`);
    } catch (e) {
      setError(friendlyError(e, 'No se pudo crear la sala. Probá de nuevo.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    setError(null);
    setNotice(null);
    setSpectatorCode(null);
    if (needName) { setError('Ingresá tu nombre (mínimo 2 letras) para jugar.'); return; }
    if (code.trim().length < 4) { setError('El código tiene que tener al menos 4 caracteres. Revisalo.'); return; }
    setBusy(true);
    try {
      const res = await joinRoom({ code: code.trim().toUpperCase(), clientId, name: name.trim(), color: avatarColor, password: roomPassword || undefined });
      if (res.sessionToken) setSessionToken(res.sessionToken);
      router.push(`/room/${res.code}`);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('partida ya empezó')) {
        setSpectatorCode(code.trim().toUpperCase());
      } else if (msg.includes('contraseña')) {
        setNeedsPassword(true);
        setError(friendlyError(e, 'Esta sala requiere contraseña.'));
      } else {
        setError(friendlyError(e, 'No se pudo unir a la sala. Probá de nuevo.'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSpectate() {
    if (!spectatorCode) return;
    if (needName) { setError('Ingresá tu nombre para ver la partida.'); return; }
    setBusy(true);
    try {
      const res = await joinAsSpectator({ code: spectatorCode, clientId, name: name.trim(), color: avatarColor, password: roomPassword || undefined });
      if (res.sessionToken) setSessionToken(res.sessionToken);
      router.push(`/room/${res.code}`);
    } catch (e) {
      setError(friendlyError(e, 'No se pudo entrar como espectador.'));
    } finally {
      setBusy(false);
      setSpectatorCode(null);
    }
  }

  return (
    <Screen scroll>
      {/* Aviso flash (ej. "Te expulsaron") al volver al home */}
      {notice && (
        <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-impostor-500/40 bg-impostor-500/10 px-4 py-3">
          <Text className="text-impostor-400 flex-1 text-sm">{notice}</Text>
          <Pressable onPress={() => setNotice(null)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text className="text-impostor-400 text-xl">×</Text>
          </Pressable>
        </View>
      )}

      {/* Error de acción (código mal, falta nombre, etc.) */}
      {error && (
        <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
          <Text className="text-yellow-400 flex-1 text-sm">⚠️ {error}</Text>
          <Pressable onPress={() => setError(null)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text className="text-yellow-400 text-xl">×</Text>
          </Pressable>
        </View>
      )}

      {/* Oferta de espectador cuando la partida ya empezó */}
      {spectatorCode && (
        <Card className="mt-4 mb-2 gap-3 border-zinc-600/40 bg-zinc-600/5">
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl">👀</Text>
            <View className="flex-1">
              <Text variant="label" className="text-zinc-400 text-xs">PARTIDA EN CURSO · {spectatorCode}</Text>
              <Text variant="body">¿Querés ver como espectador?</Text>
            </View>
          </View>
          <Text variant="muted" className="text-sm">Podés ver las pistas y el chat, pero no participar en la ronda actual.</Text>
          <View className="flex-row gap-2">
            <Button title="Ver como espectador" onPress={handleSpectate} loading={busy} className="flex-1" />
            <Pressable
              onPress={() => setSpectatorCode(null)}
              className="px-4 py-3 rounded-xl border border-surface-border items-center justify-center"
            >
              <Text className="text-zinc-500 text-sm">×</Text>
            </Pressable>
          </View>
        </Card>
      )}

      {/* Tarjeta de invitación si llegaron por enlace */}
      {invited && (
        <Card className="mt-4 mb-2 gap-3 border-gold-500/40 bg-gold-500/5">
          <View className="flex-row items-center justify-between">
            <Text variant="label" className="text-gold-400 text-xs">TE INVITARON A JUGAR</Text>
            <View className="px-2 py-0.5 rounded-full border border-gold-500/40 bg-gold-500/10">
              <Text variant="label" className="text-gold-400 text-xs tracking-[3px]">{code}</Text>
            </View>
          </View>
          <Text variant="muted" className="text-sm">Poné tu nombre y entrá directo a la sala.</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor="#52525b"
            maxLength={16}
            className="h-12 rounded-2xl border border-surface-border bg-surface-soft px-4 text-white"
          />
          <Button title={`⚽ Entrar a sala ${code}`} onPress={handleJoin} loading={busy} />
        </Card>
      )}

      {/* Banner de reconexión si había una sala activa */}
      {currentRoomCode && (
        <View className="mb-4 mt-4 flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push(`/room/${currentRoomCode}`)}
            className="flex-1 flex-row items-center justify-between rounded-2xl border border-pitch-500/40 bg-pitch-500/10 px-4 py-3 active:opacity-70"
          >
            <View>
              <Text variant="label" className="text-pitch-400 text-xs">SALA ACTIVA</Text>
              <Text variant="body" className="text-white">Volver a sala {currentRoomCode}</Text>
            </View>
            <Text className="text-pitch-400 text-xl">→</Text>
          </Pressable>
          <Pressable
            onPress={() => setCurrentRoomCode(null)}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            className="h-11 w-11 items-center justify-center rounded-2xl border border-surface-border bg-surface-soft active:opacity-70"
          >
            <Text className="text-zinc-500 text-xl">×</Text>
          </Pressable>
        </View>
      )}

      <View className={`${currentRoomCode ? 'mt-4' : 'mt-12'} mb-8 items-center`}>
        <Text variant="label" className="text-pitch-400">⚽ El juego del</Text>
        <Text variant="display" className="text-center text-4xl">IMPOSTOR{'\n'}FÚTBOL</Text>
        <Text variant="muted" className="mt-2 text-center">
          Descubrí quién no sabe de quién hablan
        </Text>
      </View>

      <Card className="gap-3">
        <Text variant="label">Tu nombre</Text>
        <View className="flex-row items-center gap-3">
          <PlayerAvatar name={name || '?'} color={avatarColor} seed={clientId} size={48} />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ej. Dani"
            placeholderTextColor="#52525b"
            maxLength={16}
            className="flex-1 h-12 rounded-2xl border border-surface-border bg-surface-soft px-4 text-white"
          />
        </View>
        <ColorPicker value={avatarColor} onChange={setAvatarColor} />
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
          onChangeText={(t) => { setCode(t.toUpperCase()); setNeedsPassword(false); setRoomPassword(''); }}
          placeholder="ABC123"
          placeholderTextColor="#52525b"
          autoCapitalize="characters"
          maxLength={6}
          className="h-12 rounded-2xl border border-surface-border bg-surface-soft px-4 text-center text-2xl tracking-[8px] text-white"
        />
        {needsPassword && (
          <View className="gap-1">
            <Text variant="label" className="text-zinc-500 text-xs">🔒 Contraseña de la sala</Text>
            <TextInput
              value={roomPassword}
              onChangeText={setRoomPassword}
              placeholder="Ingresá la contraseña"
              placeholderTextColor="#52525b"
              secureTextEntry
              className="h-12 rounded-2xl border border-gold-500/40 bg-surface-soft px-4 text-white"
            />
          </View>
        )}
        <Button title="Unirme" variant="secondary" onPress={handleJoin} loading={busy} className="mt-2" />
      </Card>

      <View className="mt-6 mb-4 flex-row flex-wrap justify-center gap-4">
        <Pressable
          onPress={() => router.push('/stats')}
          className="items-center flex-row justify-center gap-2 py-3"
        >
          <Text className="text-lg">📊</Text>
          <Text variant="muted" className="text-sm">Mis estadísticas</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/leaderboard' as never)}
          className="items-center flex-row justify-center gap-2 py-3"
        >
          <Text className="text-lg">🏆</Text>
          <Text variant="muted" className="text-sm">Ranking</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/tournament/create' as never)}
          className="items-center flex-row justify-center gap-2 py-3"
        >
          <Text className="text-lg">🥇</Text>
          <Text variant="muted" className="text-sm">Torneo</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push('/privacy' as never)}
        className="mb-4 items-center py-2"
      >
        <Text variant="muted" className="text-xs underline">Política de privacidad</Text>
      </Pressable>
    </Screen>
  );
}
