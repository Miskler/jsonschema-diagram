# jsonschema_diagram

Interactive frontend for visualizing `JSON Schema` as a node diagram. The parser,
graph builder, ref resolution, and layout logic all live in the browser. Python
now also provides a small library API, CLI, Sphinx extension, and shared
helpers for serving the default schema and rendering embed HTML.

## What is inside

- `src/`: React + TypeScript app powered by `Vite`, `React Flow`, `ELK`, and `Ajv`
- `schemas/default.json`: shared schema used by both frontend and Python backend
- `jsonschema_diagram/`: Python API and CLI for serving the app or rendering embeds
- `backend/app.py`: compatibility entrypoint for the minimal Python 3 server
- `scripts/build-embed.mjs`: bakes the site build into a self-contained HTML file

## Frontend capabilities

- dark diagram UI with table-like schema cards
- support for `properties`, `required`, `items`, `enum`, `const`, `anyOf`, `oneOf`, `allOf`
- local `#/...` `$ref` resolution with cycle-safe graph building
- raw JSON textarea, apply/reset flow, warnings for unsupported keywords
- selection details with JSON Pointer and detected constraints
- viewer-only embed mode with configurable default theme

## Local development

1. Install Node.js 18.19+.
2. Install dependencies:

```bash
npm install
```

3. Run the frontend:

```bash
npm run dev
```

4. In another terminal, serve the Python endpoint and built frontend when needed:

```bash
python3 -m backend.app
```

## Build outputs

- `npm run build:site` creates the normal static site in `dist/site`
- `npm run build:embed` turns the site build into self-contained HTML in `dist/embed`
- `npm run build` runs both steps in order

The embed artifact is designed for documentation systems such as `Sphinx`, where
you want to ship a baked schema with a file that can be opened directly.

`build:embed` now produces two embed variants:
- `dist/embed/jsonschema-diagram.embed.html`: baked schema, ready to open directly
- `dist/embed/jsonschema-diagram.embed.jinja2.html`: Jinja2-friendly template

The Jinja2 variant accepts either:
- `default_schema`: a Python dict-like schema object, rendered through `tojson`
- `default_schema_json`: a pre-serialized JSON string marked as safe
- `default_theme`: one of `slate`, `mono`, `cobalt`, `mint`, `coral`, or `gold`

If neither variable is provided, it falls back to the baked schema from
`schemas/default.json`. In embed mode the left schema editor panel is hidden, so
the viewer behaves like a clean read-only canvas.

## Python API and CLI

Install in editable mode when you want the Python entrypoints:

```bash
python3 -m pip install -e .
```

Library usage:

```python
from jsonschema_diagram import load_default_schema, render_embed_html

schema = load_default_schema()
html = render_embed_html(schema, default_theme="slate")
```

CLI usage:

```bash
jsonschema-diagram serve --host 127.0.0.1 --port 8000
jsonschema-diagram render-embed --schema-path schemas/default.json --theme slate --output diagram.html
```

## Python backend contract

`GET /api/default-jsonschema` returns the raw JSON document from `schemas/default.json`.

When `dist/site` exists, the Python server also serves the built frontend with
SPA fallback to `index.html`.

## Tests

- Frontend unit/integration tests: `npm test`
- Python smoke tests: `python3 -m unittest discover -s tests -v`

## Sphinx extension demo

This repository now includes a local Sphinx extension in `jsonschema_diagram_sphinx`
plus a demo site in `docs/`.

1. Build the embed artifacts:

```bash
npm run build:embed
```

2. Install docs dependencies:

```bash
python3 -m pip install -r docs/requirements.txt
```

3. Build the demo docs:

```bash
python3 -m sphinx -b html docs docs/_build/html
```

The demo extension accepts inline JSON, `:schema-file:` paths, or a default
schema configured in `docs/conf.py`. Theme can also be set globally with
`jsonschema_diagram_default_theme` or per-directive with `:theme:`.
