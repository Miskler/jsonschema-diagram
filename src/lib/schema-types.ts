export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type PathToken = string | number;

export interface JsonSchema {
  $id?: string;
  $schema?: string;
  $ref?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  format?: string;
  properties?: Record<string, JsonSchema>;
  patternProperties?: Record<string, JsonSchema>;
  required?: string[];
  prefixItems?: JsonSchema[];
  items?: JsonSchema | JsonSchema[] | boolean;
  enum?: JsonValue[];
  const?: JsonValue;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  definitions?: Record<string, JsonSchema>;
  $defs?: Record<string, JsonSchema>;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  default?: JsonValue;
  examples?: JsonValue[];
  [key: string]: unknown;
}

export type SchemaNodeKind =
  | "object"
  | "array"
  | "combinator"
  | "enum"
  | "ref-target";

export interface SchemaRow {
  id: string;
  label: string;
  typeLabel: string;
  pointer: string;
  resolvedPointer?: string;
  required: boolean;
  relation: string;
  description?: string;
  detailLines: string[];
  instancePathToken?: PathToken;
  childNodeId?: string;
  childNodeIds?: string[];
  childPathSuffix?: PathToken[];
  branchLabel?: string;
  handleId?: string;
  schema: JsonSchema;
}

export interface SchemaGraphNode {
  id: string;
  kind: SchemaNodeKind;
  pointer: string;
  title: string;
  subtitle: string;
  description?: string;
  rows: SchemaRow[];
  metaLines: string[];
  schema: JsonSchema;
  enumValues: string[];
  size: {
    width: number;
    height: number;
  };
}

export interface SchemaGraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  sourceRowId?: string;
  label?: string;
  labelPosition?: "center" | "source";
}

export interface SchemaGraphModel {
  rootNodeId: string;
  nodes: SchemaGraphNode[];
  edges: SchemaGraphEdge[];
  warnings: string[];
  nodeMap: Record<string, SchemaGraphNode>;
  rowMap: Record<string, SchemaRow>;
}

export type SchemaSelection =
  | {
      kind: "node";
      nodeId: string;
    }
  | {
      kind: "row";
      nodeId: string;
      rowId: string;
    };

export interface InspectorDetails {
  selectionKind: "node" | "row";
  heading: string;
  badge: string;
  description?: string;
  facts: string[];
  schemaPointer: string;
  schemaTokens: string[];
  resolvedSchemaPointer?: string;
  resolvedSchemaTokens?: string[];
  instancePathTokens?: PathToken[];
  instancePathNote?: string;
}
