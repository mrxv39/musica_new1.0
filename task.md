# Tareas poker_boss

- [ ] Añadir en la raíz un CONTEXT.md con 3-5 líneas: qué hace el proyecto, carpetas clave (modules, src, src-tauri).
- [ ] Si existe src/pages/hands/handsPageConfig.ts en git pero no en disco: quitarlo del índice con git rm --cached y hacer commit.
- [ ] En modules/workers/worker_strategy.py: asegurar que cuando se aplica el fix de BTN (p1_bet=0), la salida strategy incluya bets_fix_reason; si ya está, dejar un comentario de una línea explicando la heurística.
- [ ] En scripts/report_strategy_coverage_from_db.py: usar la misma normalización de p2_tipo/p3_tipo que el worker (uppercase); si ya está, no cambiar nada.
- [ ] Añadir en package.json un script \"report:strategy\" que ejecute: python scripts/report_strategy_coverage_from_db.py (solo si no existe).
- [ ] Ejecutar los tests del área hands (npm test o el comando que use el proyecto) y anotar en task.md si alguno falla (nombre del test).
