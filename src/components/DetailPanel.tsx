import type { InspectorDetails } from "../lib/schema-types";

interface DetailPanelProps {
  details: InspectorDetails | null;
}

export function DetailPanel({ details }: DetailPanelProps) {
  return (
    <aside className="sidebar-panel detail-panel">
      <div className="sidebar-panel__eyebrow">Selection</div>
      {details ? (
        <>
          <div className="detail-panel__heading-row">
            <h2 className="sidebar-panel__title">{details.heading}</h2>
            <span className="detail-panel__badge">{details.badge}</span>
          </div>
          <div className="detail-panel__pointer">{details.pointer}</div>
          {details.description ? (
            <p className="detail-panel__description">{details.description}</p>
          ) : null}
          <ul className="detail-panel__list">
            {details.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="detail-panel__empty">
          Pick a node or a field to inspect its pointer and constraints.
        </p>
      )}
    </aside>
  );
}
