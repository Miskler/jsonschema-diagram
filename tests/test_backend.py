from __future__ import annotations

import json
import threading
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlopen

from backend.app import create_server


class BackendServerTests(unittest.TestCase):
    def start_server(self, static_dir: Path, schema_path: Path):
        server = create_server(
            host="127.0.0.1",
            port=0,
            static_dir=static_dir,
            schema_path=schema_path,
        )
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.shutdown)
        self.addCleanup(server.server_close)
        self.addCleanup(thread.join, 1)
        return server

    def test_api_returns_shared_schema(self):
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            schema_path = root / "default.json"
            schema_path.write_text(
                json.dumps({"title": "Smoke Schema", "type": "object"}),
                encoding="utf-8",
            )

            server = self.start_server(static_dir=root / "dist", schema_path=schema_path)

            response = urlopen(
                f"http://127.0.0.1:{server.server_port}/api/default-jsonschema"
            )
            payload = json.loads(response.read().decode("utf-8"))

            self.assertEqual(payload["title"], "Smoke Schema")

    def test_root_serves_index_html_when_build_exists(self):
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            static_dir = root / "dist"
            static_dir.mkdir()
            (static_dir / "index.html").write_text(
                "<!doctype html><html><body>diagram app</body></html>",
                encoding="utf-8",
            )
            schema_path = root / "default.json"
            schema_path.write_text("{}", encoding="utf-8")

            server = self.start_server(static_dir=static_dir, schema_path=schema_path)

            response = urlopen(f"http://127.0.0.1:{server.server_port}/unknown/route")
            body = response.read().decode("utf-8")

            self.assertIn("diagram app", body)

    def test_returns_service_unavailable_without_build(self):
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            schema_path = root / "default.json"
            schema_path.write_text("{}", encoding="utf-8")

            server = self.start_server(static_dir=root / "missing", schema_path=schema_path)

            with self.assertRaises(Exception) as captured:
                urlopen(f"http://127.0.0.1:{server.server_port}/")

            self.assertIn("HTTP Error 503", str(captured.exception))


if __name__ == "__main__":
    unittest.main()
