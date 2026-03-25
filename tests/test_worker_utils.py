# tests/test_worker_utils.py
"""Tests for modules.workers.worker_utils"""
import os
import json
import tempfile
import unittest

from modules.workers.worker_utils import (
    sha1_text,
    list_images_in_dir,
    nested_get,
    dumps,
)


class TestSha1Text(unittest.TestCase):
    def test_deterministic(self):
        self.assertEqual(sha1_text("hello"), sha1_text("hello"))

    def test_different_inputs_different_hashes(self):
        self.assertNotEqual(sha1_text("a"), sha1_text("b"))

    def test_empty_string(self):
        result = sha1_text("")
        self.assertIsInstance(result, str)
        self.assertEqual(len(result), 40)  # SHA1 hex length


class TestListImagesInDir(unittest.TestCase):
    def test_returns_bmp_and_png_only(self):
        with tempfile.TemporaryDirectory() as d:
            for name in ["a.bmp", "b.png", "c.jpg", "d.txt", "e.BMP"]:
                open(os.path.join(d, name), "w").close()
            result = list_images_in_dir(d)
            basenames = [os.path.basename(f) for f in result]
            self.assertIn("a.bmp", basenames)
            self.assertIn("b.png", basenames)
            self.assertIn("e.BMP", basenames)
            self.assertNotIn("c.jpg", basenames)
            self.assertNotIn("d.txt", basenames)

    def test_empty_dir(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(list_images_in_dir(d), [])

    def test_nonexistent_dir(self):
        self.assertEqual(list_images_in_dir("/nonexistent/path/xyz"), [])

    def test_sorted_by_basename(self):
        with tempfile.TemporaryDirectory() as d:
            for name in ["c.png", "a.bmp", "b.png"]:
                open(os.path.join(d, name), "w").close()
            result = list_images_in_dir(d)
            basenames = [os.path.basename(f) for f in result]
            self.assertEqual(basenames, ["a.bmp", "b.png", "c.png"])


class TestNestedGet(unittest.TestCase):
    def test_simple_key(self):
        self.assertEqual(nested_get({"a": 1}, ["a"]), 1)

    def test_nested_keys(self):
        d = {"a": {"b": {"c": 42}}}
        self.assertEqual(nested_get(d, ["a", "b", "c"]), 42)

    def test_missing_key_returns_default(self):
        self.assertEqual(nested_get({"a": 1}, ["b"], "fallback"), "fallback")

    def test_non_dict_intermediate_returns_default(self):
        self.assertEqual(nested_get({"a": 5}, ["a", "b"], "nope"), "nope")

    def test_none_value_returns_default(self):
        self.assertEqual(nested_get({"a": None}, ["a"], "def"), "def")

    def test_empty_keys_returns_dict(self):
        d = {"a": 1}
        self.assertEqual(nested_get(d, []), d)


class TestDumps(unittest.TestCase):
    def test_returns_json_string(self):
        result = dumps({"key": "value"})
        self.assertEqual(json.loads(result), {"key": "value"})

    def test_unicode_preserved(self):
        result = dumps({"name": "cafe"})
        self.assertIn("cafe", result)


if __name__ == "__main__":
    unittest.main()
