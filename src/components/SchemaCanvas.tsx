import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useEffect } from "react";
import { createTargetHandleId } from "../lib/handle-ids";
import type { NodePositions } from "../lib/layout";
import type {
  SchemaGraphModel,
  SchemaSelection,
} from "../lib/schema-types";
import type { FlowNodeData } from "./flow-types";
import { SchemaNode } from "./SchemaNode";
import { SchemaRelationEdge } from "./SchemaRelationEdge";

const nodeTypes = {
  schema: SchemaNode,
};

const edgeTypes = {
  relation: SchemaRelationEdge,
};

interface SchemaCanvasProps {
  model: SchemaGraphModel;
  positions: NodePositions;
  selection: SchemaSelection | null;
  revision: number;
  onSelectNode: (nodeId: string) => void;
  onSelectRow: (nodeId: string, rowId: string) => void;
}

function FitViewOnRevision({ revision }: { revision: number }) {
  const reactFlow = useReactFlow();

  useEffect(() => {
    void reactFlow.fitView({
      duration: 250,
      padding: 0.18,
      minZoom: 0.2,
      maxZoom: 1.15,
    });
  }, [reactFlow, revision]);

  return null;
}

export function SchemaCanvas({
  model,
  positions,
  selection,
  revision,
  onSelectNode,
  onSelectRow,
}: SchemaCanvasProps) {
  const nodes: Node<FlowNodeData>[] = model.nodes.map((node) => ({
    id: node.id,
    type: "schema",
    data: {
      schemaNode: node,
      selection,
      onSelectNode,
      onSelectRow,
    },
    position: positions[node.id] ?? { x: 0, y: 0 },
    draggable: false,
    selectable: true,
    style: {
      width: node.size.width,
      height: node.size.height,
    },
  }));

  const edges: Edge[] = model.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: createTargetHandleId(edge.target),
    type: "relation",
    label: edge.label,
    selectable: false,
  }));

  return (
    <div className="canvas-surface">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: "relation" }}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => onSelectNode(node.id)}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.06)" gap={22} size={1} />
        <Controls showInteractive={false} />
        <FitViewOnRevision revision={revision} />
      </ReactFlow>
    </div>
  );
}
