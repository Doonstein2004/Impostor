import { useEffect, useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { Text } from '@impostor/ui';

interface CharacterImageProps {
  name: string;
  /** URL directa a una imagen con licencia libre (Wikimedia Commons, etc.). */
  imageUrl?: string;
  /** Nombre completo del personaje — se usa para buscar la foto en Wikipedia si no hay imageUrl. */
  fullName?: string;
  size?: number;
}

/** Cache en memoria para no repetir fetches de Wikipedia en la misma sesión. */
const wikiCache = new Map<string, string | null>();

/**
 * Componente para renderizar la imagen de un personaje.
 *
 * Estrategia de carga:
 * 1. Si tiene `imageUrl` hardcodeada, la usa directamente.
 * 2. Si no, intenta obtener la thumbnail desde la API REST de Wikipedia
 *    usando `fullName` (las imágenes de Wikipedia son de dominio público o CC BY-SA).
 * 3. Si todo falla, muestra un fallback elegante con las iniciales.
 */
export function CharacterImage({
  name,
  imageUrl,
  fullName,
  size = 56,
}: CharacterImageProps) {
  const [imgError, setImgError] = useState(false);
  const [wikiUrl, setWikiUrl] = useState<string | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);

  // Buscar imagen de Wikipedia si no hay imageUrl directa
  useEffect(() => {
    if (imageUrl || !fullName) return;

    // Revisar cache primero
    const cached = wikiCache.get(fullName);
    if (cached !== undefined) {
      setWikiUrl(cached);
      return;
    }

    let cancelled = false;
    setWikiLoading(true);

    const title = fullName.replace(/ /g, '_');
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const url = data?.thumbnail?.source ?? null;
        wikiCache.set(fullName, url);
        setWikiUrl(url);
      })
      .catch(() => {
        if (cancelled) return;
        wikiCache.set(fullName, null);
        setWikiUrl(null);
      })
      .finally(() => {
        if (!cancelled) setWikiLoading(false);
      });

    return () => { cancelled = true; };
  }, [imageUrl, fullName]);

  const resolvedUrl = imageUrl || wikiUrl;
  const initial = (name?.trim().charAt(0) || '?').toUpperCase();

  // Fallback: iniciales sobre fondo estilizado
  if (!resolvedUrl || imgError) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Text
          className="font-display text-emerald-300"
          style={{ fontSize: Math.round(size * 0.42) }}
        >
          {initial}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(245,158,11,0.3)',
      }}
    >
      <Image
        source={{ uri: resolvedUrl }}
        style={{ width: size, height: size }}
        resizeMode="cover"
        onError={() => setImgError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#064e3b',
    borderWidth: 1.5,
    borderColor: '#10b98140',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
