<div align="center">

# jsonschema_diagram

*A frontend-first toolkit for visualizing `JSON Schema` as an interactive node graph, with a polished web viewer, self-contained embed artifacts, a Python API, CLI, and Sphinx integration.*

[![Python](https://img.shields.io/badge/python-3.10+-blue)](https://python.org)
[![Node](https://img.shields.io/badge/node-18.19+-5fa04e)](https://nodejs.org)
[![React](https://img.shields.io/badge/frontend-react%20%2B%20vite-61dafb)](https://react.dev)
[![Code style: Black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)
[![Type checked: mypy](https://img.shields.io/badge/type--checked-mypy-blue)](https://mypy.readthedocs.io/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**[Documentation](https://miskler.github.io/jsonschema-diagram/getting-started.html)** | **[Sphinx Demo](https://miskler.github.io/jsonschema-diagram/demo.html)** | **[Python API](https://miskler.github.io/jsonschema-diagram/python-api.html)** | **[CLI](https://miskler.github.io/jsonschema-diagram/cli.html)** | **[Schema Support](https://miskler.github.io/jsonschema-diagram/schema-support.html)**

</div>

<h2 align="center">✨ Features</h2>

- **Interactive schema graph**: render objects, arrays, refs, enums, and combinators as connected cards instead of raw JSON blocks.
- **Frontend-first architecture**: parsing, graph building, ref resolution, layout, search, and interaction all live in the browser.
- **Embed-ready output**: generate a self-contained HTML viewer for docs portals, static pages, and Sphinx.
- **Python integration**: use a small Python API and CLI to serve the site, render embed HTML, and integrate with docs tooling.
- **Sphinx extension included**: embed diagrams from inline JSON, local schema files, or a shared default schema.
- **Selection and path tooling**: inspect schema paths and JSON paths, copy them in multiple formats, and follow links across the graph.
- **Theme-aware viewer**: support clean read-only embed mode with configurable default themes.

<h2 align="center">🚀 Quick Start</h2>

<h3 align="center">Installation</h3>

For normal usage from this repository checkout, install the Python package and use
the bundled frontend artifacts:

```bash
python3 -m pip install -e .
```

You do **not** need `npm install` just to:

- serve the viewer
- render embed HTML
- use the Python API
- use the Sphinx extension

<h3 align="center">Local Viewer</h3>

Serve the viewer and the default schema endpoint:

```bash
jsonschema-diagram serve
```

<h3 align="center">Self-Contained Embed</h3>

```bash
jsonschema-diagram render-embed \
  --schema-path schemas/default.json \
  --theme slate \
  --output diagram.html
```

<h3 align="center">30-Second Python Example</h3>

```python
from jsonschema_diagram import load_default_schema, render_embed_html

schema = load_default_schema()
html = render_embed_html(schema, default_theme="slate")

print(html[:200])
```

<h3 align="center">CLI Usage</h3>

```bash
# Serve the built site plus /api/default-jsonschema
jsonschema-diagram serve --host 127.0.0.1 --port 8000

# Render a self-contained embed document
jsonschema-diagram render-embed \
  --schema-path schemas/default.json \
  --theme slate \
  --output diagram.html

# Read schema JSON from stdin
cat schemas/default.json | jsonschema-diagram render-embed --stdin --output diagram.html
```

<h3 align="center">Sphinx Guide</h3>

Build the embed artifact and the docs site:

```bash
python3 -m pip install -r docs/requirements.txt
npm run build:embed
python3 -m sphinx -E -a -b html docs docs/_build/html
```

Minimal `conf.py`:

```python
extensions = ["jsonschema_diagram_sphinx"]

jsonschema_diagram_embed_template = "dist/embed/jsonschema-diagram.embed.jinja2.html"
jsonschema_diagram_default_schema_path = "schemas/default.json"
jsonschema_diagram_default_height = "760px"
jsonschema_diagram_default_theme = "slate"
```

Minimal directive:

```rst
.. jsonschema-diagram::
   :schema-file: examples/pattern-catalog.json
   :theme: mono
   :height: 720px
```

<h3 align="center">Frontend Development Only</h3>

You only need Node.js and `npm install` when you want to rebuild or work on the
frontend itself:

```bash
npm install
npm run dev
```

<h2 align="center">🧭 Viewer Modes</h2>

<h3 align="center"><code>site</code></h3>

The full application experience:

- left schema input panel
- theme preset picker
- raw schema editor
- apply/reset actions
- graph canvas, search, zoom, and selection dialog

<h3 align="center"><code>embed</code></h3>

The clean viewer-only mode:

- no left editor panel
- ideal for docs and static embedding
- default schema and theme are injected through runtime config or Jinja

Runtime config shape:

```html
<script>
window.__JSONSCHEMA_DIAGRAM_CONFIG__ = {
  mode: "embed",
  defaultTheme: "slate",
  defaultSchema: {...}
};
</script>
```

<h2 align="center">📦 Build Outputs</h2>

```bash
npm run build
```

This produces:

- `dist/site/index.html`: normal static site build
- `dist/embed/jsonschema-diagram.embed.html`: baked standalone embed file
- `dist/embed/jsonschema-diagram.embed.jinja2.html`: Jinja2-friendly embed template

The Jinja2 embed variant accepts:

- `default_schema`
- `default_schema_json`
- `default_theme`

If not provided, it falls back to the shared schema in `schemas/default.json` and the default embed theme.

<h2 align="center">🧩 Supported Schema Features</h2>

Current core support includes:

- `type`
- `format`
- `properties`
- `required`
- `patternProperties`
- `items`
- `prefixItems`
- `enum`
- `const`
- `anyOf`
- `oneOf`
- `allOf`
- local `#/...` `$ref`

More detail is documented in [Schema Support](https://miskler.github.io/jsonschema-diagram/schema-support.html).

<h2 align="center">🐍 Python API</h2>

Public helpers currently include:

- `load_default_schema()`
- `load_json_schema(path)`
- `render_embed_html(schema, default_theme=...)`
- `write_embed_html(path, schema, default_theme=...)`
- `create_server(...)`
- `build_handler(...)`

Example:

```python
from jsonschema_diagram import create_server, load_json_schema, write_embed_html

schema = load_json_schema("schemas/default.json")
write_embed_html("build/diagram.html", schema, default_theme="mono")

server = create_server(host="127.0.0.1", port=8000)
server.serve_forever()
```

Full reference: [Python API](https://miskler.github.io/jsonschema-diagram/python-api.html)

<h2 align="center">📚 Sphinx Extension</h2>

The repository ships with `jsonschema_diagram_sphinx`, which embeds the viewer
through an `iframe` using the self-contained embed artifact.

Minimal `conf.py`:

```python
extensions = ["jsonschema_diagram_sphinx"]

jsonschema_diagram_embed_template = "dist/embed/jsonschema-diagram.embed.jinja2.html"
jsonschema_diagram_default_schema_path = "schemas/default.json"
jsonschema_diagram_default_height = "760px"
jsonschema_diagram_default_theme = "slate"
```

Minimal directive:

```rst
.. jsonschema-diagram::
   :schema-file: examples/pattern-catalog.json
   :theme: mono
   :height: 720px
```

More detail: [Sphinx Extension](https://miskler.github.io/jsonschema-diagram/sphinx-extension.html)

<h2 align="center">📖 Documentation</h2>

The repository includes a much more detailed Sphinx doc set than the demo page alone.

- [Getting Started](https://miskler.github.io/jsonschema-diagram/getting-started.html)
- [Viewer Modes](https://miskler.github.io/jsonschema-diagram/viewer-modes.html)
- [Python API](https://miskler.github.io/jsonschema-diagram/python-api.html)
- [CLI](https://miskler.github.io/jsonschema-diagram/cli.html)
- [Sphinx Extension](https://miskler.github.io/jsonschema-diagram/sphinx-extension.html)
- [Schema Support](https://miskler.github.io/jsonschema-diagram/schema-support.html)
- [Troubleshooting](https://miskler.github.io/jsonschema-diagram/troubleshooting.html)
- [Development](https://miskler.github.io/jsonschema-diagram/development.html)
- [Demo Page](https://miskler.github.io/jsonschema-diagram/demo.html)

Build the docs locally:

```bash
python3 -m pip install -r docs/requirements.txt
python3 -m sphinx -E -a -b html docs docs/_build/html
```

<h2 align="center">🛠️ Development</h2>

Common commands:

```bash
npm test
python3 -m unittest discover -s tests -v
npm run build
python3 -m sphinx -E -a -b html docs docs/_build/html
```

Python code quality commands:

```bash
make format
make lint
make type-check
```

These use the configured tooling:

- `black`
- `isort`
- `flake8`
- `mypy`

<h2 align="center">🗂️ Project Layout</h2>

- `src/`: React + TypeScript viewer
- `schemas/default.json`: shared default schema
- `jsonschema_diagram/`: Python API and CLI
- `jsonschema_diagram_sphinx/`: Sphinx extension
- `backend/`: compatibility HTTP server entrypoint
- `docs/`: Sphinx documentation source
- `scripts/build-embed.mjs`: embed builder

<h2 align="center">📄 License</h2>

MIT License. See [LICENSE](LICENSE) for details.
