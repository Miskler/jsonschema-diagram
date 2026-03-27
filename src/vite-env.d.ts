/// <reference types="vite/client" />

import type { DiagramRuntimeConfig } from "./lib/runtime-config";

declare global {
  interface Window {
    __JSONSCHEMA_DIAGRAM_CONFIG__?: Partial<DiagramRuntimeConfig>;
  }
}

export {};
