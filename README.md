# jsonschema_diagram

Interactive frontend for visualizing `JSON Schema` as a node diagram. The parser,
graph builder, ref resolution, and layout logic all live in the browser. Python
is only responsible for serving the shared `default_jsonschema` and, optionally,
the built static frontend.

## What is inside

- `src/`: React + TypeScript app powered by `Vite`, `React Flow`, `ELK`, and `Ajv`
- `schemas/default.json`: shared schema used by both frontend and Python backend
- `backend/app.py`: minimal Python 3 server with `GET /api/default-jsonschema`
- `scripts/build-embed.mjs`: bakes the site build into a self-contained HTML file

## Frontend capabilities

- dark diagram UI with table-like schema cards
- support for `properties`, `required`, `items`, `enum`, `const`, `anyOf`, `oneOf`, `allOf`
- local `#/...` `$ref` resolution with cycle-safe graph building
- raw JSON textarea, apply/reset flow, warnings for unsupported keywords
- selection details with JSON Pointer and detected constraints

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

## Python backend contract

`GET /api/default-jsonschema` returns the raw JSON document from `schemas/default.json`.

When `dist/site` exists, the Python server also serves the built frontend with
SPA fallback to `index.html`.

## Tests

- Frontend unit/integration tests: `npm test`
- Python smoke tests: `python3 -m unittest discover -s tests -v`
