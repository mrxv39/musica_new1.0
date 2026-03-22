# CLAUDE_CONTEXT — poker_boss — 2026-03-22

## Tareas ejecutadas hoy

### T08 — Eliminar subprocess en pipeline preflop [refactor] ✅
**Rama:** `feature/refactor-preflop-imports` (pushed)
**Commits:** `76ec598`, `ce67c1e`
**Estado:** COMPLETADO en sesion anterior. Verificado hoy: 0 subprocess calls en modules/preflop/.

### T04 — Dashboard de stats para demo [feature] ✅
**Rama:** `feature/refactor-preflop-imports` (pushed)
**Commit:** `d6bc160`

**Cambios:**
- `src/db/playerStats.ts` — Data access layer read-only para tabla `player_stats` (ya existente con 496 filas, 317 jugadores). Types `PlayerStatsRow`, `ComputedStats`. Computa VPIP%, PFR%, 3Bet%, F3B%, 4Bet%, Limp%, AF, WTSD%, Win% desde raw counts.
- `src/pages/PlayerStatsPage.tsx` — Pagina completa:
  - Tabla sortable por cualquier columna (click en header)
  - Filtro por nombre de jugador
  - Filtro por table_size (All / HU / 3H)
  - Color-coded type badges: verde=fish (VPIP>=40), amarillo=reg (25-40), rojo=shark (<25)
  - Click en fila abre panel de detalle con grid de todas las stats + chips won/bet
- `src/app/tabs.ts` — Nuevo tab `stats` con label "Stats"
- `src/app/AppRouter.tsx` — Ruta para `PlayerStatsPage`

**Datos reales:** 496 rows en player_stats, 317 jugadores unicos, table sizes 2 (HU) y 3 (3H). Top player: StyLizard con 1268 hands HU.

**Resultado:** No errores de TypeScript en archivos nuevos/modificados. Build OK.

## Verificacion final (sesion 2026-03-22)
- **Tests:** 54 passed (6.85s)
- **Subprocess residuales:** Solo en `spawn_workers.py` (spawning workers, no pipeline preflop — correcto)
- **PlayerStatsPage.tsx:** Existe y funcional
- **Ambas tareas T04 + T08:** COMPLETADAS y verificadas

## Fix aplicado (sesion 2026-03-22 noche)
- **`modules/stats/player_stats.py` estaba eliminado** — solo quedaba el .pyc en cache
- Restaurado desde commit `cb93640` (ultimo commit donde existía)
- Este módulo es crítico: contiene la lógica de cálculo de stats y el schema de `player_stats`
- Sin él, el frontend PlayerStatsPage no puede funcionar con datos nuevos

## Estado actual
- Rama `feature/refactor-preflop-imports` contiene T08 + T04 + fix player_stats.py
- `player_stats` tabla ya poblada con datos reales
- Pendiente: commit del fix de player_stats.py restaurado
