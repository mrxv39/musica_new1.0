# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\substrategy_constants.py
from __future__ import annotations

OR_KEYS = [
    "OR_TO_CALL_ANY",
    "OPEN_PUSH",
    "OR_TO_CALL_SMALL",
    "OR_TO_FOLD",
    "LIMP_CALL_ANY",
    "LIMP_CALL_SMALL",
    "LIMP_FOLD",
    "LIMP_TO_CALL_ANY",
]

# MOVE mapping (as per requested contract):
# - OR_* keys => move "OR"
# - OPEN_PUSH => move "PUSH"
# - LIMP_* keys => move "LIMP"
OR_BLOCK_MOVE_BY_KEY = {
    "OR_TO_CALL_ANY": "OR",
    "OR_TO_CALL_SMALL": "OR",
    "OR_TO_FOLD": "OR",
    "OPEN_PUSH": "PUSH",
    "LIMP_CALL_ANY": "LIMP",
    "LIMP_CALL_SMALL": "LIMP",
    "LIMP_FOLD": "LIMP",
    "LIMP_TO_CALL_ANY": "LIMP",
}
