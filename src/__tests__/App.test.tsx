import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { sampleSchema } from "../test-support/sampleSchema";

vi.mock("../lib/layout", () => ({
  layoutSchemaGraph: vi.fn(async (model) =>
    Object.fromEntries(
      model.nodes.map((node, index) => [node.id, { x: index * 180, y: index * 80 }]),
    ),
  ),
}));

vi.mock("../components/SchemaCanvas", () => ({
  SchemaCanvas: ({ model, onSelectNode, onSelectRow }: any) => (
    <div data-testid="schema-canvas">
      {model.nodes.map((node: any) => (
        <div key={node.id}>
          <button type="button" onClick={() => onSelectNode(node.id)}>
            {node.title}
          </button>
          {node.rows.map((row: any) => (
            <button
              type="button"
              key={row.id}
              onClick={() => onSelectRow(node.id, row.id)}
            >
              {row.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  ),
}));

describe("App", () => {
  beforeEach(() => {
    window.__JSONSCHEMA_DIAGRAM_CONFIG__ = {
      mode: "embed",
      defaultSchema: sampleSchema,
    };
  });

  afterEach(() => {
    cleanup();
    delete window.__JSONSCHEMA_DIAGRAM_CONFIG__;
  });

  it("loads the embedded default schema", async () => {
    render(<App />);

    expect(await screen.findByDisplayValue(/"title": "Catalog Entry"/)).toBeInTheDocument();
    expect((await screen.findAllByText("Catalog Entry")).length).toBeGreaterThan(0);
  });

  it("applies manual schema and resets to default", async () => {
    render(<App />);

    const textarea = await screen.findByLabelText("Raw schema");
    const replacement = JSON.stringify(
      {
        title: "Mini Schema",
        type: "object",
        properties: {
          code: {
            type: "string",
          },
        },
      },
      null,
      2,
    );

    fireEvent.change(textarea, { target: { value: replacement } });
    fireEvent.click(screen.getByRole("button", { name: "Apply schema" }));
    expect((await screen.findAllByText("Mini Schema")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect((await screen.findAllByText("Catalog Entry")).length).toBeGreaterThan(0);
  });

  it("updates the details panel when a row is selected", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "status" }));

    expect(await screen.findByText("required field")).toBeInTheDocument();
    expect(await screen.findByText("#/properties/status")).toBeInTheDocument();
    expect(await screen.findByText(/type: enum/)).toBeInTheDocument();
  });
});
