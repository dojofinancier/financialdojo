/**
 * Script to find and update internal links from English to French routes
 * 
 * This script searches for common English route patterns and suggests replacements.
 * Run this to see what needs to be updated, then update files manually or use find/replace.
 * 
 * Usage:
 *   npx tsx scripts/update-internal-links.ts
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const routeMappings: Record<string, string> = {
  // Main routes
  "/learn/": "/learn/",
  "/payment": "/payment",
  "/dashboard": "/dashboard",
  "/dashboard/student": "/dashboard/student",
  "/dashboard/profile": "/dashboard/profile",
  "/dashboard/payments": "/dashboard/payments",
  "/dashboard/admin": "/dashboard/admin",
  "/cohorts/": "/cohorts/",
  
  // Query parameters (optional - can keep English)
  "?tab=appointments": "?tab=rendez-vous",
};

function findFiles(dir: string, extensions: string[] = [".tsx", ".ts", ".jsx", ".js"]): string[] {
  const files: string[] = [];
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules, .next, etc.
        if (!entry.startsWith(".") && entry !== "node_modules" && entry !== ".next") {
          files.push(...findFiles(fullPath, extensions));
        }
      } else if (stat.isFile()) {
        const ext = entry.substring(entry.lastIndexOf("."));
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Skip files we can't read
  }
  
  return files;
}

function updateFile(filePath: string, dryRun: boolean = true): { updated: boolean; changes: string[] } {
  try {
    const content = readFileSync(filePath, "utf-8");
    let newContent = content;
    const changes: string[] = [];
    
    for (const [oldRoute, newRoute] of Object.entries(routeMappings)) {
      if (content.includes(oldRoute)) {
        const regex = new RegExp(oldRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
        const matches = content.match(regex);
        if (matches) {
          changes.push(`  - ${oldRoute} → ${newRoute} (${matches.length} occurrence(s))`);
          if (!dryRun) {
            newContent = newContent.replace(regex, newRoute);
          }
        }
      }
    }
    
    if (changes.length > 0 && !dryRun) {
      writeFileSync(filePath, newContent, "utf-8");
    }
    
    return { updated: changes.length > 0, changes };
  } catch (error) {
    return { updated: false, changes: [] };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--apply");
  
  console.log("🔍 Searching for English routes in codebase...");
  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }
  
  const appDir = join(process.cwd(), "app");
  const componentsDir = join(process.cwd(), "components");
  
  const files = [
    ...findFiles(appDir),
    ...findFiles(componentsDir),
  ];
  
  console.log(`Found ${files.length} files to check\n`);
  
  const filesWithChanges: Array<{ file: string; changes: string[] }> = [];
  
  for (const file of files) {
    const result = updateFile(file, dryRun);
    if (result.updated) {
      filesWithChanges.push({
        file: file.replace(process.cwd(), "."),
        changes: result.changes,
      });
    }
  }
  
  if (filesWithChanges.length === 0) {
    console.log("✅ No files need updating!");
    return;
  }
  
  console.log(`📋 Found ${filesWithChanges.length} files with English routes:\n`);
  
  for (const { file, changes } of filesWithChanges) {
    console.log(`📄 ${file}`);
    changes.forEach(change => console.log(change));
    console.log();
  }
  
  if (dryRun) {
    console.log("💡 Run with --apply to make changes:");
    console.log("   npx tsx scripts/update-internal-links.ts --apply");
  } else {
    console.log("✅ Files updated!");
  }
}

main().catch(console.error);

