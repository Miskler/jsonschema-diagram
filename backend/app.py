from __future__ import annotations

import argparse
import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Type
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SCHEMA_PATH = ROOT_DIR / "schemas" / "default.json"
DEFAULT_STATIC_DIR = ROOT_DIR / "dist" / "site"


def build_handler(
    static_dir: Path = DEFAULT_STATIC_DIR,
    schema_path: Path = DEFAULT_SCHEMA_PATH,
) -> Type[SimpleHTTPRequestHandler]:
    class DiagramHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(static_dir), **kwargs)

        def do_GET(self) -> None:  # noqa: N802
            request_path = urlparse(self.path).path

            if request_path == "/api/default-jsonschema":
                self._serve_schema()
                return

            if not static_dir.exists():
                self._serve_missing_build()
                return

            candidate = (
                static_dir / request_path.lstrip("/")
                if request_path not in {"", "/"}
                else static_dir / "index.html"
            )

            if request_path in {"", "/"} or not candidate.exists() or candidate.is_dir():
                self.path = "/index.html"
            else:
                self.path = request_path

            super().do_GET()

        def _serve_schema(self) -> None:
            payload = schema_path.read_text(encoding="utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload.encode("utf-8"))

        def _serve_missing_build(self) -> None:
            payload = json.dumps(
                {
                    "error": "Frontend build not found.",
                    "expected_static_dir": str(static_dir),
                    "hint": "Run `npm install` and `npm run build:site` before serving the UI.",
                }
            ).encode("utf-8")
            self.send_response(HTTPStatus.SERVICE_UNAVAILABLE)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)

    return DiagramHandler


def create_server(
    host: str = "127.0.0.1",
    port: int = 8000,
    static_dir: Path = DEFAULT_STATIC_DIR,
    schema_path: Path = DEFAULT_SCHEMA_PATH,
) -> ThreadingHTTPServer:
    return ThreadingHTTPServer(
        (host, port),
        build_handler(static_dir=static_dir, schema_path=schema_path),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the JSON Schema diagram app.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    parser.add_argument(
        "--static-dir",
        default=str(DEFAULT_STATIC_DIR),
        help="Directory containing the built frontend site.",
    )
    parser.add_argument(
        "--schema-path",
        default=str(DEFAULT_SCHEMA_PATH),
        help="Path to the shared default schema JSON file.",
    )
    args = parser.parse_args()

    server = create_server(
        host=args.host,
        port=args.port,
        static_dir=Path(args.static_dir),
        schema_path=Path(args.schema_path),
    )

    print(f"Serving JSON Schema diagram on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
