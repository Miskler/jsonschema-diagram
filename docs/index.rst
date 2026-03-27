JSON Schema Diagram
===================

``jsonschema_diagram`` is a frontend-first viewer for JSON Schema documents.
It turns nested objects, arrays, refs, combinators, enums, and pattern-based
objects into an explorable node graph that can run as:

- a normal static site
- a self-contained embed artifact
- a Python-rendered HTML snippet
- a Sphinx directive inside docs

The codebase is intentionally split so that parsing, graph building, ref
resolution, layout, and interaction all stay in the browser, while Python
handles serving, embedding, packaging, and documentation workflows.

What This Documentation Covers
------------------------------

This documentation set is broader than the demo page. It explains:

- how to run the web app locally
- how ``site`` and ``embed`` modes differ
- how to use the Python API and CLI
- how to integrate the Sphinx extension
- which JSON Schema features are supported today
- how path formatting works in the selection dialog
- how to troubleshoot common frontend, embed, and docs issues
- how to work on the project itself

Guides
------

.. toctree::
   :maxdepth: 2
   :caption: Guides

   getting-started
   viewer-modes
   python-api
   cli
   sphinx-extension

Reference
---------

.. toctree::
   :maxdepth: 2
   :caption: Reference

   schema-support
   troubleshooting
   development

Examples
--------

.. toctree::
   :maxdepth: 2
   :caption: Examples

   demo
