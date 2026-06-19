import { ConvexReactClient } from 'convex/react';

const url = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!url) {
  console.warn(
    '[Impostor] Falta EXPO_PUBLIC_CONVEX_URL. Corré `pnpm convex:dev` y copiá la URL al .env',
  );
}

export const convex = new ConvexReactClient(url ?? 'https://placeholder.convex.cloud', {
  unsavedChangesWarning: false,
});
