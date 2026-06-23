import { Text } from '@impostor/ui';
import { Pressable, View } from 'react-native';
import { AVATAR_COLORS } from '@/lib/avatars';

/** Fila de swatches para elegir el color del avatar. */
export function ColorPicker({
  value,
  onChange,
  label = 'Tu color',
}: {
  value: string;
  onChange: (key: string) => void;
  label?: string;
}) {
  return (
    <View className="gap-2">
      {label ? <Text variant="label" className="text-zinc-500 text-xs">{label}</Text> : null}
      <View className="flex-row flex-wrap gap-1.5">
        {AVATAR_COLORS.map((c) => {
          const active = value === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => onChange(c.key)}
              accessibilityLabel={c.label}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: c.hex,
                borderWidth: active ? 2.5 : 0,
                borderColor: '#ffffff',
              }}
              className="active:opacity-70 items-center justify-center"
            >
              {active ? <Text className="text-white" style={{ fontSize: 11 }}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
