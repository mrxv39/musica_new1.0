# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\range_parser.py

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

RANKS = "23456789TJQKA"
RANK_TO_I = {r: i for i, r in enumerate(RANKS)}


def _norm_rank(r: str) -> str:
    r = (r or "").strip().upper()
    if r == "10":
        return "T"
    return r


def hand_to_class(card1: str, card2: str) -> str:
    """Convert two cards like 'As' + 'Qh' into 'AQs' / 'AQo' / 'AA'."""
    c1 = (card1 or "").strip()
    c2 = (card2 or "").strip()
    if len(c1) < 2 or len(c2) < 2:
        raise ValueError(f"Invalid cards: {card1!r}, {card2!r}")

    r1, s1 = _norm_rank(c1[0]), c1[-1].lower()
    r2, s2 = _norm_rank(c2[0]), c2[-1].lower()
    if r1 not in RANK_TO_I or r2 not in RANK_TO_I:
        raise ValueError(f"Invalid ranks: {card1!r}, {card2!r}")

    # order ranks high->low
    if RANK_TO_I[r2] > RANK_TO_I[r1]:
        r1, r2 = r2, r1
        s1, s2 = s2, s1

    if r1 == r2:
        return f"{r1}{r2}"

    suited = "s" if s1 == s2 else "o"
    return f"{r1}{r2}{suited}"


def normalize_hand_class(hand_class: str) -> str:
    """Normalize to canonical: 'AQs', 'KTo', 'AA'. Accepts 'AsQh' too."""
    s = (hand_class or "").strip()
    if not s:
        raise ValueError("hand_class empty")

    # compact 2-card e.g. AsQh
    if len(s) == 4 and s[0].isalpha() and s[1].isalpha() and s[2].isalpha() and s[3].isalpha():
        return hand_to_class(s[:2], s[2:])

    s = s.upper()

    # pair
    if len(s) == 2 and s[0] in RANKS and s[1] in RANKS and s[0] == s[1]:
        return s

    # suited/offsuit
    if len(s) == 3 and s[0] in RANKS and s[1] in RANKS and s[2] in ("S", "O") and s[0] != s[1]:
        r1, r2, so = s[0], s[1], s[2].lower()
        if RANK_TO_I[r2] > RANK_TO_I[r1]:
            r1, r2 = r2, r1
        return f"{r1}{r2}{so}"

    raise ValueError(f"Unsupported hand_class format: {hand_class!r}")


@dataclass(frozen=True)
class Token:
    raw: str
    start: str
    end: Optional[str] = None
    plus: bool = False


def _split_tokens(range_text: str) -> List[str]:
    raw = (range_text or "").replace(";", ",")
    parts: List[str] = []
    for chunk in raw.split(","):
        for p in chunk.strip().split():
            if p:
                parts.append(p.strip())
    return parts


def _parse_token(s: str) -> Token:
    t = s.strip()
    plus = t.endswith("+")
    if plus:
        t = t[:-1].strip()
    if "-" in t:
        a, b = t.split("-", 1)
        return Token(raw=s, start=a.strip(), end=b.strip(), plus=plus)
    return Token(raw=s, start=t, end=None, plus=plus)


def _all_pairs_from(pair: str) -> List[str]:
    r = pair[0]
    i = RANK_TO_I[r]
    return [f"{RANKS[j]}{RANKS[j]}" for j in range(i, len(RANKS))]


def _expand_nonpair_plus(h: str) -> List[str]:
    """A5s+ -> A5s,A6s,...,AKs (first rank fixed)."""
    r1, r2, so = h[0], h[1], h[2]
    i1, i2 = RANK_TO_I[r1], RANK_TO_I[r2]
    out = []
    for j in range(i2, i1):
        out.append(f"{r1}{RANKS[j]}{so}")
    return out


def _expand_nonpair_dash(a: str, b: str) -> List[str]:
    """A5s-A2s (same first rank + same suitedness)."""
    if len(a) != 3 or len(b) != 3:
        return []
    r1a, r2a, soa = a[0], a[1], a[2]
    r1b, r2b, sob = b[0], b[1], b[2]
    if r1a != r1b or soa != sob:
        return []
    i2a, i2b = RANK_TO_I[r2a], RANK_TO_I[r2b]
    step = 1 if i2b >= i2a else -1
    out = []
    for j in range(i2a, i2b + step, step):
        if j >= RANK_TO_I[r1a]:
            continue
        out.append(f"{r1a}{RANKS[j]}{soa}")
    return out


def expand_range(range_text: str) -> List[str]:
    """Expand a compact range string into a list of hand classes.

    Supports:
    - pairs: '77', '66+'
    - nonpairs: 'AQs', 'KTo', 'A5s+', 'A5s-A2s'
    - wildcards: '*', 'ANY', 'RANDOM'
    """
    text = (range_text or "").strip()
    if not text:
        return []
    up = text.upper()
    if up in ("*", "ANY", "RANDOM"):
        return ["*"]

    out: List[str] = []
    for raw in _split_tokens(text):
        tok = _parse_token(raw)
        a = normalize_hand_class(tok.start) if tok.start else ""

        if a == "*":
            out.append("*")
            continue

        if tok.end:
            b = normalize_hand_class(tok.end)
            if len(a) == 2 and len(b) == 2 and a[0] == a[1] == b[0] == b[1]:
                ia, ib = RANK_TO_I[a[0]], RANK_TO_I[b[0]]
                step = 1 if ib >= ia else -1
                for j in range(ia, ib + step, step):
                    out.append(f"{RANKS[j]}{RANKS[j]}")
            else:
                out.extend(_expand_nonpair_dash(a, b))
            continue

        if tok.plus:
            if len(a) == 2:
                out.extend(_all_pairs_from(a))
            else:
                out.extend(_expand_nonpair_plus(a))
            continue

        out.append(a)

    seen = set()
    uniq: List[str] = []
    for h in out:
        if h not in seen:
            seen.add(h)
            uniq.append(h)
    return uniq


def hand_in_range(hand_class: str, range_text: str) -> bool:
    hc = normalize_hand_class(hand_class)
    expanded = expand_range(range_text)
    if not expanded:
        return False
    if "*" in expanded:
        return True
    return hc in set(expanded)
