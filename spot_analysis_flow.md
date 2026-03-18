# Flujo Completo: De Imagen a Estrategia

## Objetivo Final
Cuando el worker procesa una imagen:
1. Extrae OCR (nombres, stacks, bets, dealer, posición)
2. Valida preflop (cartas, tiempo, sin board)
3. Busca en `spots_strategies` una estrategia que coincida
4. Si encuentra → retorna move + betmin/betmax
5. Si NO encuentra → **asigna FOLD como default**

---

## Flujo Paso a Paso (Basado en worker_mesa.py)

### ENTRADA: Imagen Real de Poker

```
Screenshot de mesa en vivo:
  ├─ 4-6 jugadores visibles
  ├─ Nombres en cada posición
  ├─ Stacks en big blinds (100, 150, 200, etc.)
  ├─ Bets actuales (cero preflop, o antes de decisión)
  ├─ Botón dealer visible
  ├─ Reloj/tiempo visible
  └─ Cartas del héroe visibles (AK, QQ, 72, etc.)
```

---

## FASE 1: OCR (Línea 223 o 208)

```python
ocr = run_ocr(img_path)  # Ejecuta 6 módulos en paralelo/secuencial
```

**Módulos OCR ejecutados**:

### 1A: `names.py` - Extrae Nombres
```python
# Busca en cada posición: 1, 2, 3, 4, 5, 6
# Reconoce caracteres de nombre

ocr["names"] = {
    "p1": "Hero",      # Mi nombre en la UI
    "p2": "Villain1",  # Jugador 2
    "p3": "Villain2",  # Jugador 3
    "p4": None,        # Posición vacía
    "p5": "Villain3",  # Jugador 5
    "p6": None         # Posición vacía
}
```

### 1B: `stacks.py` - Extrae Stacks (en BB)
```python
# Lee números al lado de cada nombre
# Convierte a big blinds (si BB=0.5, stack=50 → 100BB)

ocr["stacks"] = {
    "p1": 150.0,  # Mi stack = 150 big blinds
    "p2": 200.0,  # Villano 1 = 200 BB
    "p3": 175.5,  # Villano 2 = 175.5 BB
    "p4": None,
    "p5": 125.0,  # Villano 3 = 125 BB
    "p6": None
}
```

### 1C: `bets.py` - Extrae Bets/Raises
```python
# Lee apuestas actuales en el board
# Preflop: usualmente 0 antes de acción (o blinds posted)

ocr["bets"] = {
    "p1_bet": 0,      # Yo sin apostar aún
    "p2_bet": 1.0,    # Small blind (SB) apostó 1 (0.5 en BB=0.5)
    "p3_bet": 2.0,    # Big blind (BB) apostó 2
    "p4_bet": 0,
    "p5_bet": 0,
    "p6_bet": 0,
    "pot": 3.0        # Pot total
}
```

### 1D: `dealer.py` - Extrae Dealer
```python
# Busca botón dealer (círculo/D en la mesa)

ocr["dealer"] = {
    "dealer_seat": 1   # El dealer es p2 (botón está en p2)
}
```

### 1E: `gamecode.py` - Extrae Identificador Sala
```python
ocr["gamecode"] = {
    "game_id": "NLH_Table5",  # Identifica la sala/juego
    "buyin": "100/200"
}
```

### 1F: `posiciones.py` - Extrae Mi Posición
```python
# Determina: ¿Estoy en BTN, CO, HJ, LJ, UTG?
# Basado en dealer_seat y mi posición (p1)

ocr["posiciones"] = {
    "hero_pos": "CO",         # Cut-off (2 después del dealer)
    "sb_pos": "SB",           # Small blind
    "bb_pos": "BB",           # Big blind
    "all_positions": ["CO", "SB", "BB", "LJ", "UTG", "UTG+1"]
}
```

**Salida OCR Completa**:
```json
{
  "ok": true,
  "names": {"p1": "Hero", "p2": "Villain1", "p3": "Villain2", "p5": "Villain3"},
  "stacks": {"p1": 150.0, "p2": 200.0, "p3": 175.5, "p5": 125.0},
  "bets": {"p1_bet": 0, "p2_bet": 1.0, "p3_bet": 2.0, "pot": 3.0},
  "dealer": {"dealer_seat": 1},
  "gamecode": {"game_id": "NLH_Table5"},
  "posiciones": {"hero_pos": "CO"}
}
```

**Tiempo**: 200-500ms

---

## FASE 2: PREFLOP PIPELINE (Línea 245 o 209)

```python
preflop = _run_preflop_direct(img_path)  # Valida preflop
```

**Módulos Preflop**:

### 2A: `mano.py` - Extrae Cartas del Héroe
```python
# OCR sobre las 2 cartas del héroe (down cards)
# Reconoce: A, K, Q, J, T, 2-9
# Determina suit: ♠, ♥, ♦, ♣

preflop["modules"]["mano"] = {
    "mano_ok": true,
    "hand_class": "AK",        # Ace-King
    "hand_suit": "os",         # offsuit (diferentes palos)
    "card1": "A♠",
    "card2": "K♥",
    "valid": true
}

# Si OCR falla:
preflop["modules"]["mano"] = {
    "mano_ok": false,
    "valid": false,
    "error": "No cards detected"
}
```

### 2B: `time.py` - Valida que es PREFLOP
```python
# Verifica que NO hay community cards visibles
# Verifica que cartas del héroe son "hole cards" (down cards)

preflop["modules"]["time"] = {
    "time_ok": true,
    "street": "preflop",       # Preflop = sin community cards
    "board": [],               # Vacío preflop
    "valid": true
}

# Si hay community cards → falla:
preflop["modules"]["time"] = {
    "time_ok": false,
    "street": "flop",          # Es flop, no preflop
    "board": ["K♠", "Q♥", "5♦"],
    "valid": false
}
```

### 2C: `board_state.py` - Valida Stack Efectivo
```python
# Verifica que tenemos suficiente información de stacks
# Calcula stack efectivo (menor de los dos)

preflop["modules"]["board_state"] = {
    "noboard_ok": true,        # No hay community cards
    "stacks_valid": true,
    "effective_stack_bb": 125.0,  # Min de mis 150 vs villano 125
    "board": []
}
```

**Salida Preflop Completa**:
```json
{
  "modules": {
    "mano": {
      "mano_ok": true,
      "hand_class": "AK",
      "hand_suit": "os",
      "valid": true
    },
    "time": {
      "time_ok": true,
      "street": "preflop",
      "board": [],
      "valid": true
    },
    "board_state": {
      "noboard_ok": true,
      "stacks_valid": true,
      "effective_stack_bb": 125.0
    }
  }
}
```

**Validación de Preflop Válido** (worker_mesa.py línea 282):
```python
if preflop_fail(preflop):  # Si ALGUNO falla:
    # Mueve imagen a /borrar
    # NO continúa con estrategia
    return
```

**Preflop FALLA si**:
- `mano.mano_ok == False` (no detectó cartas)
- `time.time_ok == False` (no es preflop)
- `board_state.noboard_ok == False` (hay community cards)

**Tiempo**: 100-300ms

---

## FASE 3: EXTRACT MODULES (Línea 322)

```python
mano_result, stacks_result = extract_modules_fn(preflop)
```

**Extrae de preflop**:

```python
mano_result = {
    "hand_class": "AK",    # AK, QQ, 72o, etc.
    "hand_suit": "os"      # "os" = offsuit, "s" = suited
}

stacks_result = {
    "p1": 150.0,           # Mi stack en BB
    "p2": 200.0,
    "p3": 175.5,
    "p5": 125.0            # Stack efectivo = 125.0
}
```

**Tiempo**: 5-10ms

---

## FASE 4: COMPUTE STRATEGY (Línea 357)

```python
strategy, err = compute_strategy_safe_fn(preflop, mano_result, ocr)
```

**¿Qué hace `compute_strategy_safe_fn`?**

Esta función es **el CORAZÓN del matching de estrategia**. Busca en la tabla `spots_strategies`:

### 4A: Determinar Situación
```python
# Extrae de OCR:
hero_pos = ocr["posiciones"]["hero_pos"]  # "CO"
effective_stack = stacks_result["p1"]     # 125.0 BB

# Construye KEY de búsqueda:
situacion = "CO_vs_SB_BB"  # "POSICIÓN_vs_PRIMEROS_OPONENTES"
hand_class = mano_result["hand_class"]    # "AK"

# Lo que estamos buscando:
# ├─ hand_class EN [AA-TT, AK, AQ, ...] (rango de mano)
# ├─ posición == CO
# ├─ stack >= 100 Y stack <= 200 (rango de stacks)
# └─ opositores == SB, BB
```

### 4B: Query a spots_strategies
```sql
SELECT * FROM spots_strategies
WHERE
  hand_min <= 'AK' <= hand_max          -- Rango de manos
  AND position = 'CO'                   -- Mi posición
  AND stack_min <= 125.0 <= stack_max   -- Rango de stacks
  AND vs_positions LIKE '%SB%BB%'       -- Opositores
  LIMIT 1
```

**Ejemplo de fila que podría retornar**:
```
spots_strategies:
  id: 42
  hand_range: "AA-TT, AK, AQ, AJ, AT, KQ, KJ"
  position: "CO"
  stack_min: 100
  stack_max: 200
  vs_positions: "SB, BB"

sub_strategies:
  action: "Raise"
  betmin: 2.5
  betmax: 4.0
  notes: "3bet vs SB+BB"
```

### 4C: Retorna Strategy
```python
strategy = {
    "ok": true,
    "move": "Raise",          # Acción recomendada
    "betmin": 2.5,            # Apuesta mínima (en BB)
    "betmax": 4.0,            # Apuesta máxima (en BB)
    "sheet": "Hoja1",         # Nombre de la hoja
    "situacion": "CO_vs_SB_BB",
    "se_used": 125.0,         # Stack efectivo usado
    "spot_strategy_id": 42    # ID de la estrategia encontrada
}
```

### 4D: Si NO Encuentra Estrategia
```python
strategy = {
    "ok": false,
    "move": None,
    "error": "No matching strategy for AK @ CO with 125BB vs SB+BB"
}
```

**Luego viene la corrección** (línea 358):
```python
strategy = force_ok_on_default_fold(strategy)
```

¿QUÉ HACE?
```python
def force_ok_on_default_fold(strategy):
    if not isinstance(strategy, dict):
        return {"ok": True, "move": "FOLD"}

    if strategy.get("ok") != True:
        # Si no encontró estrategia, asigna FOLD
        return {
            "ok": True,
            "move": "FOLD",
            "reason": "No matching strategy found - default to FOLD"
        }

    return strategy
```

**Entonces**:
- Si encuentra estrategia → usa esa (Raise, Call, etc.)
- Si NO encuentra → **asigna FOLD automáticamente**

**Tiempo**: 10-50ms

---

## FASE 5: UPDATE SPOT DECISION (Línea 367)

```python
update_spot_decision(
    spot_id=int(spot_id),
    move=str(strategy.get("move") or ""),      # "Raise" o "FOLD"
    betmin=strategy.get("betmin", None),       # 2.5 o None
    betmax=strategy.get("betmax", None),       # 4.0 o None
)
```

**Guarda en tabla `spots`**:
```sql
UPDATE spots
SET
  move = 'Raise',
  betmin = 2.5,
  betmax = 4.0
WHERE id = {spot_id}
```

**Tiempo**: 5-10ms

---

## FASE 6: PERSIST HANDS_OBS (Línea 434)

```python
obs_id = persist_preflop_obs(
    dbmod=dbmod,
    preflop=preflop,           # Toda info de preflop
    image_fp=image_fp,         # Fingerprint de imagen
    img_path=img_path,         # Path a imagen guardada
    mesa=mesa,                 # Mesa número
    ocr=ocr,                   # TODO OCR completo
    mano_result=mano_result,   # {hand_class: AK, hand_suit: os}
    stacks_result=stacks_result,  # {p1: 150, p2: 200, ...}
    strategy=strategy,         # {move: Raise, betmin: 2.5, betmax: 4.0}
    tempo_s=round(time.perf_counter() - tick_t0, 3),
)
```

**Inserta en `hands_obs`**:
```sql
INSERT INTO hands_obs (
  mesa, ts, ocr_json, preflop_json, mano_class, stacks_json,
  strategy_json, move, betmin, betmax, tempo_s, image_path
)
VALUES (
  1, "2026-01-27 07:32:43", '{"ok": true, "names": {...}}',
  '{"modules": {...}}', 'AK', '{"p1": 150, "p2": 200, ...}',
  '{"ok": true, "move": "Raise", "betmin": 2.5, "betmax": 4.0}',
  'Raise', 2.5, 4.0, 0.895, '/path/to/img.bmp'
)
```

**Tiempo**: 20-50ms

---

## FASE 7: MOVE IMAGE (Línea 542 o 569)

```python
if has_strategy_move(strategy):  # ¿Tiene move + betmin + betmax?
    dst = safe_move(img_path, dirs.ok_dir)
    # Mueve a /ok
else:
    dst = safe_move(img_path, dirs.err_dir)
    # Mueve a /errors
```

**Lógica**:
```python
def has_strategy_move(strategy):
    if not isinstance(strategy, dict):
        return False
    if strategy.get("ok") is not True:
        return False

    move = strategy.get("move")
    betmin = strategy.get("betmin")
    betmax = strategy.get("betmax")

    # Todos deben existir
    return bool(move) and betmin is not None and betmax is not None
```

**Resultado**:
- Si move="Raise", betmin=2.5, betmax=4.0 → **ok/**
- Si move="FOLD", betmin=None, betmax=None → **errors/**

---

## Diagrama Completo

```
IMAGEN REAL
     ↓
[FASE 1] OCR (200-500ms)
├─ names → {p1: Hero, p2: Villain1, ...}
├─ stacks → {p1: 150, p2: 200, ...}
├─ bets → {p1_bet: 0, p2_bet: 1, ...}
├─ dealer → {dealer_seat: 1}
├─ gamecode → {game_id: "NLH_Table5"}
└─ posiciones → {hero_pos: "CO"}
     ↓
[FASE 2] PREFLOP (100-300ms)
├─ mano.py → {hand_class: AK, hand_suit: os}
├─ time.py → {street: preflop, board: []}
└─ board_state.py → {stacks_valid: true}
     ↓ SI FALLA → MOVE A /borrar → FIN
     ↓
[FASE 3] EXTRACT (5-10ms)
├─ mano_result = {hand_class: AK}
└─ stacks_result = {p1: 150, p2: 200, ...}
     ↓
[FASE 4] COMPUTE STRATEGY (10-50ms)
├─ Query spots_strategies
│  ├─ hand_class "AK" EN rango
│  ├─ position "CO"
│  └─ stacks 125BB EN rango
├─ SI ENCUENTRA → move="Raise", betmin=2.5, betmax=4.0
└─ SI NO ENCUENTRA → move="FOLD" (force_ok_on_default_fold)
     ↓
[FASE 5] UPDATE SPOT (5-10ms)
└─ Guarda move + bets en tabla spots
     ↓
[FASE 6] PERSIST (20-50ms)
└─ Inserta en hands_obs con TODO
     ↓
[FASE 7] MOVE IMAGE (1-5ms)
├─ has_strategy_move(strategy)?
├─ YES (move + betmin + betmax) → /ok
└─ NO (FOLD o error) → /errors
     ↓
RESULTADO: Imagen en /ok/ o /errors/
            move="Raise" o "FOLD"
            betmin, betmax guardados
```

---

## Cómo Verificar que Funciona

### 1. Imagen en `/ok/` con Estrategia
```
archivo: screenshot_20260127073243035.bmp en /ok/
```

Significa:
- ✅ OCR exitoso
- ✅ Preflop válido
- ✅ Encontró estrategia o asignó FOLD con move+bets

### 2. Imagen en `/errors/` sin Estrategia
```
archivo: screenshot_XXXXXXXX.bmp en /errors/
```

Significa:
- ✅ OCR exitoso
- ✅ Preflop válido
- ❌ NO encontró estrategia Y NO tiene move+bets (error)

### 3. Imagen en `/borrar/`
```
archivo: screenshot_XXXXXXXX.bmp en /borrar/
```

Significa:
- ❌ OCR falló (sin cartas, nombres ilegibles)
- ❌ Preflop falló (no es preflop, hay board, cartas no visibles)

---

## Debugging: Cómo Saber Qué Falló

**Chequea tabla `hands_obs`**:
```sql
SELECT
  id, mesa, mano_class, move, betmin, betmax,
  ocr_json, preflop_json, strategy_json
FROM hands_obs
WHERE mesa = 1
ORDER BY id DESC
LIMIT 5
```

**Si `mano_class` es NULL**:
- OCR falló en cartas

**Si `move` es NULL pero `mano_class` es OK**:
- Preflop falló o estrategia no encontrada

**Si `move` es "FOLD"**:
- No encontró en spots_strategies → default FOLD

**Si `move` es "Raise", "Call", etc.**:
- ✅ Encontró en spots_strategies
- ✅ Retorna move + betmin + betmax

---

## Resumen: Flujo Exitoso

```
Imagen → OCR (nombres, stacks, cartas) → Preflop (válido)
  → Query spots_strategies (por mano + posición + stacks)
    → SI ENCUENTRA → move + betmin/betmax
    → SI NO ENCUENTRA → move="FOLD" (default)
      → INSERT en hands_obs
        → MOVE imagen a /ok/ (tiene move+bets)
```

**Result**: `move`, `betmin`, `betmax` listos para mostrar al jugador.
