import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, "../..");
export const OUTPUT_DIR = path.join(PROJECT_ROOT, "scripts", "translation", "output");

export const SOURCE_PATHS = [
  "app",
  "components",
  "lib",
  "middleware.ts",
];

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  "build",
  "dist",
  "out",
  ".git",
  "public",
  "logs",
  "scripts",
  "prisma",
  "archive",
  "Archive",
]);

export const FORCE_TRANSLATE_PATHS = new Set([
  "app/home-page-client.tsx",
  "app/politique-de-confidentialite/page.tsx",
  "app/termes-et-conditions/page.tsx",
  "lib/constants/investisseur-diagnostic.ts",
]);

const frenchChars = /[\u00C0-\u017F]/;
const frenchWords = [
  "accueil",
  "apprendre",
  "apropos",
  "tableau",
  "bord",
  "connexion",
  "deconnexion",
  "inscription",
  "mot",
  "passe",
  "courriel",
  "paiement",
  "panier",
  "cohorte",
  "investisseur",
  "politique",
  "confidentialite",
  "termes",
  "conditions",
  "erreur",
  "reinitialiser",
  "nouveau",
  "envoyer",
  "message",
  "sujet",
  "contact",
  "telephone",
  "formation",
  "cours",
  "profil",
  "etudiant",
  "facture",
  "adresse",
  "modifier",
  "supprimer",
  "ajouter",
  "questionnaire",
  "merci",
  "saisir",
  "veuillez",
  "obligatoire",
  "valide",
];

const frenchWordRegex = new RegExp(`\\b(${frenchWords.join("|")})\\b`, "i");

export function loadEnv() {
  dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export function toPosixPath(value: string) {
  return value.split(path.sep).join("/");
}

export function isExcludedDir(name: string) {
  return EXCLUDED_DIRS.has(name);
}

export function isLikelyUserFacingText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length < 2) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^\/[A-Za-z0-9/_-]*$/.test(trimmed)) return false;
  if (/^[A-Za-z0-9_./:-]+$/.test(trimmed) && !/\s/.test(trimmed)) return false;
  return true;
}

export function isFrenchText(text: string) {
  const trimmed = text.trim();
  if (!isLikelyUserFacingText(trimmed)) return false;
  if (frenchChars.test(trimmed)) return true;
  return frenchWordRegex.test(trimmed.toLowerCase());
}
