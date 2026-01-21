/**
 * Translates extracted strings using OpenAI.
 * Run with: tsx scripts/translation/translate-openai.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import {
  OUTPUT_DIR,
  ensureDir,
  loadEnv,
  toPosixPath,
} from "./translation-utils";

type ExtractedEntry = {
  id: string;
  path: string;
  line: number;
  column: number;
  text: string;
};

type TranslationEntry = ExtractedEntry & {
  translation: string;
};

const MODEL = "gpt-5-mini";

function getArgValue(flag: string, defaultValue: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return defaultValue;
  const value = process.argv[index + 1];
  if (!value) return defaultValue;
  return value;
}

function getArgNumber(flag: string, defaultValue: number) {
  const value = getArgValue(flag, "");
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function extractJsonArray(text: string) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("OpenAI response did not include a JSON array.");
  }
  return text.slice(start, end + 1);
}

function buildPrompt(texts: string[]) {
  return `Translate the following French UI strings to English for a financial education platform.\n\nRules:\n- Always translate \"Le Dojo Financier\" or \"Dojo Financier\" as \"Financial Dojo\".\n- Preserve punctuation, line breaks, HTML/Markdown tags, and placeholders like {name}, {{name}}, %s, and \${...}.\n- Return only a JSON array of translations in the same order.\n\nStrings:\n${JSON.stringify(texts, null, 2)}`;
}

async function translateBatch(openai: OpenAI, texts: string[]) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a precise translation engine. Respond only with JSON.",
      },
      {
        role: "user",
        content: buildPrompt(texts),
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  const json = extractJsonArray(content);
  const parsed = JSON.parse(json);

  if (!Array.isArray(parsed)) {
    throw new Error("OpenAI response JSON is not an array.");
  }

  if (parsed.length !== texts.length) {
    throw new Error(
      `Translation count mismatch. Expected ${texts.length}, got ${parsed.length}.`,
    );
  }

  return { translations: parsed as string[], usage: response.usage };
}

async function main() {
  loadEnv();

  const inputPath = getArgValue(
    "--input",
    path.join(OUTPUT_DIR, "strings.json"),
  );
  const outputPath = getArgValue(
    "--output",
    path.join(OUTPUT_DIR, "translations.json"),
  );
  const batchSize = getArgNumber("--batch-size", 25);
  const delayMs = getArgNumber("--delay", 1000);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing in the environment.");
  }

  const raw = await fs.readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw) as { entries: ExtractedEntry[] };
  const entries = parsed.entries ?? [];

  const uniqueTexts: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!seen.has(entry.text)) {
      seen.add(entry.text);
      uniqueTexts.push(entry.text);
    }
  }

  const openai = new OpenAI({ apiKey });
  const translationMap = new Map<string, string>();

  let totalTokens = 0;
  const batches = chunk(uniqueTexts, batchSize);

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    console.log(`Translating batch ${i + 1}/${batches.length} (${batch.length} items)`);

    const { translations, usage } = await translateBatch(openai, batch);
    translations.forEach((translation, index) => {
      translationMap.set(batch[index], translation);
    });

    totalTokens += usage?.total_tokens ?? 0;

    if (delayMs > 0 && i < batches.length - 1) {
      await sleep(delayMs);
    }
  }

  const translatedEntries: TranslationEntry[] = entries.map((entry) => ({
    ...entry,
    translation: translationMap.get(entry.text) ?? entry.text,
  }));

  await ensureDir(path.dirname(outputPath));
  const payload = {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    sourceLanguage: "fr",
    targetLanguage: "en",
    entryCount: translatedEntries.length,
    uniqueStrings: uniqueTexts.length,
    totalTokens,
    entries: translatedEntries,
  };

  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Saved translations to ${toPosixPath(outputPath)}`);
}

main().catch((error) => {
  console.error("Failed to translate strings:", error);
  process.exit(1);
});
