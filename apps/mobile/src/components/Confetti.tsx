import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316'];
const COUNT = 26;

interface ParticleData {
  id: number;
  startX: number;
  endX: number;
  endY: number;
  color: string;
  delay: number;
  size: number;
  isCircle: boolean;
}

function Particle({ startX, endX, endY, color, delay, size, isCircle }: ParticleData) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rot = useSharedValue(0);

  useEffect(() => {
    tx.value = withDelay(delay, withTiming(endX, { duration: 1400, easing: Easing.out(Easing.quad) }));
    ty.value = withDelay(delay, withTiming(endY, { duration: 1400, easing: Easing.out(Easing.quad) }));
    rot.value = withDelay(delay, withTiming(720, { duration: 1400 }));
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 80 }),
        withDelay(900, withTiming(0, { duration: 420 })),
      ),
    );
  }, []);

  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        aStyle,
        {
          position: 'absolute',
          left: startX,
          bottom: 50,
          width: size,
          height: isCircle ? size : size * 0.5,
          backgroundColor: color,
          borderRadius: isCircle ? size / 2 : 2,
        },
      ]}
    />
  );
}

/** Confetti que explota hacia arriba cuando inocentes ganan. No bloquea toques. */
export function ConfettiBlast({ active }: { active: boolean }) {
  const [particles] = useState<ParticleData[]>(() => {
    const { width } = Dimensions.get('window');
    return Array.from({ length: COUNT }, (_, i) => ({
      id: i,
      startX: Math.random() * (width - 20) + 10,
      endX: (Math.random() - 0.5) * 220,
      endY: -(Math.random() * 520 + 160),
      color: COLORS[i % COLORS.length]!,
      delay: Math.random() * 500,
      size: Math.random() * 8 + 6,
      isCircle: i % 3 === 0,
    }));
  });

  if (!active) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents="none">
      {particles.map((p) => (
        <Particle key={p.id} {...p} />
      ))}
    </View>
  );
}
