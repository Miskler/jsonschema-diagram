Getting Started
===============

This page is the fastest path from clone to a working viewer.

Project Shape
-------------

The repository has three main layers:

- ``src/``: the React and TypeScript application
- ``jsonschema_diagram/``: the Python API and CLI
- ``jsonschema_diagram_sphinx/``: the Sphinx extension

The shared default schema lives in ``schemas/default.json`` and is reused by:

- the frontend
- the Python HTTP endpoint
- the embed build
- the Sphinx demo

Requirements
------------

For local development you usually want:

- Node.js 18.19 or newer
- Python 3.10 or newer

Frontend Setup
--------------

Install the frontend dependencies:

.. code-block:: bash

   npm install

Start the Vite development server:

.. code-block:: bash

   npm run dev

That gives you the interactive site with live reload.

Production-Like Local Run
-------------------------

Build the static site:

.. code-block:: bash

   npm run build:site

Serve the frontend plus the shared schema endpoint:

.. code-block:: bash

   python3 -m backend.app

The Python server exposes:

- ``/`` for the built SPA
- ``/api/default-jsonschema`` for the shared default schema

Embed Artifacts
---------------

Build both normal site output and self-contained embed HTML:

.. code-block:: bash

   npm run build

Relevant outputs:

- ``dist/site/index.html`` for the normal static site
- ``dist/embed/jsonschema-diagram.embed.html`` for a baked standalone viewer
- ``dist/embed/jsonschema-diagram.embed.jinja2.html`` for template-driven embed rendering

Python Package Setup
--------------------

Install the Python package in editable mode when you want the library API,
CLI, or Sphinx extension from the same checkout:

.. code-block:: bash

   python3 -m pip install -e .

After that the CLI is available as:

.. code-block:: bash

   jsonschema-diagram --help

Build The Docs
--------------

Install docs dependencies:

.. code-block:: bash

   python3 -m pip install -r docs/requirements.txt

Build the Sphinx demo:

.. code-block:: bash

   python3 -m sphinx -E -a -b html docs docs/_build/html

Open:

- ``docs/_build/html/index.html``
- ``docs/_build/html/demo.html``

Suggested First Run
-------------------

If you are new to the project, this sequence gives the best overview:

1. Run ``npm install``.
2. Run ``npm run dev`` and inspect the live viewer.
3. Run ``python3 -m pip install -e .``.
4. Try ``jsonschema-diagram render-embed --theme slate --output diagram.html``.
5. Build the docs and open the Sphinx demo.
