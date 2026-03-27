import { useEffect, useState } from "react";
import {
  formatInstancePath,
  formatSchemaPath,
  type PathFormat,
} from "../lib/path-format";
import type { InspectorDetails } from "../lib/schema-types";

interface DetailPanelProps {
  details: InspectorDetails | null;
  onClose: () => void;
}

interface PathCard {
  id: string;
  label: string;
  value?: string;
  note?: string;
}

export function DetailPanel({ details, onClose }: DetailPanelProps) {
  const [pathFormat, setPathFormat] = useState<PathFormat>("slash");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!details) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [details, onClose]);

  useEffect(() => {
    setPathFormat("slash");
    setCopiedId(null);
  }, [details]);

  if (!details) {
    return null;
  }

  const pathCards: PathCard[] = [
    {
      id: "schema-pointer",
      label: "Schema pointer",
      value: details.schemaPointer,
    },
    {
      id: "schema-path",
      label: "Schema path",
      value: formatSchemaPath(details.schemaTokens, pathFormat),
    },
    ...(details.resolvedSchemaPointer
      ? [
          {
            id: "resolved-pointer",
            label: "Resolved schema",
            value: details.resolvedSchemaPointer,
          },
          {
            id: "resolved-path",
            label: "Resolved path",
            value: formatSchemaPath(
              details.resolvedSchemaTokens ?? details.schemaTokens,
              pathFormat,
            ),
          },
        ]
      : []),
    {
      id: "instance-path",
      label: "JSON path",
      value: details.instancePathTokens
        ? formatInstancePath(details.instancePathTokens, pathFormat)
        : undefined,
      note:
        details.instancePathNote ??
        (!details.instancePathTokens
          ? "No stable JSON path is available for this selection."
          : undefined),
    },
  ];

  async function handleCopy(card: PathCard) {
    if (!card.value) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(card.value);
      } else {
        const input = document.createElement("textarea");
        input.value = card.value;
        input.setAttribute("readonly", "true");
        input.style.position = "absolute";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      setCopiedId(card.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === card.id ? null : current));
      }, 1400);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <div className="detail-modal" role="presentation" onClick={onClose}>
      <aside
        className="detail-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="detail-modal__topbar">
          <div>
            <div className="sidebar-panel__eyebrow">
              {details.selectionKind === "row" ? "Field Selection" : "Node Selection"}
            </div>
            <div className="detail-modal__heading-row">
              <h2 className="sidebar-panel__title" id="detail-modal-title">
                {details.heading}
              </h2>
              <span className="detail-panel__badge">{details.badge}</span>
            </div>
          </div>

          <button
            type="button"
            className="detail-modal__close"
            onClick={onClose}
            aria-label="Close selection details"
          >
            Close
          </button>
        </div>

        {details.description ? (
          <p className="detail-panel__description">{details.description}</p>
        ) : null}

        {details.facts.length > 0 ? (
          <div className="detail-panel__facts">
            {details.facts.map((fact) => (
              <span className="detail-panel__fact" key={fact}>
                {fact}
              </span>
            ))}
          </div>
        ) : null}

        <div className="detail-panel__section">
          <div className="detail-panel__section-head">
            <div className="source-panel__label">Copy Paths</div>
            <div
              className="detail-panel__format-switch"
              role="tablist"
              aria-label="Path format"
            >
              {(["slash", "py-like"] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  className={[
                    "detail-panel__format-button",
                    pathFormat === format ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setPathFormat(format)}
                  aria-pressed={pathFormat === format}
                >
                  {format === "slash" ? "Slash" : "Py-like"}
                </button>
              ))}
            </div>
          </div>

          <div className="detail-panel__path-grid">
            {pathCards.map((card) => (
              <section className="detail-panel__path-card" key={card.id}>
                <div className="detail-panel__path-head">
                  <div className="detail-panel__path-label">{card.label}</div>
                  <button
                    type="button"
                    className="detail-panel__copy-button"
                    onClick={() => void handleCopy(card)}
                    disabled={!card.value}
                  >
                    {copiedId === card.id ? "Copied" : "Copy"}
                  </button>
                </div>

                {card.value ? (
                  <code className="detail-panel__path-value">{card.value}</code>
                ) : (
                  <div className="detail-panel__path-empty">Unavailable</div>
                )}

                {card.note ? (
                  <div className="detail-panel__path-note">{card.note}</div>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
