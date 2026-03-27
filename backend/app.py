from __future__ import annotations

import argparse
from pathlib import Path

from jsonschema_diagram import (
    DEFAULT_SCHEMA_PATH,
    DEFAULT_SITE_DIR,
    create_server,
)

DEFAULT_STATIC_DIR = DEFAULT_SITE_DIR


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
