# Workers Detallado - Qué Hacen Exactamente

## Visión General

Los **workers** son procesos Python paralelos que corren continuamente monitoreando mesas de poker en vivo. Cada worker gestiona **1 mesa** y ejecuta un loop cada **3000ms (3 segundos)**.

Cuando presionas **"Run workers (loop, 4 instances)"** se lanzan **4 instancias** del worker, una por cada mesa que tienes configurada.

---

## Arquitectura de Workers

### Punto de Entrada Principal

**Archivo**: `modules/preflop/workers_loop/worker_mesa.py`
**Función**: `run_worker_mesa_once()`

Este es el corazón del worker. Se ejecuta una vez por tick (cada 3 segundos) por cada mesa.

---

## Flujo Completo de un Worker (1 Tick)

### FASE 1: CAPTURA DE PANTALLA

```python
# Línea 122
img_path = capture_to_tmp(area, dirs.tmp_dir, ts)
```

**¿Qué hace?**
- Captura un screenshot de la región de la mesa (`area`) en las coordenadas especificadas
- Guarda la imagen temporalmente en `tmp_dir` con nombre: `{timestamp}__mesa_{mesa_number}.bmp`
- Coordenadas del `area`:
  - `x1, y1` = esquina superior izquierda
  - `x2, y2` = esquina inferior derecha
  - `mesa` = número de mesa (1, 2, 3, 4)

**Ejemplo**:
```
Captura la región (100, 50) hasta (1000, 600) de la pantalla
Guarda en: C:/tmp/workers_out/2026-03-18_15-30-45__mesa_1.bmp
```

**Tiempo aproximado**: 50-100ms

---

### FASE 2: EXTRACCIÓN DE TIEMPO (TIME GATE)

```python
# Línea 128-142
roi_path = os.path.join(dirs.tmp_dir, f"{ts}__mesa_{mesa}__time_roi.bmp")
time_gate = run_time_gate_on_roi_path(area, dirs.tmp_dir, ts, roi_path)
```

**¿Qué hace?**
- Extrae el ROI (Region of Interest) con el reloj/tiempo visible en la mesa
- Ejecuta OCR solo en esa región pequeña para detectar el tiempo
- Verifica si el tiempo es válido (no es una mano antigua repetida)

**Si falla (`time_ok == False`)**:
- Descarta la captura
- Log: `[mesa X] TIME FALSE -> skip`
- Vuelve al siguiente tick sin procesar

**Tiempo aproximado**: 50-200ms

---

### FASE 3: DEDUPLICACIÓN - FRAME DUPLICADO

```python
# Línea 161-169
image_fp = get_file_fingerprint(img_path)  # SHA1 hash de la imagen
last_capture_fp = _LAST_CAPTURE_FP_BY_MESA.get(mesa)
if last_capture_fp == image_fp:
    return  # Skip, frame idéntico al anterior
```

**¿Qué hace?**
- Calcula huella digital (fingerprint) SHA1 de la captura
- Compara con el último frame capturado de esa mesa
- Si son idénticos → **SKIP** (no procesa nada más)

**Propósito**: Evitar procesar el mismo frame múltiples veces en ticks consecutivos

**Tiempo aproximado**: 10ms

---

### FASE 4: DEDUPLICACIÓN - CAPTURA RECIENTE

```python
# Línea 173-187
since_ms = int(time.time() * 1000) - RECENT_CAPTURE_WINDOW_MS  # Últimos 15 segundos
recent = dbmod.find_recent_capture_by_fingerprint(
    image_fingerprint=image_fp,
    since_ms=since_ms,
)
if recent:
    return  # Skip, captura idéntica en los últimos 15 segundos
```

**¿Qué hace?**
- Busca en la base de datos si hace poco (últimos 15 segundos) se procesó una captura igual
- Si existe → **SKIP** (no vuelve a procesar)

**Propósito**: Evitar duplicados si por ejemplo:
- El usuario pausó la grabación
- Hay lag y llegan frames idénticos

**Ventana de dedup**: 15 segundos (configurable con `POKER_BOSS_CAPTURE_DEDUPE_WINDOW_MS`)

**Tiempo aproximado**: 5-20ms

---

### FASE 5: OCR (EXTRACCIÓN DE INFORMACIÓN)

```python
# Línea 207-249
ocr = run_ocr(img_path)  # Modo secuencial (por defecto)
```

**¿Qué hace?**
Ejecuta **6 módulos de OCR en paralelo** (usando threads) sobre la misma imagen:

| Módulo | Extrae | Salida |
|--------|--------|--------|
| `names.py` | Nombres de los jugadores en cada posición | `{"p1": "Hero", "p2": "Villain1", ...}` |
| `stacks.py` | Stack size de cada jugador (en big blinds) | `{"p1": 150.5, "p2": 200.0, ...}` |
| `bets.py` | Bets/raises actuales en el board | `{"p1_bet": 10.0, "p2_bet": 20.0}` |
| `dealer.py` | Posición del botón dealer | `{"dealer_seat": 3}` |
| `gamecode.py` | Identificador de la sala/juego | `{"game_code": "High Stakes"}` |
| `posiciones.py` | Posición del héroe | `{"hero_position": "BTN"}` |

**Ejecución**:
```
POKER_BOSS_WORKER_SEQUENTIAL=1 (default)
  ├─ OCR secuencial (todos juntos, más rápido en práctica)
  └─ Tiempo total: 200-500ms

POKER_BOSS_WORKER_SEQUENTIAL=0
  ├─ OCR paralelo (threads, puede ser más lento por GIL)
  └─ Tiempo total: 300-600ms
```

**Salida OCR**:
```json
{
  "ok": true,
  "names": {"p1": "Hero", "p2": "Villain1", "p3": "Villain2"},
  "stacks": {"p1": 150.5, "p2": 200.0, "p3": 175.25},
  "bets": {"p1_bet": 0, "p2_bet": 10},
  "dealer": {"dealer_seat": 2},
  "gamecode": {"game_id": "NLH_Table5"},
  "posiciones": {"hero_pos": "BTN"},
  "_timings": {
    "ocr_names": 45.2,
    "ocr_stacks": 67.3,
    "ocr_bets": 34.1,
    ...
  }
}
```

**Tiempo aproximado**: 200-500ms

---

### FASE 6: PREFLOP PIPELINE

```python
# Línea 245
preflop = _run_preflop_direct(img_path)
```

**¿Qué hace?**
Ejecuta 3 módulos para validar que es un spot de **preflop válido**:

#### 6A: Detección de Cartas (mano.py)
```python
# Extrae: Cartas del héroe (ej: AK, QQ, 72o)
# Valida: Cartas reconocidas correctamente
```

**Salida**:
```json
{
  "mano_ok": true,
  "hand_class": "AK",
  "hand_suit": "os",  // offsuit
  "valid": true
}
```

#### 6B: Validación de Tiempo (time.py)
```python
# Valida: Es tiempo de preflop (no flop, no turn)
# Revisa: Cartas del héroe visibles (no pocket cards escondidas)
```

**Salida**:
```json
{
  "time_ok": true,
  "street": "preflop",
  "board": [],
  "valid": true
}
```

#### 6C: Estado del Board (board_state.py)
```python
# Valida: No hay board comunitario visible (preflop = sin board)
# Revisa: Stack efectivo del héroe
```

**Salida**:
```json
{
  "noboard_ok": true,
  "stacks_valid": true,
  "board": []
}
```

**Preflop válido** si:
- `mano_ok == True` (cartas reconocidas)
- `time_ok == True` (es preflop)
- `noboard_ok == True` (sin board comunitario)

**Si falla**:
```python
# Línea 282-304
if preflop_fail(preflop):
    # Mueve imagen a carpeta "del" (borrar)
    dst = safe_move(img_path, dirs.del_dir)
    # Escribe debug info
    # Log: [mesa X] preflop FAIL -> borrar: /path/img | reason
    return
```

**Tiempo aproximado**: 100-300ms

---

### FASE 7: EXTRACCIÓN DE MÓDULOS PREFLOP

```python
# Línea 322
mano_result, stacks_result = extract_modules_fn(preflop)
```

**¿Qué hace?**
- Extrae la mano (AK, QQ, etc.) del resultado preflop
- Extrae los stacks efectivos (en big blinds)

**Salida**:
```python
mano_result = {"hand_class": "AK", "hand_suit": "os"}
stacks_result = {"p1": 150.5, "p2": 200.0, "p3": 175.25}
```

**Tiempo aproximado**: 5-10ms

---

### FASE 8: INSERCIÓN EN TABLA SPOTS

```python
# Línea 330-351
spot_id = dbmod.insert_spot_capture_from_data(
    mesa=mesa,
    image_path=dest_capture_path,
    ts=ts,
    stacks_result=stacks_result,
    ocr=ocr,
    preflop=preflop,
    mano_result=mano_result,
    time_sec=time_sec,
    spot_fingerprint=spot_fingerprint,
)
```

**¿Qué hace?**
- Guarda un registro en la tabla SQLite `spots` con toda la información:
  - Número de mesa, timestamp, cartas, stacks, bets, posiciones, OCR, preflop

**Tabla SQLite: `spots`**
```sql
CREATE TABLE spots (
  id INTEGER PRIMARY KEY,
  mesa INTEGER,
  image_path TEXT,
  ts TEXT,  -- timestamp
  mano_result JSON,  -- {"hand_class": "AK", ...}
  stacks_result JSON,  -- {"p1": 150.5, ...}
  ocr JSON,  -- toda la info de OCR
  preflop JSON,  -- resultado preflop
  spot_fingerprint TEXT,  -- hash para dedup
  time_sec REAL  -- tiempo de procesamiento
)
```

**Tiempo aproximado**: 20-50ms

---

### FASE 9: CÁLCULO DE ESTRATEGIA

```python
# Línea 357
strategy, err = compute_strategy_safe_fn(preflop, mano_result, ocr)
strategy = force_ok_on_default_fold(strategy)
```

**¿Qué hace?**
- Busca la mano (AK, QQ, etc.) y stacks en las hojas de estrategia guardadas
- Si encontró una estrategia → retorna: `{"ok": True, "move": "Raise", "betmin": 2.5, "betmax": 4.0}`
- Si no encontró → retorna: `{"ok": False}` o default "Fold"

**Salida Strategy**:
```json
{
  "ok": true,
  "move": "Raise",
  "betmin": 2.5,
  "betmax": 4.0,
  "sheet": "Hoja1",
  "situacion": "BTN_vs_SB",
  "se_used": 100.0
}
```

**Tiempo aproximado**: 10-50ms

---

### FASE 10: ACTUALIZACIÓN DE DECISIÓN

```python
# Línea 363-374
if spot_id and isinstance(strategy, dict) and has_strategy_move(strategy):
    update_spot_decision(
        spot_id=int(spot_id),
        move=str(strategy.get("move") or ""),
        betmin=strategy.get("betmin", None),
        betmax=strategy.get("betmax", None),
    )
```

**¿Qué hace?**
- Si hay estrategia válida → actualiza la tabla `spots` con la decisión recomendada
- Guarda: move (Fold/Check/Raise), betmin, betmax

**Tiempo aproximado**: 5-10ms

---

### FASE 11: LINKEO A ESTRATEGIA (SPOTS_STRATEGIES)

```python
# Línea 376-430
if spot_id and isinstance(strategy, dict):
    # Busca la estrategia en tabla spots_strategies
    # Verifica que la mano esté dentro del rango definido
    # Si match → guarda strategy_id en spots
```

**¿Qué hace?**
- Vincula el spot encontrado con la fila específica de `spots_strategies`
- Verifica que:
  - La mano está en el rango definido (ej: "AA-TT, AK, AQ")
  - Los stacks coinciden
  - La posición coincide

**Tiempo aproximado**: 20-100ms

---

### FASE 12: PERSISTENCIA EN TABLA HANDS_OBS

```python
# Línea 434-448
obs_id = persist_preflop_obs(
    dbmod=dbmod,
    preflop=preflop,
    image_fp=image_fp,
    img_path=img_path,
    mesa=mesa,
    ocr=ocr,
    mano_result=mano_result,
    stacks_result=stacks_result,
    strategy=strategy,
    tempo_s=round(time.perf_counter() - tick_t0, 3),
)
```

**¿Qué hace?**
- Guarda un registro completo en la tabla `hands_obs`
- Incluye TODO: OCR, preflop, estrategia, timing

**Tabla SQLite: `hands_obs`**
```sql
CREATE TABLE hands_obs (
  id INTEGER PRIMARY KEY,
  mesa INTEGER,
  ts TEXT,
  fingerprint TEXT,
  ocr_json TEXT,  -- JSON completo de OCR
  preflop_json TEXT,  -- JSON de preflop
  strategy_json TEXT,  -- JSON de estrategia
  timing_ms REAL,  -- tiempo total del tick
  image_path TEXT
)
```

**Tiempo aproximado**: 20-50ms

---

## Diagrama de Flujo de 1 Tick

```
TICK COMIENZA (cada 3000ms)
        ↓
1. CAPTURA PANTALLA (50-100ms)
   └─ screenshot región mesa
        ↓
2. TIME GATE (50-200ms)
   └─ extrae reloj, valida que sea tiempo válido
   └─ SI FALLA → RETURN (skip)
        ↓
3. DEDUP FRAME (10ms)
   └─ compara con último frame de esa mesa
   └─ SI IGUAL → RETURN (skip)
        ↓
4. DEDUP CAPTURA (5-20ms)
   └─ busca en DB si hace poco procesamos igual
   └─ SI EXISTE → RETURN (skip)
        ↓
5. OCR (200-500ms)
   ├─ names.py → nombres jugadores
   ├─ stacks.py → stacks BB
   ├─ bets.py → bets/raises
   ├─ dealer.py → posición dealer
   ├─ gamecode.py → sala
   └─ posiciones.py → posición héroe
        ↓
6. PREFLOP PIPELINE (100-300ms)
   ├─ mano.py → cartas héroe
   ├─ time.py → validar preflop
   └─ board_state.py → validar sin board
   └─ SI FALLA → MOVE IMAGEN A "DEL" → RETURN
        ↓
7. EXTRACT MÓDULOS (5-10ms)
   └─ extrae mano y stacks del preflop
        ↓
8. INSERT SPOTS (20-50ms)
   └─ guarda en tabla `spots`
        ↓
9. COMPUTE STRATEGY (10-50ms)
   └─ busca mano en hojas de estrategia
        ↓
10. UPDATE DECISION (5-10ms)
    └─ guarda move + bet range en spots
        ↓
11. LINK SPOTS_STRATEGIES (20-100ms)
    └─ vincula spot con fila de estrategia
        ↓
12. PERSIST HANDS_OBS (20-50ms)
    └─ guarda todo en tabla `hands_obs`
        ↓
13. PUBLICAR EVENT TAURI (< 1ms)
    └─ frontend recibe notificación de nuevo spot
        ↓
TICK TERMINA (tiempo total: 500-1500ms)
        ↓
ESPERA 3000ms - (tiempo usado) = proximal al próximo tick
```

---

## Manejo de Errores en Cada Fase

| Fase | Error | Acción |
|------|-------|--------|
| Captura | excepción | Log error, RETURN |
| Time Gate | time_ok=false | Descarta, RETURN |
| Dedup Frame | frame igual | RETURN sin procesar |
| Dedup Captura | existe en DB | RETURN sin procesar |
| OCR | excepción en módulo | Continúa con otros módulos, guarda errores |
| Preflop | falla validación | Mueve imagen a "del", RETURN |
| Extract | excepción | Log, continúa |
| Insert Spots | excepción DB | Log, continúa |
| Compute Strategy | excepción | Retorna `{"ok": False}` |
| Insert Hands_OBS | excepción DB | Log, continúa |

---

## Estados de una Captura

Una captura pasa por estos estados en la DB:

```
1. "captured"
   └─ Acaba de capturarse, antes de OCR

2. "ok"
   └─ Pasó todas las validaciones

3. "borrar"
   └─ Falló preflop, se descarta

4. "duplicate"
   └─ Era un frame/captura duplicado
```

---

## Performance y Optimizaciones

### Secuencial vs Paralelo

```
POKER_BOSS_WORKER_SEQUENTIAL=1 (default - RECOMENDADO)
  ├─ OCR y Preflop se ejecutan secuencialmente
  ├─ Wall-time: 500-1500ms por tick
  └─ Razón: Python GIL hace threads lentos para CPU-bound

POKER_BOSS_WORKER_SEQUENTIAL=0 (paralelo)
  ├─ OCR y Preflop en paralelo con ThreadPoolExecutor
  ├─ Wall-time: 600-1800ms por tick
  └─ Más lento porque GIL serializa threads anyway
```

### Ventanas de Deduplicación

```
Frame Dedup (en memoria):
  └─ Última captura de cada mesa
  └─ Casi gratis (10ms)

Captura Dedup (en DB):
  └─ Últimas 15 segundos (configurable)
  └─ Costo: 5-20ms
  └─ Evita procesar duplicados si hay lag/pausa
```

---

## Persistencia y Tablas

### Flujo de Persistencia

```
worker_mesa.py
  ├─ Captura → imagen temporal
  ├─ OCR → `worker_capture` table (con fingerprint)
  ├─ Preflop valid?
  │  ├─ YES → copia imagen a CAPTURES_IMG_DIR
  │  └─ NO → mueve imagen a "del" directory
  ├─ Insert `spots` (tabla con spot_id)
  ├─ Compute strategy
  ├─ Update `spots` con decision
  ├─ Link `spots_strategies`
  └─ Insert `hands_obs` (tabla con obs_id)
```

### Tablas Involucradas

| Tabla | Propósito | Campos clave |
|-------|-----------|--------------|
| `worker_capture` | Tracking de capturas | capture_id, fingerprint, status |
| `spots` | Spots preflop detectados | spot_id, mesa, OCR, preflop, strategy |
| `hands_obs` | Observaciones completas | obs_id, spots_id, OCR JSON, strategy JSON |
| `spots_strategies` | Hojas de estrategia | strategy_id, hand_range, move, bet_range |

---

## Límites y Constraints

| Limit | Valor | Notas |
|-------|-------|-------|
| Núm. de workers | 4 | Configurable pero hardcoded en UI |
| Intervalo tick | 3000ms | Configurable |
| Ventana dedup | 15000ms | Configurable con env var |
| OCR timeout | Sin timeout explícito | Puede colgarse si OCR se cuelga |
| Preflop timeout | Sin timeout explícito | Idem |

---

## Limitaciones Conocidas

1. **Subprocess Preflop**: Preflop pipeline llama subprocesses externos
   - Causa: ~100-500ms latencia adicional
   - Roadmap: Refactorizar a imports directos

2. **GIL Python**: OCR paralelo es más lento que secuencial
   - Causa: Python GIL serializa threads
   - Solución: Usar WORKER_SEQUENTIAL=1 (default)

3. **No hay timeout visible**: Si OCR/preflop se cuelga
   - Worker esperará indefinidamente
   - Backend debería tener timeout y recuperarse

4. **Fingerprint simple**: Usa SHA1 de imagen + tiempo
   - No es content-aware
   - Puede colisionar si imágenes idénticas pero distinto tiempo

5. **DB lock global**: `_db_lock` serializa todas las escrituras
   - Con 4 workers en paralelo, hay contención
   - Roadmap: Optimizar con read-write locks

---

## Ejemplo: Procesamiento de 1 Spot Real

```
TICK 1 @ 15:30:45
  1. Captura mesa 1 → 100x100.bmp (15KB)
  2. Time gate OK (reloj visible)
  3. Frame check OK (diferente al anterior)
  4. Captura check OK (no en últimos 15s)
  5. OCR extrae:
     ├─ names: {p1: "Hero", p2: "Villain1", p3: "Villain2"}
     ├─ stacks: {p1: 150, p2: 200, p3: 175}
     ├─ bets: {p1_bet: 0, p2_bet: 10}
     ├─ dealer: 2
     └─ position: BTN (p1 is BTN)
  6. Preflop valida:
     ├─ mano: AK offsuit ✓
     ├─ time: preflop ✓
     └─ board: empty ✓
  7. Insert spots → spot_id=12345
  8. Compute strategy:
     ├─ Busca: AK @ BTN vs SB 150BB
     └─ Encuentra: Raise 2.5-4.0
  9. Update spots decision → move="Raise", betmin=2.5, betmax=4.0
  10. Link spots_strategies → strategy_id=987
  11. Insert hands_obs → obs_id=54321
  12. Publish Tauri event → Frontend recibe notificación

  TIMING:
    Capture: 95ms
    Time gate: 120ms
    OCR: 350ms
    Preflop: 200ms
    Strategy: 30ms
    DB ops: 100ms
    ────────────
    TOTAL: 895ms

  Próximo tick en: 3000 - 895 = 2105ms
```

---

## Variables de Ambiente

```bash
# Ventana de deduplicación (ms)
POKER_BOSS_CAPTURE_DEDUPE_WINDOW_MS=15000

# Modo OCR (1=secuencial, 0=paralelo)
POKER_BOSS_WORKER_SEQUENTIAL=1

# OCR paralelo independiente del worker mode
POKER_BOSS_OCR_SEQUENTIAL=1

# Profiling de timings
POKER_BOSS_WORKER_PROFILE=0

# Database path
POKER_BOSS_DB_PATH=/path/to/poker_boss.db
```

