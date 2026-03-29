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
    render_site_html,
    validate_theme_id,
    write_site_bundle,
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

    def test_render_site_html_injects_runtime_config(self):
        with TemporaryDirectory() as temp_dir:
            index_path = Path(temp_dir) / "index.html"
            index_path.write_text(
                """
                <!doctype html>
                <html>
                  <head>
                    <title>Site Demo</title>
                  </head>
                  <body>
                    <div id="root"></div>
                  </body>
                </html>
                """,
                encoding="utf-8",
            )

            rendered = render_site_html(
                {"title": "Site API Demo", "type": "object"},
                template_path=index_path,
                default_theme="mint",
            )

            self.assertIn('"mode":"site"', rendered)
            self.assertIn('"defaultTheme":"mint"', rendered)
            self.assertIn("Site API Demo", rendered)

    def test_write_site_bundle_copies_assets_and_index(self):
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            site_dir = root / "site-src"
            site_dir.mkdir()
            (site_dir / "index.html").write_text(
                """
                <!doctype html>
                <html>
                  <head></head>
                  <body>
                    <script type="module" src="/assets/app.js"></script>
                  </body>
                </html>
                """,
                encoding="utf-8",
            )
            assets_dir = site_dir / "assets"
            assets_dir.mkdir()
            (assets_dir / "app.js").write_text("console.log('site');", encoding="utf-8")

            output_dir = root / "rendered-site"
            write_site_bundle(
                output_dir,
                {"title": "Bundle Demo", "type": "object"},
                site_dir=site_dir,
                default_theme="coral",
            )

            self.assertTrue((output_dir / "assets" / "app.js").exists())
            rendered_index = (output_dir / "index.html").read_text(encoding="utf-8")
            self.assertIn('"mode":"site"', rendered_index)
            self.assertIn('"defaultTheme":"coral"', rendered_index)
            self.assertIn("Bundle Demo", rendered_index)

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

    def test_cli_render_site_writes_output_directory(self):
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            schema_path = root / "schema.json"
            schema_path.write_text(
                json.dumps({"title": "CLI Site Demo", "type": "object"}),
                encoding="utf-8",
            )
            site_dir = root / "site-src"
            site_dir.mkdir()
            (site_dir / "index.html").write_text(
                """
                <!doctype html>
                <html>
                  <head></head>
                  <body>
                    <div id="root"></div>
                  </body>
                </html>
                """,
                encoding="utf-8",
            )
            (site_dir / "style.css").write_text("body{}", encoding="utf-8")
            output_dir = root / "site-out"
            stdout = io.StringIO()

            with redirect_stdout(stdout):
                exit_code = cli_main(
                    [
                        "render-site",
                        "--schema-path",
                        str(schema_path),
                        "--site-dir",
                        str(site_dir),
                        "--theme",
                        "gold",
                        "--output",
                        str(output_dir),
                    ]
                )

            self.assertEqual(exit_code, 0)
            self.assertTrue((output_dir / "style.css").exists())
            self.assertIn("Wrote site bundle", stdout.getvalue())
            rendered_index = (output_dir / "index.html").read_text(encoding="utf-8")
            self.assertIn('"mode":"site"', rendered_index)
            self.assertIn('"defaultTheme":"gold"', rendered_index)
            self.assertIn("CLI Site Demo", rendered_index)


if __name__ == "__main__":
    unittest.main()
