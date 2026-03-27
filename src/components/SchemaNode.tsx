import { Handle, Position, type NodeProps } from "@xyflow/react";
import { createTargetHandleId } from "../lib/handle-ids";
import type { FlowNodeData } from "./flow-types";

export function SchemaNode({ data, id, selected }: NodeProps<FlowNodeData>) {
  const { schemaNode, selection, onSelectNode, onSelectRow, onHoverRow } = data;
  const activeRowId = selection?.kind === "row" ? selection.rowId : null;
  const nodeSelected =
    selected || (selection?.kind === "node" && selection.nodeId === id);
  const hasRequiredRows = schemaNode.rows.some((row) => row.required);
  const isRootNode = schemaNode.pointer === "#";
  const directArrayRow =
    schemaNode.kind === "array" &&
    schemaNode.rows.length === 1 &&
    schemaNode.rows[0].relation === "items" &&
    schemaNode.rows[0].handleId
      ? schemaNode.rows[0]
      : null;

  return (
    <div
      className={[
        "schema-node",
        `schema-node--${schemaNode.kind}`,
        directArrayRow ? "schema-node--direct-link" : "",
        hasRequiredRows ? "schema-node--has-required" : "",
        nodeSelected ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-node-id={id}
      onClick={() => onSelectNode(id)}
    >
      {!isRootNode ? (
        <Handle
          id={createTargetHandleId(id)}
          type="target"
          position={Position.Left}
          className="schema-node__target"
        />
      ) : null}

      <div className="schema-node__header">
        <div>
          <div className="schema-node__title">{schemaNode.title}</div>
          <div className="schema-node__subtitle">{schemaNode.subtitle}</div>
        </div>
        <span className="schema-node__badge">{schemaNode.kind}</span>
      </div>

      {directArrayRow ? (
        <Handle
          id={directArrayRow.handleId}
          type="source"
          position={Position.Right}
          className="schema-node__source schema-node__source--node"
        />
      ) : null}

      {schemaNode.kind === "enum" ? (
        <div className="schema-node__enum-list">
          {schemaNode.enumValues.map((value) => (
            <span className="schema-node__enum-pill" key={value}>
              {value}
            </span>
          ))}
        </div>
      ) : (
        <div className="schema-node__rows">
          {schemaNode.rows.map((row) => {
            const rowSelected = activeRowId === row.id;
            const hasChildren =
              (row.childNodeIds?.length ?? 0) > 0 || Boolean(row.childNodeId);

            return (
              <button
                type="button"
                key={row.id}
                data-row-id={row.id}
                className={[
                  "schema-node__row",
                  rowSelected ? "is-active" : "",
                  hasChildren ? "has-child" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectRow(id, row.id);
                }}
                onMouseEnter={() => onHoverRow(id, row.id)}
                onMouseLeave={() => onHoverRow(id, null)}
                title={`${row.label} · ${row.typeLabel}`}
              >
                {hasRequiredRows ? (
                  <span className="schema-node__required">
                    {row.required ? "!" : ""}
                  </span>
                ) : null}
                <span className="schema-node__label">{row.label}</span>
                <span className="schema-node__type">{row.typeLabel}</span>

                {row.handleId ? (
                  <Handle
                    id={row.handleId}
                    type="source"
                    position={Position.Right}
                    className="schema-node__source"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
