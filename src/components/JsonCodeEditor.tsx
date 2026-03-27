import { useDeferredValue, useMemo, useRef } from "react";

interface JsonCodeEditorProps {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const JSON_TOKEN_PATTERN =
  /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;

const SCHEMA_KEYWORDS = new Set([
  "$defs",
  "$ref",
  "$schema",
  "allOf",
  "anyOf",
  "const",
  "default",
  "definitions",
  "description",
  "enum",
  "examples",
  "format",
  "items",
  "oneOf",
  "pattern",
  "patternProperties",
  "prefixItems",
  "properties",
  "required",
  "title",
  "type",
]);

export function JsonCodeEditor({
  id,
  value,
  disabled = false,
  onChange,
}: JsonCodeEditorProps) {
  const deferredValue = useDeferredValue(value);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const highlightedTokens = useMemo(
    () => highlightJsonText(deferredValue),
    [deferredValue],
  );

  return (
    <div className="source-panel__editor">
      <div
        ref={highlightRef}
        className="source-panel__editor-highlight"
        aria-hidden="true"
      >
        <pre className="source-panel__editor-code">
          {highlightedTokens}
          {deferredValue.endsWith("\n") ? "\n" : null}
        </pre>
      </div>
      <textarea
        id={id}
        className="source-panel__textarea"
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (!highlightRef.current) {
            return;
          }

          highlightRef.current.scrollTop = event.currentTarget.scrollTop;
          highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      />
    </div>
  );
}

function highlightJsonText(text: string): Array<string | JSX.Element> {
  const result: Array<string | JSX.Element> = [];
  let cursor = 0;

  for (const match of text.matchAll(JSON_TOKEN_PATTERN)) {
    const token = match[0];
    const start = match.index ?? cursor;

    if (start > cursor) {
      result.push(text.slice(cursor, start));
    }

    result.push(
      <span
        key={`${start}-${token}`}
        className={`source-panel__token source-panel__token--${classifyToken(
          text,
          token,
          start,
        )}`}
      >
        {token}
      </span>,
    );
    cursor = start + token.length;
  }

  if (cursor < text.length) {
    result.push(text.slice(cursor));
  }

  return result;
}

function classifyToken(source: string, token: string, start: number): string {
  if (token === "true" || token === "false" || token === "null") {
    return "literal";
  }

  if (/^-?\d/.test(token)) {
    return "number";
  }

  if (token === ":" || token === ",") {
    return "operator";
  }

  if (/^[{}\[\]]$/.test(token)) {
    return "brace";
  }

  if (token.startsWith('"')) {
    const isKey = isJsonKey(source, start + token.length);
    const keyCandidate = safelyParseJsonString(token);

    if (isKey && keyCandidate !== undefined && SCHEMA_KEYWORDS.has(keyCandidate)) {
      return "schema-key";
    }

    if (isKey) {
      return "key";
    }

    return "string";
  }

  return "plain";
}

function isJsonKey(source: string, tokenEnd: number): boolean {
  let cursor = tokenEnd;

  while (cursor < source.length && /\s/.test(source[cursor])) {
    cursor += 1;
  }

  return source[cursor] === ":";
}

function safelyParseJsonString(token: string): string | undefined {
  try {
    return JSON.parse(token) as string;
  } catch {
    return undefined;
  }
}
