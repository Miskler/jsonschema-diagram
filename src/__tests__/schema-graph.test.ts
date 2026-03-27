import { describe, expect, it } from "vitest";
import { formatInstancePath } from "../lib/path-format";
import { buildSchemaGraph, getSelectionDetails } from "../lib/schema-graph";
import type { JsonSchema } from "../lib/schema-types";
import { sampleSchema } from "../test-support/sampleSchema";

describe("buildSchemaGraph", () => {
  it("creates direct array item links, enum nodes, and fans out combinators from a row", () => {
    const model = buildSchemaGraph(sampleSchema);
    const rootNode = model.nodeMap[model.rootNodeId];
    const ownerRow = rootNode.rows.find((row) => row.label === "owner");
    const listRow = rootNode.rows.find((row) => row.label === "list");
    const listTarget = listRow?.childNodeIds?.[0]
      ? model.nodeMap[listRow.childNodeIds[0]]
      : undefined;

    expect(model.rootNodeId).toContain("object");
    expect(model.nodes.some((node) => node.kind === "array")).toBe(false);
    expect(listTarget?.title).toBe("Item");
    expect(model.nodes.some((node) => node.kind === "combinator")).toBe(false);
    expect(model.nodes.some((node) => node.kind === "enum")).toBe(true);
    expect(ownerRow?.branchLabel).toBe("anyOf");
    expect(ownerRow?.childNodeIds).toHaveLength(2);
  });

  it("resolves local refs and tolerates cycles", () => {
    const model = buildSchemaGraph(sampleSchema);
    const itemNodes = model.nodes.filter((node) => node.title === "Item");
    const itemNode = itemNodes[0];
    const managerRow = itemNode.rows.find((row) => row.label === "manager");

    expect(itemNodes).toHaveLength(1);
    expect(managerRow?.resolvedPointer).toBe("#/$defs/item");
    expect(model.edges.some((edge) => edge.source === itemNode.id && edge.target === itemNode.id)).toBe(true);
  });

  it("creates warnings for unsupported keywords and broken refs", () => {
    const schema: JsonSchema = {
      type: "object",
      if: {
        type: "string",
      },
      properties: {
        broken: {
          $ref: "#/$defs/missing",
        },
      },
    };

    const model = buildSchemaGraph(schema);

    expect(model.warnings.some((warning) => warning.includes('keyword "if"'))).toBe(true);
    expect(model.warnings.some((warning) => warning.includes("unable to resolve local ref"))).toBe(true);
  });

  it("visualizes patternProperties as object rows without unsupported warnings", () => {
    const schema: JsonSchema = {
      title: "Headers",
      type: "object",
      patternProperties: {
        "^x-": {
          title: "Header Value",
          type: "object",
          properties: {
            value: {
              type: "string",
            },
          },
        },
      },
    };

    const model = buildSchemaGraph(schema);
    const rootNode = model.nodeMap[model.rootNodeId];
    const patternRow = rootNode.rows[0];
    const details = getSelectionDetails(model, {
      kind: "row",
      nodeId: rootNode.id,
      rowId: patternRow.id,
    });

    expect(patternRow.label).toBe("/^x-/");
    expect(patternRow.relation).toBe("pattern");
    expect(rootNode.subtitle).toBe("pattern object");
    expect(patternRow.childNodeIds).toHaveLength(1);
    expect(model.warnings.some((warning) => warning.includes("patternProperties"))).toBe(
      false,
    );
    expect(details?.instancePathTokens).toEqual(["$match(^x-)"]);
    expect(details?.instancePathNote).toContain(
      "Generated example key shown in the JSON path",
    );
  });

  it("builds inspector details for a selected row", () => {
    const model = buildSchemaGraph(sampleSchema);
    const rootNode = model.nodeMap[model.rootNodeId];
    const statusRow = rootNode.rows.find((row) => row.label === "status");
    const details = getSelectionDetails(model, {
      kind: "row",
      nodeId: rootNode.id,
      rowId: statusRow!.id,
    });

    expect(details?.heading).toBe("status");
    expect(details?.facts.some((line) => line.includes("type: enum"))).toBe(true);
    expect(details?.schemaPointer).toBe("#/properties/status");
    expect(details?.resolvedSchemaPointer).toBe("#/$defs/status");
    expect(details?.instancePathTokens).toEqual(["status"]);
  });

  it("allocates enough space for enum values", () => {
    const schema: JsonSchema = {
      title: "Status",
      type: "string",
      enum: ["draft", "review", "published"],
    };

    const model = buildSchemaGraph(schema);
    const enumNode = model.nodes.find((node) => node.kind === "enum");

    expect(enumNode).toBeDefined();
    expect(enumNode?.size.height).toBeGreaterThanOrEqual(220);
  });

  it("keeps array item links direct without an items edge label", () => {
    const schema: JsonSchema = {
      title: "Tags",
      type: "array",
      items: {
        type: "object",
        properties: {
          value: {
            type: "string",
          },
        },
      },
    };

    const model = buildSchemaGraph(schema);
    const arrayNode = model.nodes.find((node) => node.kind === "array");
    const arrayEdge = model.edges.find((edge) => edge.source === arrayNode?.id);

    expect(arrayNode).toBeDefined();
    expect(arrayNode?.rows[0]?.relation).toBe("items");
    expect(arrayEdge?.label).toBeUndefined();
    expect(arrayNode?.size.height).toBe(84);
  });

  it("renders prefixItems tuples without placeholder rows or unsupported warnings", () => {
    const schema: JsonSchema = {
      type: "array",
      prefixItems: [
        { type: "string" },
        { type: "integer" },
        { type: "boolean" },
      ],
      items: false,
    };

    const model = buildSchemaGraph(schema);
    const rootNode = model.nodeMap[model.rootNodeId];
    const secondRow = rootNode.rows[1];
    const details = getSelectionDetails(model, {
      kind: "row",
      nodeId: rootNode.id,
      rowId: secondRow.id,
    });

    expect(rootNode.kind).toBe("array");
    expect(rootNode.rows.map((row) => row.label)).toEqual(["[0]", "[1]", "[2]"]);
    expect(rootNode.rows.map((row) => row.typeLabel)).toEqual([
      "string",
      "integer",
      "boolean",
    ]);
    expect(rootNode.metaLines).toContain("3 tuple items");
    expect(rootNode.metaLines).toContain("closed tuple");
    expect(model.warnings.some((warning) => warning.includes("prefixItems"))).toBe(false);
    expect(details?.instancePathTokens).toEqual([1]);
    expect(formatInstancePath(details?.instancePathTokens, "py-like")).toBe("data[1]");
  });

  it("derives a primary JSON path for reused definition nodes", () => {
    const model = buildSchemaGraph(sampleSchema);
    const itemNode = model.nodes.find((node) => node.title === "Item");
    const details = getSelectionDetails(model, {
      kind: "node",
      nodeId: itemNode!.id,
    });

    expect(details?.schemaPointer).toBe("#/$defs/item");
    expect(details?.instancePathTokens).toEqual(["list", 0]);
  });

  it("keeps numeric object keys distinct from array indexes in JSON paths", () => {
    const schema: JsonSchema = {
      title: "Root",
      type: "object",
      patternProperties: {
        "^0$": {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  hover: {
                    type: "boolean",
                  },
                },
              },
            },
          },
        },
      },
    };

    const model = buildSchemaGraph(schema);
    const rootNode = model.nodeMap[model.rootNodeId];
    const patternNode = model.nodeMap[rootNode.rows[0].childNodeIds![0]];
    const itemsNode = model.nodeMap[
      patternNode.rows.find((row) => row.label === "items")!.childNodeIds![0]
    ];
    const hoverRow = itemsNode.rows.find((row) => row.label === "hover");
    const details = getSelectionDetails(model, {
      kind: "row",
      nodeId: itemsNode.id,
      rowId: hoverRow!.id,
    });

    expect(details?.instancePathTokens).toEqual(["$match(^0$)", "items", 0, "hover"]);
    expect(formatInstancePath(details?.instancePathTokens, "py-like")).toBe(
      'data["0"].items[0].hover',
    );
  });

  it("marks direct combinator branches with a wildcard JSON segment", () => {
    const schema: JsonSchema = {
      type: "array",
      items: {
        anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
      },
    };

    const model = buildSchemaGraph(schema);
    const rootNode = model.nodeMap[model.rootNodeId];
    const itemsRow = rootNode.rows[0];
    const booleanNodeId = itemsRow.childNodeIds?.[2];
    const details = getSelectionDetails(model, {
      kind: "node",
      nodeId: booleanNodeId!,
    });

    expect(details?.schemaTokens).toEqual(["items", "anyOf", "2"]);
    expect(details?.instancePathTokens).toEqual(["*"]);
    expect(formatInstancePath(details?.instancePathTokens, "py-like")).toBe(
      "data[*]",
    );
    expect(details?.instancePathNote).toContain(
      'Wildcard "*" marks a schema branch',
    );
  });

  it("keeps the property path and appends a wildcard for object-level combinator branches", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        owner: {
          anyOf: [{ type: "string" }, { type: "boolean" }],
        },
      },
    };

    const model = buildSchemaGraph(schema);
    const rootNode = model.nodeMap[model.rootNodeId];
    const ownerRow = rootNode.rows[0];
    const booleanNodeId = ownerRow.childNodeIds?.[1];
    const details = getSelectionDetails(model, {
      kind: "node",
      nodeId: booleanNodeId!,
    });

    expect(details?.instancePathTokens).toEqual(["owner", "*"]);
    expect(formatInstancePath(details?.instancePathTokens, "py-like")).toBe(
      "data.owner[*]",
    );
  });
});
