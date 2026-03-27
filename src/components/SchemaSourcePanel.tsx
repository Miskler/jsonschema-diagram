import { JsonCodeEditor } from "./JsonCodeEditor";
import type { ThemePreset, ThemePresetId } from "../lib/theme-presets";

interface SchemaSourcePanelProps {
  mode: "site" | "embed";
  sourceText: string;
  sourceOrigin: string;
  busy: boolean;
  hasDefaultSchema: boolean;
  themeId: ThemePresetId;
  themePresets: readonly ThemePreset[];
  errors: string[];
  warnings: string[];
  onThemeChange: (themeId: ThemePresetId) => void;
  onSourceChange: (value: string) => void;
  onInsert: () => void | Promise<void>;
  onDelete: () => void;
  onApply: () => void;
  onReset: () => void;
}

export function SchemaSourcePanel({
  mode,
  sourceText,
  sourceOrigin,
  busy,
  hasDefaultSchema,
  themeId,
  themePresets,
  errors,
  warnings,
  onThemeChange,
  onSourceChange,
  onInsert,
  onDelete,
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

      <div className="theme-picker">
        <div className="source-panel__label">Color preset</div>
        <div className="theme-picker__grid">
          {themePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={[
                "theme-picker__button",
                themeId === preset.id ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-theme-preview={preset.id}
              onClick={() => onThemeChange(preset.id)}
              aria-pressed={themeId === preset.id}
            >
              <span className="theme-picker__swatches">
                <span className="theme-picker__swatch" />
                <span className="theme-picker__swatch theme-picker__swatch--alt" />
                <span className="theme-picker__swatch theme-picker__swatch--surface" />
              </span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="source-panel__field-header">
        <label className="source-panel__label" htmlFor="schema-input">
          Raw schema
        </label>
        <div className="source-panel__icon-actions" aria-label="Schema editor actions">
          <button
            className="source-panel__icon-button"
            type="button"
            onClick={onInsert}
            disabled={busy}
            aria-label="Paste schema from clipboard"
            title="Paste schema from clipboard"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M5.5 2.75h5m-4-.5v.5m3-.5v.5M5 3.75H4A1.25 1.25 0 0 0 2.75 5v7A1.25 1.25 0 0 0 4 13.25h8A1.25 1.25 0 0 0 13.25 12V5A1.25 1.25 0 0 0 12 3.75h-1M8 6v4.25m0 0L6.25 8.5M8 10.25 9.75 8.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="source-panel__icon-button"
            type="button"
            onClick={onDelete}
            disabled={busy || sourceText.length === 0}
            aria-label="Clear schema input"
            title="Clear schema input"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M5.5 2.75h5M2.75 4.5h10.5M6.25 6.5v4.75M9.75 6.5v4.75M4.75 4.5l.45 7.1c.04.64.57 1.15 1.21 1.15h3.18c.64 0 1.17-.51 1.21-1.15l.45-7.1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <JsonCodeEditor
        id="schema-input"
        value={sourceText}
        disabled={busy}
        onChange={onSourceChange}
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
