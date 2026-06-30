import { Text as RNText, type TextProps } from 'react-native';
import { twMerge } from 'tailwind-merge';

type Variant = 'display' | 'title' | 'body' | 'muted' | 'label';

const styles: Record<Variant, string> = {
  display: 'text-3xl font-display text-white',
  title: 'text-xl font-display text-white',
  body: 'text-base font-body text-zinc-200',
  muted: 'text-sm font-body text-zinc-400',
  label: 'text-xs font-body uppercase tracking-wider text-zinc-500',
};

export interface ThemedTextProps extends TextProps {
  variant?: Variant;
  className?: string;
}

export function Text({ variant = 'body', className = '', ...props }: ThemedTextProps) {
  const extraProps: Record<string, any> = {};
  if (variant === 'display') {
    extraProps.role = 'heading';
    extraProps['aria-level'] = 1;
  }
  return (
    <RNText
      className={twMerge(styles[variant], className)}
      {...props}
      {...extraProps}
    />
  );
}

