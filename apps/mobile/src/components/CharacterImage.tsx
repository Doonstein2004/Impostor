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

const WIKI_UA_HEADERS = { 'Api-User-Agent': 'ImpostorFutbolApp/1.0 (https://impostor-black-one.vercel.app)' };

type WikiPage = { title?: string; missing?: unknown; thumbnail?: { source?: string } };

function firstThumb(data: unknown): string | null {
  const pages = (data as { query?: { pages?: Record<string, WikiPage> } })?.query?.pages;
  const page = pages ? Object.values(pages)[0] : null;
  return page && page.missing === undefined ? page.thumbnail?.source ?? null : null;
}

/**
 * Busca la thumbnail de un personaje en Wikipedia en español.
 *
 * Estrategia en dos niveles:
 * 1. Match exacto de título vía `fullName` (con `redirects=1`) — rápido y preciso.
 *    Cubre incluso apodos como Garrincha, porque Wikipedia tiene una página de
 *    redirect desde el nombre de nacimiento ("Manuel Francisco dos Santos")
 *    hacia el artículo real.
 * 2. Si no hay match (nombre completo no coincide con ningún título/redirect),
 *    fallback a búsqueda de texto completo usando `name` — pero SIN el sufijo
 *    parentético que algunos personajes usan para desambiguar en el pool
 *    (ej. "Zidane (DT)", "Trezeguet (Egipto)"): buscar el string literal con
 *    paréntesis rompe la búsqueda y devuelve páginas sin relación.
 */
async function fetchWikiThumb(name: string, fullName?: string): Promise<string | null> {
  if (fullName) {
    const titleUrl =
      `https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&titles=${encodeURIComponent(fullName)}&redirects=1` +
      `&prop=pageimages&piprop=thumbnail&pithumbsize=300`;
    const r = await fetch(titleUrl, { headers: WIKI_UA_HEADERS });
    if (r.ok) {
      const thumb = firstThumb(await r.json());
      if (thumb) return thumb;
    }
  }

  const strippedName = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const searchUrl =
    `https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(`${strippedName} futbolista`)}&gsrlimit=1` +
    `&prop=pageimages&piprop=thumbnail&pithumbsize=300`;
  const r = await fetch(searchUrl, { headers: WIKI_UA_HEADERS });
  if (!r.ok) return null;
  return firstThumb(await r.json());
}

/**
 * Componente para renderizar la imagen de un personaje.
 *
 * Estrategia de carga:
 * 1. Si tiene `imageUrl` hardcodeada, la usa directamente.
 * 2. Si no, busca la thumbnail en Wikipedia (ver `fetchWikiThumb`).
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

    fetchWikiThumb(name, fullName)
      .then((thumb) => {
        if (cancelled) return;
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
