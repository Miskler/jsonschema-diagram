import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const siteDir = resolve(rootDir, "dist", "site");
const embedDir = resolve(rootDir, "dist", "embed");
const packageDataDir = resolve(rootDir, "jsonschema_diagram", "data");
const schemaPath = resolve(rootDir, "schemas", "default.json");
const siteHtmlPath = resolve(siteDir, "index.html");

const html = await readFile(siteHtmlPath, "utf8");
const defaultSchema = JSON.parse(await readFile(schemaPath, "utf8"));
const defaultTheme = "slate";

const bakedRuntimeConfigScript = `<script>window.__JSONSCHEMA_DIAGRAM_CONFIG__ = ${JSON.stringify(
  {
    mode: "embed",
    defaultSchema,
    defaultTheme,
  },
)};</script>\n`;

const jinjaRuntimeConfigScript = `<script>
window.__JSONSCHEMA_DIAGRAM_CONFIG__ = {
  mode: "embed",
  defaultTheme:
    {% if default_theme is defined %}
      {{ default_theme | tojson }}
    {% else %}
      ${JSON.stringify(defaultTheme)}
    {% endif %},
  defaultSchema:
    {% if default_schema is defined %}
      {{ default_schema | tojson }}
    {% elif default_schema_json is defined %}
      {{ default_schema_json | safe }}
    {% else %}
      ${JSON.stringify(defaultSchema)}
    {% endif %}
};
</script>\n`;

function inlineBuild(runtimeConfigScript) {
  let output = html;

  return (async () => {
    for (const match of [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)]) {
      const href = match[1];
      const original = match[0];
      const css = await readFile(resolve(siteDir, href.replace(/^\.\//, "")), "utf8");
      output = output.replace(original, () => `<style>\n${css}\n</style>`);
    }

    let injectedRuntimeConfig = false;
    for (const match of [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/g)]) {
      const src = match[1];
      const original = match[0];
      const js = await readFile(resolve(siteDir, src.replace(/^\.\//, "")), "utf8");
      const config = injectedRuntimeConfig ? "" : runtimeConfigScript;
      injectedRuntimeConfig = true;
      output = output.replace(
        original,
        () => `${config}<script type="module">\n${js}\n</script>`,
      );
    }

    return output;
  })();
}

const bakedOutput = await inlineBuild(bakedRuntimeConfigScript);
const jinjaOutput = await inlineBuild(jinjaRuntimeConfigScript);

await mkdir(embedDir, { recursive: true });
await mkdir(packageDataDir, { recursive: true });
await writeFile(resolve(embedDir, "index.html"), bakedOutput, "utf8");
await writeFile(resolve(embedDir, "jsonschema-diagram.embed.html"), bakedOutput, "utf8");
await writeFile(
  resolve(embedDir, "jsonschema-diagram.embed.jinja2.html"),
  jinjaOutput,
  "utf8",
);
await writeFile(resolve(packageDataDir, "default.json"), JSON.stringify(defaultSchema, null, 2), "utf8");
await writeFile(
  resolve(packageDataDir, "jsonschema-diagram.embed.html"),
  bakedOutput,
  "utf8",
);
await writeFile(
  resolve(packageDataDir, "jsonschema-diagram.embed.jinja2.html"),
  jinjaOutput,
  "utf8",
);
