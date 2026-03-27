import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { createTargetHandleId } from "../lib/handle-ids";
import type { NodePositions } from "../lib/layout";
import type {
  SchemaGraphModel,
  SchemaSelection,
} from "../lib/schema-types";
import type { FlowNodeData } from "./flow-types";
import { SchemaNode } from "./SchemaNode";
import { SchemaRelationEdge } from "./SchemaRelationEdge";

interface RelationEdgeData {
  isSelfLoop?: boolean;
  nodeWidth?: number;
  nodeHeight?: number;
  labelPosition?: "center" | "source";
}

interface EdgeHoverSample {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceRowId?: string;
  points: Array<{ x: number; y: number }>;
  strokeElement: SVGElement | null;
  trailElement: SVGElement | null;
  sourceNodeElement: HTMLElement | null;
  targetNodeElement: HTMLElement | null;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

const EDGE_HOVER_DISTANCE = 16;
const EDGE_SAMPLE_STEP = 12;

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
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const edgeSamplesRef = useRef<EdgeHoverSample[]>([]);
  const hoveredEdgeIdRef = useRef<string | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const hoveredRowRef = useRef<{ nodeId: string; rowId: string } | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setHoveredEdgeDom(null, edgeSamplesRef.current, hoveredEdgeIdRef);
    setHoveredNodeDom(null, edgeSamplesRef.current, hoveredNodeIdRef);
    setHoveredRowDom(null, edgeSamplesRef.current, hoveredRowRef);

    let frameA = 0;
    let frameB = 0;

    frameA = requestAnimationFrame(() => {
      frameB = requestAnimationFrame(() => {
        edgeSamplesRef.current = collectEdgeHoverSamples(canvasRef.current, model);
      });
    });

    return () => {
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
      if (hoverFrameRef.current !== null) {
        cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      setHoveredEdgeDom(null, edgeSamplesRef.current, hoveredEdgeIdRef);
      setHoveredNodeDom(null, edgeSamplesRef.current, hoveredNodeIdRef);
      setHoveredRowDom(null, edgeSamplesRef.current, hoveredRowRef);
    };
  }, [model, revision]);

  const nodes: Node<FlowNodeData>[] = model.nodes.map((node) => ({
    id: node.id,
    type: "schema",
    data: {
      schemaNode: node,
      selection,
      onSelectNode,
      onSelectRow,
      onHoverRow: handleRowHover,
    },
    position: positions[node.id] ?? { x: 0, y: 0 },
    draggable: false,
    selectable: true,
    style: {
      width: node.size.width,
      height: node.size.height,
    },
  }));

  const edges: Edge<RelationEdgeData>[] = model.edges.map((edge) => {
    const targetNode = model.nodeMap[edge.target];
    const isSelfLoop = edge.source === edge.target;

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: createTargetHandleId(edge.target),
      type: "relation",
      label: edge.label,
      selectable: false,
      data: isSelfLoop
        ? {
            isSelfLoop,
            nodeWidth: targetNode?.size.width,
            nodeHeight: targetNode?.size.height,
            labelPosition: edge.labelPosition,
          }
        : edge.labelPosition
          ? {
              labelPosition: edge.labelPosition,
            }
          : undefined,
    };
  });

  function handlePaneMouseMove(event: ReactMouseEvent<Element, MouseEvent>) {
    if (!reactFlowRef.current || edgeSamplesRef.current.length === 0) {
      setHoveredEdgeDom(null, edgeSamplesRef.current, hoveredEdgeIdRef);
      return;
    }

    pendingPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    if (hoverFrameRef.current !== null) {
      return;
    }

    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = null;

      if (!reactFlowRef.current || !pendingPointerRef.current) {
        return;
      }

      const flowPoint = reactFlowRef.current.screenToFlowPosition(
        pendingPointerRef.current,
      );

      setHoveredEdgeDom(
        findHoveredEdgeId(edgeSamplesRef.current, flowPoint, EDGE_HOVER_DISTANCE),
        edgeSamplesRef.current,
        hoveredEdgeIdRef,
      );
    });
  }

  function handlePaneMouseLeave() {
    pendingPointerRef.current = null;

    if (hoverFrameRef.current !== null) {
      cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }

    setHoveredEdgeDom(null, edgeSamplesRef.current, hoveredEdgeIdRef);
  }

  function handleNodeMouseEnter(nodeId: string) {
    pendingPointerRef.current = null;

    if (hoverFrameRef.current !== null) {
      cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }

    setHoveredEdgeDom(null, edgeSamplesRef.current, hoveredEdgeIdRef);
    setHoveredNodeDom(
      nodeId,
      edgeSamplesRef.current,
      hoveredNodeIdRef,
      hoveredRowRef.current?.nodeId === nodeId,
    );
  }

  function handleNodeMouseLeave(nodeId: string) {
    if (hoveredRowRef.current?.nodeId === nodeId) {
      setHoveredRowDom(null, edgeSamplesRef.current, hoveredRowRef);
    }

    if (hoveredNodeIdRef.current !== nodeId) {
      return;
    }

    setHoveredNodeDom(null, edgeSamplesRef.current, hoveredNodeIdRef, false);
  }

  function handleRowHover(nodeId: string, rowId: string | null) {
    pendingPointerRef.current = null;

    if (hoverFrameRef.current !== null) {
      cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }

    setHoveredEdgeDom(null, edgeSamplesRef.current, hoveredEdgeIdRef);

    if (rowId) {
      if (hoveredNodeIdRef.current === nodeId) {
        clearNodeHoverVisual(nodeId, edgeSamplesRef.current);
      }

      setHoveredRowDom({ nodeId, rowId }, edgeSamplesRef.current, hoveredRowRef);
      return;
    }

    if (hoveredRowRef.current?.nodeId !== nodeId) {
      return;
    }

    setHoveredRowDom(null, edgeSamplesRef.current, hoveredRowRef);

    if (hoveredNodeIdRef.current === nodeId) {
      applyNodeHoverVisual(nodeId, edgeSamplesRef.current);
    }
  }

  return (
    <div ref={canvasRef} className="canvas-surface">
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
        onInit={(instance) => {
          reactFlowRef.current = instance;
        }}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onNodeMouseEnter={(_, node) => handleNodeMouseEnter(node.id)}
        onNodeMouseLeave={(_, node) => handleNodeMouseLeave(node.id)}
        onPaneMouseMove={handlePaneMouseMove}
        onPaneMouseLeave={handlePaneMouseLeave}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.06)" gap={22} size={1} />
        <Controls showInteractive={false} />
        <FitViewOnRevision revision={revision} />
      </ReactFlow>
    </div>
  );
}

function setHoveredEdgeDom(
  nextEdgeId: string | null,
  samples: EdgeHoverSample[],
  hoveredEdgeIdRef: { current: string | null },
) {
  if (hoveredEdgeIdRef.current === nextEdgeId) {
    return;
  }

  const previousSample = hoveredEdgeIdRef.current
    ? samples.find((sample) => sample.id === hoveredEdgeIdRef.current)
    : null;
  getEdgeStrokeElement(previousSample)?.classList.remove("is-hovered");
  getEdgeTrailElement(previousSample)?.classList.remove("is-hovered");
  getEdgeNodeElement(previousSample, "source")?.classList.remove("is-edge-linked");
  getEdgeNodeElement(previousSample, "target")?.classList.remove("is-edge-linked");

  const nextSample = nextEdgeId
    ? samples.find((sample) => sample.id === nextEdgeId)
    : null;
  getEdgeStrokeElement(nextSample)?.classList.add("is-hovered");
  getEdgeTrailElement(nextSample)?.classList.add("is-hovered");
  getEdgeNodeElement(nextSample, "source")?.classList.add("is-edge-linked");
  getEdgeNodeElement(nextSample, "target")?.classList.add("is-edge-linked");

  hoveredEdgeIdRef.current = nextEdgeId;
}

function setHoveredNodeDom(
  nextNodeId: string | null,
  samples: EdgeHoverSample[],
  hoveredNodeIdRef: { current: string | null },
  suppressVisual = false,
) {
  if (hoveredNodeIdRef.current === nextNodeId) {
    return;
  }

  const previousNodeId = hoveredNodeIdRef.current;
  if (previousNodeId) {
    clearNodeHoverVisual(previousNodeId, samples);
  }

  if (nextNodeId && !suppressVisual) {
    applyNodeHoverVisual(nextNodeId, samples);
  }

  hoveredNodeIdRef.current = nextNodeId;
}

function applyNodeHoverVisual(nodeId: string, samples: EdgeHoverSample[]) {
  getNodeElementById(nodeId)?.classList.add("is-node-hovered");

  for (const sample of samples) {
    if (sample.sourceNodeId !== nodeId && sample.targetNodeId !== nodeId) {
      continue;
    }

    getEdgeStrokeElement(sample)?.classList.add("is-linked");

    if (sample.sourceNodeId !== nodeId) {
      getEdgeNodeElement(sample, "source")?.classList.add("is-edge-linked");
    }

    if (sample.targetNodeId !== nodeId) {
      getEdgeNodeElement(sample, "target")?.classList.add("is-edge-linked");
    }
  }
}

function clearNodeHoverVisual(nodeId: string, samples: EdgeHoverSample[]) {
  getNodeElementById(nodeId)?.classList.remove("is-node-hovered");

  for (const sample of samples) {
    if (sample.sourceNodeId !== nodeId && sample.targetNodeId !== nodeId) {
      continue;
    }

    getEdgeStrokeElement(sample)?.classList.remove("is-linked");

    if (sample.sourceNodeId !== nodeId) {
      getEdgeNodeElement(sample, "source")?.classList.remove("is-edge-linked");
    }

    if (sample.targetNodeId !== nodeId) {
      getEdgeNodeElement(sample, "target")?.classList.remove("is-edge-linked");
    }
  }
}

function setHoveredRowDom(
  nextRow: { nodeId: string; rowId: string } | null,
  samples: EdgeHoverSample[],
  hoveredRowRef: { current: { nodeId: string; rowId: string } | null },
) {
  const previousRow = hoveredRowRef.current;

  if (
    previousRow?.nodeId === nextRow?.nodeId &&
    previousRow?.rowId === nextRow?.rowId
  ) {
    return;
  }

  if (previousRow) {
    getRowElementById(previousRow.rowId)?.classList.remove("is-row-hovered");

    for (const sample of samples) {
      if (sample.sourceRowId !== previousRow.rowId) {
        continue;
      }

      getEdgeStrokeElement(sample)?.classList.remove("is-linked");

      if (sample.sourceNodeId !== previousRow.nodeId) {
        getEdgeNodeElement(sample, "source")?.classList.remove("is-edge-linked");
      }

      if (sample.targetNodeId !== previousRow.nodeId) {
        getEdgeNodeElement(sample, "target")?.classList.remove("is-edge-linked");
      }
    }
  }

  if (nextRow) {
    getRowElementById(nextRow.rowId)?.classList.add("is-row-hovered");

    for (const sample of samples) {
      if (sample.sourceRowId !== nextRow.rowId) {
        continue;
      }

      getEdgeStrokeElement(sample)?.classList.add("is-linked");

      if (sample.sourceNodeId !== nextRow.nodeId) {
        getEdgeNodeElement(sample, "source")?.classList.add("is-edge-linked");
      }

      if (sample.targetNodeId !== nextRow.nodeId) {
        getEdgeNodeElement(sample, "target")?.classList.add("is-edge-linked");
      }
    }
  }

  hoveredRowRef.current = nextRow;
}

function getEdgeStrokeElement(sample: EdgeHoverSample | null | undefined): SVGElement | null {
  if (!sample) {
    return null;
  }

  if (sample.strokeElement?.isConnected) {
    return sample.strokeElement;
  }

  const nextElement = findEdgeElement(".schema-edge-stroke", sample.id);
  sample.strokeElement = nextElement;
  return nextElement;
}

function getEdgeTrailElement(sample: EdgeHoverSample | null | undefined): SVGElement | null {
  if (!sample) {
    return null;
  }

  if (sample.trailElement?.isConnected) {
    return sample.trailElement;
  }

  const nextElement = findEdgeElement(".schema-edge-trail", sample.id);
  sample.trailElement = nextElement;
  return nextElement;
}

function getEdgeNodeElement(
  sample: EdgeHoverSample | null | undefined,
  side: "source" | "target",
): HTMLElement | null {
  if (!sample) {
    return null;
  }

  if (side === "source") {
    if (sample.sourceNodeElement?.isConnected) {
      return sample.sourceNodeElement;
    }

    const nextElement = findNodeElement(sample.sourceNodeId);
    sample.sourceNodeElement = nextElement;
    return nextElement;
  }

  if (sample.targetNodeElement?.isConnected) {
    return sample.targetNodeElement;
  }

  const nextElement = findNodeElement(sample.targetNodeId);
  sample.targetNodeElement = nextElement;
  return nextElement;
}

function findEdgeElement(selector: string, edgeId: string): SVGElement | null {
  const elements = document.querySelectorAll<SVGElement>(`${selector}[data-edge-id]`);

  for (const element of elements) {
    if (element.dataset.edgeId === edgeId) {
      return element;
    }
  }

  return null;
}

function findNodeElement(nodeId: string): HTMLElement | null {
  return getNodeElementById(nodeId);
}

function getNodeElementById(nodeId: string): HTMLElement | null {
  const elements = document.querySelectorAll<HTMLElement>(".react-flow__node[data-id]");

  for (const element of elements) {
    if (element.dataset.id === nodeId) {
      return element;
    }
  }

  return null;
}

function getRowElementById(rowId: string): HTMLElement | null {
  const elements = document.querySelectorAll<HTMLElement>(".schema-node__row[data-row-id]");

  for (const element of elements) {
    if (element.dataset.rowId === rowId) {
      return element;
    }
  }

  return null;
}

function collectEdgeHoverSamples(
  container: HTMLDivElement | null,
  model: SchemaGraphModel,
): EdgeHoverSample[] {
  if (!container) {
    return [];
  }

  const paths = Array.from(
    container.querySelectorAll<SVGPathElement>(".schema-edge-guide[data-edge-id]"),
  );
  const edgesById = new Map(model.edges.map((edge) => [edge.id, edge]));

  return paths
    .map((path) => buildEdgeHoverSample(path, edgesById))
    .filter((sample): sample is EdgeHoverSample => sample !== null);
}

function buildEdgeHoverSample(
  path: SVGPathElement,
  edgesById: Map<string, SchemaGraphModel["edges"][number]>,
): EdgeHoverSample | null {
  const id = path.dataset.edgeId;
  const parent = path.parentElement;
  const edge = id ? edgesById.get(id) : null;

  if (
    !id ||
    !parent ||
    !edge ||
    typeof path.getTotalLength !== "function" ||
    typeof path.getPointAtLength !== "function"
  ) {
    return null;
  }

  const totalLength = path.getTotalLength();

  if (!Number.isFinite(totalLength) || totalLength <= 0) {
    return null;
  }

  const pointCount = Math.max(2, Math.ceil(totalLength / EDGE_SAMPLE_STEP));
  const points: Array<{ x: number; y: number }> = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let index = 0; index <= pointCount; index += 1) {
    const distance = totalLength * (index / pointCount);
    const point = path.getPointAtLength(distance);

    points.push({ x: point.x, y: point.y });
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    id,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    sourceRowId: edge.sourceRowId,
    points,
    strokeElement: parent.querySelector<SVGElement>(".schema-edge-stroke"),
    trailElement: parent.querySelector<SVGElement>(".schema-edge-trail"),
    sourceNodeElement: findNodeElement(edge.source),
    targetNodeElement: findNodeElement(edge.target),
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
    },
  };
}

function findHoveredEdgeId(
  samples: EdgeHoverSample[],
  point: { x: number; y: number },
  threshold: number,
): string | null {
  const thresholdSquared = threshold * threshold;
  let closestId: string | null = null;
  let closestDistance = thresholdSquared;

  for (const sample of samples) {
    if (
      point.x < sample.bounds.minX - threshold ||
      point.x > sample.bounds.maxX + threshold ||
      point.y < sample.bounds.minY - threshold ||
      point.y > sample.bounds.maxY + threshold
    ) {
      continue;
    }

    for (const samplePoint of sample.points) {
      const dx = samplePoint.x - point.x;
      const dy = samplePoint.y - point.y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared < closestDistance) {
        closestDistance = distanceSquared;
        closestId = sample.id;
      }
    }
  }

  return closestId;
}
