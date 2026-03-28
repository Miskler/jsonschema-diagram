from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any

from docutils import nodes
from docutils.parsers.rst import directives
from sphinx.application import Sphinx
from sphinx.util.docutils import SphinxDirective
from sphinx.util.fileutil import copy_asset

from jsonschema_diagram import (
    __version__,
    DEFAULT_EMBED_TEMPLATE_PATH,
    load_json_schema,
    render_embed_html,
    validate_theme_id,
)

PACKAGE_DIR = Path(__file__).resolve().parent
DEFAULT_EMBED_TEMPLATE = DEFAULT_EMBED_TEMPLATE_PATH
DEFAULT_HEIGHT = "720px"


def render_embed_document(
    template_path: Path,
    schema: Any,
    *,
    default_theme: str | None = None,
) -> str:
    return render_embed_html(
        schema,
        template_path=template_path,
        default_theme=default_theme,
    )


def build_iframe_markup(
    embed_html: str,
    *,
    height: str,
    title: str,
    caption: str | None = None,
) -> str:
    escaped_srcdoc = html.escape(embed_html, quote=True)
    escaped_title = html.escape(title, quote=True)
    escaped_height = html.escape(height, quote=True)
    caption_markup = (
        '<figcaption class="jsonschema-diagram-sphinx__caption">'
        f"{html.escape(caption)}</figcaption>"
        if caption
        else ""
    )

    return (
        '<figure class="jsonschema-diagram-sphinx" '
        f'style="--jsonschema-diagram-height: {escaped_height};">'
        f'<iframe class="jsonschema-diagram-sphinx__frame" loading="lazy" '
        f'title="{escaped_title}" srcdoc="{escaped_srcdoc}"></iframe>'
        f"{caption_markup}"
        f"</figure>"
    )


class JsonSchemaDiagramDirective(SphinxDirective):
    has_content = True
    option_spec = {
        "schema-file": directives.path,
        "height": directives.unchanged,
        "caption": directives.unchanged,
        "theme": directives.unchanged,
    }

    def run(self):
        schema = self._resolve_schema()

        if getattr(self.env.app.builder, "format", "") != "html":
            source = json.dumps(schema, ensure_ascii=False, indent=2)
            literal = nodes.literal_block(source, source)
            literal["language"] = "json"
            return [literal]

        template_path = Path(self.env.app.config.jsonschema_diagram_embed_template)
        self.env.note_dependency(str(template_path))
        theme = self._resolve_theme()
        embed_html = render_embed_document(
            template_path,
            schema,
            default_theme=theme,
        )
        caption = self.options.get("caption")
        iframe_markup = build_iframe_markup(
            embed_html,
            height=self.options.get(
                "height",
                self.env.app.config.jsonschema_diagram_default_height,
            ),
            title=caption or "JSON Schema diagram",
            caption=caption,
        )
        return [nodes.raw("", iframe_markup, format="html")]

    def _resolve_schema(self):
        has_inline_content = bool(self.content)
        has_schema_file = "schema-file" in self.options
        configured_default = self.env.app.config.jsonschema_diagram_default_schema_path

        if has_inline_content and has_schema_file:
            raise self.error(
                "Use either inline JSON content or :schema-file:, not both."
            )

        if has_inline_content:
            return self._parse_inline_json("\n".join(self.content))

        if has_schema_file:
            _, absolute_path = self.env.relfn2path(self.options["schema-file"])
            path = Path(absolute_path)
            self.env.note_dependency(str(path))
            return load_json_schema(path)

        if configured_default:
            path = Path(configured_default)
            self.env.note_dependency(str(path))
            return load_json_schema(path)

        raise self.error(
            "No schema source provided. Add inline JSON, use :schema-file:, "
            "or configure `jsonschema_diagram_default_schema_path`."
        )

    def _resolve_theme(self) -> str | None:
        theme = self.options.get("theme") or (
            self.env.app.config.jsonschema_diagram_default_theme
        )

        if theme is None:
            return None

        try:
            return validate_theme_id(theme)
        except ValueError as exc:
            raise self.error(str(exc)) from exc

    def _parse_inline_json(self, content: str):
        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            raise self.error(f"Inline JSON Schema is not valid JSON: {exc}") from exc


def _copy_static_assets(app: Sphinx):
    if getattr(app.builder, "format", "") != "html":
        return

    source_dir = PACKAGE_DIR / "_static"
    target_dir = Path(app.outdir) / "_static" / "jsonschema_diagram_sphinx"
    copy_asset(str(source_dir), str(target_dir))


def setup(app: Sphinx):
    app.add_config_value(
        "jsonschema_diagram_embed_template",
        str(DEFAULT_EMBED_TEMPLATE),
        "env",
        [str],
    )
    app.add_config_value(
        "jsonschema_diagram_default_schema_path",
        None,
        "env",
        [str, type(None)],
    )
    app.add_config_value(
        "jsonschema_diagram_default_height",
        DEFAULT_HEIGHT,
        "env",
        [str],
    )
    app.add_config_value(
        "jsonschema_diagram_default_theme",
        None,
        "env",
        [str, type(None)],
    )
    app.add_directive("jsonschema-diagram", JsonSchemaDiagramDirective)
    app.connect("builder-inited", _copy_static_assets)
    app.add_css_file("jsonschema_diagram_sphinx/jsonschema_diagram_sphinx.css")

    return {
        "version": __version__,
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }
