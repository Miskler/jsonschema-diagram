import { Handle, Position, type NodeProps } from "@xyflow/react";
import { createTargetHandleId } from "../lib/handle-ids";
import type { FlowNodeData } from "./flow-types";

export function SchemaNode({ data, id, selected }: NodeProps<FlowNodeData>) {
  const { schemaNode, selection, onSelectNode, onSelectRow } = data;
  const activeRowId = selection?.kind === "row" ? selection.rowId : null;
  const nodeSelected =
    selected || (selection?.kind === "node" && selection.nodeId === id);

  return (
    <div
      className={[
        "schema-node",
        `schema-node--${schemaNode.kind}`,
        nodeSelected ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelectNode(id)}
    >
      <Handle
        id={createTargetHandleId(id)}
        type="target"
        position={Position.Left}
        className="schema-node__target"
      />

      <div className="schema-node__header">
        <div>
          <div className="schema-node__title">{schemaNode.title}</div>
          <div className="schema-node__subtitle">{schemaNode.subtitle}</div>
        </div>
        <span className="schema-node__badge">{schemaNode.kind}</span>
      </div>

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

            return (
              <button
                type="button"
                key={row.id}
                className={[
                  "schema-node__row",
                  rowSelected ? "is-active" : "",
                  row.childNodeId ? "has-child" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectRow(id, row.id);
                }}
                title={`${row.label} · ${row.typeLabel}`}
              >
                <span className="schema-node__required">
                  {row.required ? "!" : ""}
                </span>
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
