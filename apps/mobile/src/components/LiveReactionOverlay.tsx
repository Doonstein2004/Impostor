import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@impostor/backend/api';
import type { Id } from '@impostor/backend/dataModel';

export const EMOJI_OPTIONS = ['🔥', '😲', '👏', '💯', '🤔', '😂', '😍', '🤯'] as const;

type LiveReaction = {
  _id: string;
  clientId: string;
  playerName: string;
  emoji: string;
  sentAt: number;
};

type FloatingItem = LiveReaction & { x: number; key: string };

// ─── Emoji flotante individual ────────────────────────────────────────────────

function FloatingEmoji({ item, onDone }: { item: FloatingItem; onDone: (key: string) => void }) {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2)) });
    translateY.value = withTiming(-170, { duration: 3200, easing: Easing.out(Easing.ease) });
    opacity.value = withDelay(
      1800,
      withTiming(0, { duration: 1400 }, () => {
        runOnJS(onDone)(item.key);
      }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.floatingItem, { left: item.x }, style]}>
      <Text style={styles.floatingEmoji}>{item.emoji}</Text>
      <Text style={styles.floatingName} numberOfLines={1}>{item.playerName}</Text>
    </Animated.View>
  );
}

// ─── Overlay + barra de envío ─────────────────────────────────────────────────

type Props = {
  roomId: Id<'rooms'>;
  clientId: string;
  playerName: string;
  /** Offset desde el fondo para que la barra quede encima del chat dock. */
  bottomOffset?: number;
};

export function LiveReactionOverlay({ roomId, clientId, playerName, bottomOffset = 0 }: Props) {
  const sendReaction = useMutation(api.liveReactions.send);
  const reactions = useQuery(api.liveReactions.list, { roomId });

  const [floatingItems, setFloatingItems] = useState<FloatingItem[]>([]);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!reactions) return;
    for (const r of reactions) {
      if (!seenIds.current.has(r._id)) {
        seenIds.current.add(r._id);
        const x = 24 + Math.random() * 200;
        setFloatingItems(prev => [
          ...prev,
          { ...r, x, key: `${r._id}_${Date.now()}` },
        ]);
      }
    }
  }, [reactions]);

  const removeItem = (key: string) => {
    setFloatingItems(prev => prev.filter(i => i.key !== key));
  };

  const handleSend = (emoji: string) => {
    sendReaction({ roomId, clientId, playerName, emoji }).catch(() => {});
  };

  return (
    // El View padre ocupa toda la pantalla como overlay; box-none pasa taps al contenido de abajo
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Emojis flotantes — sin capturar taps */}
      <View style={styles.floatingContainer} pointerEvents="none">
        {floatingItems.map(item => (
          <FloatingEmoji key={item.key} item={item} onDone={removeItem} />
        ))}
      </View>

      {/* Barra de emojis — fija en la parte inferior */}
      <View style={[styles.buttonRow, { bottom: bottomOffset }]}>
        {EMOJI_OPTIONS.map(emoji => (
          <Pressable
            key={emoji}
            onPress={() => handleSend(emoji)}
            style={({ pressed }) => [
              styles.emojiBtn,
              pressed && styles.emojiBtnPressed,
            ]}
          >
            <Text style={styles.emojiBtnText}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  floatingItem: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
    maxWidth: 64,
  },
  floatingEmoji: {
    fontSize: 34,
  },
  floatingName: {
    fontSize: 9,
    color: '#a3a3a3',
    marginTop: 1,
  },
  buttonRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    gap: 3,
    backgroundColor: 'rgba(18,18,20,0.88)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(63,63,70,0.6)',
  },
  emojiBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(63,63,70,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiBtnPressed: {
    backgroundColor: 'rgba(234,179,8,0.28)',
    transform: [{ scale: 0.86 }],
  },
  emojiBtnText: {
    fontSize: 17,
  },
});
