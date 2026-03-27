import { RB } from "@gruhn/regex-utils";
import type { PathToken } from "./schema-types";

export type PathFormat = "slash" | "py-like";

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NUMERIC_INDEX_PATTERN = /^\d+$/;
const WILDCARD_TOKEN = "*";
const PATTERN_TOKEN_PREFIX = "$match(";
const PATTERN_TOKEN_SUFFIX = ")";
const PATTERN_EXAMPLE_CACHE = new Map<string, string>();
const SCHEMA_ARRAY_SEGMENTS = new Set([
  "allOf",
  "anyOf",
  "items",
  "oneOf",
  "prefixItems",
]);

export function parseSchemaPointer(pointer: string): string[] {
  if (pointer === "#") {
    return [];
  }

  if (!pointer.startsWith("#/")) {
    return [pointer];
  }

  return pointer
    .slice(2)
    .split("/")
    .filter(Boolean)
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
}

export function formatSchemaPath(tokens: string[], format: PathFormat): string {
  if (format === "slash") {
    return tokens.length > 0 ? tokens.join("/") : "/";
  }

  return formatSchemaPyLike(tokens);
}

export function formatInstancePath(
  tokens: PathToken[] | undefined,
  format: PathFormat,
): string {
  if (!tokens) {
    return "";
  }

  if (format === "slash") {
    return tokens.length > 0 ? tokens.map(formatInstanceSegment).join("/") : "/";
  }

  return formatPyLike(tokens, "data");
}

export function createPatternPathToken(pattern: string): string {
  return `${PATTERN_TOKEN_PREFIX}${pattern}${PATTERN_TOKEN_SUFFIX}`;
}

export function hasPatternPathToken(tokens: PathToken[] | undefined): boolean {
  return Boolean(tokens?.some(isPatternPathToken));
}

function formatPyLike(tokens: PathToken[], rootName: string): string {
  return tokens.reduce((result, token) => {
    if (typeof token === "number") {
      return `${result}[${token}]`;
    }

    if (token === WILDCARD_TOKEN) {
      return `${result}[*]`;
    }

    const segment = formatInstanceSegment(token);

    return IDENTIFIER_PATTERN.test(segment)
      ? `${result}.${segment}`
      : `${result}[${JSON.stringify(segment)}]`;
  }, rootName);
}

function formatSchemaPyLike(tokens: string[]): string {
  return tokens.reduce((result, token, index) => {
    const previousToken = index > 0 ? tokens[index - 1] : undefined;

    if (
      previousToken &&
      SCHEMA_ARRAY_SEGMENTS.has(previousToken) &&
      NUMERIC_INDEX_PATTERN.test(token)
    ) {
      return `${result}[${Number(token)}]`;
    }

    return IDENTIFIER_PATTERN.test(token)
      ? `${result}.${token}`
      : `${result}[${JSON.stringify(token)}]`;
  }, "schema");
}

function isPatternPathToken(token: PathToken): token is string {
  return (
    typeof token === "string" &&
    token.startsWith(PATTERN_TOKEN_PREFIX) &&
    token.endsWith(PATTERN_TOKEN_SUFFIX)
  );
}

function formatInstanceSegment(token: PathToken): string {
  if (typeof token === "number") {
    return String(token);
  }

  if (token === WILDCARD_TOKEN) {
    return token;
  }

  if (!isPatternPathToken(token)) {
    return token;
  }

  const pattern = token.slice(
    PATTERN_TOKEN_PREFIX.length,
    token.length - PATTERN_TOKEN_SUFFIX.length,
  );

  return resolvePatternExample(pattern) ?? token;
}

function resolvePatternExample(pattern: string): string | undefined {
  const cached = PATTERN_EXAMPLE_CACHE.get(pattern);

  if (cached) {
    return cached;
  }

  try {
    const values = RB(new RegExp(pattern)).enumerate();
    let fallback: string | undefined;

    for (let index = 0; index < 24; index += 1) {
      const next = values.next();

      if (next.done) {
        break;
      }

      if (fallback === undefined) {
        fallback = next.value;
      }

      if (next.value.length > 0) {
        PATTERN_EXAMPLE_CACHE.set(pattern, next.value);
        return next.value;
      }
    }

    if (fallback) {
      PATTERN_EXAMPLE_CACHE.set(pattern, fallback);
      return fallback;
    }
  } catch {
    return undefined;
  }

  return undefined;
}
