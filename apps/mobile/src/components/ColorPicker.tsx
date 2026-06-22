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
      <View className="flex-row flex-wrap gap-2">
        {AVATAR_COLORS.map((c) => {
          const active = value === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => onChange(c.key)}
              accessibilityLabel={c.label}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: c.hex,
                borderWidth: active ? 3 : 0,
                borderColor: '#ffffff',
              }}
              className="active:opacity-70 items-center justify-center"
            >
              {active ? <Text className="text-white" style={{ fontSize: 13 }}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
