/**
 * Applies translated strings back to source files.
 * Run with: tsx scripts/translation/apply-translations.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  OUTPUT_DIR,
  PROJECT_ROOT,
  ensureDir,
  toPosixPath,
} from "./translation-utils";

type TranslationEntry = {
  path: string;
  text: string;
  translation: string;
};

function getArgValue(flag: string, defaultValue: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return defaultValue;
  const value = process.argv[index + 1];
  if (!value) return defaultValue;
  return value;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeForQuote(value: string, quote: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(new RegExp(escapeRegExp(quote), "g"), `\\${quote}`);
}

function replaceLiteral(content: string, original: string, replacement: string) {
  const quotes = ["\"", "'", "`"];
  let updated = content;

  for (const quote of quotes) {
    const pattern = new RegExp(`${escapeRegExp(quote)}${escapeRegExp(original)}${escapeRegExp(quote)}`, "g");
    const escapedReplacement = escapeForQuote(replacement, quote);
    updated = updated.replace(
      pattern,
      `${quote}${escapedReplacement}${quote}`,
    );
  }

  return updated;
}

async function main() {
  const inputPath = getArgValue(
    "--input",
    path.join(OUTPUT_DIR, "translations.json"),
  );
  const dryRun = hasFlag("--dry-run");

  const raw = await fs.readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw) as { entries: TranslationEntry[] };
  const entries = parsed.entries ?? [];

  const entriesByPath = new Map<string, TranslationEntry[]>();
  for (const entry of entries) {
    if (!entry.translation || entry.translation === entry.text) continue;
    const list = entriesByPath.get(entry.path) ?? [];
    list.push(entry);
    entriesByPath.set(entry.path, list);
  }

  await ensureDir(path.dirname(inputPath));

  let updatedFiles = 0;
  for (const [relativePath, fileEntries] of entriesByPath.entries()) {
    const fullPath = path.join(PROJECT_ROOT, relativePath);
    const content = await fs.readFile(fullPath, "utf8");

    const sortedEntries = [...fileEntries].sort(
      (a, b) => b.text.length - a.text.length,
    );

    let updated = content;
    for (const entry of sortedEntries) {
      updated = replaceLiteral(updated, entry.text, entry.translation);
    }

    if (updated !== content) {
      updatedFiles += 1;
      if (!dryRun) {
        await fs.writeFile(fullPath, updated, "utf8");
      }
      console.log(`Updated ${relativePath}`);
    }
  }

  if (dryRun) {
    console.log(`Dry run complete. ${updatedFiles} files would be updated.`);
    return;
  }

  console.log(`Applied translations to ${updatedFiles} files.`);
}

main().catch((error) => {
  console.error("Failed to apply translations:", error);
  process.exit(1);
});
