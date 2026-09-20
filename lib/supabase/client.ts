import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aeqqnzqcxurnpbkkahvl.supabase.co";
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlcXFuenFjeHVybnBia2thaHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjg0NjEsImV4cCI6MjEwNDg0NDQ2MX0.AKXurdmZHV2jjXADHLBjmqszREFk9OE5uiZpu4FabWg";

  return createBrowserClient(supabaseUrl, supabaseKey);
}
