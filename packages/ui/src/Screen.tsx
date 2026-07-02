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
  const inner = scroll ? (
    <ScrollView
      style={{ flex: 1, paddingHorizontal: noPadding ? 0 : 16 }}
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      // En web mostramos la barra para que se pueda scrollear con el mouse.
      showsVerticalScrollIndicator={Platform.OS === 'web'}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, paddingHorizontal: noPadding ? 0 : 16 }} className={className || undefined}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b0f0e' }} edges={['top', 'bottom']}>
      {/* On web: center and cap width so it looks like a phone app, not a stretched website. */}
      <View
        style={{
          flex: 1,
          width: '100%',
          backgroundColor: '#0b0f0e',
          ...(Platform.OS === 'web' ? { alignSelf: 'center', maxWidth: WEB_MAX_WIDTH } : null),
        }}
      >
        {inner}
      </View>
    </SafeAreaView>
  );
}
