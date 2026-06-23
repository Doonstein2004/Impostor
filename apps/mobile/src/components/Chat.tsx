import { api } from '@impostor/backend/api';
import { Text } from '@impostor/ui';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSession } from '@/lib/session';
import { useChatDock } from '@/lib/useChatDock';
import { toast } from '@/lib/useToast';
import { friendlyError } from '@/lib/errors';
import type { RoomView } from './types';

const WEB_MAX_WIDTH = 430;
/** A partir de este ancho (web) el chat va como panel lateral fijo, sin tapar el juego. */
const SIDE_MODE_MIN_WIDTH = 820;

/**
 * Chat de sala. Diseñado para no interferir con el juego y para escribir fluido:
 * - El input está SIEMPRE visible (no hace falta abrir para escribir).
 * - En web ancho va como panel lateral derecho (no tapa la columna del juego).
 * - En mobile/web angosto va como barra inferior; reporta su alto real a
 *   `useChatDock` y las pantallas reservan ese espacio (useChatInset).
 */
export function GameChat({ room }: { room: RoomView }) {
  const { clientId, name } = useSession();
  const messages = useQuery(api.messages.listByRoom, { roomId: room._id });
  const send = useMutation(api.messages.send);

  const { width } = useWindowDimensions();
  const sideMode = Platform.OS === 'web' && width >= SIDE_MODE_MIN_WIDTH;
  const setDockHeight = useChatDock((s) => s.setHeight);

  // En modo panel lateral el chat no ocupa espacio inferior; al desmontar, reset.
  useEffect(() => {
    if (sideMode) setDockHeight(0);
    return () => setDockHeight(0);
  }, [sideMode, setDockHeight]);

  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const audioMode = room.config.commMode === 'audio';
  const count = messages?.length ?? 0;
  const last = count > 0 ? messages![count - 1] : null;

  // Inicializa "vistos" en la primera carga.
  useEffect(() => {
    if (seen === null && messages !== undefined) setSeen(count);
  }, [messages, count, seen]);

  // En panel lateral todo es visible: nada queda "sin leer".
  // En modo barra, lo nuevo cuenta como no leído mientras esté colapsado.
  const allVisible = sideMode || expanded;
  useEffect(() => {
    if (allVisible) setSeen(count);
  }, [allVisible, count]);
  const unread = allVisible || seen === null ? 0 : Math.max(0, count - seen);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await send({ roomId: room._id, clientId, name, text: trimmed });
      setText('');
      setSeen(count + 1); // no contar el propio mensaje como no leído
    } catch (e) {
      toast.error(friendlyError(e, 'No se pudo enviar el mensaje.'));
    } finally {
      setBusy(false);
    }
  }

  // ── Sub-render: lista de mensajes (función, no componente: evita remontar) ─
  const renderMessages = (style?: object) => (
      <ScrollView
        ref={scrollRef}
        style={[{ paddingHorizontal: 12 }, style]}
        contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages === undefined ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator color="#f59e0b" />
          </View>
        ) : count === 0 ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#52525b', textAlign: 'center' }}>
              Sin mensajes todavía. ¡Rompé el hielo!
            </Text>
          </View>
        ) : (
          messages!.map((m) => {
            const isMe = m.clientId === clientId;
            return (
              <View key={m._id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {!isMe && (
                  <Text style={{ fontSize: 10, color: '#71717a', marginLeft: 10, marginBottom: 2, fontWeight: '600' }}>
                    {m.name}
                  </Text>
                )}
                <View
                  style={{
                    maxWidth: '85%',
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
                    backgroundColor: isMe ? 'rgba(245,158,11,0.16)' : '#1c1c1e',
                    borderWidth: 1,
                    borderColor: isMe ? 'rgba(245,158,11,0.3)' : '#27272a',
                    borderBottomRightRadius: isMe ? 4 : 16,
                    borderBottomLeftRadius: isMe ? 16 : 4,
                  }}
                >
                  <Text style={{ fontSize: 15, color: isMe ? '#fde68a' : '#e4e4e7', lineHeight: 20 }}>
                    {m.text}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    );

  // ── Sub-render: fila de input (siempre visible) ──────────────────────────
  const inputRow = (
    <View
      style={{
        flexDirection: 'row', gap: 8, alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 10,
        borderTopWidth: 1, borderTopColor: '#1c1c1e',
      }}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        onFocus={() => setSeen(count)}
        placeholder="Mensaje…"
        placeholderTextColor="#52525b"
        maxLength={300}
        returnKeyType="send"
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
        style={{
          flex: 1, height: 42, borderRadius: 21,
          borderWidth: 1, borderColor: '#27272a', backgroundColor: '#18181b',
          paddingHorizontal: 16, color: '#fff', fontSize: 15,
        }}
      />
      <Pressable
        onPress={handleSend}
        disabled={busy || !text.trim()}
        style={{
          height: 42, width: 42, borderRadius: 21,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: text.trim() ? '#f59e0b' : '#1c1c1e',
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={{ fontSize: 18, fontWeight: '700', color: text.trim() ? '#000' : '#52525b' }}>→</Text>
        )}
      </Pressable>
    </View>
  );

  const audioPlaceholder = (
    <View style={{ paddingHorizontal: 24, paddingVertical: 28, alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 36 }}>🎧</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: '#e4e4e7', textAlign: 'center' }}>
        Sala de audio próximamente
      </Text>
      <Text style={{ fontSize: 12, color: '#71717a', textAlign: 'center', lineHeight: 18 }}>
        El host eligió comunicación por voz. Por ahora coordinen por su llamada habitual,
        o cambien a chat de texto en la configuración.
      </Text>
    </View>
  );

  // ── Modo panel lateral (web ancho) ───────────────────────────────────────
  if (sideMode) {
    return (
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
        <View
          style={{
            position: 'absolute', right: 24, top: 24, bottom: 24, width: 340,
            backgroundColor: '#0c0c0d', borderRadius: 18,
            borderWidth: 1, borderColor: '#27272a', overflow: 'hidden',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1c1c1e' }}>
            <Text style={{ fontSize: 17 }}>{audioMode ? '🎙️' : '💬'}</Text>
            <Text style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: '700', color: '#d4d4d8' }}>
              {audioMode ? 'SALA DE AUDIO' : 'CHAT DE SALA'}
            </Text>
          </View>
          {audioMode ? (
            audioPlaceholder
          ) : (
            <View style={{ flex: 1 }}>
              {renderMessages({ flex: 1 })}
              {inputRow}
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Modo barra inferior (mobile / web angosto) ───────────────────────────
  const overlayStyle = Platform.OS === 'web'
    ? { alignSelf: 'center' as const, width: '100%' as const, maxWidth: WEB_MAX_WIDTH }
    : undefined;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
      <View pointerEvents="box-none" style={[{ flex: 1, justifyContent: 'flex-end' }, overlayStyle]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            entering={FadeInUp.springify().damping(20)}
            onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
            style={{
              backgroundColor: 'rgba(12,12,13,0.98)',
              borderTopLeftRadius: 18, borderTopRightRadius: 18,
              borderWidth: 1, borderColor: '#27272a',
              overflow: 'hidden',
            }}
          >
            {/* Historial (al expandir) */}
            {expanded && (audioMode ? audioPlaceholder : renderMessages({ maxHeight: 180 }))}

            {/* Barra superior: último mensaje + toggle */}
            <Pressable
              onPress={() => setExpanded((e) => !e)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 14, paddingVertical: 8,
                borderBottomWidth: expanded ? 0 : 1, borderBottomColor: '#1c1c1e',
              }}
            >
              <View style={{ position: 'relative' }}>
                <Text style={{ fontSize: 17 }}>{audioMode ? '🎙️' : '💬'}</Text>
                {unread > 0 && (
                  <View
                    style={{
                      position: 'absolute', top: -6, right: -8,
                      minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: '#0c0c0d',
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>
                      {unread > 9 ? '9+' : unread}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                {audioMode ? (
                  <Text style={{ fontSize: 13, color: '#a1a1aa' }} numberOfLines={1}>Sala de audio</Text>
                ) : last ? (
                  <Text style={{ fontSize: 13, color: '#d4d4d8' }} numberOfLines={1}>
                    <Text style={{ fontWeight: '700', color: '#a1a1aa' }}>{last.clientId === clientId ? 'Vos' : last.name}: </Text>
                    {last.text}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 13, color: '#52525b' }} numberOfLines={1}>Chat de sala</Text>
                )}
              </View>
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
            </Pressable>

            {/* Input siempre visible (salvo audio) */}
            {!audioMode && inputRow}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}
