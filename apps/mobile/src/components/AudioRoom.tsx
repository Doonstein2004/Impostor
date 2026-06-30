import { api } from '@impostor/backend/api';
import { Text } from '@impostor/ui';
import { useAction } from 'convex/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { AudioSession, registerGlobals } from '@livekit/react-native';
import { Room, RoomEvent } from 'livekit-client';
import { friendlyError } from '@/lib/errors';
import { useShallow } from 'zustand/react/shallow';
import { useSession } from '@/lib/session';
import { useChatDock } from '@/lib/useChatDock';
import { toast } from '@/lib/useToast';
import type { RoomView } from './types';

// Inicializa los globals de WebRTC para la plataforma nativa.
// Debe llamarse antes de usar cualquier API de LiveKit.
registerGlobals();

const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL;

type Member = {
  identity: string;
  name: string;
  speaking: boolean;
  micOn: boolean;
  isLocal: boolean;
};
type Status = 'connecting' | 'connected' | 'error' | 'unconfigured';

/**
 * Sala de audio nativa (Android/iOS) con LiveKit.
 * Misma UI que AudioRoom.web.tsx; difiere en:
 *  - Importa de `@livekit/react-native` (no `livekit-client`)
 *  - Llama AudioSession.startAudioSession/stopAudioSession para el routing nativo
 *  - No necesita adjuntar elementos <audio> al DOM (el audio se reproduce automáticamente)
 *  - No hay lockeo de autoplay (Android/iOS no lo tienen)
 */
export function AudioRoom({ room }: { room: RoomView }) {
  const { clientId, name } = useSession(
    useShallow((s) => ({ clientId: s.clientId, name: s.name })),
  );
  const getToken = useAction(api.livekit.token);
  const setDockHeight = useChatDock((s) => s.setHeight);

  const [status, setStatus] = useState<Status>(LIVEKIT_URL ? 'connecting' : 'unconfigured');
  const [micOn, setMicOn] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [expanded, setExpanded] = useState(false);
  const roomRef = useRef<Room | null>(null);

  const sync = useCallback(() => {
    const lk = roomRef.current;
    if (!lk) return;
    const all = [lk.localParticipant, ...lk.remoteParticipants.values()];
    setMembers(
      all.map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
        speaking: p.isSpeaking,
        micOn: p.isMicrophoneEnabled,
        isLocal: p.identity === lk.localParticipant.identity,
      })),
    );
    setMicOn(lk.localParticipant.isMicrophoneEnabled);
  }, []);

  useEffect(() => () => setDockHeight(0), [setDockHeight]);

  useEffect(() => {
    if (!LIVEKIT_URL) return;
    let cancelled = false;
    const lk = new Room();
    roomRef.current = lk;

    lk.on(RoomEvent.ParticipantConnected, sync)
      .on(RoomEvent.ParticipantDisconnected, sync)
      .on(RoomEvent.ActiveSpeakersChanged, sync)
      .on(RoomEvent.TrackMuted, sync)
      .on(RoomEvent.TrackUnmuted, sync)
      .on(RoomEvent.LocalTrackPublished, sync)
      .on(RoomEvent.LocalTrackUnpublished, sync)
      .on(RoomEvent.TrackSubscribed, sync)
      .on(RoomEvent.TrackUnsubscribed, sync);

    (async () => {
      try {
        await AudioSession.startAudioSession();
        const res = await getToken({ roomCode: room.code, clientId, name });
        if (cancelled) return;
        await lk.connect(LIVEKIT_URL!, res.token);
        if (cancelled) return;
        await lk.localParticipant.setMicrophoneEnabled(true);
        if (cancelled) return;
        setStatus('connected');
        sync();
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        toast.error(friendlyError(e, 'No se pudo conectar al audio (¿micrófono habilitado?).'));
      }
    })();

    return () => {
      cancelled = true;
      void lk.disconnect();
      void AudioSession.stopAudioSession();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.code, clientId, name]);

  async function toggleMic() {
    const lk = roomRef.current;
    if (!lk) return;
    const next = !lk.localParticipant.isMicrophoneEnabled;
    try {
      await lk.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
    } catch (e) {
      toast.error(friendlyError(e, 'No se pudo cambiar el micrófono (¿permiso denegado?).'));
    }
    sync();
  }

  const connected = status === 'connected';
  const speaking = members.filter((m) => m.speaking && m.micOn);

  const statusLabel =
    status === 'unconfigured' ? 'Audio no configurado'
    : status === 'connecting' ? 'Conectando al audio…'
    : status === 'error' ? 'No se pudo conectar'
    : speaking.length > 0
      ? `Hablando: ${speaking.map((m) => (m.isLocal ? 'Vos' : m.name)).join(', ')}`
      : `${members.length} en la sala de audio`;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <View
        onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
        style={{
          backgroundColor: 'rgba(12,12,13,0.98)',
          borderTopLeftRadius: 18, borderTopRightRadius: 18,
          borderWidth: 1,
          borderColor: connected ? 'rgba(16,185,129,0.35)' : '#27272a',
          overflow: 'hidden',
        }}
      >
        {/* Lista de participantes al expandir */}
        {expanded && connected && (
          <ScrollView
            style={{ maxHeight: 180 }}
            contentContainerStyle={{ padding: 12, gap: 8 }}
          >
            {members.map((m) => (
              <View key={m.identity} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    height: 34, width: 34, borderRadius: 17,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#18181b',
                    borderWidth: 2,
                    borderColor: m.speaking && m.micOn ? '#10b981' : '#3f3f46',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#e4e4e7' }}>
                    {m.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={{ flex: 1, fontSize: 14, color: '#e4e4e7' }} numberOfLines={1}>
                  {m.isLocal ? `${m.name} (vos)` : m.name}
                </Text>
                <Text style={{ fontSize: 16 }}>
                  {m.micOn ? (m.speaking ? '🔊' : '🎤') : '🔇'}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Barra de control */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingHorizontal: 14, paddingVertical: 10,
            borderTopWidth: expanded && connected ? 1 : 0,
            borderTopColor: '#1c1c1e',
          }}
        >
          <Pressable
            onPress={() => { if (connected) setExpanded((e) => !e); }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            {status === 'connecting' ? (
              <ActivityIndicator color="#10b981" size="small" />
            ) : (
              <Text style={{ fontSize: 18 }}>
                {status === 'error' || status === 'unconfigured' ? '🎧' : '🎙️'}
              </Text>
            )}
            <Text
              style={{ flex: 1, fontSize: 13, color: connected ? '#d4d4d8' : '#a1a1aa' }}
              numberOfLines={1}
            >
              {statusLabel}
            </Text>
            {connected && (
              <View
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: expanded ? 'rgba(255,255,255,0.09)' : 'transparent',
                }}
              >
                <Text style={{ fontSize: expanded ? 15 : 12, color: expanded ? '#e4e4e7' : '#71717a' }}>
                  {expanded ? '✕' : '▴'}
                </Text>
              </View>
            )}
          </Pressable>

          {connected && (
            <Pressable
              onPress={toggleMic}
              style={{
                height: 42, width: 42, borderRadius: 21,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: micOn ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                borderWidth: 1.5,
                borderColor: micOn ? '#10b981' : '#ef4444',
              }}
            >
              <Text style={{ fontSize: 18 }}>{micOn ? '🎤' : '🔇'}</Text>
            </Pressable>
          )}
        </View>

        {status === 'unconfigured' && (
          <Text style={{ fontSize: 11, color: '#71717a', paddingHorizontal: 14, paddingBottom: 12, lineHeight: 16 }}>
            Falta configurar EXPO_PUBLIC_LIVEKIT_URL. Ver docs/AUDIO.md.
          </Text>
        )}
      </View>
    </View>
  );
}
