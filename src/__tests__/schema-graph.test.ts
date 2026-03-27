import { describe, expect, it } from "vitest";
import { buildSchemaGraph, getSelectionDetails } from "../lib/schema-graph";
import type { JsonSchema } from "../lib/schema-types";
import { sampleSchema } from "../test-support/sampleSchema";

describe("buildSchemaGraph", () => {
  it("creates object, array, combinator, and enum nodes", () => {
    const model = buildSchemaGraph(sampleSchema);

    expect(model.rootNodeId).toContain("object");
    expect(model.nodes.some((node) => node.kind === "array")).toBe(true);
    expect(model.nodes.some((node) => node.kind === "combinator")).toBe(true);
    expect(model.nodes.some((node) => node.kind === "enum")).toBe(true);
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
    expect(details?.lines.some((line) => line.includes("type: enum"))).toBe(true);
    expect(details?.lines.some((line) => line.includes("#/$defs/status"))).toBe(true);
  });
});
