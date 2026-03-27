import { defineConfig, mergeConfig } from "vite";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: "./src/setupTests.ts",
      css: true,
      coverage: {
        reporter: ["text", "html"],
      },
    },
  }),
);
