import type {
  InspectorDetails,
  JsonSchema,
  JsonValue,
  PathToken,
  SchemaGraphEdge,
  SchemaGraphModel,
  SchemaGraphNode,
  SchemaNodeKind,
  SchemaRow,
  SchemaSelection,
} from "./schema-types";
import {
  createPatternPathToken,
  hasPatternPathToken,
  parseSchemaPointer,
} from "./path-format";

const OBJECT_WIDTH = 316;
const ARRAY_WIDTH = 304;
const COMBINATOR_WIDTH = 280;
const ENUM_WIDTH = 182;
const ENUM_MAX_WIDTH = 260;
const REF_WIDTH = 240;
const ENUM_HEADER_HEIGHT = 66;
const ENUM_LIST_VERTICAL_PADDING = 36;
const ENUM_PILL_VERTICAL_CHROME = 18;
const ENUM_PILL_GAP = 10;
const ENUM_PILL_LINE_HEIGHT = 20;
const ENUM_AVERAGE_CHAR_WIDTH = 8;
const ENUM_HORIZONTAL_PADDING = 56;

const SUPPORTED_WARNINGS = [
  "if",
  "then",
  "else",
  "not",
  "dependentSchemas",
  "unevaluatedProperties",
  "unevaluatedItems",
  "propertyNames",
  "contains",
];

interface BuildContext {
  document: JsonSchema;
  nodes: Map<string, SchemaGraphNode>;
  edges: Map<string, SchemaGraphEdge>;
  warnings: Set<string>;
}

interface ResolveResult {
  schema: JsonSchema;
  ref?: string;
  resolvedPointer?: string;
  brokenRef?: boolean;
}

export function buildSchemaGraph(schema: JsonSchema): SchemaGraphModel {
  const context: BuildContext = {
    document: schema,
    nodes: new Map(),
    edges: new Map(),
    warnings: new Set(),
  };

  collectUnsupportedWarnings(schema, "#", context);

  const rootNodeId = ensureNode(context, schema, "#", true);

  if (!rootNodeId) {
    throw new Error("Unable to create a graph node for the root schema.");
  }

  const nodes = Array.from(context.nodes.values());
  const edges = Array.from(context.edges.values());
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const rowMap = Object.fromEntries(
    nodes.flatMap((node) => node.rows.map((row) => [row.id, row])),
  );

  return {
    rootNodeId,
    nodes,
    edges,
    warnings: Array.from(context.warnings.values()),
    nodeMap,
    rowMap,
  };
}

export function getSelectionDetails(
  model: SchemaGraphModel,
  selection: SchemaSelection | null,
): InspectorDetails | null {
  if (!selection) {
    return null;
  }

  const pathLookup = buildInstancePathLookup(model);

  if (selection.kind === "node") {
    const node = model.nodeMap[selection.nodeId];

    if (!node) {
      return null;
    }

    const schemaTokens = parseSchemaPointer(node.pointer);
    const baseInstancePathTokens = pathLookup.nodePaths.get(node.id);
    const instancePathTokens = isDirectCombinatorBranchSelection(schemaTokens)
      ? appendCombinatorBranchWildcard(baseInstancePathTokens, schemaTokens)
      : baseInstancePathTokens;
    const instancePathNotes = [];

    if (pathLookup.ambiguousNodeIds.has(node.id)) {
      instancePathNotes.push(
        "Primary reachable JSON path shown. This node is reused in multiple branches.",
      );
    }

    if (isDirectCombinatorBranchSelection(schemaTokens)) {
      instancePathNotes.push(
        'Wildcard "*" marks a schema branch over the shared instance location for this anyOf/oneOf/allOf variant.',
      );
    }

    if (hasPatternPathToken(instancePathTokens)) {
      instancePathNotes.push(
        "Generated example key shown in the JSON path. Actual object keys must still match the regex.",
      );
    }

    return {
      selectionKind: "node",
      heading: node.title,
      badge: node.kind,
      description: node.description,
      facts: [node.subtitle, ...node.metaLines],
      schemaPointer: node.pointer,
      schemaTokens,
      instancePathTokens,
      instancePathNote:
        instancePathNotes.length > 0 ? instancePathNotes.join(" ") : undefined,
    };
  }

  const row = model.rowMap[selection.rowId];

  if (!row) {
    return null;
  }

  const schemaTokens = parseSchemaPointer(row.pointer);
  const isDirectCombinatorBranchValue =
    row.relation === "value" && isDirectCombinatorBranchSelection(schemaTokens);
  const baseInstancePathTokens = pathLookup.rowPaths.get(row.id);
  const instancePathTokens = isDirectCombinatorBranchValue
    ? appendCombinatorBranchWildcard(baseInstancePathTokens, schemaTokens)
    : baseInstancePathTokens;
  const instancePathNotes = [];

  if (pathLookup.ambiguousNodeIds.has(selection.nodeId)) {
    instancePathNotes.push(
      "Primary reachable JSON path shown. This schema branch is reachable through multiple refs.",
    );
  }

  if (row.relation === "pattern" || hasPatternPathToken(instancePathTokens)) {
    instancePathNotes.push(
      "Generated example key shown in the JSON path. Actual object keys must still match the regex.",
    );
  }

  if (isDirectCombinatorBranchValue) {
    instancePathNotes.push(
      'Wildcard "*" marks a schema branch over the shared instance location for this anyOf/oneOf/allOf variant.',
    );
  }

  return {
    selectionKind: "row",
    heading: row.label,
    badge: row.required ? "required field" : row.relation,
    description: row.description,
    facts: [
      `type: ${row.typeLabel}`,
      ...row.detailLines,
    ],
    schemaPointer: row.pointer,
    schemaTokens,
    resolvedSchemaPointer: row.resolvedPointer,
    resolvedSchemaTokens: row.resolvedPointer
      ? parseSchemaPointer(row.resolvedPointer)
      : undefined,
    instancePathTokens,
    instancePathNote:
      instancePathNotes.length > 0 ? instancePathNotes.join(" ") : undefined,
  };
}

function ensureNode(
  context: BuildContext,
  inputSchema: JsonSchema,
  pointer: string,
  force: boolean,
): string | undefined {
  const resolved = resolveReference(context, inputSchema, pointer);
  const effectiveSchema = resolved.schema;
  const canonicalPointer = resolved.resolvedPointer ?? pointer;
  const nodeKind = classifySchema(effectiveSchema, force, Boolean(resolved.ref));

  if (!nodeKind) {
    return undefined;
  }

  const nodeId = createNodeId(canonicalPointer, nodeKind);
  const existing = context.nodes.get(nodeId);

  if (existing) {
    return existing.id;
  }

  const node: SchemaGraphNode = {
    id: nodeId,
    kind: nodeKind,
    pointer: canonicalPointer,
    title: createNodeTitle(canonicalPointer, effectiveSchema, nodeKind),
    subtitle: createSubtitle(effectiveSchema, nodeKind),
    description: effectiveSchema.description ?? inputSchema.description,
    rows: [],
    metaLines: [],
    schema: effectiveSchema,
    enumValues: [],
    size: {
      width: pickWidth(nodeKind),
      height: 120,
    },
  };

  context.nodes.set(nodeId, node);
  populateNode(context, node, inputSchema, effectiveSchema, canonicalPointer);
  node.size = measureNode(node);

  return nodeId;
}

function populateNode(
  context: BuildContext,
  node: SchemaGraphNode,
  rawSchema: JsonSchema,
  schema: JsonSchema,
  pointer: string,
): void {
  node.metaLines = createMetaLines(schema, node.kind);

  if (node.kind === "enum") {
    node.enumValues = extractEnumValues(schema);
    return;
  }

  if (node.kind === "object") {
    const properties = Object.entries(schema.properties ?? {});
    const patternProperties = Object.entries(schema.patternProperties ?? {});
    const required = new Set(schema.required ?? []);

    node.rows =
      properties.length > 0 || patternProperties.length > 0
        ? [
            ...properties.map(([label, childSchema]) => {
              const childPointer = joinPointer(pointer, "properties", label);
              return createRow(context, node.id, label, childSchema, childPointer, {
                required: required.has(label),
                relation: "field",
                forceChildNode: false,
              });
            }),
            ...patternProperties.map(([pattern, childSchema]) => {
              const childPointer = joinPointer(
                pointer,
                "patternProperties",
                pattern,
              );

              return createRow(
                context,
                node.id,
                formatPatternLabel(pattern),
                childSchema,
                childPointer,
                {
                  required: false,
                  relation: "pattern",
                  forceChildNode: false,
                  instancePathToken: createPatternPathToken(pattern),
                  detailLines: [`patternProperty: ${pattern}`],
                },
              );
            }),
          ]
        : [createPlaceholderRow(node.id, pointer, "No properties", "empty")];

    for (const row of node.rows) {
      pushEdge(context, node.id, row);
    }

    return;
  }

  if (node.kind === "array") {
    const prefixItems = schema.prefixItems ?? [];

    if (prefixItems.length > 0) {
      const tupleRows = prefixItems.map((itemSchema, index) =>
        createRow(
          context,
          node.id,
          `[${index}]`,
          itemSchema,
          joinPointer(pointer, "prefixItems", String(index)),
          {
            required: false,
            relation: "index",
            forceChildNode: false,
            instancePathToken: index,
            detailLines: [`index: ${index}`],
          },
        ),
      );
      const restRow =
        schema.items && typeof schema.items === "object" && !Array.isArray(schema.items)
          ? [
              createRow(
                context,
                node.id,
                `[${prefixItems.length}+]`,
                schema.items,
                joinPointer(pointer, "items"),
                {
                  required: false,
                  relation: "rest",
                  forceChildNode: false,
                  instancePathToken: prefixItems.length,
                  detailLines: [
                    `additional items: indexes >= ${prefixItems.length}`,
                  ],
                },
              ),
            ]
          : [];

      node.rows =
        tupleRows.length > 0 || restRow.length > 0
          ? [...tupleRows, ...restRow]
          : [createPlaceholderRow(node.id, pointer, "No tuple items", "empty")];

      for (const row of node.rows) {
        pushEdge(context, node.id, row);
      }

      return;
    }

    if (Array.isArray(schema.items)) {
      context.warnings.add(
        `${pointer}: tuple-style items are not fully supported in v1; showing the first item schema only.`,
      );
    }

    const itemSchema = Array.isArray(schema.items)
      ? schema.items[0]
      : typeof schema.items === "object"
        ? schema.items
        : undefined;

    node.rows = itemSchema
      ? [
          createRow(context, node.id, "items", itemSchema, joinPointer(pointer, "items"), {
            required: false,
            relation: "items",
            forceChildNode: false,
          }),
        ]
      : [createPlaceholderRow(node.id, pointer, "items", "unknown")];

    pushEdge(context, node.id, node.rows[0]);
    return;
  }

  if (node.kind === "combinator") {
    const { keyword, variants } = getCombinator(schema);

    node.subtitle = keyword;
    node.rows = variants.map((variant, index) =>
      createRow(
        context,
        node.id,
        `${keyword} ${index + 1}`,
        variant,
        joinPointer(pointer, keyword, String(index)),
        {
          required: false,
          relation: keyword,
          forceChildNode: true,
        },
      ),
    );

    for (const row of node.rows) {
      pushEdge(context, node.id, row);
    }

    return;
  }

  node.rows = [
    createRow(context, node.id, "value", rawSchema, pointer, {
      required: false,
      relation: "value",
      forceChildNode: false,
    }),
  ];
}

function createRow(
  context: BuildContext,
  nodeId: string,
  label: string,
  schema: JsonSchema,
  pointer: string,
  options: {
    required: boolean;
    relation: string;
    forceChildNode: boolean;
    instancePathToken?: PathToken;
    detailLines?: string[];
  },
): SchemaRow {
  const resolved = resolveReference(context, schema, pointer);
  const effectiveSchema = resolved.schema;
  const rowId = `${nodeId}::${slug(pointer)}::${slug(label)}`;
  const inlineCombinator = getInlineCombinator(effectiveSchema);
  const directArrayChild = inlineCombinator
    ? undefined
    : getDirectArrayChildNode(context, effectiveSchema, resolved.resolvedPointer ?? pointer);
  const childNodeIds = inlineCombinator
    ? inlineCombinator.variants
        .map((variant, index) =>
          ensureNode(
            context,
            variant,
            joinPointer(
              resolved.resolvedPointer ?? pointer,
              inlineCombinator.keyword,
              String(index),
            ),
            true,
          ),
        )
        .filter((childId): childId is string => Boolean(childId))
    : [];
  const childNodeId = inlineCombinator
    ? undefined
    : directArrayChild
      ? directArrayChild.childNodeId
    : ensureNode(
        context,
        schema,
        pointer,
        options.forceChildNode,
      );
  const nextChildNodeIds =
    childNodeIds.length > 0
      ? childNodeIds
      : childNodeId
        ? [childNodeId]
        : [];

  return {
    id: rowId,
    label,
    typeLabel: createTypeLabel(schema, effectiveSchema, Boolean(resolved.ref)),
    pointer,
    resolvedPointer:
      resolved.resolvedPointer && resolved.resolvedPointer !== pointer
        ? resolved.resolvedPointer
        : undefined,
    required: options.required,
    relation: options.relation,
    description: schema.description ?? effectiveSchema.description,
    detailLines: [
      ...(options.detailLines ?? []),
      ...createDetailLines(
        schema,
        effectiveSchema,
        resolved,
        inlineCombinator,
      ),
    ],
    instancePathToken: options.instancePathToken,
    childNodeId,
    childNodeIds: nextChildNodeIds.length > 0 ? nextChildNodeIds : undefined,
    childPathSuffix: directArrayChild?.childPathSuffix,
    branchLabel: inlineCombinator?.keyword,
    handleId: nextChildNodeIds.length > 0 ? `handle-${slug(rowId)}` : undefined,
    schema,
  };
}

function getDirectArrayChildNode(
  context: BuildContext,
  schema: JsonSchema,
  pointer: string,
): { childNodeId?: string; childPathSuffix: PathToken[] } | undefined {
  if ((schema.prefixItems?.length ?? 0) > 0) {
    return undefined;
  }

  if (!looksLikeArray(schema)) {
    return undefined;
  }

  const itemSchema = Array.isArray(schema.items)
    ? schema.items[0]
    : typeof schema.items === "object"
      ? schema.items
      : undefined;

  if (!itemSchema) {
    return undefined;
  }

  const childNodeId = ensureNode(context, itemSchema, joinPointer(pointer, "items"), false);

  if (!childNodeId) {
    return undefined;
  }

  return {
    childNodeId,
    childPathSuffix: [0],
  };
}

function createPlaceholderRow(
  nodeId: string,
  pointer: string,
  label: string,
  typeLabel: string,
): SchemaRow {
  return {
    id: `${nodeId}::${slug(pointer)}::${slug(label)}`,
    label,
    typeLabel,
    pointer,
    required: false,
    relation: "placeholder",
    detailLines: [],
    schema: {},
  };
}

function pushEdge(
  context: BuildContext,
  sourceNodeId: string,
  row: SchemaRow,
): void {
  const childNodeIds = row.childNodeIds ?? (row.childNodeId ? [row.childNodeId] : []);
  const sourceNode = context.nodes.get(sourceNodeId);

  if (childNodeIds.length === 0) {
    return;
  }

  childNodeIds.forEach((childNodeId, index) => {
    const edgeId = `${sourceNodeId}->${childNodeId}->${row.id}`;
    const isDirectArrayItemsEdge =
      sourceNode?.kind === "array" && row.relation === "items";

    context.edges.set(edgeId, {
      id: edgeId,
      source: sourceNodeId,
      target: childNodeId,
      sourceHandle: row.handleId,
      sourceRowId: row.id,
      label: isDirectArrayItemsEdge
        ? undefined
        : row.branchLabel && index === 0
          ? row.branchLabel
          : row.relation,
      labelPosition: row.branchLabel && index === 0 ? "source" : "center",
    });
  });
}

function buildInstancePathLookup(model: SchemaGraphModel): {
  nodePaths: Map<string, PathToken[]>;
  rowPaths: Map<string, PathToken[]>;
  ambiguousNodeIds: Set<string>;
} {
  const nodePaths = new Map<string, PathToken[]>();
  const rowPaths = new Map<string, PathToken[]>();
  const ambiguousNodeIds = new Set<string>();
  const queue = [model.rootNodeId];

  nodePaths.set(model.rootNodeId, []);

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (!nodeId) {
      continue;
    }

    const node = model.nodeMap[nodeId];
    const basePath = nodePaths.get(nodeId);

    if (!node || !basePath) {
      continue;
    }

    for (const row of node.rows) {
      const rowPath = extendInstancePath(basePath, row);
      rowPaths.set(row.id, rowPath);
      const childNodePath = row.childPathSuffix
        ? [...rowPath, ...row.childPathSuffix]
        : rowPath;

      const childNodeIds = row.childNodeIds ?? (row.childNodeId ? [row.childNodeId] : []);

      for (const childNodeId of childNodeIds) {
        const existing = nodePaths.get(childNodeId);

        if (!existing) {
          nodePaths.set(childNodeId, childNodePath);
          queue.push(childNodeId);
          continue;
        }

        const comparison = comparePaths(childNodePath, existing);
        const nextKey = serializePath(childNodePath);
        const prevKey = serializePath(existing);

        if (comparison < 0) {
          nodePaths.set(childNodeId, childNodePath);
          queue.push(childNodeId);
        } else if (comparison === 0 && nextKey !== prevKey) {
          ambiguousNodeIds.add(childNodeId);
        }
      }
    }
  }

  return {
    nodePaths,
    rowPaths,
    ambiguousNodeIds,
  };
}

function extendInstancePath(basePath: PathToken[], row: SchemaRow): PathToken[] {
  if (row.instancePathToken !== undefined) {
    return [...basePath, row.instancePathToken];
  }

  if (row.relation === "field") {
    return [...basePath, row.label];
  }

  if (row.relation === "items") {
    return [...basePath, 0];
  }

  return [...basePath];
}

function isDirectCombinatorBranchSelection(tokens: string[]): boolean {
  if (tokens.length < 2) {
    return false;
  }

  const branchKeyword = tokens[tokens.length - 2];
  const branchIndex = tokens[tokens.length - 1];

  return (
    (branchKeyword === "anyOf" ||
      branchKeyword === "oneOf" ||
      branchKeyword === "allOf") &&
    /^\d+$/.test(branchIndex)
  );
}

function appendCombinatorBranchWildcard(
  basePath: PathToken[] | undefined,
  schemaTokens: string[],
): PathToken[] | undefined {
  if (!basePath) {
    return undefined;
  }

  const parentSegment = schemaTokens.at(-3);
  const lastSegment = basePath.at(-1);

  if (parentSegment === "items" && typeof lastSegment === "number") {
    return [...basePath.slice(0, -1), "*"];
  }

  return [...basePath, "*"];
}

function comparePaths(left: PathToken[], right: PathToken[]): number {
  if (left.length !== right.length) {
    return left.length - right.length;
  }

  return serializePath(left).localeCompare(serializePath(right));
}

function serializePath(path: PathToken[]): string {
  return path
    .map((segment) =>
      typeof segment === "number" ? `n:${segment}` : `s:${segment}`,
    )
    .join("\u001f");
}

function resolveReference(
  context: BuildContext,
  schema: JsonSchema,
  pointer: string,
): ResolveResult {
  if (typeof schema.$ref !== "string") {
    return { schema };
  }

  const ref = schema.$ref;

  if (ref === "#") {
    return {
      schema: context.document,
      ref,
      resolvedPointer: "#",
    };
  }

  if (!ref.startsWith("#/")) {
    context.warnings.add(
      `${pointer}: external refs are not supported in v1 (${ref}).`,
    );
    return {
      schema,
      ref,
      brokenRef: true,
    };
  }

  const target = getSchemaAtPointer(context.document, ref);

  if (!target) {
    context.warnings.add(`${pointer}: unable to resolve local ref ${ref}.`);
    return {
      schema,
      ref,
      brokenRef: true,
    };
  }

  return {
    schema: target,
    ref,
    resolvedPointer: ref,
  };
}

function getSchemaAtPointer(
  document: JsonSchema,
  pointer: string,
): JsonSchema | undefined {
  if (pointer === "#") {
    return document;
  }

  const tokens = pointer
    .slice(2)
    .split("/")
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));

  let cursor: unknown = document;

  for (const token of tokens) {
    if (!isSchemaLikeContainer(cursor)) {
      return undefined;
    }

    cursor = (cursor as Record<string, unknown>)[token];
  }

  return isSchemaRecord(cursor) ? cursor : undefined;
}

function collectUnsupportedWarnings(
  schema: JsonSchema,
  pointer: string,
  context: BuildContext,
): void {
  for (const keyword of SUPPORTED_WARNINGS) {
    if (keyword in schema) {
      context.warnings.add(
        `${pointer}: keyword "${keyword}" is not visualized in v1.`,
      );
    }
  }

  for (const [propertyName, propertySchema] of Object.entries(schema.properties ?? {})) {
    collectUnsupportedWarnings(
      propertySchema,
      joinPointer(pointer, "properties", propertyName),
      context,
    );
  }

  for (const [propertyName, propertySchema] of Object.entries(
    schema.patternProperties ?? {},
  )) {
    collectUnsupportedWarnings(
      propertySchema,
      joinPointer(pointer, "patternProperties", propertyName),
      context,
    );
  }

  const nestedArrayGroups: Array<[string, JsonSchema[] | undefined]> = [
    ["anyOf", schema.anyOf],
    ["oneOf", schema.oneOf],
    ["allOf", schema.allOf],
  ];

  for (const [keyword, variants] of nestedArrayGroups) {
    variants?.forEach((variant, index) => {
      collectUnsupportedWarnings(
        variant,
        joinPointer(pointer, keyword, String(index)),
        context,
      );
    });
  }

  if (schema.items && !Array.isArray(schema.items)) {
    if (typeof schema.items === "object") {
      collectUnsupportedWarnings(schema.items, joinPointer(pointer, "items"), context);
    }
  }

  schema.prefixItems?.forEach((itemSchema, index) => {
    collectUnsupportedWarnings(
      itemSchema,
      joinPointer(pointer, "prefixItems", String(index)),
      context,
    );
  });

  if (Array.isArray(schema.items)) {
    schema.items.forEach((itemSchema, index) => {
      collectUnsupportedWarnings(
        itemSchema,
        joinPointer(pointer, "items", String(index)),
        context,
      );
    });
  }

  for (const [name, definition] of Object.entries(schema.$defs ?? {})) {
    collectUnsupportedWarnings(definition, joinPointer(pointer, "$defs", name), context);
  }

  for (const [name, definition] of Object.entries(schema.definitions ?? {})) {
    collectUnsupportedWarnings(
      definition,
      joinPointer(pointer, "definitions", name),
      context,
    );
  }
}

function classifySchema(
  schema: JsonSchema,
  force: boolean,
  fromRef: boolean,
): SchemaNodeKind | undefined {
  if (schema.enum || "const" in schema) {
    return "enum";
  }

  if (schema.anyOf || schema.oneOf || schema.allOf) {
    return "combinator";
  }

  if (looksLikeArray(schema)) {
    return "array";
  }

  if (looksLikeObject(schema)) {
    return "object";
  }

  if (force || fromRef) {
    return "ref-target";
  }

  return undefined;
}

function looksLikeObject(schema: JsonSchema): boolean {
  return (
    schema.type === "object" ||
    (Array.isArray(schema.type) && schema.type.includes("object")) ||
    Boolean(schema.properties && Object.keys(schema.properties).length > 0) ||
    Boolean(
      schema.patternProperties && Object.keys(schema.patternProperties).length > 0,
    )
  );
}

function isPatternObjectSchema(schema: JsonSchema): boolean {
  return (
    looksLikeObject(schema) &&
    Object.keys(schema.patternProperties ?? {}).length > 0 &&
    Object.keys(schema.properties ?? {}).length === 0
  );
}

function looksLikeArray(schema: JsonSchema): boolean {
  return (
    schema.type === "array" ||
    (Array.isArray(schema.type) && schema.type.includes("array")) ||
    "items" in schema ||
    Boolean(schema.prefixItems && schema.prefixItems.length > 0)
  );
}

function getCombinator(schema: JsonSchema): { keyword: string; variants: JsonSchema[] } {
  if (schema.anyOf) {
    return { keyword: "anyOf", variants: schema.anyOf };
  }

  if (schema.oneOf) {
    return { keyword: "oneOf", variants: schema.oneOf };
  }

  if (schema.allOf) {
    return { keyword: "allOf", variants: schema.allOf };
  }

  return { keyword: "variant", variants: [] };
}

function getInlineCombinator(
  schema: JsonSchema,
): { keyword: string; variants: JsonSchema[] } | undefined {
  const combinator = getCombinator(schema);

  return combinator.variants.length > 0 ? combinator : undefined;
}

function createTypeLabel(
  rawSchema: JsonSchema,
  effectiveSchema: JsonSchema,
  fromRef: boolean,
): string {
  let label = "schema";

  if (effectiveSchema.enum || "const" in effectiveSchema) {
    label = "enum";
  } else if (effectiveSchema.anyOf) {
    label = "anyOf";
  } else if (effectiveSchema.oneOf) {
    label = "oneOf";
  } else if (effectiveSchema.allOf) {
    label = "allOf";
  } else if (effectiveSchema.type) {
    label = Array.isArray(effectiveSchema.type)
      ? effectiveSchema.type.join(" | ")
      : effectiveSchema.type;
    if (label === "object" && isPatternObjectSchema(effectiveSchema)) {
      label = "pattern object";
    }
  } else if (looksLikeObject(effectiveSchema)) {
    label = isPatternObjectSchema(effectiveSchema) ? "pattern object" : "object";
  } else if (looksLikeArray(effectiveSchema)) {
    label = "array";
  }

  if (typeof effectiveSchema.format === "string") {
    label = `${label}:${effectiveSchema.format}`;
  }

  if (fromRef && typeof rawSchema.$ref === "string") {
    label = `${label} · ref`;
  }

  return label;
}

function createDetailLines(
  rawSchema: JsonSchema,
  effectiveSchema: JsonSchema,
  resolved: ResolveResult,
  inlineCombinator?: { keyword: string; variants: JsonSchema[] },
): string[] {
  const lines = [
    ...(inlineCombinator
      ? [`${inlineCombinator.keyword}: ${inlineCombinator.variants.length} variants`]
      : []),
    ...createConstraintLines(effectiveSchema),
    ...(resolved.ref ? [`$ref: ${resolved.ref}`] : []),
  ];

  if (resolved.brokenRef) {
    lines.unshift("broken ref");
  }

  if (rawSchema.description && rawSchema.description !== effectiveSchema.description) {
    lines.unshift("inline description override");
  }

  return lines;
}

function createMetaLines(schema: JsonSchema, kind: SchemaNodeKind): string[] {
  const lines = createConstraintLines(schema);

  if (kind === "object") {
    const propertyCount = Object.keys(schema.properties ?? {}).length;
    const patternPropertyCount = Object.keys(schema.patternProperties ?? {}).length;
    const fieldCount = propertyCount + patternPropertyCount;

    lines.unshift(`${fieldCount} fields`);
    if (patternPropertyCount > 0) {
      lines.unshift(
        `${patternPropertyCount} pattern ${
          patternPropertyCount === 1 ? "rule" : "rules"
        }`,
      );
    }
    if (schema.required?.length) {
      lines.unshift(`${schema.required.length} required`);
    }
  }

  if (kind === "array") {
    const tupleCount = schema.prefixItems?.length ?? 0;

    if (tupleCount > 0) {
      lines.unshift(`${tupleCount} tuple ${tupleCount === 1 ? "item" : "items"}`);

      if (schema.items === false) {
        lines.unshift("closed tuple");
      } else if (schema.items && typeof schema.items === "object") {
        lines.unshift(`rest schema from index ${tupleCount}`);
      } else {
        lines.unshift("additional items allowed");
      }
    } else {
      lines.unshift(
        schema.items && typeof schema.items === "object"
          ? "items schema present"
          : schema.items === false
            ? "no items allowed"
            : "items schema missing",
      );
    }
  }

  if (kind === "enum") {
    lines.unshift(`${extractEnumValues(schema).length} values`);
  }

  if (kind === "combinator") {
    lines.unshift(`${getCombinator(schema).variants.length} variants`);
  }

  return lines;
}

function createConstraintLines(schema: JsonSchema): string[] {
  const lines: string[] = [];

  if (typeof schema.minLength === "number") {
    lines.push(`minLength: ${schema.minLength}`);
  }
  if (typeof schema.maxLength === "number") {
    lines.push(`maxLength: ${schema.maxLength}`);
  }
  if (typeof schema.minimum === "number") {
    lines.push(`minimum: ${schema.minimum}`);
  }
  if (typeof schema.maximum === "number") {
    lines.push(`maximum: ${schema.maximum}`);
  }
  if (typeof schema.exclusiveMinimum === "number") {
    lines.push(`exclusiveMinimum: ${schema.exclusiveMinimum}`);
  }
  if (typeof schema.exclusiveMaximum === "number") {
    lines.push(`exclusiveMaximum: ${schema.exclusiveMaximum}`);
  }
  if (typeof schema.minItems === "number") {
    lines.push(`minItems: ${schema.minItems}`);
  }
  if (typeof schema.maxItems === "number") {
    lines.push(`maxItems: ${schema.maxItems}`);
  }
  if (typeof schema.pattern === "string") {
    lines.push(`pattern: ${schema.pattern}`);
  }
  if ("const" in schema) {
    lines.push(`const: ${previewValue(schema.const)}`);
  }
  if (schema.enum?.length) {
    lines.push(`enum: ${schema.enum.map(previewValue).join(", ")}`);
  }

  return lines;
}

function extractEnumValues(schema: JsonSchema): string[] {
  if (schema.enum) {
    return schema.enum.map(previewValue);
  }

  if ("const" in schema) {
    return [previewValue(schema.const)];
  }

  return [];
}

function createNodeTitle(
  pointer: string,
  schema: JsonSchema,
  kind: SchemaNodeKind,
): string {
  if (schema.title) {
    return schema.title;
  }

  if (kind === "combinator") {
    return getCombinator(schema).keyword;
  }

  if (pointer === "#") {
    return "Root Schema";
  }

  const tokens = parseSchemaPointer(pointer);
  const token = tokens.at(-1) ?? "schema";

  if (tokens.at(-2) === "patternProperties") {
    return formatPatternLabel(token);
  }

  return humanize(token);
}

function formatPatternLabel(pattern: string): string {
  return `/${pattern}/`;
}

function createSubtitle(schema: JsonSchema, kind: SchemaNodeKind): string {
  if (kind === "object") {
    return isPatternObjectSchema(schema) ? "pattern object" : "object";
  }

  if (kind === "array") {
    return "array";
  }

  if (kind === "combinator") {
    return getCombinator(schema).keyword;
  }

  if (kind === "enum") {
    return "enum";
  }

  return createTypeLabel(schema, schema, false);
}

function measureNode(node: SchemaGraphNode): { width: number; height: number } {
  if (node.kind === "enum") {
    const width = measureEnumWidth(node);
    const charsPerLine = Math.max(
      10,
      Math.floor((width - ENUM_HORIZONTAL_PADDING) / ENUM_AVERAGE_CHAR_WIDTH),
    );
    const contentLines = Math.max(
      1,
      node.enumValues.reduce(
        (sum, value) => sum + Math.max(1, Math.ceil(value.length / charsPerLine)),
        0,
      ),
    );
    const pillCount = Math.max(node.enumValues.length, 1);

    return {
      width,
      height: Math.max(
        172,
        ENUM_HEADER_HEIGHT +
          ENUM_LIST_VERTICAL_PADDING +
          contentLines * ENUM_PILL_LINE_HEIGHT +
          pillCount * ENUM_PILL_VERTICAL_CHROME +
          Math.max(0, pillCount - 1) * ENUM_PILL_GAP,
      ),
    };
  }

  if (
    node.kind === "array" &&
    node.rows.length === 1 &&
    node.rows[0].relation === "items" &&
    node.rows[0].handleId
  ) {
    return {
      width: pickWidth(node.kind),
      height: 84,
    };
  }

  return {
    width: pickWidth(node.kind),
    height: Math.max(124, 68 + node.rows.length * 42),
  };
}

function measureEnumWidth(node: SchemaGraphNode): number {
  const longestToken = Math.max(
    node.title.length,
    ...node.enumValues.map((value) => value.length),
  );

  return Math.min(
    ENUM_MAX_WIDTH,
    Math.max(ENUM_WIDTH, 110 + longestToken * 7),
  );
}

function pickWidth(kind: SchemaNodeKind): number {
  switch (kind) {
    case "object":
      return OBJECT_WIDTH;
    case "array":
      return ARRAY_WIDTH;
    case "combinator":
      return COMBINATOR_WIDTH;
    case "enum":
      return ENUM_WIDTH;
    case "ref-target":
      return REF_WIDTH;
  }
}

function createNodeId(pointer: string, kind: SchemaNodeKind): string {
  return `node-${kind}-${slug(pointer)}`;
}

function joinPointer(base: string, ...parts: string[]): string {
  const joined = parts.map((part) =>
    part.replace(/~/g, "~0").replace(/\//g, "~1"),
  );

  return base === "#"
    ? `#/${joined.join("/")}`
    : `${base}/${joined.join("/")}`;
}

function previewValue(value: JsonValue | undefined): string {
  if (typeof value === "string") {
    return value.length > 24 ? `${value.slice(0, 21)}...` : value;
  }

  return JSON.stringify(value) ?? "undefined";
}

function humanize(token: string): string {
  return token
    .replace(/~1/g, "/")
    .replace(/~0/g, "~")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function isSchemaLikeContainer(
  value: unknown,
): value is Record<string, unknown> | unknown[] {
  return typeof value === "object" && value !== null;
}

function isSchemaRecord(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
