import {
  Background,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
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
const MAX_SEARCH_RESULTS = 10;
const EMPTY_ROW_ID_SET = new Set<string>();

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

interface SearchMatch {
  id: string;
  kind: "node" | "row";
  nodeId: string;
  rowId?: string;
  label: string;
  meta: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  const searchMatches = useMemo(
    () => buildSearchMatches(model, searchQuery),
    [model, searchQuery],
  );
  const activeSearchMatch =
    searchMatches.length > 0
      ? searchMatches[Math.min(activeSearchIndex, searchMatches.length - 1)]
      : null;
  const visibleSearchMatches = useMemo(() => {
    if (searchMatches.length <= MAX_SEARCH_RESULTS) {
      return searchMatches.map((match, index) => ({ match, index }));
    }

    const halfWindow = Math.floor(MAX_SEARCH_RESULTS / 2);
    const start = Math.min(
      Math.max(0, activeSearchIndex - halfWindow),
      searchMatches.length - MAX_SEARCH_RESULTS,
    );

    return searchMatches
      .slice(start, start + MAX_SEARCH_RESULTS)
      .map((match, index) => ({ match, index: start + index }));
  }, [activeSearchIndex, searchMatches]);
  const matchedRowIdsByNode = useMemo(
    () => buildMatchedRowIdsByNode(searchMatches),
    [searchMatches],
  );
  const matchedNodeIds = useMemo(
    () => new Set(searchMatches.map((match) => match.nodeId)),
    [searchMatches],
  );

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

  useEffect(() => {
    setActiveSearchIndex((current) => {
      if (searchMatches.length === 0) {
        return 0;
      }

      return Math.min(current, searchMatches.length - 1);
    });
  }, [searchMatches.length]);

  useEffect(() => {
    if (!reactFlowRef.current) {
      return;
    }

    void reactFlowRef.current.fitView({
      duration: 250,
      padding: 0.18,
      minZoom: 0.2,
      maxZoom: 1.15,
    });
  }, [revision]);

  const nodes: Node<FlowNodeData>[] = model.nodes.map((node) => ({
    id: node.id,
    type: "schema",
    data: {
      schemaNode: node,
      selection,
      onSelectNode,
      onSelectRow,
      onHoverRow: handleRowHover,
      isSearchMatched: matchedNodeIds.has(node.id),
      isSearchActive: activeSearchMatch?.nodeId === node.id,
      matchedRowIds: matchedRowIdsByNode.get(node.id) ?? EMPTY_ROW_ID_SET,
      activeSearchRowId:
        activeSearchMatch?.kind === "row" && activeSearchMatch.nodeId === node.id
          ? activeSearchMatch.rowId
          : undefined,
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

  function handleZoomIn() {
    void reactFlowRef.current?.zoomIn({ duration: 150 });
  }

  function handleZoomOut() {
    void reactFlowRef.current?.zoomOut({ duration: 150 });
  }

  function handleFitView() {
    void reactFlowRef.current?.fitView({
      duration: 220,
      padding: 0.18,
      minZoom: 0.2,
      maxZoom: 1.15,
    });
  }

  function revealSearchMatch(match: SearchMatch | null) {
    if (!match) {
      return;
    }

    if (match.kind === "row" && match.rowId) {
      onSelectRow(match.nodeId, match.rowId);
    } else {
      onSelectNode(match.nodeId);
    }

    void reactFlowRef.current?.fitView({
      nodes: [{ id: match.nodeId }],
      duration: 220,
      padding: 0.36,
      minZoom: 0.35,
      maxZoom: 1.18,
    });
  }

  function moveSearchCursor(delta: number, reveal = false) {
    if (searchMatches.length === 0) {
      return;
    }

    const nextIndex =
      (activeSearchIndex + delta + searchMatches.length) % searchMatches.length;
    const nextMatch = searchMatches[nextIndex];

    setActiveSearchIndex(nextIndex);

    if (reveal) {
      revealSearchMatch(nextMatch);
    }
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSearchCursor(1, true);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSearchCursor(-1, true);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      revealSearchMatch(activeSearchMatch);
      return;
    }

    if (event.key === "Escape" && searchQuery) {
      event.preventDefault();
      setSearchQuery("");
      setActiveSearchIndex(0);
    }
  }

  return (
    <div ref={canvasRef} className="canvas-surface">
      <div
        className="canvas-toolbar nopan nowheel"
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <div className="canvas-toolbar__search-row">
          <label className="canvas-toolbar__search">
            <SearchIcon />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setActiveSearchIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              className="canvas-toolbar__search-input"
              placeholder="Search nodes and fields"
              aria-label="Search schema tree"
            />
            {searchQuery ? (
              <button
                type="button"
                className="canvas-toolbar__clear"
                onClick={() => {
                  setSearchQuery("");
                  setActiveSearchIndex(0);
                }}
                aria-label="Clear search"
                title="Clear search"
              >
                <ClearIcon />
              </button>
            ) : null}
          </label>

          <div className="canvas-toolbar__zoom-group">
            <button
              type="button"
              className="canvas-toolbar__button"
              onClick={handleZoomOut}
              aria-label="Zoom out"
              title="Zoom out"
            >
              -
            </button>
            <button
              type="button"
              className="canvas-toolbar__button canvas-toolbar__button--fit"
              onClick={handleFitView}
              aria-label="Fit view"
              title="Fit view"
            >
              <FitIcon />
            </button>
            <button
              type="button"
              className="canvas-toolbar__button"
              onClick={handleZoomIn}
              aria-label="Zoom in"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>

        {searchQuery.trim() ? (
          <div className="canvas-toolbar__results" role="listbox" aria-label="Search results">
            {searchMatches.length > 0 ? (
              <div className="canvas-toolbar__results-meta">
                {activeSearchIndex + 1}/{searchMatches.length} matches
              </div>
            ) : null}
            {searchMatches.length > 0 ? (
              visibleSearchMatches.map(({ match, index }) => {
                const isActive = index === activeSearchIndex;

                return (
                  <button
                    type="button"
                    key={match.id}
                    className={[
                      "canvas-toolbar__result",
                      isActive ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => {
                      setActiveSearchIndex(index);
                      revealSearchMatch(match);
                    }}
                    role="option"
                    aria-selected={isActive}
                  >
                    <span className="canvas-toolbar__result-kind">
                      {match.kind === "row" ? "field" : "node"}
                    </span>
                    <span className="canvas-toolbar__result-body">
                      <span className="canvas-toolbar__result-title">
                        {renderHighlightedText(match.label, searchQuery)}
                      </span>
                      <span className="canvas-toolbar__result-meta">
                        {renderHighlightedText(match.meta, searchQuery)}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="canvas-toolbar__empty">No matches in the current schema.</div>
            )}
          </div>
        ) : null}
      </div>

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

function buildSearchMatches(
  model: SchemaGraphModel,
  query: string,
): SearchMatch[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const matches: SearchMatch[] = [];

  for (const node of model.nodes) {
    const nodeMeta = [node.subtitle, node.pointer, ...node.metaLines]
      .filter(Boolean)
      .join(" • ");
    const nodeHaystack = [node.title, nodeMeta, node.description ?? ""]
      .join(" ")
      .toLowerCase();

    if (nodeHaystack.includes(normalizedQuery)) {
      matches.push({
        id: `node:${node.id}`,
        kind: "node",
        nodeId: node.id,
        label: node.title,
        meta: nodeMeta,
      });
    }

    for (const row of node.rows) {
      const rowMeta = [node.title, row.typeLabel, row.pointer, ...row.detailLines]
        .filter(Boolean)
        .join(" • ");
      const rowHaystack = [row.label, rowMeta, row.description ?? ""]
        .join(" ")
        .toLowerCase();

      if (!rowHaystack.includes(normalizedQuery)) {
        continue;
      }

      matches.push({
        id: `row:${row.id}`,
        kind: "row",
        nodeId: node.id,
        rowId: row.id,
        label: row.label,
        meta: `${node.title} • ${row.typeLabel}`,
      });
    }
  }

  return matches;
}

function buildMatchedRowIdsByNode(matches: SearchMatch[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  for (const match of matches) {
    if (match.kind !== "row" || !match.rowId) {
      continue;
    }

    const existing = result.get(match.nodeId);

    if (existing) {
      existing.add(match.rowId);
      continue;
    }

    result.set(match.nodeId, new Set([match.rowId]));
  }

  return result;
}

function renderHighlightedText(value: string, query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return value;
  }

  const matchIndex = value.toLowerCase().indexOf(normalizedQuery.toLowerCase());

  if (matchIndex === -1) {
    return value;
  }

  const before = value.slice(0, matchIndex);
  const hit = value.slice(matchIndex, matchIndex + normalizedQuery.length);
  const after = value.slice(matchIndex + normalizedQuery.length);

  return (
    <>
      {before}
      <mark className="canvas-toolbar__result-hit">{hit}</mark>
      {after}
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M13.5 12.1 17 15.6l-1.4 1.4-3.5-3.5a6 6 0 1 1 1.4-1.4ZM8.5 13A4.5 4.5 0 1 0 8.5 4a4.5 4.5 0 0 0 0 9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FitIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M6 6 14 14M14 6 6 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
