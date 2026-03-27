from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

from .api import (
    DEFAULT_EMBED_TEMPLATE_PATH,
    DEFAULT_SCHEMA_PATH,
    DEFAULT_SITE_DIR,
    VALID_THEME_IDS,
    create_server,
    load_default_schema,
    load_json_schema,
    render_embed_html,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="jsonschema-diagram",
        description="Python helpers and CLI for the JSON Schema Diagram viewer.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    serve_parser = subparsers.add_parser(
        "serve",
        help="Serve the built frontend and default schema endpoint.",
    )
    serve_parser.add_argument("--host", default="127.0.0.1")
    serve_parser.add_argument("--port", default=8000, type=int)
    serve_parser.add_argument(
        "--static-dir",
        default=str(DEFAULT_SITE_DIR),
        help="Directory containing the built frontend site.",
    )
    serve_parser.add_argument(
        "--schema-path",
        default=str(DEFAULT_SCHEMA_PATH),
        help="Path to the shared default schema JSON file.",
    )

    render_parser = subparsers.add_parser(
        "render-embed",
        help="Render a self-contained embed HTML document.",
    )
    render_parser.add_argument(
        "--schema-path",
        help="Path to a JSON Schema file. Defaults to the shared default schema.",
    )
    render_parser.add_argument(
        "--stdin",
        action="store_true",
        help="Read the schema JSON payload from stdin instead of a file.",
    )
    render_parser.add_argument(
        "--output",
        "-o",
        default="-",
        help="Output file path, or '-' to print HTML to stdout.",
    )
    render_parser.add_argument(
        "--theme",
        choices=sorted(VALID_THEME_IDS),
        help="Default theme baked into the embed document.",
    )
    render_parser.add_argument(
        "--template-path",
        default=str(DEFAULT_EMBED_TEMPLATE_PATH),
        help="Path to the Jinja2 embed template.",
    )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "serve":
        return _run_serve(args)

    if args.command == "render-embed":
        return _run_render_embed(args)

    parser.error(f"Unknown command: {args.command}")
    return 2


def _run_serve(args: argparse.Namespace) -> int:
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

    return 0


def _run_render_embed(args: argparse.Namespace) -> int:
    if args.stdin:
        schema = json.load(sys.stdin)
    elif args.schema_path:
        schema = load_json_schema(args.schema_path)
    else:
        schema = load_default_schema()

    html = render_embed_html(
        schema,
        template_path=args.template_path,
        default_theme=args.theme,
    )

    if args.output == "-":
        sys.stdout.write(html)
        return 0

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")
    print(f"Wrote embed HTML to {output_path}")
    return 0
