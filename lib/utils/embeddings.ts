import OpenAI from "openai";

// Lazy initialization to avoid errors during build when OPENAI_API_KEY is not available
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.");
    }
    openai = new OpenAI({
      apiKey,
    });
  }
  return openai;
}

/**
 * Generate embedding for text using OpenAI
 * Uses text-embedding-3-small model (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Normalize text: remove extra whitespace
    const normalizedText = text.trim().replace(/\s+/g, " ");

    if (!normalizedText) {
      throw new Error("Text cannot be empty");
    }

    const client = getOpenAIClient();
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: normalizedText,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between 0 (no similarity) and 1 (identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Prepare text for embedding by removing markdown syntax
 * Keeps the text content but removes markdown formatting
 */
export function prepareTextForEmbedding(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "") // Remove headers
    .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold
    .replace(/\*(.*?)\*/g, "$1") // Remove italic
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Remove links, keep text
    .replace(/`([^`]+)`/g, "$1") // Remove inline code
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines
    .trim();
}
