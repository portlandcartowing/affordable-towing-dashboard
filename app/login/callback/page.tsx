"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_EMAILS } from "@/lib/adminEmails";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function LoginCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }

      const email = session.user.email?.toLowerCase() || "";
      if (ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
        router.replace("/dashboard");
      } else {
        // Not an admin — sign out and show error
        supabase.auth.signOut();
        router.replace("/login?error=unauthorized");
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Verifying access…</div>
    </div>
  );
}
