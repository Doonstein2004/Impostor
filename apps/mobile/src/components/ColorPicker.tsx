import { Text } from '@impostor/ui';
import { Pressable, View } from 'react-native';
import { AVATAR_COLORS } from '@/lib/avatars';

/** Fila de swatches para elegir el color del avatar. */
export function ColorPicker({
  value,
  onChange,
  label = 'Tu color',
  compact = false,
}: {
  value: string;
  onChange: (key: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const size = compact ? 20 : 24;
  const radius = size / 2;
  const fontSize = compact ? 9 : 11;

  return (
    <View className="gap-2">
      {label ? <Text variant="label" className="text-zinc-500 text-xs">{label}</Text> : null}
      <View className={`flex-row flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {AVATAR_COLORS.map((c) => {
          const active = value === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => onChange(c.key)}
              accessibilityLabel={c.label}
              style={{
                width: size,
                height: size,
                borderRadius: radius,
                backgroundColor: c.hex,
                borderWidth: active ? 2 : 0,
                borderColor: '#ffffff',
              }}
              className="active:opacity-70 items-center justify-center"
            >
              {active ? <Text className="text-white" style={{ fontSize }}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
