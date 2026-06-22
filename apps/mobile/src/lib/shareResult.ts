import { Platform, Share } from 'react-native';

export interface ResultCardData {
  /** Texto del titular, ej. "¡INOCENTES GANAN!". */
  title: string;
  /** Nombre del personaje secreto. */
  secretName: string;
  /** Subtítulo del personaje (club / nombre completo). */
  secretSub?: string;
  /** Nombres de los impostores. */
  impostors: string[];
  /** Emoji grande del resultado. */
  emoji: string;
  /** Código de sala, para invitar. */
  code: string;
  /** URL de invitación (si existe). */
  url?: string | null;
}

/** Mensaje de texto de respaldo (native o si falla la imagen). */
function buildMessage(d: ResultCardData): string {
  const imp = d.impostors.length > 1 ? `Impostores: ${d.impostors.join(', ')}` : `Impostor: ${d.impostors[0] ?? '—'}`;
  const lines = [
    `${d.emoji} ${d.title}`,
    `Jugador secreto: ${d.secretName}`,
    imp,
    d.url ? `¿Jugamos? ${d.url}` : `Sala: ${d.code}`,
  ];
  return lines.join('\n');
}

/**
 * Dibuja la tarjeta de resultado en un canvas (sólo web) y devuelve un Blob PNG.
 * Devuelve null si no hay canvas disponible.
 */
async function drawCard(d: ResultCardData): Promise<Blob | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fondo
  ctx.fillStyle = '#0b0f0e';
  ctx.fillRect(0, 0, W, H);

  // Marco
  ctx.strokeStyle = 'rgba(16,185,129,0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  const cx = W / 2;
  ctx.textAlign = 'center';

  // Emoji
  ctx.font = '160px sans-serif';
  ctx.fillText(d.emoji, cx, 280);

  // Título
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(d.title, cx, 400);

  // Jugador secreto
  ctx.fillStyle = '#71717a';
  ctx.font = '34px sans-serif';
  ctx.fillText('EL JUGADOR SECRETO ERA', cx, 520);
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText(d.secretName, cx, 610);
  if (d.secretSub) {
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '34px sans-serif';
    ctx.fillText(d.secretSub, cx, 665);
  }

  // Impostores
  ctx.fillStyle = '#71717a';
  ctx.font = '34px sans-serif';
  ctx.fillText(d.impostors.length > 1 ? 'LOS IMPOSTORES ERAN' : 'EL IMPOSTOR ERA', cx, 790);
  ctx.fillStyle = '#f43f5e';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(d.impostors.join(', ') || '—', cx, 860);

  // Footer marca + código
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('⚽ IMPOSTOR FÚTBOL', cx, 980);
  ctx.fillStyle = '#71717a';
  ctx.font = '32px sans-serif';
  ctx.fillText(`Sala ${d.code}`, cx, 1025);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/**
 * Comparte la tarjeta de resultado. En web intenta compartir/descargar una
 * imagen PNG; en native comparte un mensaje de texto.
 */
export async function shareResultCard(d: ResultCardData): Promise<void> {
  const message = buildMessage(d);

  if (Platform.OS !== 'web') {
    try {
      await Share.share({ message });
    } catch {
      /* cancelado */
    }
    return;
  }

  try {
    const blob = await drawCard(d);
    const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;

    if (blob && nav?.canShare) {
      const file = new File([blob], 'resultado-impostor.png', { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: message, title: 'Impostor Fútbol' });
        return;
      }
    }

    // Fallback: descargar la imagen
    if (blob && typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'resultado-impostor.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      return;
    }

    // Último recurso: Web Share de texto o portapapeles
    if (nav?.share) {
      await nav.share({ text: message, title: 'Impostor Fútbol' });
    } else if (nav?.clipboard) {
      await nav.clipboard.writeText(message);
    }
  } catch {
    /* cancelado por el usuario */
  }
}
