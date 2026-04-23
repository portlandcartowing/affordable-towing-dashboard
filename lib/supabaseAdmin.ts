import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Server-only Supabase client using the service-role secret.
//
// Bypasses Row Level Security — use ONLY in:
//   - Route handlers under app/api/
//   - Server actions ("use server" files)
//   - Server components / server-only lib helpers
//
// NEVER import this file from any "use client" component or any file that
// could end up in the browser bundle. The service-role key is a full-access
// credential; leaking it defeats all Supabase security.
// ---------------------------------------------------------------------------

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set (server-only)",
      );
    }
    _admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getAdmin() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
