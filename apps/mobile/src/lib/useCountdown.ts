import { api } from '@impostor/backend/api';
import { useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';

interface CountdownResult {
  /** Segundos enteros restantes. */
  timeLeft: number;
  /** 1 → lleno, 0 → vacío. */
  progress: number;
  /** Shared value animada para la barra visual (va de 1 a 0 suavemente). */
  animatedProgress: ReturnType<typeof useSharedValue<number>>;
  expired: boolean;
}

/**
 * Contador regresivo basado en el timestamp del servidor.
 * - `startTimestamp`: el `turnStartedAt` que viene de Convex (ms UTC).
 * - `totalSeconds`: duración del turno; 0 = sin límite.
 * - `active`: false detiene el contador.
 */
export function useCountdown(
  totalSeconds: number,
  startTimestamp: number,
  active: boolean,
): CountdownResult {
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const animatedProgress = useSharedValue(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Desfase reloj-cliente vs reloj-servidor (ms). Se mide una sola vez con la
  // hora del servidor para que el contador no vaya adelantado entre dispositivos.
  const serverNow = useQuery(api.time.now, {});
  const [offset, setOffset] = useState(0);
  const offsetSet = useRef(false);
  useEffect(() => {
    if (serverNow !== undefined && !offsetSet.current) {
      offsetSet.current = true;
      setOffset(serverNow - Date.now());
    }
  }, [serverNow]);

  useEffect(() => {
    if (!active || totalSeconds <= 0) {
      setTimeLeft(totalSeconds);
      animatedProgress.value = 1;
      return;
    }

    // Hora "del servidor" estimada en el cliente = reloj local + desfase.
    const serverTime = () => Date.now() + offset;

    const tick = () => {
      const elapsed = (serverTime() - startTimestamp) / 1000;
      const left = Math.max(0, totalSeconds - elapsed);
      setTimeLeft(Math.ceil(left));
      if (left <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };

    // Calcula cuánto queda en este instante y arranca la animación de la barra
    const elapsed0 = (serverTime() - startTimestamp) / 1000;
    const left0 = Math.max(0, totalSeconds - elapsed0);
    animatedProgress.value = left0 / totalSeconds;
    animatedProgress.value = withTiming(0, { duration: left0 * 1000 });

    tick();
    intervalRef.current = setInterval(tick, 300);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [startTimestamp, totalSeconds, active, offset]);

  const progress = totalSeconds > 0 ? Math.max(0, timeLeft / totalSeconds) : 1;
  return { timeLeft, progress, animatedProgress, expired: totalSeconds > 0 && timeLeft <= 0 };
}
