import { Text } from '@impostor/ui';
import { useState } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { useSession } from '@/lib/session';

const SLIDES = [
  {
    emoji: '🎭',
    title: 'El Impostor',
    body: 'Todos reciben el nombre de un futbolista famoso. Pero uno (o más) son impostores y ven un jugador diferente o una pista vaga.',
  },
  {
    emoji: '💬',
    title: 'Las pistas',
    body: 'Por turnos, cada jugador da una pista sobre su personaje. Sin decir el nombre. El impostor tiene que fingir que sabe de quién se trata.',
  },
  {
    emoji: '🕵️',
    title: 'Detectar al impostor',
    body: 'Después de las pistas, todos votan quién creen que es el impostor. Si adivinan bien, ¡los inocentes ganan!',
  },
  {
    emoji: '🎯',
    title: 'La última oportunidad',
    body: 'Si detectan al impostor, él tiene una última chance: adivinar el nombre del personaje secreto. Si acierta, los puntos son suyos.',
  },
  {
    emoji: '🏆',
    title: 'Los puntos',
    body: 'Inocentes: 1 punto por detectar al impostor.\nImpostores: 2 puntos por pasar desapercibidos o adivinar el personaje.',
  },
];

export function TutorialModal() {
  const { tutorialSeen, setTutorialSeen } = useSession(
    useShallow((s) => ({ tutorialSeen: s.tutorialSeen, setTutorialSeen: s.setTutorialSeen })),
  );
  const [visible, setVisible] = useState(!tutorialSeen);
  const [slide, setSlide] = useState(0);
  const [key, setKey] = useState(0);
  const { width } = useWindowDimensions();

  function next() {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1);
      setKey((k) => k + 1);
    } else {
      setTutorialSeen();
      setVisible(false);
    }
  }

  function skip() {
    setTutorialSeen();
    setVisible(false);
  }

  const current = SLIDES[slide]!;
  const isLast = slide === SLIDES.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 bg-black/70 items-center justify-center px-5">
        <Animated.View
          entering={FadeIn.duration(300)}
          className="w-full rounded-2xl border border-surface-border bg-surface-card overflow-hidden"
          style={{ maxWidth: Math.min(width - 40, 400) }}
        >
          {/* Header con dots */}
          <View className="flex-row justify-center gap-1.5 pt-5 pb-3">
            {SLIDES.map((_, i) => (
              <View
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === slide ? 'w-5 bg-pitch-400' : 'w-1.5 bg-surface-soft'
                }`}
              />
            ))}
          </View>

          {/* Contenido del slide */}
          <Animated.View key={key} entering={FadeInRight.duration(250)} className="px-6 pb-2 items-center gap-3">
            <Text className="text-6xl">{current.emoji}</Text>
            <Text variant="title" className="text-2xl text-center">{current.title}</Text>
            <Text variant="body" className="text-center text-zinc-300 leading-relaxed">
              {current.body}
            </Text>
          </Animated.View>

          {/* Acciones */}
          <View className="flex-row items-center justify-between px-5 py-5 mt-2 border-t border-surface-border">
            <Pressable onPress={skip} className="py-2 px-3">
              <Text variant="muted" className="text-sm">Saltar</Text>
            </Pressable>
            <Pressable
              onPress={next}
              className="bg-pitch-500 px-6 py-2.5 rounded-xl"
            >
              <Text variant="label" className="text-white font-display text-sm">
                {isLast ? 'Entendido' : 'Siguiente'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Botón para relanzar el tutorial manualmente (desde ajustes o lobby). */
export function TutorialButton() {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);
  const [key, setKey] = useState(0);
  const { width } = useWindowDimensions();

  function next() {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1);
      setKey((k) => k + 1);
    } else {
      setVisible(false);
      setSlide(0);
    }
  }

  const current = SLIDES[slide]!;
  const isLast = slide === SLIDES.length - 1;

  return (
    <>
      <Pressable
        onPress={() => { setSlide(0); setKey((k) => k + 1); setVisible(true); }}
        className="px-3 py-1.5 rounded-lg border border-surface-border"
      >
        <Text variant="label" className="text-zinc-400 text-xs">? Cómo jugar</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
        <View className="flex-1 bg-black/70 items-center justify-center px-5">
          <Animated.View
            entering={FadeIn.duration(300)}
            className="w-full rounded-2xl border border-surface-border bg-surface-card overflow-hidden"
            style={{ maxWidth: Math.min(width - 40, 400) }}
          >
            <View className="flex-row justify-center gap-1.5 pt-5 pb-3">
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  className={`h-1.5 rounded-full ${i === slide ? 'w-5 bg-pitch-400' : 'w-1.5 bg-surface-soft'}`}
                />
              ))}
            </View>

            <Animated.View key={key} entering={FadeInRight.duration(250)} className="px-6 pb-2 items-center gap-3">
              <Text className="text-6xl">{current.emoji}</Text>
              <Text variant="title" className="text-2xl text-center">{current.title}</Text>
              <Text variant="body" className="text-center text-zinc-300 leading-relaxed">
                {current.body}
              </Text>
            </Animated.View>

            <View className="flex-row items-center justify-between px-5 py-5 mt-2 border-t border-surface-border">
              <Pressable onPress={() => { setVisible(false); setSlide(0); }} className="py-2 px-3">
                <Text variant="muted" className="text-sm">Cerrar</Text>
              </Pressable>
              <Pressable onPress={next} className="bg-pitch-500 px-6 py-2.5 rounded-xl">
                <Text variant="label" className="text-white font-display text-sm">
                  {isLast ? 'Cerrar' : 'Siguiente'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
