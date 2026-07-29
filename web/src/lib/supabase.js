import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials not found. " +
    "Set SUPABASE_URL and SUPABASE_KEY in .env or Vite environment."
  );
}

export const supabase = createClient(
  supabaseUrl || "",
  supabaseAnonKey || ""
);
