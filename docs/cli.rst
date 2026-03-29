CLI
===

The package ships with a small CLI focused on the most common Python-side
operations: serving the viewer, rendering embed HTML, and exporting site-mode
bundles.

Installation
------------

.. code-block:: bash

   python3 -m pip install jsonschema-diagram

After installation:

.. code-block:: bash

   jsonschema-diagram --help

You can also run it as a module:

.. code-block:: bash

   python3 -m jsonschema_diagram --help

Command Overview
----------------

The CLI currently provides:

- ``serve``
- ``render-embed``
- ``render-site``

``serve``
---------

Start the local server for the built site:

.. code-block:: bash

   jsonschema-diagram serve

Useful options:

- ``--host``: bind host, default ``127.0.0.1``
- ``--port``: bind port, default ``8000``
- ``--static-dir``: directory with the built site
- ``--schema-path``: schema served from ``/api/default-jsonschema``

Example:

.. code-block:: bash

   jsonschema-diagram serve --host 0.0.0.0 --port 9000

``render-embed``
----------------

Render a self-contained embed document to stdout or a file:

.. code-block:: bash

   jsonschema-diagram render-embed --output diagram.html

Useful options:

- ``--schema-path``: load the schema from a JSON file
- ``--stdin``: read the schema payload from standard input
- ``--schema-url``: let the viewer fetch the default schema from a URL
- ``--output`` or ``-o``: output path, or ``-`` for stdout
- ``--theme``: default embed theme
- ``--template-path``: custom Jinja2 embed template

``render-site``
---------------

Copy the built site assets and inject a site-mode runtime config into
``index.html``:

.. code-block:: bash

   jsonschema-diagram render-site --site-dir dist/site --output build/site

Useful options:

- ``--schema-path``: load the schema from a JSON file and inject it
- ``--stdin``: read the schema payload from standard input
- ``--schema-url``: configure site mode to fetch the default schema from a URL
- ``--output`` or ``-o``: destination directory for the rendered bundle
- ``--theme``: default site theme
- ``--site-dir``: source directory with the built SPA assets

Examples
--------

Render from the shared default schema:

.. code-block:: bash

   jsonschema-diagram render-embed --theme slate --output diagram.html

Render from a specific schema file:

.. code-block:: bash

   jsonschema-diagram render-embed \
     --schema-path docs/examples/pattern-catalog.json \
     --theme mono \
     --output docs/_build/pattern-catalog.html

Pipe JSON through stdin:

.. code-block:: bash

   cat schema.json | jsonschema-diagram render-embed --stdin --output diagram.html

Print HTML to stdout:

.. code-block:: bash

   jsonschema-diagram render-embed --schema-path schema.json --output -

Render a site bundle from a specific schema file:

.. code-block:: bash

   jsonschema-diagram render-site \
     --schema-path docs/examples/pattern-catalog.json \
     --theme mint \
     --site-dir dist/site \
     --output docs/_build/pattern-catalog-site

Render a site bundle that fetches its schema at runtime:

.. code-block:: bash

   jsonschema-diagram render-site \
     --schema-url /api/default-jsonschema \
     --site-dir dist/site \
     --output build/site

Choosing Between CLI And API
----------------------------

Use the CLI when:

- you are wiring shell scripts
- you want quick local commands
- you are building CI artifacts
- you want to export a ready-to-host site bundle
- you do not need Python-level control flow

Use the Python API when:

- you need to construct schemas dynamically
- you want tighter integration with another Python application
- you want to keep everything inside a Python build or docs toolchain
