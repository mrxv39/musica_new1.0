# Tareas poker_boss (solo tareas que Codex puede hacer con seguridad)

- [x] **Tarea 1.** Crear en la raíz el archivo CONTEXT.md con exactamente: línea 1 = una frase que describa el proyecto (p.ej. "App de escritorio para análisis de manos de póker con OCR y estrategias preflop."). Líneas 2-4 = "modules: lógica Python, OCR, workers.", "src: frontend React/TypeScript.", "src-tauri: backend Tauri/Rust." **Verificación:** existe CONTEXT.md con 4 líneas.

- [x] **Tarea 2.** En package.json, dentro de "scripts", añadir la clave "report:strategy" con valor "python scripts/report_strategy_coverage_from_db.py" solo si esa clave no existe. **Verificación:** npm run report:strategy ejecuta sin error.

- [x] **Tarea 3.** Crear scripts/report_ocr_effectiveness.py. Al inicio: REPO_ROOT = os.path.dirname del script + "..", sys.path.insert(0, REPO_ROOT). Conectar a data/poker_boss.db. Ejecutar SELECT obs_id, ocr_json FROM hands_obs WHERE preflop_ok=1. Para cada fila: parsear ocr_json; extraer ocr.bets.ok, ocr.stacks.ok, ocr.mano (hand_class), ocr.stackefectivo.value; contar mano_ok = hand_class no vacío, bets_ok = bets.ok True, stacks_ok = stacks.ok True, se_ok = value numérico en [0.01, 75]. Al final imprimir: total=N, mano_ok=count (%), bets_ok=count (%), stacks_ok=count (%), se_ok=count (%). **Verificación:** ejecutar python scripts/report_ocr_effectiveness.py y que imprima total y 4 porcentajes.

- [x] **Tarea 4.** En package.json, en "scripts", añadir "report:ocr-effectiveness" con valor "python scripts/report_ocr_effectiveness.py" si no existe. **Verificación:** npm run report:ocr-effectiveness muestra la misma salida que la Tarea 3.

- [x] **Tarea 5.** En report_ocr_effectiveness.py: además de imprimir, escribir la misma salida en un archivo data/ocr_effectiveness_YYYYMMDD.txt usando la fecha actual (datetime.date.today().strftime). Crear la carpeta data si no existe (os.makedirs). **Verificación:** existe data/ocr_effectiveness_*.txt con texto.

- [x] **Tarea 6.** En CONTEXT.md (creado en Tarea 1), añadir al final una nueva línea: "Efectividad OCR: npm run report:ocr-effectiveness; comparar dos data/ocr_effectiveness_*.txt para evolución." **Verificación:** la línea está en CONTEXT.md.
