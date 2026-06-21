import { Text } from '@impostor/ui';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast, type ToastVariant } from '@/lib/useToast';

const STYLES: Record<ToastVariant, { border: string; text: string; icon: string }> = {
  error: { border: '#ef4444', text: '#fca5a5', icon: '⚠️' },
  info: { border: '#f59e0b', text: '#fde68a', icon: 'ℹ️' },
  success: { border: '#10b981', text: '#6ee7b7', icon: '✓' },
};

/** Toast global: aviso transitorio arriba de todo. Montado en el layout raíz. */
export function Toast() {
  const message = useToast((s) => s.message);
  const variant = useToast((s) => s.variant);
  const seq = useToast((s) => s.seq);
  const clear = useToast((s) => s.clear);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(clear, 4000);
    return () => clearTimeout(t);
  }, [seq, message, clear]);

  if (!message) return null;
  const s = STYLES[variant];

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, alignItems: 'center', zIndex: 1000 }}
    >
      <Animated.View
        key={seq}
        entering={FadeInUp.springify().damping(18)}
        exiting={FadeOutUp.duration(150)}
        style={{ width: '92%', maxWidth: 430 }}
      >
        <Pressable
          onPress={clear}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            borderRadius: 14, borderWidth: 1.5, borderColor: s.border,
            backgroundColor: '#0c0c0d',
            paddingHorizontal: 14, paddingVertical: 11,
            shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
            elevation: 12,
          }}
        >
          <Text style={{ fontSize: 16 }}>{s.icon}</Text>
          <Text style={{ flex: 1, color: s.text, fontSize: 13, lineHeight: 18 }}>{message}</Text>
          <Text style={{ color: '#52525b', fontSize: 18 }}>×</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
