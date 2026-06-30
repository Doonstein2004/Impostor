import { api } from '@impostor/backend/api';
import { Text } from '@impostor/ui';
import { useAction } from 'convex/react';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { friendlyError } from '@/lib/errors';
import { useShallow } from 'zustand/react/shallow';
import { useSession } from '@/lib/session';
import { useChatDock } from '@/lib/useChatDock';
import { toast } from '@/lib/useToast';
import type { RoomView } from './types';

const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL;
const WEB_MAX_WIDTH = 430;

type Member = { identity: string; name: string; speaking: boolean; micOn: boolean; isLocal: boolean };
type Status = 'connecting' | 'connected' | 'error' | 'unconfigured';

/**
 * Sala de audio (web/escritorio) con LiveKit. Se monta de forma persistente
 * mientras estás en la sala con `commMode === 'audio'`, así la llamada no se
 * corta al colapsar el panel. Reporta su alto a `useChatDock` para reservar
 * espacio como hace el chat de texto.
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
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const roomRef = useRef<Room | null>(null);

  /** Reanuda el audio si el navegador lo bloqueó (debe llamarse desde un gesto). */
  async function ensureAudio() {
    const lk = roomRef.current;
    if (lk && !lk.canPlaybackAudio) {
      try {
        await lk.startAudio();
        setNeedsAudioUnlock(false);
      } catch {
        /* sigue bloqueado; el usuario puede reintentar tocando */
      }
    }
  }

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

    const onTrackSub = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.style.display = 'none';
        document.body.appendChild(el);
      }
      sync();
    };
    const onTrackUnsub = (track: RemoteTrack) => {
      track.detach().forEach((el) => el.remove());
      sync();
    };

    lk.on(RoomEvent.ParticipantConnected, sync)
      .on(RoomEvent.ParticipantDisconnected, sync)
      .on(RoomEvent.ActiveSpeakersChanged, sync)
      .on(RoomEvent.TrackMuted, sync)
      .on(RoomEvent.TrackUnmuted, sync)
      .on(RoomEvent.LocalTrackPublished, sync)
      .on(RoomEvent.LocalTrackUnpublished, sync)
      .on(RoomEvent.TrackSubscribed, onTrackSub)
      .on(RoomEvent.TrackUnsubscribed, onTrackUnsub)
      // El navegador puede bloquear el autoplay del audio hasta un gesto del usuario.
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (roomRef.current && !roomRef.current.canPlaybackAudio) {
          setNeedsAudioUnlock(true);
          toast.info('Tocá la barra de audio para escuchar a los demás 🔊');
        } else {
          setNeedsAudioUnlock(false);
        }
      });

    (async () => {
      try {
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
        toast.error(friendlyError(e, 'No se pudo conectar a la sala de audio.'));
      }
    })();

    return () => {
      cancelled = true;
      lk.disconnect();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.code, clientId, name]);

  async function toggleMic() {
    const lk = roomRef.current;
    if (!lk) return;
    void ensureAudio();
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
    : speaking.length > 0 ? `Hablando: ${speaking.map((m) => (m.isLocal ? 'Vos' : m.name)).join(', ')}`
    : `${members.length} en la sala de audio`;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <View style={{ alignSelf: 'center', width: '100%', maxWidth: WEB_MAX_WIDTH }}>
        <View
          onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
          style={{
            backgroundColor: 'rgba(12,12,13,0.98)',
            borderTopLeftRadius: 18, borderTopRightRadius: 18,
            borderWidth: 1, borderColor: connected ? 'rgba(16,185,129,0.35)' : '#27272a',
            overflow: 'hidden',
          }}
        >
          {/* Lista de participantes (al expandir) */}
          {expanded && connected && (
            <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
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
                  <Text style={{ fontSize: 16 }}>{m.micOn ? (m.speaking ? '🔊' : '🎤') : '🔇'}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Barra de control */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 14, paddingVertical: 10,
              borderTopWidth: expanded && connected ? 1 : 0, borderTopColor: '#1c1c1e',
            }}
          >
            <Pressable
              onPress={() => {
                void ensureAudio();
                if (connected) setExpanded((e) => !e);
              }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              {status === 'connecting' ? (
                <ActivityIndicator color="#10b981" size="small" />
              ) : (
                <Text style={{ fontSize: 18 }}>{status === 'error' || status === 'unconfigured' ? '🎧' : '🎙️'}</Text>
              )}
              <Text style={{ flex: 1, fontSize: 13, color: connected ? '#d4d4d8' : '#a1a1aa' }} numberOfLines={1}>
                {needsAudioUnlock ? '🔇 Tocá para activar el sonido' : statusLabel}
              </Text>
              {connected && (
                <Text style={{ fontSize: 12, color: '#52525b' }}>{expanded ? '▾' : '▴'}</Text>
              )}
            </Pressable>

            {/* Botón de micrófono */}
            {connected && (
              <Pressable
                onPress={toggleMic}
                style={{
                  height: 42, width: 42, borderRadius: 21,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: micOn ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                  borderWidth: 1.5, borderColor: micOn ? '#10b981' : '#ef4444',
                }}
              >
                <Text style={{ fontSize: 18 }}>{micOn ? '🎤' : '🔇'}</Text>
              </Pressable>
            )}
          </View>

          {status === 'unconfigured' && (
            <Text style={{ fontSize: 11, color: '#71717a', paddingHorizontal: 14, paddingBottom: 12, lineHeight: 16 }}>
              Falta configurar `EXPO_PUBLIC_LIVEKIT_URL` y las llaves del server. Ver docs/AUDIO.md.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
