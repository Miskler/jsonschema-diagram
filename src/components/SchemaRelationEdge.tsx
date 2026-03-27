import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { useEffect, useRef, useState } from "react";

const LABELS_TO_HIDE = new Set(["field", "pattern", "index", "rest", "placeholder"]);
const TARGET_HANDLE_CENTER_OFFSET = 31;
const LOOP_LEFT_OFFSET = 14;
const LOOP_RIGHT_PADDING = 42;
const LOOP_VERTICAL_PADDING = 24;
const LOOP_RADIUS = 32;
const TRAIL_PADDING = 18;
const TRAIL_SPACING = 17;
const TRAIL_SAMPLE_OFFSET = 3;
const CHEVRON_PATH = "M -5 -4 L 0 0 L -5 4";

interface RelationEdgeData {
  isSelfLoop?: boolean;
  nodeWidth?: number;
  nodeHeight?: number;
  labelPosition?: "center" | "source";
}

export function SchemaRelationEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
}: EdgeProps<RelationEdgeData>) {
  const isSelfLoop = data?.isSelfLoop || source === target;
  const [path, defaultLabelX, defaultLabelY] = isSelfLoop
    ? getSelfLoopPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        nodeWidth: data?.nodeWidth,
        nodeHeight: data?.nodeHeight,
      })
    : getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      });
  const [labelX, labelY] =
    data?.labelPosition === "source"
      ? getSourceLabelPosition({
          sourceX,
          sourceY,
          targetY,
        })
      : [defaultLabelX, defaultLabelY];
  const shouldRenderLabel =
    typeof label === "string" && label.length > 0 && !LABELS_TO_HIDE.has(label);
  const guidePathRef = useRef<SVGPathElement | null>(null);
  const [trail, setTrail] = useState<TrailChevron[]>([]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const nextTrail = buildChevronTrail(guidePathRef.current);
      setTrail(nextTrail);
    });

    return () => cancelAnimationFrame(frame);
  }, [path]);

  return (
    <>
      <path
        ref={guidePathRef}
        d={path}
        className="schema-edge-guide"
        data-edge-id={id}
      />
      <BaseEdge
        id={id}
        path={path}
        className="schema-edge-stroke"
        data-edge-id={id}
        interactionWidth={18}
      />
      {trail.length > 0 ? (
        <g className="schema-edge-trail" data-edge-id={id} aria-hidden="true">
          {trail.map((chevron, index) => (
            <path
              key={`${chevron.x}-${chevron.y}-${index}`}
              d={CHEVRON_PATH}
              className="schema-edge-chevron"
              transform={`translate(${chevron.x} ${chevron.y}) rotate(${chevron.angle})`}
            />
          ))}
        </g>
      ) : null}
      {shouldRenderLabel ? (
        <EdgeLabelRenderer>
          <div
            className="schema-edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

interface TrailChevron {
  x: number;
  y: number;
  angle: number;
}

function buildChevronTrail(pathElement: SVGPathElement | null): TrailChevron[] {
  if (
    !pathElement ||
    typeof pathElement.getTotalLength !== "function" ||
    typeof pathElement.getPointAtLength !== "function"
  ) {
    return [];
  }

  const totalLength = pathElement.getTotalLength();
  const usableLength = Math.max(0, totalLength - TRAIL_PADDING * 2);

  if (usableLength < 24) {
    return [];
  }

  const count = Math.max(2, Math.floor(usableLength / TRAIL_SPACING));
  const step = usableLength / (count + 1);
  const chevrons: TrailChevron[] = [];

  for (let index = 0; index < count; index += 1) {
    const distance = TRAIL_PADDING + step * (index + 1);
    const prev = pathElement.getPointAtLength(Math.max(0, distance - TRAIL_SAMPLE_OFFSET));
    const next = pathElement.getPointAtLength(
      Math.min(totalLength, distance + TRAIL_SAMPLE_OFFSET),
    );
    const point = pathElement.getPointAtLength(distance);
    const angle = (Math.atan2(next.y - prev.y, next.x - prev.x) * 180) / Math.PI;

    chevrons.push({
      x: point.x,
      y: point.y,
      angle,
    });
  }

  return chevrons;
}

function getSourceLabelPosition({
  sourceX,
  sourceY,
  targetY,
}: {
  sourceX: number;
  sourceY: number;
  targetY: number;
}): [number, number] {
  return [
    sourceX + 42,
    sourceY + (targetY > sourceY + 8 ? 18 : targetY < sourceY - 8 ? -18 : -20),
  ];
}

function getSelfLoopPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  nodeWidth,
  nodeHeight,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  nodeWidth?: number;
  nodeHeight?: number;
}): [string, number, number] {
  const width = nodeWidth ?? Math.max(220, sourceX - targetX);
  const height =
    nodeHeight ?? Math.max(140, Math.abs(sourceY - targetY) + 88);
  const nodeTop = targetY - TARGET_HANDLE_CENTER_OFFSET;
  const nodeBottom = nodeTop + height;
  const loopRight = sourceX + Math.max(34, Math.min(LOOP_RIGHT_PADDING, width * 0.14));
  const loopLeft = targetX - LOOP_LEFT_OFFSET;
  const shouldLoopBelow = sourceY >= targetY;
  const radius = Math.min(
    LOOP_RADIUS,
    Math.max(8, (loopRight - loopLeft) / 6),
  );

  if (shouldLoopBelow) {
    const loopY = nodeBottom + Math.max(18, Math.min(LOOP_VERTICAL_PADDING, height * 0.1));

    return [
      [
        `M ${sourceX} ${sourceY}`,
        `L ${loopRight - radius} ${sourceY}`,
        `Q ${loopRight} ${sourceY} ${loopRight} ${sourceY + radius}`,
        `L ${loopRight} ${loopY - radius}`,
        `Q ${loopRight} ${loopY} ${loopRight - radius} ${loopY}`,
        `L ${loopLeft + radius} ${loopY}`,
        `Q ${loopLeft} ${loopY} ${loopLeft} ${loopY - radius}`,
        `L ${loopLeft} ${targetY + radius}`,
        `Q ${loopLeft} ${targetY} ${loopLeft + radius} ${targetY}`,
        `L ${targetX} ${targetY}`,
      ].join(" "),
      (loopLeft + loopRight) / 2,
      loopY - 12,
    ];
  }

  const loopY = nodeTop - Math.max(18, Math.min(LOOP_VERTICAL_PADDING, height * 0.1));

  return [
    [
      `M ${sourceX} ${sourceY}`,
      `L ${loopRight - radius} ${sourceY}`,
      `Q ${loopRight} ${sourceY} ${loopRight} ${sourceY - radius}`,
      `L ${loopRight} ${loopY + radius}`,
      `Q ${loopRight} ${loopY} ${loopRight - radius} ${loopY}`,
      `L ${loopLeft + radius} ${loopY}`,
      `Q ${loopLeft} ${loopY} ${loopLeft} ${loopY + radius}`,
      `L ${loopLeft} ${targetY - radius}`,
      `Q ${loopLeft} ${targetY} ${loopLeft + radius} ${targetY}`,
      `L ${targetX} ${targetY}`,
    ].join(" "),
    (loopLeft + loopRight) / 2,
    loopY + 12,
  ];
}
