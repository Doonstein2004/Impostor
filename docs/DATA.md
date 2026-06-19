# Datos de jugadores y DTs

## Estrategia

El juego usa un **dataset curado y bundleado** en
[`packages/data/src/players.ts`](../packages/data/src/players.ts). Ventajas:

- **Offline y gratis**: no hay llamadas a APIs ni costos recurrentes.
- **Control de categorías**: cada personaje trae `zone`, `era`, `role` ya clasificados,
  que es justo lo que el juego necesita para filtrar el pool.
- **Versionado**: el dataset entra en git; las partidas son reproducibles.

Cada personaje tiene la forma (`Character` en `@impostor/core`):

```ts
{
  id, name, fullName, nationality,
  zone: 'portero' | 'defensor' | 'medio' | 'atacante',
  era:  'antiguo' | 'leyenda' | 'moderno' | 'experimentado' | 'actual' | 'joven_promesa',
  role: 'jugador' | 'dt',
  club?, tags?
}
```

## Fuentes para ampliar el dataset

Para un juego de adivinanzas alcanza con **nombre + posición + época** (datos factuales).
Recomendadas:

| Fuente | Uso ideal | Notas |
| --- | --- | --- |
| [TheSportsDB](https://www.thesportsdb.com/api.php) | Actuales | API gratuita (key de prueba `3`), incluye fotos. |
| Datasets FIFA en [Kaggle](https://www.kaggle.com/datasets?search=fifa+players) | Poblar en masa | CSV con miles de jugadores: nombre, posición, club, país, overall. |
| [StatsBomb Open Data](https://github.com/statsbomb/open-data) | Histórico/leyendas | Licencia abierta. |
| [API-Football](https://www.api-football.com) | Modo "en vivo" (futuro) | De pago. Sólo si querés datos actualizados automáticamente. |

### Mapeo de posición → `zone`

```
GK                         -> portero
CB, LB, RB, LWB, RWB       -> defensor
CDM, CM, CAM, LM, RM       -> medio
ST, CF, LW, RW             -> atacante
```

### Cómo ampliarlo

`packages/data/scripts/generate.ts` es el punto de extensión: implementá un fetch a
TheSportsDB o un parser de CSV de Kaggle, mapeá las posiciones y agregá las filas a
`players.ts`. Corré:

```bash
pnpm data:generate   # imprime stats por zona/época/rol del dataset actual
```

## Nota legal ⚖️

Usá fuentes con licencia abierta o uso permitido. **Evitá scrapear** sitios que lo
prohíban en sus términos de servicio (p. ej. Transfermarkt). Nombres, posición y
nacionalidad son datos factuales; las **fotos y logos** suelen tener derechos —
si vas a mostrar imágenes, verificá la licencia de cada fuente.
