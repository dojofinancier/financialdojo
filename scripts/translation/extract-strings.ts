/**
 * Extracts French UI strings for translation.
 * Run with: tsx scripts/translation/extract-strings.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import * as ts from "typescript";
import {
  FORCE_TRANSLATE_PATHS,
  OUTPUT_DIR,
  PROJECT_ROOT,
  SOURCE_PATHS,
  ensureDir,
  isExcludedDir,
  isFrenchText,
  isLikelyUserFacingText,
  toPosixPath,
} from "./translation-utils";

type ExtractedEntry = {
  id: string;
  path: string;
  line: number;
  column: number;
  text: string;
};

const SKIP_ATTRIBUTE_NAMES = new Set([
  "className",
  "class",
  "id",
  "key",
  "href",
  "src",
  "data-testid",
  "data-cy",
]);

const SKIP_PROPERTY_NAMES = new Set(["className", "class", "id", "href", "src"]);

function getScriptKind(filePath: string) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  return ts.ScriptKind.TS;
}

function shouldSkipLiteral(node: ts.Node) {
  const parent = node.parent;

  if (ts.isImportDeclaration(parent) && parent.moduleSpecifier === node) return true;
  if (ts.isExportDeclaration(parent) && parent.moduleSpecifier === node) return true;

  if (
    ts.isCallExpression(parent) &&
    ts.isIdentifier(parent.expression) &&
    parent.expression.text === "require" &&
    parent.arguments[0] === node
  ) {
    return true;
  }

  if (ts.isJsxAttribute(parent) && ts.isIdentifier(parent.name)) {
    return SKIP_ATTRIBUTE_NAMES.has(parent.name.text);
  }

  if (ts.isPropertyAssignment(parent)) {
    if (ts.isIdentifier(parent.name)) {
      return SKIP_PROPERTY_NAMES.has(parent.name.text);
    }
    if (ts.isStringLiteral(parent.name)) {
      return SKIP_PROPERTY_NAMES.has(parent.name.text);
    }
  }

  return false;
}

async function collectFiles(paths: string[]) {
  const results: string[] = [];

  async function walk(currentPath: string) {
    const stat = await fs.stat(currentPath);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(currentPath);
      for (const entry of entries) {
        if (isExcludedDir(entry)) continue;
        await walk(path.join(currentPath, entry));
      }
      return;
    }

    if (!currentPath.endsWith(".ts") && !currentPath.endsWith(".tsx")) return;
    results.push(currentPath);
  }

  for (const entry of paths) {
    await walk(path.join(PROJECT_ROOT, entry));
  }

  return results;
}

function extractFromSource(filePath: string, content: string) {
  const entries: ExtractedEntry[] = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  );

  const relativePath = toPosixPath(path.relative(PROJECT_ROOT, filePath));
  const forceTranslate = FORCE_TRANSLATE_PATHS.has(relativePath);

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!shouldSkipLiteral(node)) {
        const text = node.text;
        const shouldInclude = forceTranslate
          ? isLikelyUserFacingText(text)
          : isFrenchText(text);

        if (shouldInclude) {
          const position = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile, false),
          );
          const line = position.line + 1;
          const column = position.character + 1;
          entries.push({
            id: `${relativePath}:${line}:${column}`,
            path: relativePath,
            line,
            column,
            text,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return entries;
}

function getArgValue(flag: string, defaultValue: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return defaultValue;
  const value = process.argv[index + 1];
  if (!value) return defaultValue;
  return value;
}

async function main() {
  const outputPath = getArgValue(
    "--output",
    path.join(OUTPUT_DIR, "strings.json"),
  );

  await ensureDir(path.dirname(outputPath));

  const files = await collectFiles(SOURCE_PATHS);
  const entries: ExtractedEntry[] = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    entries.push(...extractFromSource(filePath, content));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceLanguage: "fr",
    targetLanguage: "en",
    entryCount: entries.length,
    entries,
  };

  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Extracted ${entries.length} strings to ${toPosixPath(outputPath)}`);
}

main().catch((error) => {
  console.error("Failed to extract strings:", error);
  process.exit(1);
});
