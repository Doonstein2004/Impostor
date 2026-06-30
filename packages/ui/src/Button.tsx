import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, { container: string; label: string }> = {
  primary: { container: 'bg-pitch-500 active:bg-pitch-600', label: 'text-surface' },
  secondary: { container: 'bg-surface-card border border-surface-border active:bg-surface-soft', label: 'text-white' },
  danger: { container: 'bg-impostor-500 active:bg-impostor-600', label: 'text-white' },
  ghost: { container: 'bg-transparent active:bg-surface-soft', label: 'text-zinc-300' },
};

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  className?: string;
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const v = variants[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      className={twMerge(
        'h-12 flex-row items-center justify-center rounded-2xl px-5',
        v.container,
        isDisabled ? 'opacity-50' : '',
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View className="flex-row items-center gap-2">
          <Text className={twMerge('text-base font-display', v.label)}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}
