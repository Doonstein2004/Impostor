import { test, expect, type Page } from '@playwright/test';

/**
 * Tests E2E para la creación y gestión de salas.
 * Prerequisito: Expo dev server en :8081, Convex operativo.
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

async function waitForHome(page: Page) {
  await page.goto('/');
  await expect(page.getByText('IMPOSTOR')).toBeVisible({ timeout: 50_000 });
}

/**
 * Cierra el modal de tutorial si aparece.
 * El tutorial puede aparecer hasta 6-8s después de waitForURL (Convex carga el
 * Lobby). `isVisible({timeout})` no espera a que un elemento inexistente
 * aparezca, solo consulta el estado actual — por eso usamos `waitFor`, que sí
 * hace polling activo.
 */
async function dismissTutorial(page: Page) {
  const skipBtn = page.getByText('Saltar').first();
  try {
    await skipBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await skipBtn.click();
    await expect(skipBtn).not.toBeVisible({ timeout: 5_000 });
  } catch {
    // No apareció (tutorial ya visto en una sesión previa) — nada que cerrar.
  }
}

/**
 * Crea una sala y espera hasta que la URL sea /room/XXXX.
 * Expo Router agrega ?__EXPO_ROUTER_key=... a la URL, por eso usamos regex.
 */
async function fillNameAndCreate(page: Page, name: string): Promise<string> {
  await waitForHome(page);
  await page.getByPlaceholder('Ej. Dani').fill(name);
  await page.getByText('Crear sala').click();
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 20_000 });
  await dismissTutorial(page);
  const match = page.url().match(/\/room\/([A-Z0-9]{4,8})/);
  return match?.[1] ?? '';
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe('Crear e ingresar a sala', () => {
  test('crear sala lleva al lobby con el código en la URL', async ({ page }) => {
    const code = await fillNameAndCreate(page, 'TestHost');
    expect(code).toHaveLength(6);
    await expect(page).toHaveURL(new RegExp(`/room/${code}`));
  });

  test('unirse a sala existente funciona', async ({ browser }) => {
    const ctxHost = await browser.newContext();
    const pageHost = await ctxHost.newPage();
    const code = await fillNameAndCreate(pageHost, 'HostE2E');

    const ctxPlayer = await browser.newContext();
    const pagePlayer = await ctxPlayer.newPage();
    await waitForHome(pagePlayer);
    await pagePlayer.getByPlaceholder('Ej. Dani').fill('PlayerE2E');
    await pagePlayer.getByPlaceholder('ABC123').fill(code);
    await pagePlayer.getByText('Unirme').click();
    await pagePlayer.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 15_000 });
    await dismissTutorial(pagePlayer);

    await expect(pageHost.getByText('PlayerE2E')).toBeVisible({ timeout: 10_000 });

    await ctxHost.close();
    await ctxPlayer.close();
  });
});

test.describe('Sala con contraseña', () => {
  // Tiempo extra para: crear sala, configurar pw, crear contexto de jugador, flujo de join.
  test.setTimeout(120_000);

  test('input de contraseña NO aparece para sala inexistente', async ({ page }) => {
    await waitForHome(page);
    await page.getByPlaceholder('Ej. Dani').fill('TestPlayer');
    await page.getByPlaceholder('ABC123').fill('ZZZZZZ');
    await page.getByText('Unirme').click();
    await expect(page.getByPlaceholder('Ingresá la contraseña')).not.toBeVisible();
  });

  test('flujo completo: crear sala con contraseña → join sin pw falla → join con pw ok', async ({ browser }) => {
    const ctxHost = await browser.newContext();
    const pageHost = await ctxHost.newPage();
    const code = await fillNameAndCreate(pageHost, 'HostPw');

    // El botón dice "+ Agregar" cuando no hay contraseña.
    // Es un Pressable sin role="button" explícito → getByRole no lo encuentra.
    // Usamos getByText + .first() (el div Pressable viene antes que el span Text en el DOM).
    const addPwButton = pageHost.getByText('+ Agregar').first();
    await addPwButton.scrollIntoViewIfNeeded();
    await expect(addPwButton).toBeVisible({ timeout: 8_000 });
    await addPwButton.click();

    // El input de contraseña en el Lobby tiene placeholder "Contraseña".
    const pwInput = pageHost.getByPlaceholder('Contraseña').first();
    await expect(pwInput).toBeVisible({ timeout: 10_000 });
    await pwInput.fill('clave123');
    // exact:true para no matchear por substring el "+ Guardar actual" de presets.
    await pageHost.getByText('Guardar', { exact: true }).first().click();

    // Confirmar que quedó protegida (roundtrip de la mutation a Convex).
    await expect(pageHost.getByText(/Con contraseña|Cambiar/i).first()).toBeVisible({ timeout: 15_000 });

    // Jugador intenta unirse SIN contraseña → debe aparecer el campo de pw en el home.
    const ctxPlayer = await browser.newContext();
    const pagePlayer = await ctxPlayer.newPage();
    await waitForHome(pagePlayer);
    await pagePlayer.getByPlaceholder('Ej. Dani').fill('PlayerPw');
    await pagePlayer.getByPlaceholder('ABC123').fill(code);
    await pagePlayer.getByText('Unirme').click();
    await expect(pagePlayer.getByPlaceholder('Ingresá la contraseña')).toBeVisible({ timeout: 15_000 });

    // Reintenta CON contraseña → entra al lobby.
    await pagePlayer.getByPlaceholder('Ingresá la contraseña').fill('clave123');
    await pagePlayer.getByText('Unirme').click();
    await pagePlayer.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 15_000 });

    await ctxHost.close();
    await ctxPlayer.close();
  });
});

test.describe('Límite de jugadores', () => {
  // Tiempo extra para: crear sala, configurar, unirse 4 veces, verificar rechazo.
  test.setTimeout(120_000);

  test('badge actualiza y el 5to jugador es rechazado cuando el límite es 4', async ({ browser }) => {
    const ctxHost = await browser.newContext();
    const pageHost = await ctxHost.newPage();
    const code = await fillNameAndCreate(pageHost, 'HostLimit');

    // OJO: getByText('4') SIN exact hace matching por substring — matchea
    // "844 pers. · 3r · 30s" (el resumen de config) y hasta el código de sala si
    // contiene un 4, así que .first() clickeaba cualquier cosa. Con exact:true
    // solo matchea el chip "4" de Límite de jugadores (las otras secciones no
    // tienen un nodo de texto que sea exactamente "4": Rondas usa 1/2/3/5/∞,
    // Impostores usa "N imp.").
    const chip4 = pageHost.getByText('4', { exact: true }).first();
    await chip4.waitFor({ state: 'visible', timeout: 10_000 });
    await chip4.scrollIntoViewIfNeeded();
    await chip4.click();

    // El badge debe actualizarse de "1/10" a "1/4" (roundtrip de config a Convex).
    await expect(pageHost.getByText('1/4')).toBeVisible({ timeout: 15_000 });

    // Jugadores 2–4 entran (quedan espacios).
    const extraCtxs = [];
    for (let i = 2; i <= 4; i++) {
      const ctx = await browser.newContext();
      const pg = await ctx.newPage();
      await waitForHome(pg);
      await pg.getByPlaceholder('Ej. Dani').fill(`Pl${i}`);
      await pg.getByPlaceholder('ABC123').fill(code);
      await pg.getByText('Unirme').click();
      await pg.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 15_000 });
      extraCtxs.push(ctx);
    }

    // Jugador 5 intenta entrar → rechazado.
    const ctx5 = await browser.newContext();
    const page5 = await ctx5.newPage();
    await waitForHome(page5);
    await page5.getByPlaceholder('Ej. Dani').fill('Player5');
    await page5.getByPlaceholder('ABC123').fill(code);
    await page5.getByText('Unirme').click();
    // Backend: "La sala está llena (máx. 4 jugadores)"
    await expect(page5.getByText(/llena|lleno|máx|max/i)).toBeVisible({ timeout: 8_000 });

    await ctxHost.close();
    for (const c of extraCtxs) await c.close();
    await ctx5.close();
  });
});
