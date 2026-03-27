from __future__ import annotations

import io
import json
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from tempfile import TemporaryDirectory

from jsonschema_diagram import (
    load_default_schema,
    render_embed_html,
    validate_theme_id,
)
from jsonschema_diagram.cli import main as cli_main

try:
    import jinja2  # noqa: F401
except ModuleNotFoundError:
    HAS_JINJA2 = False
else:
    HAS_JINJA2 = True


class PythonApiTests(unittest.TestCase):
    def test_validate_theme_id_rejects_unknown_theme(self):
        with self.assertRaises(ValueError):
            validate_theme_id("future-neon")

    def test_load_default_schema_reads_shared_fixture(self):
        schema = load_default_schema()

        self.assertEqual(schema["title"], "Catalog Entry")

    @unittest.skipUnless(HAS_JINJA2, "jinja2 is required for embed rendering")
    def test_render_embed_html_injects_schema_and_theme(self):
        with TemporaryDirectory() as temp_dir:
            template_path = Path(temp_dir) / "embed.jinja2.html"
            template_path.write_text(
                """
                <script>
                window.__JSONSCHEMA_DIAGRAM_CONFIG__ = {
                  mode: "embed",
                  defaultTheme: {{ default_theme | tojson }},
                  defaultSchema: {{ default_schema | tojson }}
                };
                </script>
                """,
                encoding="utf-8",
            )

            rendered = render_embed_html(
                {"title": "Python API Demo", "type": "object"},
                template_path=template_path,
                default_theme="slate",
            )

            self.assertIn("Python API Demo", rendered)
            self.assertIn('"slate"', rendered)

    @unittest.skipUnless(HAS_JINJA2, "jinja2 is required for embed rendering")
    def test_cli_render_embed_writes_output_file(self):
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            schema_path = root / "schema.json"
            schema_path.write_text(
                json.dumps({"title": "CLI Demo", "type": "object"}),
                encoding="utf-8",
            )
            template_path = root / "embed.jinja2.html"
            template_path.write_text(
                """
                <script>
                window.__JSONSCHEMA_DIAGRAM_CONFIG__ = {
                  mode: "embed",
                  defaultTheme: {{ default_theme | tojson }},
                  defaultSchema: {{ default_schema | tojson }}
                };
                </script>
                """,
                encoding="utf-8",
            )
            output_path = root / "out.html"
            stdout = io.StringIO()

            with redirect_stdout(stdout):
                exit_code = cli_main(
                    [
                        "render-embed",
                        "--schema-path",
                        str(schema_path),
                        "--template-path",
                        str(template_path),
                        "--theme",
                        "slate",
                        "--output",
                        str(output_path),
                    ]
                )

            self.assertEqual(exit_code, 0)
            self.assertTrue(output_path.exists())
            self.assertIn("Wrote embed HTML", stdout.getvalue())
            self.assertIn("CLI Demo", output_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
