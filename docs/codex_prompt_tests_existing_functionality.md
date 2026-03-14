# Codex prompt: Tests to secure existing functionality

Copy the block below into Codex (English for best results). Only high-confidence, necessary tests.

---

```
Repo: poker_boss. Goal: add tests that secure existing functionality. Implement only the two tasks below. Do not change production behavior.

TASK 1 — Strategy coverage gate (QUALITY_TODO)

- QUALITY_TODO.md and scripts/gate-coverage-strategy.ps1 require a minimum lines coverage for pages/strategy (currently 63). The objective is to raise it to 65.
- Add or extend Vitest tests that cover src/pages/strategy/useStrategyPage.ts and/or its helpers (e.g. useStrategyPage/rowsSync.ts, selection.ts, reload.ts, useSituations.ts, useSubsCrud.ts) so that the "pages/strategy" group reaches at least 65% lines. Prefer fast, focused tests (no slow E2E).
- After changes, run: npm run gate:coverage (or the strategy coverage gate script). Ensure it passes with pages/strategy >= 65. If the gate script uses a different threshold (e.g. 63), update the script to require 65 for pages/strategy and then run it to verify.
- Do not lower any existing coverage thresholds. Only add tests or raise the gate to 65.

TASK 2 — Unit test for board_state.py

- modules/preflop/board_state.py is invoked as: python -m modules.preflop.board_state --image <path>. It returns JSON with street_state ("preflop" | "postflop" | "unknown"), valid_count, cards, etc.
- Add a new pytest test file tests/test_board_state.py (or add to an existing test file under tests/ that fits) that:
  1. Creates a temporary image that produces preflop (e.g. image large enough so ROIs are in bounds but card regions are black or non-matching so valid_count == 0). Hint: FLOP_CARD_ROIS in board_state.py are (248,222,32,42), (307,222,32,42), (366,222,32,42); image size at least ~410x270 to avoid "ROI out of bounds".
  2. Runs the board_state script on that image (subprocess or import and call main with patched argv) and parses the JSON output.
  3. Asserts street_state == "preflop" and valid_count == 0.
  4. Optionally: if a postflop fixture image exists or can be created (e.g. from tests/fixtures or a synthetic with 3 valid cards), add an assertion that street_state == "postflop" and valid_count >= 3; otherwise skip the postflop case.
- Do not change board_state.py logic; only add the test. Run pytest tests/test_board_state.py and ensure it passes.

Deliverables: (1) Strategy coverage for pages/strategy at least 65, gate passes. (2) tests/test_board_state.py (or equivalent) added and passing. Run the full gate (e.g. scripts/gate-fast.ps1 or frontend tests + pytest) if possible and fix any regressions.
```

---
