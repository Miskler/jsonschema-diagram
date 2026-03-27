from __future__ import annotations

import json
from functools import lru_cache
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Type
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SCHEMA_PATH = ROOT_DIR / "schemas" / "default.json"
DEFAULT_SITE_DIR = ROOT_DIR / "dist" / "site"
DEFAULT_EMBED_TEMPLATE_PATH = (
    ROOT_DIR / "dist" / "embed" / "jsonschema-diagram.embed.jinja2.html"
)
VALID_THEME_IDS = frozenset({"mono", "slate", "cobalt", "mint", "coral", "gold"})


def validate_theme_id(theme: str | None) -> str | None:
    if theme is None:
        return None

    if theme not in VALID_THEME_IDS:
        allowed = ", ".join(sorted(VALID_THEME_IDS))
        raise ValueError(f"Unsupported theme {theme!r}. Use one of: {allowed}.")

    return theme


def load_json_schema(path: str | Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_default_schema() -> Any:
    return load_json_schema(DEFAULT_SCHEMA_PATH)


@lru_cache(maxsize=16)
def _load_embed_template(path: str):
    from jinja2 import Environment

    environment = Environment(autoescape=False)
    return environment.from_string(Path(path).read_text(encoding="utf-8"))


def render_embed_html(
    schema: Any | None = None,
    *,
    template_path: str | Path = DEFAULT_EMBED_TEMPLATE_PATH,
    default_theme: str | None = None,
) -> str:
    template_path = Path(template_path)

    if not template_path.exists():
        raise FileNotFoundError(
            "Embed template not found at "
            f"{template_path}. Run `npm run build:embed` first."
        )

    theme = validate_theme_id(default_theme)
    payload = load_default_schema() if schema is None else schema
    template = _load_embed_template(str(template_path.resolve()))
    return template.render(default_schema=payload, default_theme=theme)


def write_embed_html(
    output_path: str | Path,
    schema: Any | None = None,
    *,
    template_path: str | Path = DEFAULT_EMBED_TEMPLATE_PATH,
    default_theme: str | None = None,
) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        render_embed_html(
            schema,
            template_path=template_path,
            default_theme=default_theme,
        ),
        encoding="utf-8",
    )
    return output_path


def build_handler(
    static_dir: Path = DEFAULT_SITE_DIR,
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

            if (
                request_path in {"", "/"}
                or not candidate.exists()
                or candidate.is_dir()
            ):
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
                    "hint": (
                        "Run `npm install` and `npm run build:site` "
                        "before serving the UI."
                    ),
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
    static_dir: Path = DEFAULT_SITE_DIR,
    schema_path: Path = DEFAULT_SCHEMA_PATH,
) -> ThreadingHTTPServer:
    return ThreadingHTTPServer(
        (host, port),
        build_handler(static_dir=static_dir, schema_path=schema_path),
    )
