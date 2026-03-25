import hashlib
import os
import sys
import types

from modules.workers import worker_utils as uut


def test_sha1_helpers_and_fingerprint(monkeypatch, tmp_path):
    file_path = tmp_path / "sample.txt"
    file_path.write_text("abc", encoding="utf-8")

    monkeypatch.setattr(uut.time, "time", lambda: 10)

    assert uut.sha1_text("abc") == hashlib.sha1(b"abc").hexdigest()
    assert uut.sha1_file(str(file_path)) == hashlib.sha1(b"abc").hexdigest()
    assert uut.get_file_fingerprint(str(file_path)) == hashlib.sha1(b"abc").hexdigest()
    assert uut.get_fingerprint(3, "replay", "region1") == uut.sha1_text("3|replay|region1|5")


def test_safe_capture_success(monkeypatch, tmp_path):
    saved = {}

    class FakeImage:
        def save(self, path):
            saved["path"] = path
            with open(path, "wb") as fh:
                fh.write(b"png")

    class FakeImageGrabModule:
        @staticmethod
        def grab(bbox):
            saved["bbox"] = bbox
            return FakeImage()

    monkeypatch.setitem(sys.modules, "PIL", types.ModuleType("PIL"))
    monkeypatch.setitem(sys.modules, "PIL.ImageGrab", FakeImageGrabModule)
    monkeypatch.chdir(tmp_path)

    path, err = uut.safe_capture([1, 2, 3, 4])

    assert err is None
    assert path is not None
    assert os.path.exists(path)
    assert saved["bbox"] == (1, 2, 4, 6)


def test_safe_capture_failure(monkeypatch):
    monkeypatch.setitem(sys.modules, "PIL", types.ModuleType("PIL"))

    class BrokenImageGrabModule:
        @staticmethod
        def grab(bbox):
            raise RuntimeError(f"boom {bbox}")

    monkeypatch.setitem(sys.modules, "PIL.ImageGrab", BrokenImageGrabModule)

    path, err = uut.safe_capture([5, 6, 7, 8])

    assert path is None
    assert "boom" in err


def test_list_images_in_dir_and_nested_get(tmp_path):
    (tmp_path / "b.BMP").write_bytes(b"b")
    (tmp_path / "a.png").write_bytes(b"a")
    (tmp_path / "c.jpg").write_bytes(b"c")
    (tmp_path / "dir").mkdir()

    found = uut.list_images_in_dir(str(tmp_path))

    assert found == [str(tmp_path / "a.png"), str(tmp_path / "b.BMP")]
    assert uut.list_images_in_dir(str(tmp_path / "missing")) == []
    assert uut.nested_get({"a": {"b": {"c": 3}}}, ["a", "b", "c"]) == 3
    assert uut.nested_get({"a": {"b": None}}, ["a", "b"], default="x") == "x"
    assert uut.nested_get({"a": 1}, ["a", "b"], default="fallback") == "fallback"
    assert uut.dumps({"hola": "á"}) == '{"hola": "á"}'
