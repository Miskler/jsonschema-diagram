import { describe, expect, it } from "vitest";
import {
  createPatternPathToken,
  formatInstancePath,
  formatSchemaPath,
} from "../lib/path-format";

describe("formatInstancePath", () => {
  it("renders pattern path tokens as generated example keys", () => {
    const tokens = [createPatternPathToken("^x-[a-z]{2}$"), 0, "value"];

    expect(formatInstancePath(tokens, "slash")).toBe("x-aa/0/value");
    expect(formatInstancePath(tokens, "py-like")).toBe('data["x-aa"][0].value');
  });

  it("falls back to the raw pattern token when regex-utils cannot parse the regex", () => {
    const tokens = [createPatternPathToken("(?i:foo)")];

    expect(formatInstancePath(tokens, "slash")).toBe("$match((?i:foo))");
  });

  it("renders wildcard combinator segments without quoting them", () => {
    const tokens = [0, "*"];

    expect(formatInstancePath(tokens, "slash")).toBe("0/*");
    expect(formatInstancePath(tokens, "py-like")).toBe("data[0][*]");
  });
});

describe("formatSchemaPath", () => {
  it("renders combinator and prefix item indexes as numeric accesses in py-like mode", () => {
    expect(formatSchemaPath(["items", "anyOf", "0"], "py-like")).toBe(
      "schema.items.anyOf[0]",
    );
    expect(formatSchemaPath(["prefixItems", "2"], "py-like")).toBe(
      "schema.prefixItems[2]",
    );
  });

  it("keeps numeric property names as string keys outside schema array segments", () => {
    expect(formatSchemaPath(["properties", "0", "type"], "py-like")).toBe(
      'schema.properties["0"].type',
    );
  });
});
