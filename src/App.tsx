import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import { DetailPanel } from "./components/DetailPanel";
import { SchemaCanvas } from "./components/SchemaCanvas";
import { SchemaSourcePanel } from "./components/SchemaSourcePanel";
import { layoutSchemaGraph, type NodePositions } from "./lib/layout";
import { buildSchemaGraph, getSelectionDetails } from "./lib/schema-graph";
import { loadDefaultSchema } from "./lib/schema-loader";
import { getRuntimeConfig } from "./lib/runtime-config";
import type {
  JsonSchema,
  SchemaGraphModel,
  SchemaSelection,
} from "./lib/schema-types";
import {
  THEME_PRESETS,
  THEME_STORAGE_KEY,
  readStoredTheme,
  type ThemePresetId,
} from "./lib/theme-presets";
import { validateSchemaDocument } from "./lib/schema-validation";

export function App() {
  const runtimeConfig = getRuntimeConfig();
  const [sourceText, setSourceText] = useState("");
  const [sourceOrigin, setSourceOrigin] = useState("Waiting for schema…");
  const [defaultSchema, setDefaultSchema] = useState<JsonSchema | null>(null);
  const [defaultSchemaText, setDefaultSchemaText] = useState("");
  const [graphModel, setGraphModel] = useState<SchemaGraphModel | null>(null);
  const [positions, setPositions] = useState<NodePositions>({});
  const [selection, setSelection] = useState<SchemaSelection | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  const [themeId, setThemeId] = useState<ThemePresetId>(() => readStoredTheme());
  const requestCounter = useRef(0);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    document.documentElement.dataset.theme = themeId;

    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [themeId]);

  const applySchemaDocument = useEffectEvent(
    async (schema: JsonSchema, text: string, origin: string) => {
      const validation = validateSchemaDocument(schema);

      if (!validation.valid) {
        setErrors(validation.errors);
        setWarnings([]);
        setBusy(false);
        return;
      }

      const nextRequest = requestCounter.current + 1;
      requestCounter.current = nextRequest;
      setBusy(true);

      try {
        const model = buildSchemaGraph(schema);
        const nextPositions = await layoutSchemaGraph(model);

        if (nextRequest !== requestCounter.current) {
          return;
        }

        startTransition(() => {
          setGraphModel(model);
          setPositions(nextPositions);
          setSelection(null);
          setErrors([]);
          setWarnings([...model.warnings]);
          setSourceOrigin(origin);
          setBusy(false);
          setRevision((value) => value + 1);
        });
      } catch (error) {
        if (nextRequest !== requestCounter.current) {
          return;
        }

        setErrors([
          error instanceof Error ? error.message : "Unable to build schema graph.",
        ]);
        setBusy(false);
      }

      setSourceText(text);
    },
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setBusy(true);
      setErrors([]);

      try {
        const loaded = await loadDefaultSchema(runtimeConfig);

        if (cancelled) {
          return;
        }

        setDefaultSchema(loaded.schema);
        setDefaultSchemaText(loaded.text);
        setSourceText(loaded.text);
        await applySchemaDocument(loaded.schema, loaded.text, loaded.origin);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrors([
          error instanceof Error ? error.message : "Unable to load default schema.",
        ]);
        setBusy(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      requestCounter.current += 1;
    };
  }, []);

  const details = graphModel ? getSelectionDetails(graphModel, selection) : null;

  async function handleApply() {
    try {
      setErrors([]);
      const parsed = JSON.parse(sourceText) as JsonSchema;
      await applySchemaDocument(parsed, sourceText, "Manual input");
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Schema input is not valid JSON.",
      ]);
    }
  }

  async function handleReset() {
    if (!defaultSchema) {
      return;
    }

    setSourceText(defaultSchemaText);
    await applySchemaDocument(defaultSchema, defaultSchemaText, "Default schema");
  }

  return (
    <div className="app-shell" data-theme={themeId}>
      <SchemaSourcePanel
        mode={runtimeConfig.mode}
        sourceText={sourceText}
        sourceOrigin={sourceOrigin}
        busy={busy}
        hasDefaultSchema={Boolean(defaultSchema)}
        themeId={themeId}
        themePresets={THEME_PRESETS}
        errors={errors}
        warnings={warnings}
        onThemeChange={setThemeId}
        onSourceChange={setSourceText}
        onApply={() => void handleApply()}
        onReset={() => void handleReset()}
      />

      <main className="workspace-panel">
        {graphModel ? (
          <SchemaCanvas
            model={graphModel}
            positions={positions}
            selection={selection}
            revision={revision}
            onSelectNode={(nodeId) => setSelection({ kind: "node", nodeId })}
            onSelectRow={(nodeId, rowId) =>
              setSelection({ kind: "row", nodeId, rowId })
            }
          />
        ) : (
          <div className="workspace-panel__empty">
            Load a valid schema to render the diagram.
          </div>
        )}
      </main>

      <DetailPanel details={details} onClose={() => setSelection(null)} />
    </div>
  );
}
