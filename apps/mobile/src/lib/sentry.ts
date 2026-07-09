import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Reporte de errores en producción. Sin esto, si la app se rompe para un
 * usuario real no hay forma de enterarse salvo que escriba (ver tanda 31).
 * Sin DSN configurado, no inicializa nada (no rompe local dev sin .env).
 */
export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    // Separa por ambiente igual que Convex: los errores de desarrollo no
    // ensucian el panel que se mira para la app real.
    environment: __DEV__ ? 'development' : 'production',
    enableAutoSessionTracking: true,
    tracesSampleRate: 0, // sin performance tracing por ahora, solo error monitoring
  });
}

export { Sentry };
