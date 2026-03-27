Viewer Modes
============

The application has two runtime modes: ``site`` and ``embed``.

Site Mode
---------

``site`` is the full application experience. It includes:

- the left schema input panel
- theme preset selection
- raw schema editing
- apply and reset actions
- clipboard paste into the schema editor
- the main graph canvas
- the selection dialog

The default runtime behavior in ``site`` mode is:

- load ``/api/default-jsonschema`` if no baked schema is injected
- persist the selected theme in ``localStorage``

This is the right mode for:

- internal tools
- developer playgrounds
- reviewing and editing schemas
- QA and documentation authoring

Embed Mode
----------

``embed`` is a cleaner viewer-only runtime intended for documentation and
static embedding.

In ``embed`` mode:

- the left schema input panel is hidden
- the graph canvas fills the layout
- the baked schema or injected schema is rendered directly
- a default theme can be injected through runtime config

This is the right mode for:

- Sphinx
- Jinja2 templates
- static docs portals
- lightweight demos
- generated documentation artifacts

Runtime Config
--------------

Both modes use the same global runtime bridge:

.. code-block:: html

   <script>
   window.__JSONSCHEMA_DIAGRAM_CONFIG__ = {
     mode: "embed",
     defaultTheme: "slate",
     defaultSchema: {...}
   };
   </script>

Supported keys:

- ``mode``: ``"site"`` or ``"embed"``
- ``defaultSchemaUrl``: URL for lazy loading the initial schema
- ``defaultSchema``: raw JSON Schema object embedded directly in the page
- ``defaultTheme``: one of ``slate``, ``mono``, ``cobalt``, ``mint``, ``coral``, or ``gold``

Schema Resolution Priority
--------------------------

The viewer resolves the initial schema in this order:

1. ``defaultSchema`` from runtime config
2. ``defaultSchemaUrl`` from runtime config
3. ``/api/default-jsonschema`` in ``site`` mode

Theme Behavior
--------------

Themes also behave slightly differently between modes.

In ``site`` mode:

- user theme changes are stored in ``localStorage``
- a configured default theme is only used for initial load

In ``embed`` mode:

- the configured default theme is used directly
- no left-side theme picker is shown
- the embed stays deterministic across loads

Interaction Model
-----------------

Both modes still include the graph interaction surface:

- zoom controls
- search
- fit-to-view
- node and row selection
- selection dialog with copyable paths

What changes is the surrounding shell, not the graph engine itself.
