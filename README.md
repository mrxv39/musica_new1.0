# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Worker performance

The preflop worker runs OCR and preflop detection per capture. By default it uses a **sequential** path (OCR then preflop, and OCR modules in series) to minimize detection time. Thread-based parallelism is available but can **increase** wall time on CPU-bound workloads due to Python's GIL; sequential is the recommended default.

- `POKER_BOSS_WORKER_SEQUENTIAL=1` (default): run OCR and preflop in series; OCR internal phases also sequential. Lowest latency in practice.
- `POKER_BOSS_WORKER_SEQUENTIAL=0`: run OCR and preflop in parallel (threads). May increase time.
- `POKER_BOSS_OCR_SEQUENTIAL=0`: when worker parallel is off, you can still force OCR-internal parallelism; combined with `POKER_BOSS_WORKER_SEQUENTIAL=0` for full thread parallelism.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
