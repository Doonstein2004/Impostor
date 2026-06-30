import { Pressable, View } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { Text } from './Text';

export interface BadgeProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  className?: string;
}

export function Badge({ label, active = false, onPress, className = '' }: BadgeProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      className={twMerge(
        'rounded-full border px-3 py-1.5',
        active ? 'border-pitch-500 bg-pitch-500/20' : 'border-surface-border bg-surface-soft',
        className,
      )}
    >
      <Text className={twMerge('text-sm font-body', active ? 'text-pitch-400' : 'text-zinc-400')}>
        {label}
      </Text>
    </Wrapper>
  );
}
