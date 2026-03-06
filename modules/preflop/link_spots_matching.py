# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\link_spots_matching.py

from link_spots_utils import REGION_BY_ROOM, norm_room


def closest_spot(spots, target_ms: int, window_ms: int):
    if not spots or target_ms is None:
        return None

    lo = target_ms - window_ms
    hi = target_ms + window_ms
    best = None
    best_dt = None

    for sp in spots:
        ts = sp["ts_ms"]

        if ts < lo:
            continue

        if ts > hi:
            break

        dt = abs(ts - target_ms)

        if best is None or dt < best_dt:
            best = sp
            best_dt = dt

    return best


def choose_candidates_for_room(room, spots_all, spots_by_region):
    rnorm = norm_room(room)
    reg = REGION_BY_ROOM.get(rnorm)

    if reg and reg in spots_by_region:
        return spots_by_region[reg]

    return spots_all
