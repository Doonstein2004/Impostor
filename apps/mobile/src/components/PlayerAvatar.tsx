import { Text } from '@impostor/ui';
import { View } from 'react-native';
import { avatarHex } from '@/lib/avatars';

/**
 * Círculo de avatar con la inicial del jugador, pintado con su color elegido.
 * Si no eligió color, usa uno determinístico a partir del `seed` (clientId).
 */
export function PlayerAvatar({
  name,
  color,
  seed,
  size = 36,
  selected = false,
}: {
  name: string;
  color: string | null | undefined;
  /** Semilla para el color por defecto (normalmente el clientId). */
  seed: string;
  size?: number;
  /** Resalta con un anillo (ej. el jugador votado). */
  selected?: boolean;
}) {
  const hex = avatarHex(color, seed);
  const initial = (name?.trim().charAt(0) || '?').toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: hex,
        borderWidth: selected ? 2 : 0,
        borderColor: '#ffffff',
      }}
      className="items-center justify-center"
    >
      <Text
        className="font-display text-white"
        style={{ fontSize: Math.round(size * 0.44) }}
      >
        {initial}
      </Text>
    </View>
  );
}
