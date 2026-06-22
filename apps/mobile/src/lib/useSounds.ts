import { Platform } from 'react-native';

type SoundType = 'myTurn' | 'tick' | 'tickUrgent' | 'vote' | 'reveal' | 'impostorWins' | 'innocentsWin';

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    return Ctx ? new Ctx() : null;
  } catch {
    return null;
  }
}

let _ctx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (!_ctx || _ctx.state === 'closed') _ctx = getAudioContext();
  return _ctx;
}

function resumeCtx(ac: AudioContext) {
  if (ac.state === 'suspended') ac.resume();
}

function tone(
  ac: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
) {
  const osc = ac.createOscillator();
  const gainNode = ac.createGain();
  osc.connect(gainNode);
  gainNode.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

const sounds: Record<SoundType, (ac: AudioContext) => void> = {
  myTurn(ac) {
    // Dos notas ascendentes: "¡es tu turno!"
    const t = ac.currentTime;
    tone(ac, 440, t, 0.15, 0.3);
    tone(ac, 660, t + 0.15, 0.25, 0.3);
  },

  tick(ac) {
    // Click suave de reloj
    const t = ac.currentTime;
    tone(ac, 800, t, 0.06, 0.15, 'square');
  },

  tickUrgent(ac) {
    // Click más agudo para los últimos 5 segundos
    const t = ac.currentTime;
    tone(ac, 1200, t, 0.08, 0.25, 'square');
  },

  vote(ac) {
    // Confirmación de voto: un tono corto descendente
    const t = ac.currentTime;
    tone(ac, 520, t, 0.12, 0.2);
    tone(ac, 380, t + 0.1, 0.15, 0.15);
  },

  reveal(ac) {
    // Fanfare dramático: 4 notas
    const t = ac.currentTime;
    tone(ac, 330, t, 0.1, 0.3);
    tone(ac, 415, t + 0.1, 0.1, 0.3);
    tone(ac, 494, t + 0.2, 0.1, 0.3);
    tone(ac, 659, t + 0.3, 0.4, 0.4);
  },

  impostorWins(ac) {
    // Descenso siniestro
    const t = ac.currentTime;
    tone(ac, 440, t, 0.15, 0.3, 'sawtooth');
    tone(ac, 370, t + 0.15, 0.15, 0.3, 'sawtooth');
    tone(ac, 277, t + 0.3, 0.4, 0.3, 'sawtooth');
  },

  innocentsWin(ac) {
    // Fanfare de victoria
    const t = ac.currentTime;
    tone(ac, 523, t, 0.1, 0.3);
    tone(ac, 659, t + 0.1, 0.1, 0.3);
    tone(ac, 784, t + 0.2, 0.1, 0.3);
    tone(ac, 1047, t + 0.3, 0.5, 0.4);
  },
};

export function useSounds() {
  function play(sound: SoundType) {
    const ac = ctx();
    if (!ac) return;
    resumeCtx(ac);
    sounds[sound](ac);
  }

  return { play };
}
