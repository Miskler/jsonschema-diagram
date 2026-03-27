Schema Support
==============

This page explains what the viewer currently supports and how those schema
features appear in the graph.

Core Supported Keywords
-----------------------

The current viewer supports these commonly used JSON Schema features:

- ``type``
- ``format``
- ``properties``
- ``required``
- ``patternProperties``
- ``items``
- ``prefixItems``
- ``enum``
- ``const``
- ``anyOf``
- ``oneOf``
- ``allOf``
- local ``#/...`` references through ``$ref``

Objects
-------

Objects render as table-like cards:

- each property becomes a row
- required fields show a ``!`` marker
- object rows can connect to child schemas

``patternProperties``
---------------------

``patternProperties`` are rendered as pattern-based object rows and nodes rather
than ordinary named properties.

Important behavior:

- the viewer labels these as ``pattern object``
- JSON path generation creates a sample matching key instead of a raw regex
- if a concrete sample cannot be generated, the formatter falls back gracefully

Arrays
------

Arrays have two main shapes.

Homogeneous arrays
^^^^^^^^^^^^^^^^^^

For a normal array like:

.. code-block:: json

   {
     "type": "array",
     "items": { "type": "object" }
   }

the viewer can connect directly to the child item schema instead of forcing an
extra ``items`` intermediary card.

Tuple arrays
^^^^^^^^^^^^

For tuple schemas using ``prefixItems``:

.. code-block:: json

   {
     "type": "array",
     "prefixItems": [
       { "type": "string" },
       { "type": "integer" }
     ],
     "items": false
   }

the viewer keeps positional rows like ``[0]`` and ``[1]`` so the tuple
structure is explicit.

Enums And Const
---------------

``enum`` values render as dedicated compact cards with pill-like entries.

``const`` values are summarized in the type label and in the selection dialog.

Combinators
-----------

``anyOf``, ``oneOf``, and ``allOf`` are rendered as branch points, not as large
intermediary cards. The UI shows:

- multiple outgoing lines from the relevant row or node
- a small combinator badge near the split

This keeps the graph closer to the mental model of “one field, several schema
options”.

Refs
----

Local refs are resolved safely:

- ``$ref`` to local ``#/...`` paths is supported
- recursive refs do not crash the graph builder
- self-referential structures are shown with self-loop routing

Path Semantics
--------------

The selection dialog exposes both schema-oriented and instance-oriented paths.

Schema path
^^^^^^^^^^^

Schema path follows the schema structure itself. Examples:

- ``schema.properties.user.properties.name``
- ``schema.items.anyOf[2]``
- ``schema.patternProperties["^[0-9]+$"].properties.id``

JSON path
^^^^^^^^^

JSON path approximates where instance data would live. Examples:

- ``data.user.name``
- ``data[0]``
- ``data["123"].id``

Special rules:

- direct combinator branches use ``[*]`` because multiple schema branches can
  describe the same instance position
- pattern properties use generated sample keys when possible
- numeric object keys are kept distinct from array indices

Current Limits
--------------

The viewer intentionally does not try to implement the entire JSON Schema
specification yet.

Not covered or only partially covered today:

- remote refs
- ``if`` / ``then`` / ``else``
- ``dependentSchemas``
- ``unevaluatedProperties``
- complex annotation-only keywords
- many validation keywords that do not affect graph shape

When unsupported keywords appear, the viewer prefers warning and graceful
rendering over hard failure whenever possible.
