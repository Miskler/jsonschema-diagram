from __future__ import annotations

import unittest
from pathlib import Path
from typing import Callable

build_iframe_markup: Callable[..., str] | None
render_embed_document: Callable[..., str] | None
IMPORT_ERROR: ModuleNotFoundError | None

try:
    from jsonschema_diagram_sphinx import build_iframe_markup, render_embed_document
except ModuleNotFoundError as exc:  # pragma: no cover - depends on optional docs deps
    build_iframe_markup = None
    render_embed_document = None
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None

ROOT = Path(__file__).resolve().parents[1]
EMBED_TEMPLATE = ROOT / "dist" / "embed" / "jsonschema-diagram.embed.jinja2.html"


class SphinxExtensionTests(unittest.TestCase):
    @unittest.skipIf(
        IMPORT_ERROR is not None, f"Optional docs deps missing: {IMPORT_ERROR}"
    )
    def test_render_embed_document_injects_schema_payload(self):
        rendered = render_embed_document(
            EMBED_TEMPLATE,
            {
                "title": "Sphinx Demo",
                "type": "object",
            },
            default_theme="mono",
        )

        self.assertIn("window.__JSONSCHEMA_DIAGRAM_CONFIG__", rendered)
        self.assertIn("Sphinx Demo", rendered)
        self.assertIn("defaultTheme", rendered)
        self.assertIn('"mono"', rendered)
        self.assertNotIn('src="./assets/', rendered)
        self.assertNotIn('href="./assets/', rendered)

    @unittest.skipIf(
        IMPORT_ERROR is not None, f"Optional docs deps missing: {IMPORT_ERROR}"
    )
    def test_build_iframe_markup_wraps_srcdoc_and_caption(self):
        markup = build_iframe_markup(
            "<html><body>diagram</body></html>",
            height="640px",
            title="Demo",
            caption="Rendered in docs",
        )

        self.assertIn("srcdoc=", markup)
        self.assertIn("--jsonschema-diagram-height: 640px", markup)
        self.assertIn("Rendered in docs", markup)


if __name__ == "__main__":
    unittest.main()
