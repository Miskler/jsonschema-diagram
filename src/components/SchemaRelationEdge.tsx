import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

const LABELS_TO_HIDE = new Set(["field", "placeholder"]);

export function SchemaRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const shouldRenderLabel =
    typeof label === "string" && label.length > 0 && !LABELS_TO_HIDE.has(label);

  return (
    <>
      <BaseEdge id={id} path={path} />
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
