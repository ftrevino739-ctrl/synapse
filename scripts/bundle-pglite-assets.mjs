#!/usr/bin/env node
/**
 * Nitro's Vercel bundle does not keep PGLite's wasm/data next to the server
 * entry, so sign-up and Google/X crash on deploy. Copy them into each
 * function so the runtime can open the database.
 */
import { cp, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "node_modules/@electric-sql/pglite/dist");
const files = ["pglite.wasm", "pglite.data", "initdb.wasm"];
const functionsDir = join(root, ".vercel/output/functions");

async function functionDirs(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    if (entry.name.endsWith(".func")) found.push(path);
    else found.push(...(await functionDirs(path)));
  }
  return found;
}

const targets = await functionDirs(functionsDir);
if (targets.length === 0) {
  console.log("[pglite] no Vercel function output — skipping asset copy.");
  process.exit(0);
}

for (const funcDir of targets) {
  const destinations = [
    join(funcDir, "node_modules/@electric-sql/pglite/dist"),
    funcDir,
  ];
  for (const destination of destinations) {
    await mkdir(destination, { recursive: true });
    for (const file of files) {
      await cp(join(sourceDir, file), join(destination, file));
    }
  }
  console.log(`[pglite] assets ready in ${funcDir}`);
}
