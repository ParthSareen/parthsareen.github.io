import { createClient } from "@supabase/supabase-js";
import { createAgentGuestbookHandler } from "./logic.js";

const handler = createAgentGuestbookHandler({
  createClient,
  env: Deno.env,
});

Deno.serve(handler);
