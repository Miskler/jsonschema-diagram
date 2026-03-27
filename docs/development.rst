Development
===========

This page is aimed at contributors working on the codebase itself.

Repository Layout
-----------------

Important directories:

- ``src/``: React app, graph builder, layout logic, canvas UI
- ``schemas/``: shared default schema fixture
- ``jsonschema_diagram/``: Python API and CLI
- ``jsonschema_diagram_sphinx/``: Sphinx extension and extension CSS
- ``backend/``: compatibility server entrypoint
- ``docs/``: Sphinx documentation source
- ``tests/``: Python-side tests

Common Commands
---------------

Frontend development:

.. code-block:: bash

   npm install
   npm run dev

Frontend tests:

.. code-block:: bash

   npm test

Production builds:

.. code-block:: bash

   npm run build

Python tests:

.. code-block:: bash

   python3 -m unittest discover -s tests -v

Docs build:

.. code-block:: bash

   python3 -m sphinx -E -a -b html docs docs/_build/html

Useful Development Flows
------------------------

When changing graph rendering or styles:

1. run ``npm run dev``
2. validate manually in the browser
3. run ``npm test``
4. rebuild with ``npm run build``

When changing embed behavior:

1. run ``npm run build:embed``
2. rebuild docs with ``python3 -m sphinx -E -a -b html docs docs/_build/html``
3. verify ``docs/_build/html/demo.html``

When changing Python API or Sphinx code:

1. run ``python3 -m unittest discover -s tests -v``
2. run docs-specific tests if needed
3. rebuild the docs

Shared Assets And Contracts
---------------------------

The same default schema is reused across the stack, so changes to
``schemas/default.json`` affect:

- site mode startup
- Python server responses
- baked embed output
- Sphinx demos

The frontend runtime config is the main browser-side integration contract:

- ``mode``
- ``defaultSchemaUrl``
- ``defaultSchema``
- ``defaultTheme``

Themes
------

Theme presets are defined in:

- ``src/lib/theme-presets.ts``
- ``src/styles.css``

If you add or rename a theme, update all three places:

- frontend preset list
- CSS variables
- Python-side ``VALID_THEME_IDS``

Docs Maintenance
----------------

Keep the docs in sync when changing:

- CLI commands
- Python public functions
- embed template variables
- Sphinx directive options
- supported schema keywords

Release Checklist
-----------------

Before publishing or handing off a change set, it is worth checking:

1. ``npm test``
2. ``python3 -m unittest discover -s tests -v``
3. ``npm run build``
4. ``python3 -m sphinx -E -a -b html docs docs/_build/html``
5. open the built demo docs and at least one embed artifact
