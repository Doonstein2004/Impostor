import type { ReactNode } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
  /** Override the inner padding (e.g. for full-bleed headers). */
  noPadding?: boolean;
}

const WEB_MAX_WIDTH = 430;

export function Screen({ children, scroll = false, className = '', noPadding = false }: ScreenProps) {
  const pad = noPadding ? '' : 'px-4';

  const inner = scroll ? (
    <ScrollView
      className={`flex-1 ${pad}`}
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={`flex-1 ${pad} ${className}`}>{children}</View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      {/* On web: center and cap width so it looks like a phone app, not a stretched website. */}
      <View
        className="flex-1 w-full bg-surface"
        style={
          Platform.OS === 'web'
            ? { alignSelf: 'center', maxWidth: WEB_MAX_WIDTH }
            : undefined
        }
      >
        {inner}
      </View>
    </SafeAreaView>
  );
}
