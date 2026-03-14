import json
import subprocess
import sys

import pytest
from PIL import Image


def run_board_state(image_path):
    completed = subprocess.run(
        [sys.executable, "-m", "modules.preflop.board_state", "--image", str(image_path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


def test_board_state_black_image_is_preflop(tmp_path):
    image_path = tmp_path / "black_board.png"
    Image.new("L", (410, 270), color=0).save(image_path)

    data = run_board_state(image_path)

    assert data["street_state"] == "preflop"
    assert data["valid_count"] == 0
    assert len(data["cards"]) == 3
    assert all(card["valid"] is False for card in data["cards"])


@pytest.mark.skip(reason="No stable postflop fixture or synthetic valid-card generator available in this repo.")
def test_board_state_postflop_fixture_if_available():
    pass
