import { createClient } from "@supabase/supabase-js";
import { createRecommendedReadingsHandler } from "./logic.js";

const handler = createRecommendedReadingsHandler({
  createClient,
  env: Deno.env,
});

Deno.serve(handler);
