import { Text } from '@impostor/ui';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { useChatDock } from '@/lib/useChatDock';
import type { RoomView } from './types';

/**
 * Placeholder de sala de audio para nativo (Android/iOS). El audio real
 * (LiveKit con `livekit-client`) vive en `AudioRoom.web.tsx` y solo corre en
 * web/escritorio. Metro resuelve `.web.tsx` en web y este archivo en nativo;
 * TypeScript resuelve este como el módulo base.
 */
export function AudioRoom(_props: { room: RoomView }) {
  const setDockHeight = useChatDock((s) => s.setHeight);
  useEffect(() => () => setDockHeight(0), [setDockHeight]);

  // En web este archivo no se usa, pero por las dudas no mostramos nada ahí.
  if (Platform.OS === 'web') return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
    >
      <View
        onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
        style={{
          backgroundColor: 'rgba(12,12,13,0.98)',
          borderTopLeftRadius: 18, borderTopRightRadius: 18,
          borderWidth: 1, borderColor: '#27272a',
          paddingHorizontal: 16, paddingVertical: 12,
          flexDirection: 'row', alignItems: 'center', gap: 10,
        }}
      >
        <Text style={{ fontSize: 18 }}>🎧</Text>
        <Text style={{ flex: 1, fontSize: 12, color: '#a1a1aa', lineHeight: 16 }}>
          La sala de audio funciona en la versión web/escritorio. En el celular, abrí el juego
          desde el navegador para hablar.
        </Text>
      </View>
    </View>
  );
}
