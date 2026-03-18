# Funcionalidades - Run Workers

## Overview
Cuando el usuario pulsa el botón **"Run workers (loop, 4 instances)"** o **"Stop workers"** en la vista Hands (modo REAL), se dispara un flujo completo de orquestación de workers paralelos de OCR.

---

## Flujo Completo

### 1. UI Trigger (HandsPage.tsx:115-117)
```tsx
<button disabled={!hp.canLoad} onClick={handleToggleWorkers}>
  {hp.workersRunning ? "Stop workers" : "Run workers (loop, 4 instances)"}
</button>
```

**Ubicación**: `src/pages/HandsPage.tsx:115-117`
**Estado**: El botón se muestra SOLO en modo REAL (`hp.mode === "REAL"`)
**Habilitado**: Solo si `hp.canLoad` es true (base de datos lista)
**Etiqueta**:
- "Run workers (loop, 4 instances)" - cuando workers están parados
- "Stop workers" - cuando workers están corriendo

---

### 2. Handler Principal (HandsPage.tsx:37-55)
```tsx
const handleToggleWorkers = async () => {
  const shouldStart = !hp.workersRunning;

  // Llama a la acción de toggle
  await Promise.resolve(hp.onToggleWorkers());

  // Intenta mostrar/ocultar overlay si Tauri está disponible
  if (!canUseTauriInvoke()) {
    return;
  }

  try {
    if (shouldStart) {
      await invoke("show_overlay");  // Mostrar ventanas overlay en las 4 mesas
    } else {
      await invoke("hide_overlay");  // Ocultar ventanas overlay
    }
  } catch (e) {
    console.error("overlay toggle failed", e);
  }
};
```

**Lo que hace**:
1. Determina si se va a INICIAR o PARAR basándose en el estado actual (`workersRunning`)
2. Llama a `hp.onToggleWorkers()` (definido en useHandsPageActions)
3. Si es inicio: Invoca comando Tauri `show_overlay` para mostrar ventanas en tiempo real
4. Si es parada: Invoca comando Tauri `hide_overlay` para ocultar ventanas

---

### 3. Acción de Toggle (useHandsPageWorkerActions.ts:89-132)
```tsx
const onToggleWorkers = async () => {
  const p = safeDbPath;
  const outDir = buildWorkersOutDir();
  const next = !workersRunning;

  setBusy(true);
  setActionStatus("workers: toggling...");
  setLastLog("");

  try {
    // Intenta mostrar/ocultar overlay (redundante, ya se hace arriba)
    if (next) {
      await invoke("show_overlay").catch(e => console.warn("show_overlay failed:", e));
    } else {
      await invoke("hide_overlay").catch(e => console.warn("hide_overlay failed:", e));
    }

    // Envía comando al backend (Rust/Tauri)
    const msg = await setWorkersRunningCommand({
      running: next,
      dbPath: p,
      outDir: "C:\\path\\to\\workers_out",
      intervalMs: 3000,
      xmlDir: "C:\\Champion_Poker_XML",
      hero: "your_hero_name",
    });

    // Actualiza UI con respuesta
    const m = String(msg || "");
    setLastLog(m);
    setActionStatus("workers: " + (summarize(m) || "ok"));
    setWorkersRunning(next);  // Actualiza estado local
  } catch (e: unknown) {
    const m = "ERROR: " + getErrorMessage(e);
    setLastLog(m);
    setActionStatus("workers: " + summarize(m));
    // Oculta overlay en caso de error
    try {
      await invoke("hide_overlay");
    } catch {
      // ignore
    }
  } finally {
    setBusy(false);
  }
};
```

**Ubicación**: `src/pages/hands/useHandsPageWorkerActions.ts:89-132`
**Lo que hace**:
1. Calcula el siguiente estado (`next = !workersRunning`)
2. Marca UI como ocupada (`setBusy(true)`)
3. Intenta mostrar/ocultar overlay (redundante con el handler anterior)
4. **LLAMA AL BACKEND**: `setWorkersRunningCommand()` con parámetros
5. Actualiza estado local `setWorkersRunning(next)`
6. Guarda mensaje de respuesta en UI para mostrar al usuario
7. En caso de error: Oculta overlay y muestra mensaje de error

---

### 4. Comando al Backend (workersClient.ts:19-35)
```tsx
export const setWorkersRunningCommand = async (args: {
  running: boolean;
  dbPath: string;
  outDir: string;
  intervalMs: number;
  xmlDir?: string;
  hero?: string;
}): Promise<string> => {
  return invoke<string>("set_workers_running", {
    running: args.running,
    dbPath: args.dbPath,
    outDir: args.outDir,
    intervalMs: args.intervalMs,
    xmlDir: args.xmlDir ?? "",
    hero: args.hero ?? "",
  });
};
```

**Ubicación**: `src/pages/hands/workersClient.ts:19-35`
**Invoca comando Tauri**: `"set_workers_running"`
**Parámetros enviados**:
- `running` (bool): true para iniciar, false para parar
- `dbPath` (string): Ruta a base de datos SQLite (poker_boss.db)
- `outDir` (string): Directorio de salida para screenshots/logs de workers
- `intervalMs` (number): Intervalo de tick en ms (3000 por defecto)
- `xmlDir` (string): Directorio de archivos XML importados (Champion Poker format)
- `hero` (string): Nombre del héroe para el análisis

---

## Estados en Tiempo Real

### Variables de Estado
- `workersRunning` (bool) - Almacenado en `useWorkersPolling()` con polling cada 500ms
- `busy` (bool) - Indica que hay operación en progreso
- `actionStatus` (string) - Mensaje de estado mostrado en UI
- `lastLog` (string) - Log de respuesta del backend

### UI Feedback
Mientras está en progreso:
```
actionStatus = "workers: toggling..."
busy = true
```

Después de completarse:
```
actionStatus = "workers: ok" (o error si falla)
lastLog = <mensaje de respuesta del backend>
busy = false
workersRunning = true/false (actualizado después del siguiente poll)
```

---

## Backend Workflow (Rust/Tauri)

El comando `set_workers_running` en Rust:

1. **Si `running=true` (INICIAR)**:
   - Lanza 4 instancias del worker Python en paralelo
   - Cada worker captura una mesa diferente
   - Cada worker ejecuta tick loop cada 3000ms:
     - Captura screenshot de la mesa
     - Ejecuta OCR (nombres, stacks, bets, dealer, posición)
     - Ejecuta preflop pipeline (detección de mano, validación de tiempo)
     - Persiste en tabla `hands_obs` de SQLite
   - Publica eventos a frontend vía Tauri IPC

2. **Si `running=false` (PARAR)**:
   - Envía señal de parada a todos los workers
   - Espera a que terminen gracefully (o timeout)
   - Limpia recursos
   - Oculta ventanas overlay

---

## Overlay Windows

### `show_overlay`
- Abre 4 ventanas transparentes (una por mesa)
- Se posicionan en las coordenadas de cada mesa
- Muestran información en tiempo real:
  - Nombre de la mano (mano, flop, etc.)
  - Stack del héroe
  - Posición
  - Información de betting
- Se actualizan cada tick (3000ms)

### `hide_overlay`
- Cierra todas las ventanas overlay
- Se ejecuta al parar workers o si hay error

---

## Validaciones y Precondiciones

| Precondición | Condición | Impacto |
|--------------|-----------|--------|
| `hp.canLoad` | DB lista y accesible | Botón deshabilitado si false |
| `hp.mode === "REAL"` | Modo es REAL, no OBS | Botón no visible si OBS |
| `!hp.busy` | No hay otra operación en progreso | UI muestra "toggling..." |
| Tauri disponible | `canUseTauriInvoke()` returns true | Sin overlay si no está disponible |

---

## Manejo de Errores

| Error | Causa | Manejo |
|-------|-------|--------|
| `show_overlay` falla | Ventana ya abierta o problema Tauri | Log warning, continúa |
| `hide_overlay` falla | Ventana ya cerrada | Log warning, ignora |
| `set_workers_running` falla | Backend error, invalid params | Mostrar error en UI, ocultar overlay |
| DB corrupta/inaccesible | SQLite locks | `canLoad=false`, botón deshabilitado |

---

## Polling en Tiempo Real

Mientras `workersRunning=true`, un polling cada 500ms:

1. Invoca `get_workers_status` al backend
2. Backend retorna estado actual (running/stopped/error)
3. Frontend actualiza `workersRunning` basándose en respuesta
4. Polling se detiene cuando `workersRunning=false`

**Ubicación del polling**: `src/pages/hands/useWorkersPolling.ts`

---

## Diagrama de Flujo

```
User clicks "Run workers"
        ↓
handleToggleWorkers() (HandsPage.tsx:37-55)
        ├─→ invoke("show_overlay") — mostrar ventanas
        └─→ await hp.onToggleWorkers()
                ↓
        onToggleWorkers() (useHandsPageWorkerActions.ts:89-132)
                ├─→ setBusy(true)
                ├─→ invoke("show_overlay") [redundante]
                └─→ setWorkersRunningCommand()
                        ↓
                invoke("set_workers_running") [Tauri→Rust]
                        ↓
                [Rust Backend]
                ├─→ Spawn 4 worker instances
                ├─→ Each worker: capture→OCR→preflop→persist
                └─→ Return success message
                        ↓
                setWorkersRunning(true)
                setLastLog(response)
                setBusy(false)
                        ↓
        [Polling cada 500ms]
        get_workers_status() — verificar estado
                        ↓
        UI actualiza: workersRunning status
                        ↓
User clicks "Stop workers"
        ↓
[Mismo flujo pero con running=false]
```

---

## Archivos Involucrados

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/pages/HandsPage.tsx` | Renderiza botón, maneja overlay toggle |
| `src/pages/hands/useHandsPage.ts` | State management principal, orquesta loaders |
| `src/pages/hands/useHandsPageActions.ts` | Agrupa acciones de data y workers |
| `src/pages/hands/useHandsPageWorkerActions.ts` | Lógica de toggle, llamadas a backend |
| `src/pages/hands/workersClient.ts` | Wrappers de comandos Tauri (`set_workers_running`, `get_workers_status`) |
| `src/pages/hands/useWorkersPolling.ts` | Polling cada 500ms para estado |

---

## Notas y Limitaciones

1. **Overlay Redundancia**: `show_overlay`/`hide_overlay` se invocan en 2 lugares (HandsPage y useHandsPageWorkerActions). Considerar consolidar.

2. **Polling mientras está "toggling"**: Si el usuario hace click rápido, el polling puede reportar estado inconsistente. El `busy` flag previene clicks múltiples.

3. **Preflop Pipeline**: Usa subprocess calls, agrega ~100-500ms latencia por observation. En roadmap: refactorizar a imports directos.

4. **4 Instancias Hardcoded**: El número de workers (4) está hardcodeado en varios lugares. Considerar hacer configurable.

5. **No hay timeout visible**: Si workers se cuelgan, UI esperará indefinidamente. Backend debería tener timeout y reportar.

