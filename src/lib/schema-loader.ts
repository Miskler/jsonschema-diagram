import type { JsonSchema } from "./schema-types";
import type { DiagramRuntimeConfig } from "./runtime-config";

export interface LoadedSchema {
  schema: JsonSchema;
  text: string;
  origin: string;
}

export async function loadDefaultSchema(
  config: DiagramRuntimeConfig,
): Promise<LoadedSchema> {
  if (config.defaultSchema) {
    return {
      schema: config.defaultSchema,
      text: JSON.stringify(config.defaultSchema, null, 2),
      origin: config.mode === "embed" ? "Embedded schema" : "Injected schema",
    };
  }

  if (!config.defaultSchemaUrl) {
    throw new Error("No default schema source was configured.");
  }

  const response = await fetch(config.defaultSchemaUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load default schema: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as JsonSchema;

  return {
    schema: payload,
    text: JSON.stringify(payload, null, 2),
    origin: config.defaultSchemaUrl,
  };
}
