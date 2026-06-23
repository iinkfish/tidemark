import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadSchema(name) {
  const schemaPath = resolve(__dirname, "../schemas", `${name}.json`);
  try {
    const raw = await readFile(schemaPath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
      if (err.code === "ENOENT") {
        throw new Error(`Schema "${name}" not found at ${schemaPath}`);
      }
      throw new Error(`Failed to load schema "${name}": ${err.message}`);
    }
}

function validate(result, schema) {
  if (!result || typeof result !== "object") {
    throw new Error("Result must be a non-null object");
  }

  for (const field of schema.required) {
    if (!(field in result) || result[field] === null || result[field] === undefined || result[field] === "") {
      throw new Error(`Missing or empty required field: "${field}"`);
    }
  }
}

const [, , file] = process.argv;

async function main() {
  if (!file) {
    console.error("No scraper file specified");
    process.exit(1);
  }

  const { pathToFileURL } = await import("url");
  const module = await import(pathToFileURL(file).href);
  const schemaName = module.config?.pointSchema ?? "environmental-schema";
  const schema = await loadSchema(schemaName);

  console.log(`[${schemaName}] Schema:`, schema);

  const result = await module.run();

  try {
    validate(result, schema);
  } catch (err) {
    console.error(`Validation failed for [${schemaName}]: ${err.message}`);
    process.exit(1);
  }

  process.send(result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
