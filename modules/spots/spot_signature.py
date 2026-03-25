# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\spots\spot_signature.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple


def _to_float(x: Any, default: float = 0.0) -> float:
    try:
        if x is None:
            return default
        return float(x)
    except Exception:
        return default


def _to_str(x: Any, default: str = "") -> str:
    try:
        if x is None:
            return default
        s = str(x)
        return s
    except Exception:
        return default


def stack_bucket(bb: float) -> str:
    """
    Bucket simple para stacks en BB. Ajustable.
    """
    bb = float(bb)
    if bb <= 5:
        return "5bb"
    if bb <= 8:
        return "8bb"
    if bb <= 10:
        return "10bb"
    if bb <= 12:
        return "12bb"
    if bb <= 15:
        return "15bb"
    if bb <= 20:
        return "20bb"
    if bb <= 25:
        return "25bb"
    if bb <= 30:
        return "30bb"
    if bb <= 40:
        return "40bb"
    return "40bb+"


def _players_tag(p2_pos: str, p3_pos: str) -> str:
    """
    Si falta p3 => HU. Si existen p2 y p3 => 3H (por ahora).
    """
    p2 = _to_str(p2_pos).strip().upper()
    p3 = _to_str(p3_pos).strip().upper()
    if p3 == "" or p3 == "NA" or p3 == "NONE":
        return "HU"
    return "3H"


def _street_tag(street: Any) -> str:
    s = _to_str(street, "PREFLOP").strip().upper()
    if not s:
        return "PREFLOP"
    # normaliza algunos posibles valores
    if s in ("PRE", "PREFLOP", "PF"):
        return "PREFLOP"
    if s in ("FLOP", "TURN", "RIVER"):
        return s
    return s


def _pattern_from_numbers(street: str, p1_bet_bb: float) -> str:
    """
    Patrón MUY básico, solo para agrupar al principio.
    Preflop:
      - ~0.5 => LIMP
      - >=1 => RAISE
      - 0 => CHECK/UNKNOWN
    Postflop:
      - solo street por ahora
    """
    if street != "PREFLOP":
        return street

    b = float(p1_bet_bb)
    if b <= 0.0:
        return "PREFLOP_UNKNOWN"
    # limp típico en bb units
    if 0.25 <= b <= 0.75:
        return "LIMP"
    # OR típico 2 - 3.5
    if 1.0 <= b <= 3.5:
        return "RAISE"
    return "BET"


@dataclass(frozen=True)
class SpotSignature:
    signature: str
    street: str
    hero_pos: str
    players: str
    se_bucket: str


def build_signature_from_spot_row(spot: Dict[str, Any]) -> SpotSignature:
    """
    spot: dict leído de sqlite3.Row (convertido a dict)
    Intentamos ser tolerantes a diferentes nombres de columna.

    Campos típicos esperados (si existen):
      hero_pos / spot / p1_pos
      p2_pos, p3_pos
      street
      p1_se_bb / se_bb / stackefectivo_bb
      p1_bet_bb / bet_bb
    """
    hero = (_to_str(spot.get("hero_pos", "")) or _to_str(spot.get("spot", "")) or _to_str(spot.get("p1_pos", ""))).strip().upper()
    if not hero:
        hero = "UNK"

    p2_pos = _to_str(spot.get("p2_pos", "")).strip().upper()
    p3_pos = _to_str(spot.get("p3_pos", "")).strip().upper()

    street = _street_tag(spot.get("street", spot.get("calle", "PREFLOP")))

    se = _to_float(
        spot.get("p1_se_bb", spot.get("se_bb", spot.get("stackefectivo_bb", spot.get("p1_se", 0)))),
        default=0.0,
    )
    bet = _to_float(
        spot.get("p1_bet_bb", spot.get("bet_bb", spot.get("p1_bet", 0.0))),
        default=0.0,
    )

    players = _players_tag(p2_pos, p3_pos)
    se_b = stack_bucket(se)
    pat = _pattern_from_numbers(street, bet)

    # Firma compacta
    sig = f"{players}_{hero}_{se_b}_{pat}"

    return SpotSignature(signature=sig, street=street, hero_pos=hero, players=players, se_bucket=se_b)
