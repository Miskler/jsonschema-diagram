Sphinx Extension
================

The repository includes a local Sphinx extension called
``jsonschema_diagram_sphinx``. It embeds the viewer through an ``iframe`` whose
``srcdoc`` contains the self-contained embed artifact.

Why This Extension Exists
-------------------------

It solves a few practical problems for documentation systems:

- keeps the frontend logic in the browser
- avoids runtime asset fetching from the docs page
- allows a clean embed mode without the editor sidebar
- lets docs authors provide schemas inline, from files, or from a shared default

Installation
------------

For docs work in this repository:

.. code-block:: bash

   python3 -m pip install -r docs/requirements.txt

If you want to use the extension as a package entry in another project:

.. code-block:: bash

   python3 -m pip install -e .

Basic Configuration
-------------------

Minimal ``conf.py`` setup:

.. code-block:: python

   extensions = ["jsonschema_diagram_sphinx"]

   jsonschema_diagram_embed_template = "dist/embed/jsonschema-diagram.embed.jinja2.html"
   jsonschema_diagram_default_schema_path = "schemas/default.json"
   jsonschema_diagram_default_height = "760px"
   jsonschema_diagram_default_theme = "slate"

Config Values
-------------

``jsonschema_diagram_embed_template``
   Path to the Jinja2 embed template. This should normally point to
   ``dist/embed/jsonschema-diagram.embed.jinja2.html``.

``jsonschema_diagram_default_schema_path``
   Optional default schema used when a directive does not provide inline JSON
   or ``:schema-file:``.

``jsonschema_diagram_default_height``
   Default iframe height.

``jsonschema_diagram_default_theme``
   Default embed theme. Must be one of ``slate``, ``mono``, ``cobalt``,
   ``mint``, ``coral``, or ``gold``.

Directive Syntax
----------------

The directive name is:

.. code-block:: rst

   .. jsonschema-diagram::

Supported options:

- ``:schema-file:``
- ``:height:``
- ``:caption:``
- ``:theme:``

Schema Sources
--------------

The directive supports three schema sources.

1. Inline JSON:

.. code-block:: rst

   .. jsonschema-diagram::

      {
        "title": "Inline Example",
        "type": "object"
      }

2. File-based schema:

.. code-block:: rst

   .. jsonschema-diagram::
      :schema-file: examples/pattern-catalog.json

3. Shared default from ``conf.py``:

.. code-block:: rst

   .. jsonschema-diagram::

Theme Override Per Diagram
--------------------------

You can override the default theme per directive:

.. code-block:: rst

   .. jsonschema-diagram::
      :schema-file: examples/pattern-catalog.json
      :theme: mono
      :height: 700px

Build Workflow
--------------

Recommended docs build flow:

1. Build the embed artifact:

.. code-block:: bash

   npm run build:embed

2. Build the Sphinx site:

.. code-block:: bash

   python3 -m sphinx -E -a -b html docs docs/_build/html

The ``-E -a`` flags are especially useful after frontend changes because they
force Sphinx to rebuild pages that embed the viewer.

How Rebuild Tracking Works
--------------------------

The extension registers the embed template and schema files as Sphinx
dependencies, so changes to those files invalidate the right pages on the next
build.

When Not To Use The Extension
-----------------------------

The extension is a strong fit for docs. It is less ideal when:

- you need direct JS integration with the parent page
- you want the editing sidebar inside the docs page
- you want to manage the graph viewer as a normal SPA route instead of an embed
