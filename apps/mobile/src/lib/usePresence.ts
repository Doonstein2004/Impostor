import { api } from '@impostor/backend/api';
import type { Id } from '@impostor/backend/dataModel';
import { useMutation } from 'convex/react';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

const HEARTBEAT_MS = 30_000;

/**
 * Mantiene el campo `connected` y `lastActiveAt` del jugador sincronizados
 * con el estado real de la pestaña/app. Funciona en web (Page Visibility API)
 * y en React Native (AppState).
 */
export function usePresence(roomId: Id<'rooms'> | null | undefined, clientId: string) {
  const updatePresence = useMutation(api.rooms.updatePresence);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  useEffect(() => {
    if (!roomId) return;

    updatePresence({ roomId, clientId, connected: true });

    if (Platform.OS === 'web') {
      function onVisibility() {
        const rid = roomIdRef.current;
        if (!rid) return;
        updatePresence({ roomId: rid, clientId, connected: document.visibilityState === 'visible' });
      }
      document.addEventListener('visibilitychange', onVisibility);

      const beat = setInterval(() => {
        const rid = roomIdRef.current;
        if (rid && document.visibilityState === 'visible') {
          updatePresence({ roomId: rid, clientId, connected: true });
        }
      }, HEARTBEAT_MS);

      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        clearInterval(beat);
        const rid = roomIdRef.current;
        if (rid) updatePresence({ roomId: rid, clientId, connected: false });
      };
    } else {
      const sub = AppState.addEventListener('change', (state) => {
        const rid = roomIdRef.current;
        if (!rid) return;
        updatePresence({ roomId: rid, clientId, connected: state === 'active' });
      });

      const beat = setInterval(() => {
        const rid = roomIdRef.current;
        if (rid && AppState.currentState === 'active') {
          updatePresence({ roomId: rid, clientId, connected: true });
        }
      }, HEARTBEAT_MS);

      return () => {
        sub.remove();
        clearInterval(beat);
        const rid = roomIdRef.current;
        if (rid) updatePresence({ roomId: rid, clientId, connected: false });
      };
    }
  }, [roomId, clientId]);
}
