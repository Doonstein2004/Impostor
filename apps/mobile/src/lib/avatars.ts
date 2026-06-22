/**
 * Paleta de colores de avatar. La `key` (ASCII corta) es lo que se guarda en
 * Convex; el `hex` se usa para pintar el círculo del avatar en el cliente.
 */
export interface AvatarColor {
  key: string;
  hex: string;
  /** Etiqueta accesible para el selector. */
  label: string;
}

export const AVATAR_COLORS: AvatarColor[] = [
  { key: 'rojo', hex: '#ef4444', label: 'Rojo' },
  { key: 'naranja', hex: '#f97316', label: 'Naranja' },
  { key: 'ambar', hex: '#f59e0b', label: 'Ámbar' },
  { key: 'lima', hex: '#84cc16', label: 'Lima' },
  { key: 'verde', hex: '#22c55e', label: 'Verde' },
  { key: 'esmeralda', hex: '#10b981', label: 'Esmeralda' },
  { key: 'cyan', hex: '#06b6d4', label: 'Cyan' },
  { key: 'azul', hex: '#3b82f6', label: 'Azul' },
  { key: 'indigo', hex: '#6366f1', label: 'Índigo' },
  { key: 'violeta', hex: '#8b5cf6', label: 'Violeta' },
  { key: 'rosa', hex: '#ec4899', label: 'Rosa' },
  { key: 'fucsia', hex: '#d946ef', label: 'Fucsia' },
];

const BY_KEY = new Map(AVATAR_COLORS.map((c) => [c.key, c]));

/** Hash estable y simple de un string a un entero no negativo. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Devuelve el hex del color del avatar. Si el jugador no eligió color (`key`
 * nulo/desconocido), asigna uno determinístico a partir del `seed` (clientId)
 * para que igual tenga identidad visual estable.
 */
export function avatarHex(key: string | null | undefined, seed: string): string {
  if (key && BY_KEY.has(key)) return BY_KEY.get(key)!.hex;
  return AVATAR_COLORS[hashString(seed) % AVATAR_COLORS.length]!.hex;
}

/** Color por defecto (determinístico) para un clientId, como `key`. */
export function defaultColorKey(seed: string): string {
  return AVATAR_COLORS[hashString(seed) % AVATAR_COLORS.length]!.key;
}
