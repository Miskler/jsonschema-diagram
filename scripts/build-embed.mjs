import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const siteDir = resolve(rootDir, "dist", "site");
const embedDir = resolve(rootDir, "dist", "embed");
const schemaPath = resolve(rootDir, "schemas", "default.json");
const siteHtmlPath = resolve(siteDir, "index.html");

const html = await readFile(siteHtmlPath, "utf8");
const defaultSchema = JSON.parse(await readFile(schemaPath, "utf8"));

let output = html;

for (const match of [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)]) {
  const href = match[1];
  const original = match[0];
  const css = await readFile(resolve(siteDir, href.replace(/^\.\//, "")), "utf8");
  output = output.replace(original, `<style>\n${css}\n</style>`);
}

let injectedRuntimeConfig = false;
for (const match of [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/g)]) {
  const src = match[1];
  const original = match[0];
  const js = await readFile(resolve(siteDir, src.replace(/^\.\//, "")), "utf8");
  const runtimeConfig = injectedRuntimeConfig
    ? ""
    : `<script>window.__JSONSCHEMA_DIAGRAM_CONFIG__ = ${JSON.stringify(
        {
          mode: "embed",
          defaultSchema,
        },
      )};</script>\n`;
  injectedRuntimeConfig = true;
  output = output.replace(
    original,
    `${runtimeConfig}<script type="module">\n${js}\n</script>`,
  );
}

await mkdir(embedDir, { recursive: true });
await writeFile(resolve(embedDir, "index.html"), output, "utf8");
await writeFile(resolve(embedDir, "jsonschema-diagram.embed.html"), output, "utf8");
