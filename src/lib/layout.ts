import ELK from "elkjs/lib/elk.bundled.js";
import { createTargetHandleId } from "./handle-ids";
import type { SchemaGraphModel } from "./schema-types";

export interface NodePositions {
  [nodeId: string]: {
    x: number;
    y: number;
  };
}

const elk = new ELK();
const PORT_SIZE = 10;

export async function layoutSchemaGraph(
  model: SchemaGraphModel,
): Promise<NodePositions> {
  const graph = await elk.layout({
    id: "schema-root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "140",
      "elk.spacing.nodeNode": "72",
      "elk.spacing.edgeNode": "42",
      "elk.padding": "[top=36,left=36,bottom=36,right=36]",
      "elk.edgeRouting": "SPLINES",
    },
    children: model.nodes.map((node) => ({
      id: node.id,
      width: node.size.width,
      height: node.size.height,
      layoutOptions: {
        "org.eclipse.elk.portConstraints": "FIXED_ORDER",
      },
      ports: [
        {
          id: createTargetHandleId(node.id),
          width: PORT_SIZE,
          height: PORT_SIZE,
          layoutOptions: {
            "org.eclipse.elk.port.side": "WEST",
          },
        },
        ...node.rows
          .filter((row) => row.handleId)
          .map((row) => ({
            id: row.handleId!,
            width: PORT_SIZE,
            height: PORT_SIZE,
            layoutOptions: {
              "org.eclipse.elk.port.side": "EAST",
            },
          })),
      ],
    })),
    edges: model.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.sourceHandle ?? edge.source],
      targets: [createTargetHandleId(edge.target)],
    })),
  });

  const positions: NodePositions = {};

  for (const child of graph.children ?? []) {
    positions[child.id] = {
      x: child.x ?? 0,
      y: child.y ?? 0,
    };
  }

  return positions;
}
