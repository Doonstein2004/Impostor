import { Platform } from 'react-native';

// Haptics solo existe en native. En web no hace nada.
let haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  // Importación dinámica para que el bundle web no cargue el módulo nativo.
  import('expo-haptics').then((m) => { haptics = m; });
}

export const Haptics = {
  /** Toque ligero — confirmación de acción (votar, enviar pista). */
  light() {
    haptics?.impactAsync(haptics.ImpactFeedbackStyle.Light);
  },
  /** Toque medio — turno del jugador, acción importante. */
  medium() {
    haptics?.impactAsync(haptics.ImpactFeedbackStyle.Medium);
  },
  /** Toque fuerte — reveal, victoria/derrota. */
  heavy() {
    haptics?.impactAsync(haptics.ImpactFeedbackStyle.Heavy);
  },
  /** Notificación de éxito. */
  success() {
    haptics?.notificationAsync(haptics.NotificationFeedbackType.Success);
  },
  /** Notificación de error. */
  error() {
    haptics?.notificationAsync(haptics.NotificationFeedbackType.Error);
  },
  /** Notificación de advertencia. */
  warning() {
    haptics?.notificationAsync(haptics.NotificationFeedbackType.Warning);
  },
};
