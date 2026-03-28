Python API
==========

The Python package wraps the embed template, the shared schema, and the local
HTTP server behind a small API that is easy to script.

Installation
------------

.. code-block:: bash

   python3 -m pip install jsonschema-diagram

Core Imports
------------

The most common imports are:

.. code-block:: python

   from jsonschema_diagram import (
       create_server,
       load_default_schema,
       load_json_schema,
       render_embed_html,
       write_embed_html,
   )

Loading Schemas
---------------

Load the project-wide shared schema:

.. code-block:: python

   from jsonschema_diagram import load_default_schema

   schema = load_default_schema()

Load any JSON Schema file from disk:

.. code-block:: python

   from jsonschema_diagram import load_json_schema

   schema = load_json_schema("schemas/default.json")

Rendering Embed HTML
--------------------

Render a self-contained HTML document using the Jinja2 embed template:

.. code-block:: python

   from jsonschema_diagram import render_embed_html

   html = render_embed_html(
       {"title": "Example", "type": "object"},
       default_theme="slate",
   )

Important parameters:

- ``schema``: the raw JSON Schema object
- ``template_path``: optional path to a custom embed template
- ``default_theme``: optional theme id for embed mode

Writing Embed Files
-------------------

To write the rendered document directly to disk:

.. code-block:: python

   from jsonschema_diagram import write_embed_html

   write_embed_html(
       "build/diagram.html",
       {"title": "Release Schema", "type": "object"},
       default_theme="slate",
   )

This is useful in:

- doc generation pipelines
- build scripts
- CI artifact generation
- release packaging

Serving The Site
----------------

Create an HTTP server for the built frontend and schema endpoint:

.. code-block:: python

   from jsonschema_diagram import create_server

   server = create_server(host="127.0.0.1", port=8000)
   server.serve_forever()

The server serves:

- the built SPA from ``dist/site``
- the default schema from ``schemas/default.json``

Custom Paths
------------

The server can be pointed at a different build or a different schema file:

.. code-block:: python

   from pathlib import Path
   from jsonschema_diagram import create_server

   server = create_server(
       static_dir=Path("my-static-site"),
       schema_path=Path("my-schema.json"),
   )

Theme Validation
----------------

Use ``validate_theme_id`` when you want to verify user-supplied theme values
before rendering:

.. code-block:: python

   from jsonschema_diagram import validate_theme_id

   theme = validate_theme_id("slate")

Valid themes are:

- ``slate``
- ``mono``
- ``cobalt``
- ``mint``
- ``coral``
- ``gold``

When To Use The API
-------------------

The Python API is best when you need:

- embed HTML generation inside Python tooling
- a local viewer server without wiring your own handler
- reusable integration from scripts, notebooks, or build steps
- a stable interface shared by the CLI and Sphinx extension
