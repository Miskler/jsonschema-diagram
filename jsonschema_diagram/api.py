from __future__ import annotations

import json
import re
import shutil
from functools import lru_cache
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Type
from urllib.parse import urlparse

PACKAGE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PACKAGE_DIR.parent
DATA_DIR = PACKAGE_DIR / "data"

DEFAULT_SCHEMA_PATH = (
    DATA_DIR / "default.json"
    if (DATA_DIR / "default.json").exists()
    else ROOT_DIR / "schemas" / "default.json"
)
DEFAULT_SITE_DIR = ROOT_DIR / "dist" / "site"
DEFAULT_SITE_INDEX_PATH = DEFAULT_SITE_DIR / "index.html"
DEFAULT_EMBED_TEMPLATE_PATH = (
    DATA_DIR / "jsonschema-diagram.embed.jinja2.html"
    if (DATA_DIR / "jsonschema-diagram.embed.jinja2.html").exists()
    else ROOT_DIR / "dist" / "embed" / "jsonschema-diagram.embed.jinja2.html"
)
VALID_VIEWER_MODES = frozenset({"site", "embed"})
VALID_THEME_IDS = frozenset({"mono", "slate", "cobalt", "mint", "coral", "gold"})
RUNTIME_CONFIG_SCRIPT_PATTERN = re.compile(
    r"<script\b[^>]*>\s*window\.__JSONSCHEMA_DIAGRAM_CONFIG__\s*=.*?</script>",
    re.DOTALL,
)


def validate_viewer_mode(mode: str) -> str:
    if mode not in VALID_VIEWER_MODES:
        allowed = ", ".join(sorted(VALID_VIEWER_MODES))
        raise ValueError(f"Unsupported viewer mode {mode!r}. Use one of: {allowed}.")

    return mode


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


def _serialize_javascript(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return (
        payload.replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def _resolve_runtime_schema(
    schema: Any | None,
    *,
    default_schema_url: str | None,
) -> Any | None:
    if schema is not None and default_schema_url is not None:
        raise ValueError(
            "Use either an inline schema payload or default_schema_url, not both."
        )

    if schema is not None:
        return schema

    if default_schema_url is not None:
        return None

    return load_default_schema()


def build_runtime_config(
    mode: str,
    schema: Any | None = None,
    *,
    default_theme: str | None = None,
    default_schema_url: str | None = None,
) -> dict[str, Any]:
    runtime_mode = validate_viewer_mode(mode)
    theme = validate_theme_id(default_theme)
    payload = _resolve_runtime_schema(
        schema,
        default_schema_url=default_schema_url,
    )

    runtime_config: dict[str, Any] = {"mode": runtime_mode}

    if payload is not None:
        runtime_config["defaultSchema"] = payload

    if default_schema_url is not None:
        runtime_config["defaultSchemaUrl"] = default_schema_url

    if theme is not None:
        runtime_config["defaultTheme"] = theme

    return runtime_config


def _raise_missing_artifact(path: Path, *, mode: str) -> None:
    build_command = "build:site" if mode == "site" else "build:embed"
    label = "Site HTML" if mode == "site" else "Embed template"
    raise FileNotFoundError(
        f"{label} not found at {path}. Run `npm run {build_command}` first."
    )


def _runtime_config_script(runtime_config: dict[str, Any]) -> str:
    payload = _serialize_javascript(runtime_config)
    return f"<script>window.__JSONSCHEMA_DIAGRAM_CONFIG__ = {payload};</script>"


def _inject_runtime_config(document: str, runtime_config: dict[str, Any]) -> str:
    script = _runtime_config_script(runtime_config)

    if RUNTIME_CONFIG_SCRIPT_PATTERN.search(document):
        return RUNTIME_CONFIG_SCRIPT_PATTERN.sub(script, document, count=1)

    if "</head>" in document:
        return document.replace("</head>", f"  {script}\n  </head>", 1)

    if "</body>" in document:
        return document.replace("</body>", f"  {script}\n  </body>", 1)

    return f"{script}\n{document}"


def render_viewer_html(
    mode: str,
    schema: Any | None = None,
    *,
    template_path: str | Path | None = None,
    default_theme: str | None = None,
    default_schema_url: str | None = None,
) -> str:
    runtime_mode = validate_viewer_mode(mode)
    runtime_config = build_runtime_config(
        runtime_mode,
        schema,
        default_theme=default_theme,
        default_schema_url=default_schema_url,
    )

    if runtime_mode == "embed":
        resolved_template_path = Path(template_path or DEFAULT_EMBED_TEMPLATE_PATH)

        if not resolved_template_path.exists():
            _raise_missing_artifact(resolved_template_path, mode=runtime_mode)

        template = _load_embed_template(str(resolved_template_path.resolve()))
        default_schema = runtime_config.get("defaultSchema")
        document = template.render(
            runtime_config=runtime_config,
            runtime_config_json=_serialize_javascript(runtime_config),
            default_schema=default_schema,
            default_schema_json=(
                _serialize_javascript(default_schema)
                if default_schema is not None
                else None
            ),
            default_schema_url=runtime_config.get("defaultSchemaUrl"),
            default_theme=runtime_config.get("defaultTheme"),
        )
        return _inject_runtime_config(document, runtime_config)

    resolved_template_path = Path(template_path or DEFAULT_SITE_INDEX_PATH)

    if not resolved_template_path.exists():
        _raise_missing_artifact(resolved_template_path, mode=runtime_mode)

    document = resolved_template_path.read_text(encoding="utf-8")
    return _inject_runtime_config(document, runtime_config)


def write_viewer_html(
    output_path: str | Path,
    mode: str,
    schema: Any | None = None,
    *,
    template_path: str | Path | None = None,
    default_theme: str | None = None,
    default_schema_url: str | None = None,
) -> Path:
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        render_viewer_html(
            mode,
            schema,
            template_path=template_path,
            default_theme=default_theme,
            default_schema_url=default_schema_url,
        ),
        encoding="utf-8",
    )
    return destination


def render_embed_html(
    schema: Any | None = None,
    *,
    template_path: str | Path = DEFAULT_EMBED_TEMPLATE_PATH,
    default_theme: str | None = None,
    default_schema_url: str | None = None,
) -> str:
    return render_viewer_html(
        "embed",
        schema,
        template_path=template_path,
        default_theme=default_theme,
        default_schema_url=default_schema_url,
    )


def render_site_html(
    schema: Any | None = None,
    *,
    template_path: str | Path = DEFAULT_SITE_INDEX_PATH,
    default_theme: str | None = None,
    default_schema_url: str | None = None,
) -> str:
    return render_viewer_html(
        "site",
        schema,
        template_path=template_path,
        default_theme=default_theme,
        default_schema_url=default_schema_url,
    )


def write_embed_html(
    output_path: str | Path,
    schema: Any | None = None,
    *,
    template_path: str | Path = DEFAULT_EMBED_TEMPLATE_PATH,
    default_theme: str | None = None,
    default_schema_url: str | None = None,
) -> Path:
    return write_viewer_html(
        output_path,
        "embed",
        schema,
        template_path=template_path,
        default_theme=default_theme,
        default_schema_url=default_schema_url,
    )


def write_site_html(
    output_path: str | Path,
    schema: Any | None = None,
    *,
    template_path: str | Path = DEFAULT_SITE_INDEX_PATH,
    default_theme: str | None = None,
    default_schema_url: str | None = None,
) -> Path:
    return write_viewer_html(
        output_path,
        "site",
        schema,
        template_path=template_path,
        default_theme=default_theme,
        default_schema_url=default_schema_url,
    )


def write_site_bundle(
    output_dir: str | Path,
    schema: Any | None = None,
    *,
    site_dir: str | Path = DEFAULT_SITE_DIR,
    default_theme: str | None = None,
    default_schema_url: str | None = None,
) -> Path:
    source_dir = Path(site_dir)

    if not source_dir.exists():
        _raise_missing_artifact(source_dir, mode="site")

    destination_dir = Path(output_dir)
    source_dir_resolved = source_dir.resolve()
    destination_dir_resolved = destination_dir.resolve()

    if destination_dir_resolved != source_dir_resolved:
        try:
            destination_dir_resolved.relative_to(source_dir_resolved)
        except ValueError:
            pass
        else:
            raise ValueError("output_dir cannot be nested inside site_dir.")

        shutil.copytree(source_dir, destination_dir, dirs_exist_ok=True)
    else:
        destination_dir.mkdir(parents=True, exist_ok=True)

    write_site_html(
        destination_dir / "index.html",
        schema,
        template_path=source_dir / "index.html",
        default_theme=default_theme,
        default_schema_url=default_schema_url,
    )
    return destination_dir


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
