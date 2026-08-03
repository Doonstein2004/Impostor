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
 * 2. Si no, busca la thumbnail vía la API de búsqueda de Wikipedia en español
 *    (`action=query&generator=search`), usando el nombre común (`name`) —
 *    no `fullName`: el título del artículo casi nunca es el nombre completo
 *    (ej. Garrincha = "Manuel Francisco dos Santos"), y la búsqueda por texto
 *    tolera apodos/acentos donde una búsqueda de título exacto fallaría.
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
    if (imageUrl || !name) return;

    const cacheKey = fullName ? `${name}|${fullName}` : name;
    const cached = wikiCache.get(cacheKey);
    if (cached !== undefined) {
      setWikiUrl(cached);
      return;
    }

    let cancelled = false;
    setWikiLoading(true);

    const searchTerm = `${name} futbolista`;
    const url =
      `https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=search&gsrsearch=${encodeURIComponent(searchTerm)}&gsrlimit=1` +
      `&prop=pageimages&piprop=thumbnail&pithumbsize=300`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const pages = data?.query?.pages;
        const firstPage = pages ? Object.values(pages)[0] : null;
        const thumb =
          (firstPage as { thumbnail?: { source?: string } } | null)?.thumbnail
            ?.source ?? null;
        wikiCache.set(cacheKey, thumb);
        setWikiUrl(thumb);
      })
      .catch(() => {
        if (cancelled) return;
        wikiCache.set(cacheKey, null);
        setWikiUrl(null);
      })
      .finally(() => {
        if (!cancelled) setWikiLoading(false);
      });

    return () => { cancelled = true; };
  }, [imageUrl, name, fullName]);

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
