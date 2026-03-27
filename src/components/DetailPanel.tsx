import { Fragment, type ReactNode, useEffect, useState } from "react";
import {
  formatInstancePath,
  formatSchemaPath,
  parseSchemaPointer,
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
  kind: "pointer" | "schema" | "instance";
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
      id: "schema-path",
      label: "Schema path",
      value: formatSchemaPath(details.schemaTokens, pathFormat),
      kind: "schema",
    },
    ...(details.resolvedSchemaPointer
      ? [
          {
            id: "resolved-pointer",
            label: "Resolved schema",
            value: details.resolvedSchemaPointer,
            kind: "pointer" as const,
          },
          {
            id: "resolved-path",
            label: "Resolved path",
            value: formatSchemaPath(
              details.resolvedSchemaTokens ?? details.schemaTokens,
              pathFormat,
            ),
            kind: "schema" as const,
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
      kind: "instance",
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
                  <code className="detail-panel__path-value detail-panel__path-value--syntax">
                    {renderPathValue(card)}
                  </code>
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

  function renderPathValue(card: PathCard): ReactNode {
    if (!card.value) {
      return null;
    }

    if (card.kind === "pointer") {
      return renderPointerValue(card.value);
    }

    if (pathFormat === "slash") {
      return renderSlashValue(card.value);
    }

    return renderPyLikeValue(card.value);
  }
}

function renderPointerValue(pointer: string): ReactNode {
  const tokens = parseSchemaPointer(pointer);

  return (
    <>
      <span className="detail-panel__path-token detail-panel__path-token--root">#</span>
      {tokens.map((token, index) => (
        <Fragment key={`${pointer}-${token}-${index}`}>
          <span className="detail-panel__path-token detail-panel__path-token--sep">/</span>
          <span className="detail-panel__path-token detail-panel__path-token--segment">
            {token}
          </span>
        </Fragment>
      ))}
    </>
  );
}

function renderSlashValue(value: string): ReactNode {
  if (value === "/") {
    return (
      <span className="detail-panel__path-token detail-panel__path-token--root">/</span>
    );
  }

  const tokens = value.split("/");

  return tokens.map((token, index) => (
    <Fragment key={`${value}-${token}-${index}`}>
      {index > 0 ? (
        <span className="detail-panel__path-token detail-panel__path-token--sep">/</span>
      ) : null}
      <span
        className={[
          "detail-panel__path-token",
          /^\d+$/.test(token)
            ? "detail-panel__path-token--number"
            : "detail-panel__path-token--segment",
        ].join(" ")}
      >
        {token}
      </span>
    </Fragment>
  ));
}

function renderPyLikeValue(value: string): ReactNode {
  const result: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  const rootMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(value);

  if (rootMatch) {
    result.push(
      <span
        key={`root-${key}`}
        className="detail-panel__path-token detail-panel__path-token--root"
      >
        {rootMatch[0]}
      </span>,
    );
    cursor = rootMatch[0].length;
    key += 1;
  }

  while (cursor < value.length) {
    const current = value[cursor];

    if (current === ".") {
      result.push(
        <span
          key={`sep-${key}`}
          className="detail-panel__path-token detail-panel__path-token--sep"
        >
          .
        </span>,
      );
      key += 1;
      cursor += 1;

      const identifierMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(value.slice(cursor));

      if (identifierMatch) {
        result.push(
          <span
            key={`segment-${key}`}
            className="detail-panel__path-token detail-panel__path-token--segment"
          >
            {identifierMatch[0]}
          </span>,
        );
        key += 1;
        cursor += identifierMatch[0].length;
      }

      continue;
    }

    if (current === "[") {
      const bracketEnd = value.indexOf("]", cursor);

      if (bracketEnd === -1) {
        break;
      }

      const content = value.slice(cursor + 1, bracketEnd);

      result.push(
        <span
          key={`open-${key}`}
          className="detail-panel__path-token detail-panel__path-token--sep"
        >
          [
        </span>,
      );
      key += 1;
      result.push(
        <span
          key={`content-${key}`}
          className={[
            "detail-panel__path-token",
            /^"\s*.*\s*"$/.test(content)
              ? "detail-panel__path-token--string"
              : /^\d+$/.test(content)
                ? "detail-panel__path-token--number"
                : "detail-panel__path-token--segment",
          ].join(" ")}
        >
          {content}
        </span>,
      );
      key += 1;
      result.push(
        <span
          key={`close-${key}`}
          className="detail-panel__path-token detail-panel__path-token--sep"
        >
          ]
        </span>,
      );
      key += 1;
      cursor = bracketEnd + 1;
      continue;
    }

    result.push(
      <span
        key={`plain-${key}`}
        className="detail-panel__path-token detail-panel__path-token--segment"
      >
        {current}
      </span>,
    );
    key += 1;
    cursor += 1;
  }

  return result;
}
