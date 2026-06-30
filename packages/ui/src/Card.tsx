import { View, type ViewProps } from 'react-native';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ className = '', ...props }: CardProps) {
  return (
    <View
      className={twMerge('rounded-3xl border border-surface-border bg-surface-card p-5', className)}
      {...props}
    />
  );
}
