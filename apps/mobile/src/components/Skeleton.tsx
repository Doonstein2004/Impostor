import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Bloque con pulso de opacidad. Usar como placeholder mientras carga contenido. */
export function Skeleton({
  width,
  height = 16,
  rounded = false,
  className,
}: {
  width?: number | `${number}%`;
  height?: number;
  rounded?: boolean;
  className?: string;
}) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.8, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        aStyle,
        {
          height,
          width: width ?? '100%',
          backgroundColor: '#1e2d28',
          borderRadius: rounded ? height / 2 : 10,
        },
      ]}
      // NativeWind className opcional para ajustes adicionales desde el callsite
      className={className}
    />
  );
}

/**
 * Pantalla esqueleto que reemplaza al ActivityIndicator mientras se carga la sala.
 * Simula la estructura del lobby para reducir la sensación de espera.
 */
export function SkeletonRoomLoading() {
  return (
    <View className="flex-1 bg-surface px-4 pt-14">
      {/* Código de sala */}
      <View className="items-center gap-2 mb-8 mt-4">
        <Skeleton width={80} height={11} />
        <Skeleton width={160} height={44} rounded />
        <Skeleton width={120} height={11} />
      </View>

      {/* Lista de jugadores */}
      <View className="gap-3 mb-6">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-row items-center gap-3 px-2">
            <Skeleton width={40} height={40} rounded />
            <View className="flex-1 gap-1.5">
              <Skeleton height={14} width="60%" />
              <Skeleton height={10} width="35%" />
            </View>
            <Skeleton width={28} height={14} />
          </View>
        ))}
      </View>

      {/* Separador + configuración */}
      <View className="h-px bg-surface-border mx-2 mb-6" />
      <View className="gap-2.5 px-2">
        <Skeleton height={13} width="40%" />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </View>

      {/* Botón de inicio */}
      <View className="absolute bottom-10 left-4 right-4">
        <Skeleton height={52} rounded />
      </View>
    </View>
  );
}
