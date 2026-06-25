import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import schema from './schema';
import { api } from './_generated/api';

/// <reference types="vite/client" />
// Fuente de funciones para convex-test (todas las funciones del directorio).
const modules = import.meta.glob('./**/*.ts');

// ─── helpers ────────────────────────────────────────────────────────────────

async function createRoom(
  t: ReturnType<typeof convexTest>,
  opts: { password?: string; maxPlayers?: number } = {},
) {
  const config = opts.maxPlayers !== undefined
    ? { ...defaultConfig, maxPlayers: opts.maxPlayers }
    : defaultConfig;

  const { code } = await t.mutation(api.rooms.create, {
    clientId: 'host-1',
    name: 'Host',
    ...(opts.password ? { password: opts.password } : {}),
  });

  // Si hay maxPlayers, actualizar la config de la sala.
  if (opts.maxPlayers !== undefined) {
    const room = await t.query(api.rooms.get, { code });
    if (room) {
      await t.mutation(api.rooms.updateConfig, {
        roomId: room._id,
        clientId: 'host-1',
        config: { ...defaultConfig, maxPlayers: opts.maxPlayers },
      });
    }
  }

  return code;
}

const defaultConfig = {
  zones: [] as ('portero' | 'defensor' | 'medio' | 'atacante')[],
  eras: [] as ('antiguo' | 'leyenda' | 'moderno' | 'experimentado' | 'actual' | 'joven_promesa')[],
  roles: ['jugador', 'dt'] as ('jugador' | 'dt')[],
  clubs: [] as string[],
  impostorCount: 1,
  impostorHint: 'nada' as const,
  turnSeconds: 30,
  maxRounds: 3,
  maxClueRounds: 3,
  voteSeconds: 60,
  commMode: 'texto' as const,
  penaltyWrongVote: false,
  maxPlayers: 10,
};

// ─── rooms.create ────────────────────────────────────────────────────────────

describe('rooms.create', () => {
  it('crea una sala y devuelve código de 6 chars', async () => {
    const t = convexTest(schema, modules);
    const result = await t.mutation(api.rooms.create, {
      clientId: 'host-1',
      name: 'Host',
    });
    expect(result.code).toHaveLength(6);
    expect(result.roomId).toBeDefined();
  });

  it('el host queda en la sala como jugador', async () => {
    const t = convexTest(schema, modules);
    const { code } = await t.mutation(api.rooms.create, {
      clientId: 'host-1',
      name: 'Juan',
    });
    const room = await t.query(api.rooms.get, { code });
    expect(room).not.toBeNull();
    expect(room!.players).toHaveLength(1);
    expect(room!.players[0]!.clientId).toBe('host-1');
    expect(room!.players[0]!.isHost).toBe(true);
  });

  it('sala con contraseña expone hasPassword=true (pero no la clave)', async () => {
    const t = convexTest(schema, modules);
    const { code } = await t.mutation(api.rooms.create, {
      clientId: 'host-1',
      name: 'Host',
      password: 'secreto',
    });
    const room = await t.query(api.rooms.get, { code });
    expect(room!.hasPassword).toBe(true);
  });

  it('sala sin contraseña expone hasPassword=false', async () => {
    const t = convexTest(schema, modules);
    const { code } = await t.mutation(api.rooms.create, {
      clientId: 'host-1',
      name: 'Host',
    });
    const room = await t.query(api.rooms.get, { code });
    expect(room!.hasPassword).toBe(false);
  });
});

// ─── rooms.join — contraseña ─────────────────────────────────────────────────

describe('rooms.join — contraseña', () => {
  it('rechaza al jugador sin contraseña cuando la sala tiene una', async () => {
    const t = convexTest(schema, modules);
    const code = await createRoom(t, { password: 'secreto' });

    await expect(
      t.mutation(api.rooms.join, {
        code,
        clientId: 'player-1',
        name: 'Player',
      }),
    ).rejects.toThrow('contraseña');
  });

  it('rechaza con contraseña incorrecta', async () => {
    const t = convexTest(schema, modules);
    const code = await createRoom(t, { password: 'secreto' });

    await expect(
      t.mutation(api.rooms.join, {
        code,
        clientId: 'player-1',
        name: 'Player',
        password: 'equivocada',
      }),
    ).rejects.toThrow('contraseña');
  });

  it('permite entrar con la contraseña correcta', async () => {
    const t = convexTest(schema, modules);
    const code = await createRoom(t, { password: 'secreto' });

    const result = await t.mutation(api.rooms.join, {
      code,
      clientId: 'player-1',
      name: 'Player',
      password: 'secreto',
    });
    expect(result.code).toBe(code);
  });

  it('el jugador ya presente no necesita contraseña (reconexión)', async () => {
    const t = convexTest(schema, modules);
    const code = await createRoom(t, { password: 'secreto' });

    // Primera entrada con contraseña.
    await t.mutation(api.rooms.join, {
      code,
      clientId: 'player-1',
      name: 'Player',
      password: 'secreto',
    });

    // Reconexión sin contraseña — no debe tirar error.
    await expect(
      t.mutation(api.rooms.join, {
        code,
        clientId: 'player-1',
        name: 'Player',
      }),
    ).resolves.toBeDefined();
  });
});

// ─── rooms.join — límite de jugadores ────────────────────────────────────────

describe('rooms.join — maxPlayers', () => {
  it('rechaza al jugador N+1 cuando la sala está llena', async () => {
    const t = convexTest(schema, modules);
    const code = await createRoom(t, { maxPlayers: 2 });

    // Host ya ocupa el primer lugar; el segundo jugador llena la sala.
    await t.mutation(api.rooms.join, {
      code, clientId: 'player-2', name: 'P2',
    });

    // El tercer jugador debe ser rechazado.
    await expect(
      t.mutation(api.rooms.join, {
        code, clientId: 'player-3', name: 'P3',
      }),
    ).rejects.toThrow('llena');
  });

  it('un espectador no ocupa lugar de jugador', async () => {
    const t = convexTest(schema, modules);
    const code = await createRoom(t, { maxPlayers: 2 });

    // Llenar con 2 jugadores (host + player-2).
    await t.mutation(api.rooms.join, {
      code, clientId: 'player-2', name: 'P2',
    });

    // Un espectador adicional debe poder entrar.
    await expect(
      t.mutation(api.rooms.joinAsSpectator, {
        code, clientId: 'spectator-1', name: 'Spec',
      }),
    ).resolves.toBeDefined();
  });
});

// ─── rooms.updatePassword ────────────────────────────────────────────────────

describe('rooms.updatePassword', () => {
  it('host puede agregar contraseña', async () => {
    const t = convexTest(schema, modules);
    const code = await createRoom(t);
    const room = await t.query(api.rooms.get, { code });

    await t.mutation(api.rooms.updatePassword, {
      roomId: room!._id,
      clientId: 'host-1',
      password: 'nueva',
    });

    const updated = await t.query(api.rooms.get, { code });
    expect(updated!.hasPassword).toBe(true);
  });

  it('host puede borrar la contraseña', async () => {
    const t = convexTest(schema, modules);
    const code = await createRoom(t, { password: 'original' });
    const room = await t.query(api.rooms.get, { code });

    await t.mutation(api.rooms.updatePassword, {
      roomId: room!._id,
      clientId: 'host-1',
      password: '',
    });

    const updated = await t.query(api.rooms.get, { code });
    expect(updated!.hasPassword).toBe(false);
  });

  it('un no-host no puede cambiar la contraseña', async () => {
    const t = convexTest(schema, modules);
    const code = await createRoom(t);
    const room = await t.query(api.rooms.get, { code });

    await t.mutation(api.rooms.join, {
      code, clientId: 'player-1', name: 'P1',
    });

    await expect(
      t.mutation(api.rooms.updatePassword, {
        roomId: room!._id,
        clientId: 'player-1',
        password: 'hack',
      }),
    ).rejects.toThrow('host');
  });
});
