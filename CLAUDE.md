# Poker Boss — Claude Instructions

## Golden Rule

**NEVER remove, simplify, or rewrite existing working code when implementing new features.**
If a file exists and works, do NOT replace it with a "cleaner" version. Add to it, don't subtract.
Before editing any file, READ it first to understand what it already does.

## Tests — Regla Critica

- **NUNCA modificar un test existente para que pase**
- Si un test falla → arreglar el codigo de produccion, no el test
- Si crees que un test esta desactualizado → detente, explica el motivo y espera confirmacion antes de tocarlo
- Modificar un test sin permiso explicito es un error critico

## Critical Lessons (from past incidents)

1. **HandsPage has a complex 4-table dashboard** (tournaments, spots, hands, players) with worker controls, review filters, column config, and image preview. It is NOT a simple page — it uses ~30 sub-modules in `src/pages/hands/`. Never rewrite it.

2. **The Rust backend (`src-tauri/src/`) has multiple modules**: `workers/`, `obs.rs`, `import_xml.rs`, `reset_real.rs`, `image_io.rs`, `match_spots.rs`, `python.rs`. These are all required. Never simplify `main.rs` to a single file.

3. **The workers pipeline** uses `modules/preflop/workers_loop/` (19 files) and `modules/preflop/run_workers_loop.py`. Each worker instance captures a specific screen region (mesa 1-4) defined in `workers_loop/config.py`. Workers run in infinite loop until stopped.

4. **Database is `data/poker_boss.db`** — all references must use this. The env var is `POKER_BOSS_DB_PATH`. There is NO `musica_new.db` anymore.

## Before Making Changes

- **Read the file first.** Understand its imports, exports, and dependencies.
- **Check what other files import from it.** Use `grep` to find usages before changing exports.
- **Don't delete files** that aren't explicitly requested to be deleted.
- **Don't change function signatures** without updating all callers.
- **Don't lower test coverage** — if restoring files drops coverage, add tests rather than lowering thresholds.

## Architecture

### Frontend (src/)
- `src/config.ts` — centralized paths (DB, XML dir, batch folder, hero name)
- `src/db.ts` — DB access layer with cached connections via `openDb()`
- `src/db/sql.ts` — strategy DB access (singleton `getDB()`)
- `src/db/players.ts` — players DB access
- `src/pages/HandsPage.tsx` — main dashboard, uses `useHandsPage` hook
- `src/pages/hands/` — ~30 modules: tables, modals, filters, workers client, sorting, columns
- `src/pages/SpotsPage.tsx` — strategy editor for spots
- `src/pages/PlayerStatsPage.tsx` — player statistics (3H vs HU)

### Rust Backend (src-tauri/src/)
- `main.rs` — app setup, overlay window, command registration
- `workers/` — worker process management (spawn 4 instances with mesa regions)
- `obs.rs` — OCR observation commands
- `python.rs` — Python process spawning helper
- `import_xml.rs` — Champion Poker XML import
- `reset_real.rs` — table reset commands
- `image_io.rs` — image reading for UI
- `match_spots.rs` — spot linking

### Python Backend (modules/)
- `modules/workers/` — single-image worker (worker.py, worker_loop.py)
- `modules/preflop/workers_loop/` — multi-mesa loop runner (19 files)
- `modules/preflop/run_workers_loop.py` — entry point for Tauri workers
- `modules/db/` — DB connection, schema, migrations
- `modules/stats/player_stats.py` — player statistics engine
- `modules/ocr/` — OCR pipeline
- `modules/strategy/` — strategy matching

### Mesa Regions (config.py)
```
Mesa 1: x1=520,  y1=210,  x2=1296, y2=807
Mesa 2: x1=520,  y1=807,  x2=1296, y2=1404
Mesa 3: x1=1296, y1=210,  x2=2072, y2=807
Mesa 4: x1=1296, y1=807,  x2=2072, y2=1404
```

## Development Workflow

- Frontend changes hot-reload via Vite — do NOT restart the app for TS/TSX changes.
- Rust changes auto-recompile via Tauri file watcher.
- Only kill/restart the app when explicitly asked.
- Run `npm run gate:fast` before committing (pre-commit hook enforces this).
- Commit after each feature, don't accumulate changes.

## Database

- Single DB: `data/poker_boss.db`
- Key tables: `hands` (52k), `tournaments` (3k), `spots` (108), `player_stats`, `players`, `hands_obs`, `workers_captures`, `worker_profile`
- Indexes exist on: `hands(startdate)`, `hands(tournament_id)`, `spots(hand_id)`, `tournaments(created_at)`
- Stats split by `table_size`: 2=HU, 3=3H

## Testing

- Frontend: `npm run test:fast` (vitest, 104 tests)
- Backend: `pytest` (54 tests)
- Gate: `npm run gate:fast` (runs both + coverage check)

## Flujo: Run Workers (boton en vista Hands)

### 1. Frontend (`useHandsPageWorkerActions.ts`)
- Llama a Tauri command `set_workers_running(running=true, dbPath, outDir, xmlDir, hero)`
- Muestra 4 overlays (uno por mesa, ajustado a su region exacta)
- Inicia polling cada 2s con `get_workers_status` para saber si siguen vivos

### 2. Rust backend (`workers/commands.rs`)
- Spawna **4 procesos Python** en paralelo, cada uno ejecutando `modules/preflop/run_workers_loop.py`
- Cada proceso recibe `POKER_BOSS_MESA_INDEX=0,1,2,3` (una mesa por instancia)
- Stdout/stderr redirigidos a `data/spots_raw/time_spots/YYYYMMDD/instance_N/_logs/run_workers_loop.log`
- Si hay `xmlDir` + `hero`, spawna un 5to proceso `live_xml_sync.py` que sincroniza XMLs cada 8s
- Crea 4 ventanas overlay transparentes, cada una posicionada exactamente sobre su mesa:
  - Mesa 1: x:520, y:210, w:776, h:597
  - Mesa 2: x:520, y:807, w:776, h:597
  - Mesa 3: x:1296, y:210, w:776, h:597
  - Mesa 4: x:1296, y:807, w:776, h:597
- Cada overlay muestra (cuando el worker detecta un spot):
  - **Move** (PUSH, FOLD, CALL, etc.)
  - **Bet min / Bet max**
  - **Mano** (ej: AQs)
  - **SE** (stack efectivo en BB)

### 3. Python loop (`workers_loop/loop_runner.py`) — loop infinito SIN delay

**3a. Captura de pantalla** (`capture.py`)
- Captura solo la region de su mesa directamente (ej: mesa 1 = x:520-1296, y:210-807)
- Guarda imagen en `time_gate_probe/` como AREA.bmp

**3b. Time gate** (`time_gate.py`)
- Recorta la zona del timer dentro de la mesa (offset 350,470,50,15)
- Evalua si es el momento correcto para analizar (score > threshold)
- Si `time_gate = false` → vuelve a 3a inmediatamente (sin delay)

**3c. Si pasa el time gate → Preflop** (`worker_mesa_preflop.py`)
- Detecta las cartas del hero (mano.py) → `hand_class` (ej: "AQs")
- Verifica que no hay board visible (noboard.py)
- Si no hay cartas validas o hay board → skip

**3d. OCR completo** (`worker_mesa_obs.py`)
- Names: detecta nombres de villanos (p2, p3)
- Villano: clasifica tipo (fish/reg/shark) consultando DB `players`
- Stacks: lee stacks de cada jugador
- Bets: lee apuestas actuales
- Stack efectivo: calcula SE en BB
- Dealer: detecta posicion del boton
- Posiciones: asigna BTN/SB/BB
- Gamecode: lee el codigo de partida

**3e. Strategy matching** (`strategy_pipeline.py`)
- Con los datos del OCR, busca el spot que matchea en `spots_strategies`
- Determina el move (PUSH, FOLD, CALL, etc.) y rangos de apuesta

**3f. Persistencia** (`worker_mesa_obs.py`)
- Deduplica: si la mano+stack no cambio respecto al tick anterior → skip
- Si hay datos validos: inserta en tabla `spots` de la DB
- Guarda la imagen en `data/img/`
- Genera fingerprint del archivo

**3g. Sync XML** (cada tick, si configurado)
- Importa nuevos XMLs de Champion Poker a la DB

### 4. Al pulsar "Stop Workers"
- Rust mata los 4 procesos Python + el proceso XML sync
- Frontend oculta el overlay
- Polling detecta "stopped" y actualiza la UI
