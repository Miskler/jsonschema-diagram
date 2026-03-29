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
    load_json_schema,
    render_embed_html,
    write_site_bundle,
)


def _add_schema_source_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--schema-path",
        help="Path to a JSON Schema file.",
    )
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="Read the schema JSON payload from stdin instead of a file.",
    )
    parser.add_argument(
        "--schema-url",
        help="URL that the viewer should fetch for its default schema.",
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
    _add_schema_source_arguments(render_parser)
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

    site_parser = subparsers.add_parser(
        "render-site",
        help="Write a configured site-mode bundle directory.",
    )
    _add_schema_source_arguments(site_parser)
    site_parser.add_argument(
        "--output",
        "-o",
        required=True,
        help="Output directory for the rendered site bundle.",
    )
    site_parser.add_argument(
        "--theme",
        choices=sorted(VALID_THEME_IDS),
        help="Default theme injected into site mode.",
    )
    site_parser.add_argument(
        "--site-dir",
        default=str(DEFAULT_SITE_DIR),
        help="Directory containing the built site assets to copy.",
    )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "serve":
        return _run_serve(args)

    if args.command == "render-embed":
        return _run_render_embed(args)

    if args.command == "render-site":
        return _run_render_site(args)

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


def _resolve_schema_source(
    args: argparse.Namespace,
) -> tuple[object | None, str | None]:
    active_sources = sum(
        [
            1 if args.stdin else 0,
            1 if args.schema_path else 0,
            1 if args.schema_url else 0,
        ]
    )

    if active_sources > 1:
        raise ValueError(
            "Use only one schema source: --stdin, --schema-path, or --schema-url."
        )

    if args.stdin:
        return json.load(sys.stdin), None

    if args.schema_path:
        return load_json_schema(args.schema_path), None

    if args.schema_url:
        return None, args.schema_url

    return None, None


def _run_render_embed(args: argparse.Namespace) -> int:
    schema, schema_url = _resolve_schema_source(args)

    html = render_embed_html(
        schema,
        template_path=args.template_path,
        default_theme=args.theme,
        default_schema_url=schema_url,
    )

    if args.output == "-":
        sys.stdout.write(html)
        return 0

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")
    print(f"Wrote embed HTML to {output_path}")
    return 0


def _run_render_site(args: argparse.Namespace) -> int:
    schema, schema_url = _resolve_schema_source(args)
    output_dir = write_site_bundle(
        args.output,
        schema,
        site_dir=args.site_dir,
        default_theme=args.theme,
        default_schema_url=schema_url,
    )
    print(f"Wrote site bundle to {output_dir}")
    return 0
