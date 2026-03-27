import type { JsonSchema } from "./schema-types";
import {
  isThemePresetId,
  type ThemePresetId,
} from "./theme-presets";

export interface DiagramRuntimeConfig {
  mode: "site" | "embed";
  defaultSchemaUrl?: string;
  defaultSchema?: JsonSchema;
  defaultTheme?: ThemePresetId;
}

export function getRuntimeConfig(): DiagramRuntimeConfig {
  const configured = window.__JSONSCHEMA_DIAGRAM_CONFIG__ ?? {};
  const mode = configured.mode === "embed" ? "embed" : "site";
  const defaultTheme =
    typeof configured.defaultTheme === "string" &&
    isThemePresetId(configured.defaultTheme)
      ? configured.defaultTheme
      : undefined;

  return {
    mode,
    defaultSchema: configured.defaultSchema,
    defaultTheme,
    defaultSchemaUrl:
      configured.defaultSchemaUrl ??
      (mode === "site" ? "/api/default-jsonschema" : undefined),
  };
}
