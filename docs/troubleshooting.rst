Troubleshooting
===============

This page collects the most common issues seen while working with the viewer,
embed artifacts, and Sphinx integration.

Frontend Build Not Found
------------------------

If the Python server returns a ``503`` with a message about a missing frontend
build, run:

.. code-block:: bash

   npm install
   npm run build:site

The local server expects the built site in ``dist/site``.

Embed Changes Do Not Show Up In Docs
------------------------------------

If Sphinx pages still show old behavior after frontend changes:

.. code-block:: bash

   npm run build:embed
   python3 -m sphinx -E -a -b html docs docs/_build/html

The important part is rebuilding both:

- the embed artifact
- the Sphinx HTML pages that inline it

Opening Non-Self-Contained HTML Over ``file://``
------------------------------------------------

Normal Vite production output is not meant to be opened directly from
``file://`` because browsers will block asset loading.

Use one of these instead:

- ``dist/site`` through HTTP
- ``dist/embed/jsonschema-diagram.embed.html`` for standalone embed viewing

Sphinx Theme Not Found
----------------------

If Sphinx reports that the ``furo`` theme cannot be found, install docs
dependencies:

.. code-block:: bash

   python3 -m pip install -r docs/requirements.txt

Clipboard Paste Does Not Work
-----------------------------

Clipboard access in the editor depends on browser capabilities and origin
security rules. If paste from the toolbar fails:

- use a secure origin or local dev server
- paste manually into the raw schema editor

Huge Bundle Warning During Build
--------------------------------

The current frontend bundle is still large enough to trigger Vite's chunk-size
warning. This is not a functional error, but it is useful to know when tuning
performance.

If you see the warning:

- the build still succeeded
- runtime behavior is still valid
- future optimization can focus on chunk splitting and lazy loading

Broken Or Stale Theme In Embed
------------------------------

If the wrong embed theme shows up:

- check ``defaultTheme`` in ``window.__JSONSCHEMA_DIAGRAM_CONFIG__``
- check ``default_theme`` in the Jinja2 render context
- rebuild embed output after changing frontend theme presets

Pattern Property Paths Look Surprising
--------------------------------------

For ``patternProperties``, JSON path uses a generated sample key, not the regex
itself. That is intentional because the path aims to look like instance data.

Combinator Branch Paths Use ``[*]``
-----------------------------------

If a selected node is the direct root of an ``anyOf`` or ``oneOf`` branch, the
JSON path may use ``[*]`` instead of a concrete array index or property name.
That means the schema branch describes the same instance slot as sibling
branches, so a single concrete location would be misleading.
