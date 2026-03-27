interface SchemaSourcePanelProps {
  mode: "site" | "embed";
  sourceText: string;
  sourceOrigin: string;
  busy: boolean;
  hasDefaultSchema: boolean;
  errors: string[];
  warnings: string[];
  onSourceChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
}

export function SchemaSourcePanel({
  mode,
  sourceText,
  sourceOrigin,
  busy,
  hasDefaultSchema,
  errors,
  warnings,
  onSourceChange,
  onApply,
  onReset,
}: SchemaSourcePanelProps) {
  return (
    <aside className="sidebar-panel source-panel">
      <div className="sidebar-panel__eyebrow">Schema Input</div>
      <h1 className="sidebar-panel__title">JSON Schema Diagram</h1>
      <p className="source-panel__lead">
        Interactive read-only view for core JSON Schema structures, local refs,
        arrays, enums, and combinators.
      </p>

      <div className="source-panel__meta">
        <span className="source-panel__meta-chip">{mode}</span>
        <span className="source-panel__meta-chip">{busy ? "Updating…" : "Ready"}</span>
      </div>

      <label className="source-panel__label" htmlFor="schema-input">
        Raw schema
      </label>
      <textarea
        id="schema-input"
        className="source-panel__textarea"
        spellCheck={false}
        value={sourceText}
        onChange={(event) => onSourceChange(event.target.value)}
      />

      <div className="source-panel__actions">
        <button
          className="source-panel__button source-panel__button--primary"
          type="button"
          onClick={onApply}
          disabled={busy}
        >
          Apply schema
        </button>
        <button
          className="source-panel__button"
          type="button"
          onClick={onReset}
          disabled={!hasDefaultSchema || busy}
        >
          Reset to default
        </button>
      </div>

      <div className="source-panel__origin">Source: {sourceOrigin}</div>

      {errors.length > 0 ? (
        <div className="message-block message-block--error">
          <div className="message-block__title">Errors</div>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="message-block message-block--warning">
          <div className="message-block__title">Warnings</div>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
