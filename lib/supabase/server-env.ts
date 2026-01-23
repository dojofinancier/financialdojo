import { getSupabasePublishableKey, getSupabaseUrl } from "./public-env";

export { getSupabasePublishableKey, getSupabaseUrl };

export function getSupabaseSecretKey() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  return key;
}
