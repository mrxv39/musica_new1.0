"""Centralized fingerprinting utilities for poker spots and captures.

Multiple fingerprinting strategies are used for different purposes:
1. spot_fingerprint: mesa + p1_stack - for deduplicating spots by table state
2. image_fingerprint: path + timestamp bucket - for deduplicating captures
3. board_state_fingerprint: path + board detection timestamp - for board state changes
"""

from __future__ import annotations

import hashlib
import time
from typing import Optional


def sha1_hash(data: str) -> str:
    """Compute SHA1 hash of a string."""
    return hashlib.sha1(data.encode("utf-8", errors="ignore")).hexdigest()


def spot_fingerprint(mesa: int, p1_stack: float) -> str:
    """Fingerprint for deduplicating spots by table state.

    Key = mesa + p1_stack (to 3 decimals).
    Used for 10-second deduplication window.

    Args:
        mesa: Table number
        p1_stack: Hero stack in decimals

    Returns:
        SHA1 hex digest of "mesa=X|p1=Y.YYY"
    """
    key = f"mesa={int(mesa)}|p1={float(p1_stack):.3f}"
    return sha1_hash(key)


def image_fingerprint(image_path: str, timestamp_ms: Optional[int] = None) -> str:
    """Fingerprint for deduplicating captures by image content and time bucket.

    Key = path + (timestamp // 2) seconds.
    Bucketing every 2 seconds prevents identical frames from being reprocessed.

    Note: Uses second precision (not milliseconds) to match board_state_fingerprint().
    This avoids bucket collision inconsistencies at second boundaries.

    Args:
        image_path: Absolute path to image file
        timestamp_ms: Timestamp in milliseconds (uses current time if None)

    Returns:
        SHA1 hex digest
    """
    if timestamp_ms is None:
        timestamp_ms = int(time.time() * 1000)

    # Convert to seconds and bucket every 2 seconds (matches board_state_fingerprint)
    timestamp_sec = timestamp_ms // 1000
    bucket = timestamp_sec // 2
    key = f"{image_path}|bucket={bucket}"
    return sha1_hash(key)


def board_state_fingerprint(image_path: str) -> str:
    """Fingerprint for detecting board state changes.

    Key = path + (current_timestamp // 2) seconds.
    Used in board_state.py for detecting when flop appears.

    Args:
        image_path: Absolute path to image file

    Returns:
        SHA1 hex digest
    """
    current_bucket = int(time.time()) // 2
    key = f"{image_path}|board_state|{current_bucket}"
    return sha1_hash(key)
