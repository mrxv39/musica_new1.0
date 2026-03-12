# POKER BOSS — RESUMEN TECNICO DEL SISTEMA
Fecha: 2026-03-10
Generado para continuar desarrollo en otro chat

---------------------------------------------------------------------

# 1. ESTADO ACTUAL DEL REPOSITORIO

Branch actual:
feat/worker-real-mode

Commit intentado:
feat(worker): detect board state and skip preflop pipeline when flop is visible

Resultado:

Frontend tests: OK
Frontend coverage: OK
Backend tests: FAIL

Error exacto:

FAILED tests/test_preflop.py::TestPreflop::test_shape_and_flags

Motivo del error:

El test esperaba:

modules["noboard"]

Pero ahora el pipeline devuelve:

modules["board_state"]

Esto indica que el contrato del test está desactualizado.


---------------------------------------------------------------------

# 2. CAMBIOS IMPLEMENTADOS EN ESTE BLOQUE

## Nuevo módulo

modules/preflop/board_state.py


Responsabilidad confirmada:

Detectar estado de la mesa:

preflop
postflop
unknown


Salida observada en runtime:

{
  "street_state": "preflop | postflop",
  "valid_count": int,
  "cards": [...],
  "score_min": float,
  "fingerprint": string
}


Confirmado por ejecución manual:
flop.png fue detectado correctamente como postflop.


---------------------------------------------------------------------

# 3. CAMBIOS EN EL WORKER

Archivo:

modules/preflop/workers_loop/worker_mesa.py


Optimización confirmada:

Skip temprano si el frame no cambia.


Implementación observada:

cache por mesa:

_LAST_CAPTURE_FP_BY_MESA


Flujo:

captura frame
↓
calcula fingerprint
↓
si fingerprint == anterior
↓
UNCHANGED_FRAME -> skip


Resultado confirmado en logs:

[mesa X] UNCHANGED_FRAME -> skip


Esto evita:

OCR innecesario
persistencias repetidas
uso excesivo de CPU


---------------------------------------------------------------------

# 4. CAMBIO EN EL PIPELINE PREFLOP

Archivo:

modules/preflop/preflop.py


Cambio confirmado:

Antes:

modules = {
    mano,
    time,
    noboard
}


Ahora:

modules = {
    mano,
    time,
    board_state
}


Esto rompe el test backend que esperaba noboard.


---------------------------------------------------------------------

# 5. ARQUITECTURA GENERAL DEL SISTEMA (SOLO LO CONFIRMADO)

---------------------------------------------------------------------

## Backend Python

Directorios confirmados:

modules/

modules/ocr
modules/preflop
modules/preflop/workers_loop
modules/db


---------------------------------------------------------------------

## OCR

Archivo confirmado:

modules/ocr/ocr.py


Uso confirmado:

worker_mesa.py llama a:

run_ocr(img_path)


---------------------------------------------------------------------

## Pipeline preflop

Archivos confirmados:

modules/preflop/preflop.py
modules/preflop/mano.py
modules/preflop/time.py
modules/preflop/board_state.py


Salida confirmada del pipeline:

{
  preflop_ok,
  fingerprint,
  modules,
  errors
}


modules contiene:

mano
time
board_state


---------------------------------------------------------------------

## Detector de mano

Archivo confirmado:

modules/preflop/mano.py


Campos observados en salida:

card1
card2
hand_rank
hand_class
suited
score1
score2


---------------------------------------------------------------------

## Detector de board

Archivo confirmado:

modules/preflop/board_state.py


Detecta:

flop visible
no flop


Devuelve:

street_state


---------------------------------------------------------------------

## Workers

Archivos confirmados:

modules/preflop/run_workers_loop.py
modules/preflop/workers_loop/worker_mesa.py


Comportamiento confirmado:

worker por mesa
ticks numerados
captura de ROI
OCR
pipeline preflop
persistencia


---------------------------------------------------------------------

## Time Gate

Archivo confirmado:

modules/preflop/workers_loop/time_gate.py


Uso confirmado:

run_time_gate_for_area(...)


Si time_ok == False
la mesa se ignora


---------------------------------------------------------------------

# 6. BASE DE DATOS

Ruta confirmada usada en esta sesión:

data/poker_boss.db


Tablas confirmadas por evidencia directa:

hands_obs
hands
players
hand_links


Tabla detectada en error runtime:

strategies


Error observado:

OperationalError: no such table: strategies


Esto significa que la DB usada por el worker no contiene esa tabla.


NO_CONFIRMADO:

si strategies es requerida para este flujo.


---------------------------------------------------------------------

# 7. PERSISTENCIA DE OBSERVACIONES

Funciones confirmadas:

persist_preflop_obs(...)
update_obs_frame_ref(...)


Tabla usada:

hands_obs


Campos observados en consultas:

obs_id
frame_ref


---------------------------------------------------------------------

# 8. CAPTURAS DE WORKER

Funciones observadas en código:

insert_worker_capture
update_worker_capture_ocr
update_worker_capture_route
find_recent_capture_by_fingerprint


Esto implica la existencia de una tabla de capturas.


NO_CONFIRMADO:

nombre exacto de la tabla.

Posibles nombres vistos en repo:

worker_captures
workers_captures


---------------------------------------------------------------------

# 9. SISTEMA DE CARPETAS DE DEBUG

Confirmado por logs:

ok
errors
borrar
time_mano_candidates


Las imágenes se mueven según resultado del pipeline.


---------------------------------------------------------------------

# 10. FRONTEND

Confirmado por tests que han pasado.

Tecnologías NO_CONFIRMADAS
(probablemente React + Tauri)


Funcionalidades confirmadas:

HandsPage
tabla de manos reales
modal de mano real
modal de imagen OCR
botón Match Images
import XML
editor de estrategia
botón Run Workers


---------------------------------------------------------------------

# 11. MATCH IMAGES

Acción confirmada:

Match Images


Backend invocado:

match_spots


Si dbPath está vacío:

usa poker_boss.db


---------------------------------------------------------------------

# 12. IMPORTACION XML

Confirmado por tests frontend.

Flujo:

Import XML
↓
invoke backend
↓
parámetros

folder
hero
dbPath


---------------------------------------------------------------------

# 13. FLUJO COMPLETO DEL SISTEMA

Confirmado por arquitectura observada.

Poker tables
↓
workers capturan frames
↓
OCR detecta spots
↓
pipeline preflop analiza
↓
hands_obs guarda fingerprints
↓
(POST SESION)
import XML
↓
link spots OCR a manos reales


---------------------------------------------------------------------

# 14. PROBLEMA ACTUAL QUE BLOQUEA EL COMMIT

Test roto:

tests/test_preflop.py


El test espera:

modules["noboard"]


Pero ahora existe:

modules["board_state"]


Solución probable:

actualizar el test para reflejar el nuevo contrato.


---------------------------------------------------------------------

# 15. PRIMER PASO EN EL SIGUIENTE CHAT

Abrir:

tests/test_preflop.py


Actualizar:

self.assertIn("noboard", data["modules"])


por:

self.assertIn("board_state", data["modules"])


Luego ejecutar:

python -m pytest -q


Si pasa:

git commit
git push


---------------------------------------------------------------------

# 16. GRADO DE CONFIANZA

Alta confianza:

worker skip por frame repetido
board_state funcionando
pipeline preflop actualizado
error del test correctamente identificado


Media confianza:

contrato final de preflop.py


Baja / NO_CONFIRMADO:

compatibilidad noboard vs board_state
estructura completa de tablas worker_captures
arquitectura exacta frontend (React/Tauri)

---------------------------------------------------------------------

# FIN DEL RESUMEN

Este archivo se generó automáticamente para continuar el desarrollo en otro chat sin perder contexto.

