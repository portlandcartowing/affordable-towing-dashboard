"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function DriverCallbackPage() {
  useEffect(() => {
    // Supabase puts tokens in the URL hash after implicit OAuth grant.
    // The client library picks them up automatically via onAuthStateChange.
    // We just need to wait for the session to be set, then redirect.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        window.location.href = "/driver";
      }
    });

    // Also handle the case where the hash is already processed
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = "/driver";
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
