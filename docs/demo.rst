Extension Demo
==============

This page keeps a few visual examples of the Sphinx directive in action. For
configuration and integration details, see :doc:`sphinx-extension`.

Shared Default Schema
---------------------

The directive can use the shared default schema configured in ``conf.py``:

.. jsonschema-diagram::
   :caption: Shared schema from ``schemas/default.json``
   :height: 780px

Schema From File
----------------

The directive can also load JSON from a file relative to the current document:

.. jsonschema-diagram::
   :schema-file: examples/pattern-catalog.json
   :caption: Pattern objects, arrays, and nested refs from a docs-local file
   :height: 760px
   :theme: slate

Inline Schema
-------------

Inline JSON is handy for focused examples in API docs:

.. jsonschema-diagram::
   :caption: Inline tuple and combinator example
   :height: 720px

   {
     "title": "Tuple Payload",
     "type": "array",
     "prefixItems": [
       {
         "type": "object",
         "properties": {
           "kind": {
             "type": "string",
             "enum": ["alpha", "beta"]
           },
           "value": {
             "anyOf": [
               { "type": "string" },
               { "type": "number" },
               { "type": "boolean" }
             ]
           }
         },
         "required": ["kind", "value"]
       },
       {
         "type": "object",
         "patternProperties": {
           "^[a-z]+$": {
             "type": "integer"
           }
         }
       }
     ],
     "items": false
   }

Theme Override
--------------

The directive can also override the global docs theme choice for a single
viewer instance:

.. jsonschema-diagram::
   :caption: Mono theme override for a tiny inline schema
   :height: 520px
   :theme: mono

   {
     "title": "Event Envelope",
     "type": "object",
     "required": ["type", "payload"],
     "properties": {
       "type": {
         "type": "string",
         "enum": ["created", "updated", "deleted"]
       },
       "payload": {
         "type": "object",
         "patternProperties": {
           "^x-": {
             "type": "string"
           }
         }
       }
     }
   }
