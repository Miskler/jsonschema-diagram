import { describe, expect, it } from "vitest";
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
});
