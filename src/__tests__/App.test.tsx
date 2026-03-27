import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    window.localStorage.clear();
    window.__JSONSCHEMA_DIAGRAM_CONFIG__ = {
      mode: "site",
      defaultSchema: sampleSchema,
    };
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    delete window.__JSONSCHEMA_DIAGRAM_CONFIG__;
  });

  it("loads the configured default schema in site mode", async () => {
    render(<App />);

    expect(await screen.findByDisplayValue(/"title": "Catalog Entry"/)).toBeInTheDocument();
    expect((await screen.findAllByText("Catalog Entry")).length).toBeGreaterThan(0);
  });

  it("renders embed mode without the source sidebar and honors default theme", async () => {
    window.__JSONSCHEMA_DIAGRAM_CONFIG__ = {
      mode: "embed",
      defaultSchema: sampleSchema,
      defaultTheme: "mono",
    };

    render(<App />);

    expect(await screen.findByTestId("schema-canvas")).toBeInTheDocument();
    expect(screen.queryByLabelText("Raw schema")).not.toBeInTheDocument();
    expect(screen.queryByText("Color preset")).not.toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("mono");
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

  it("pastes schema input from the clipboard", async () => {
    const clipboardText = JSON.stringify(
      {
        title: "Clipboard Schema",
        type: "object",
        patternProperties: {
          "^x-": {
            type: "string",
          },
        },
      },
      null,
      2,
    );

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        readText: vi.fn(async () => clipboardText),
      },
    });

    render(<App />);

    await screen.findByDisplayValue(/"title": "Catalog Entry"/);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Paste schema from clipboard" }),
      ).toBeEnabled();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Paste schema from clipboard",
      }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Raw schema")).toHaveValue(clipboardText);
    });
  });

  it("updates the details panel when a row is selected", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "status" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("required field")).toBeInTheDocument();
    expect(screen.queryByText("Schema pointer")).not.toBeInTheDocument();
    expect(await screen.findByText("Schema path")).toBeInTheDocument();
    expect(
      await screen.findByText((_, element) => element?.textContent === "properties/status"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText((_, element) => element?.textContent === "#/$defs/status"),
    ).toBeInTheDocument();
    expect(await screen.findByText("JSON path")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Slash" })).toBeInTheDocument();
    expect(await screen.findByText(/type: enum/)).toBeInTheDocument();
  });

  it("renders node selection paths with syntax highlighting and no schema pointer", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Catalog Entry" }));

    const dialog = await screen.findByRole("dialog");

    expect(await screen.findByText("Node Selection")).toBeInTheDocument();
    expect(screen.queryByText("Schema pointer")).not.toBeInTheDocument();

    const schemaPathCard = screen.getByText("Schema path").closest("section");
    const jsonPathCard = screen.getByText("JSON path").closest("section");

    expect(schemaPathCard).not.toBeNull();
    expect(jsonPathCard).not.toBeNull();

    expect(
      schemaPathCard?.querySelector(".detail-panel__path-value--syntax"),
    ).toBeInTheDocument();
    expect(
      schemaPathCard?.querySelector(".detail-panel__path-token--root"),
    ).toBeInTheDocument();
    expect(
      jsonPathCard?.querySelector(".detail-panel__path-value--syntax"),
    ).toBeInTheDocument();
    expect(schemaPathCard?.querySelector(".detail-panel__path-token--root")).toHaveTextContent(
      "/",
    );
  });
});
