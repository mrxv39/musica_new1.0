# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Poker Boss** is a Tauri desktop application that performs real-time OCR on poker table screenshots to extract hand information, detect game states, and validate against imported hand histories.

**Data Flow**:
```
Live Poker Table
    ↓ (screenshot capture)
Worker Loop (worker.py)
    ├─→ Fingerprint for deduplication
    ├─→ Run OCR (names, stacks, bets, dealer, positions)
    ├─→ Run Preflop Pipeline (hand detection, time validation, board state)
    └─→ Persist to SQLite (hands_obs table)

Frontend (React/Tauri IPC)
    ├─→ Display observations with images
    ├─→ Match observations to imported hand histories
    └─→ Strategy editor for situation analysis
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tauri 2 (IPC bridge)
- **Backend**: Python (OCR via OpenCV, preflop pipeline modules)
- **Desktop**: Tauri 2 (Rust IPC layer)
- **Database**: SQLite with WAL mode
- **Testing**: vitest (frontend), pytest (backend)

## Common Commands

### Development

- `npm run dev` — Start Vite dev server (HMR on port 1423)
- `npm run tauri dev` — Launch Tauri desktop app with hot-reload
- `npm run build` — Build TypeScript + Vite for production

### Testing

**Frontend (vitest)**:
- `npm test` — Run vitest watch mode
- `npm run test:run` (alias for `test:fast`) — Run all tests once (fast mode)
- `npm run test:slow` — Run all tests (slow mode, includes integration tests)
- `npm run test:coverage` — Run tests with coverage report
- `npm run test:ui` — Run single UI test (example: `src/tests/ui_import_xml_payload.test.tsx`)

**Backend (pytest)**:
- `pytest tests/` — Run all Python tests
- `pytest tests/test_preflop.py::TestPreflop::test_shape_and_flags` — Run single test
- `pytest tests/ -v` — Verbose output
- `pytest tests/ -m "not slow"` — Skip slow tests (marked with `@pytest.mark.slow`)

**Gates** (CI/compliance):
- `npm run gate:fast` — Run fast vitest suite (PowerShell script)
- `npm run gate:coverage` — Check strategy module coverage meets 75% threshold

### Reporting

- `npm run report:strategy` — Generate strategy coverage report from database
- `npm run report:ocr-effectiveness` — Analyze OCR accuracy against ground truth

## Architecture Details

### Worker Loop (`modules/workers/`)

The worker runs per-table and continuously:
1. **Captures** screenshots of a poker table region
2. **Fingerprints** (SHA1 hash of image + time window) to deduplicate
3. **Runs OCR** in parallel (names, stacks, bets, dealer, positions modules)
4. **Runs Preflop Pipeline** (subprocess-based: mano.py, time.py, board_state.py)
5. **Persists** observation to `hands_obs` table with JSON serialized OCR output
6. **Publishes** to frontend via Tauri IPC event

**Key files**:
- `modules/workers/worker.py` — CLI entry point, argument parsing, table ROI config
- `modules/workers/worker_loop.py` — Main tick loop, capture orchestration
- `modules/preflop/workers_loop/worker_mesa.py` — Per-table worker with dedup logic
- `modules/preflop/workers_loop/fingerprinting.py` — Fingerprint generation and cache

**Known Limitation**: Preflop detection uses subprocess calls to external Python scripts. This adds ~100-500ms latency per observation. Refactoring to direct imports is in the roadmap.

### OCR Engine (`modules/ocr/`)

Parallel modules extract different aspects of the table:
- `names.py` — Seat names / villain positions
- `stacks.py` — Stack sizes (in big blinds)
- `bets.py` — Current bet/raise amounts
- `dealer.py` — Dealer button position
- `gamecode.py` — Room/game identifier
- `posiciones.py` — Hero seat position

All modules receive the same image and run in parallel (ThreadPoolExecutor). Failures are caught and return empty dicts gracefully.

### Database (`modules/db/`)

- `db.py` — Thread-safe wrapper around SQLite; all DB ops protected by `_db_lock`
- `migrate.py` — Schema initialization (run on app startup if tables don't exist)

**Key tables**:
- `hands_obs` — Raw OCR observations (fingerprint, hand_class, time_str, ocr_json, image_path)
- `hands_real` — Imported XML hand histories from Champion Poker format
- `players` — Villain classification and notes
- `strategies` — Preflop situation definitions (position, stacks, hand ranges)
- `sub_strategies` — Action recommendations per situation

### Frontend (`src/`)

- `pages/HandsPage.tsx` — Real-time observation table with filters, image modal
- `pages/strategy/` — Editor for situations and sub-strategies
- `pages/ImportPage.tsx` — XML hand history importer workflow
- `db.ts` — Tauri SQL plugin bindings and typed query wrappers

No centralized state management (React Context used sparingly). Strategy domain is complex and could benefit from Zustand/Redux if prop-drilling becomes a bottleneck.

## Worker Performance Tuning

By default, workers use **sequential execution** (recommended):
- `POKER_BOSS_WORKER_SEQUENTIAL=1` (default) — OCR modules run in series; lowest wall-time latency in practice
- `POKER_BOSS_WORKER_SEQUENTIAL=0` — OCR modules run in parallel threads; may increase time due to Python's GIL
- `POKER_BOSS_OCR_SEQUENTIAL=0` — Force parallel OCR even when worker is sequential (fine-grained control)

See `README.md` for rationale. Do not assume thread parallelism improves throughput on CPU-bound workloads.

## Known Issues & Debt

1. **Subprocess Preflop Pipeline** — Calls external Python processes for mano/time/board_state. Refactor to direct imports to reduce latency.
2. **Global DB Lock** — All writes serialize via `_db_lock`; no read-write optimization. Could be bottleneck with 4+ concurrent workers.
3. **Fingerprint Collisions** — Uses time window (2 sec), not content hash. In-memory dedup cache lost on restart.
4. **Test Fragility** — Checkpoint auto-saves suggest flaky tests. Investigate root causes before scaling.
5. **Backup File Clutter** — 189+ `.bak_*` files in repo; clean up and use git branches instead.

## Testing Notes

- Tests are marked with `@pytest.mark.slow` for integration/IO-heavy tests
- `conftest.py` contains shared fixtures (database, image mocks, etc.)
- Frontend tests use Vitest + Testing Library; prefer `user-event` over `fireEvent`
- Coverage gates (in `scripts/gate-coverage-strategy.ps1`) enforce 75% for strategy module; adjust thresholds there

## File Organization

```
modules/
├── ocr/           # OCR extraction modules (names, stacks, bets, etc.)
├── preflop/       # Hand detection, board state, preflop pipeline
│   └── workers_loop/    # Worker tick logic and fingerprinting
├── workers/       # Worker entry points (deprecated location; see preflop/workers_loop)
├── db/            # SQLite wrapper and migrations
├── importers/     # XML importer for Champion Poker hand histories
├── strategy/      # Strategy matching and situation evaluation
└── spots/         # Spot observation linking to hands_real

src/
├── pages/         # Main UI pages (Hands, Strategy, Import, etc.)
├── components/    # Reusable React components
├── db.ts          # Tauri SQL bindings (typed wrappers)
└── tests/         # Vitest test files

tests/            # Pytest suite (backend)
scripts/          # One-off diagnostic scripts (report_*, debug_*, etc.)
```

## Debugging Tips

- **Worker hangs?** Check `worker_loop.py` for exceptions caught in broad try-except blocks. Add logging context.
- **OCR misdetections?** Use `scripts/debug_hero_hand_ocr.py` to inspect extracted text per module.
- **Database corruption?** Check `migrate.py` for incomplete schema migration; consider backups before recovery.
- **Tauri IPC timeouts?** Frontend commands to Python backend may hang; check worker thread is not blocked on DB lock.
- **Flaky tests?** Review `conftest.py` fixtures for cleanup issues; ensure test isolation (no shared database state).
