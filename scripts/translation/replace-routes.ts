/**
 * Replaces French route segments with English equivalents.
 * Run with: tsx scripts/translation/replace-routes.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT, toPosixPath } from "./translation-utils";

const ROOTS = ["app", "components", "lib", "scripts", "middleware.ts"];
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  "build",
  "dist",
  "out",
  ".git",
  "public",
  "logs",
  "prisma",
  "archive",
  "Archive",
  "scripts/translation",
]);

const REPLACEMENTS: Array<[string, string]> = [
  ["/tableau-de-bord/etudiant", "/dashboard/student"],
  ["/tableau-de-bord/paiements", "/dashboard/payments"],
  ["/tableau-de-bord/profil", "/dashboard/profile"],
  ["/tableau-de-bord/admin", "/dashboard/admin"],
  ["/tableau-de-bord", "/dashboard"],
  ["/formations", "/courses"],
  ["/apprendre", "/learn"],
  ["/cohorte", "/cohorts"],
  ["/panier", "/cart"],
  ["/paiement", "/payment"],
  ["/checkout", "/payment"],
  ["/a-propos", "/about"],
  ["/politique-de-confidentialite", "/privacy-policy"],
  ["/termes-et-conditions", "/terms-and-conditions"],
  ["/investisseur", "/investor"],
  ["/poser-question", "/ask-question"],
];

async function collectFiles(entries: string[]) {
  const results: string[] = [];

  async function walk(currentPath: string, relativeDir: string) {
    const stat = await fs.stat(currentPath);
    if (stat.isDirectory()) {
      const name = toPosixPath(relativeDir || path.basename(currentPath));
      if (EXCLUDED_DIRS.has(name)) return;
      const items = await fs.readdir(currentPath);
      for (const item of items) {
        const nextPath = path.join(currentPath, item);
        const nextRelative = relativeDir ? path.join(relativeDir, item) : item;
        const normalizedNext = toPosixPath(nextRelative);
        if (EXCLUDED_DIRS.has(normalizedNext)) continue;
        await walk(nextPath, nextRelative);
      }
      return;
    }

    if (!currentPath.endsWith(".ts") && !currentPath.endsWith(".tsx")) return;
    results.push(currentPath);
  }

  for (const entry of entries) {
    const fullPath = path.join(PROJECT_ROOT, entry);
    await walk(fullPath, entry);
  }

  return results;
}

function applyReplacements(content: string) {
  let updated = content;
  for (const [from, to] of REPLACEMENTS) {
    updated = updated.split(from).join(to);
  }
  return updated;
}

async function main() {
  const files = await collectFiles(ROOTS);
  let updatedCount = 0;

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const updated = applyReplacements(content);
    if (updated !== content) {
      await fs.writeFile(filePath, updated, "utf8");
      updatedCount += 1;
      console.log(`Updated ${toPosixPath(path.relative(PROJECT_ROOT, filePath))}`);
    }
  }

  console.log(`Route replacement complete. Updated ${updatedCount} files.`);
}

main().catch((error) => {
  console.error("Route replacement failed:", error);
  process.exit(1);
});
