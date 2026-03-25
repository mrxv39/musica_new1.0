"""Agent module: game state analysis and action decision.

Given a preflop game state snapshot, the agent decides what action to take
using the strategy engine (primary) with a historical data fallback.
"""
from .models import AgentDecision, GameState
from .decide import decide
