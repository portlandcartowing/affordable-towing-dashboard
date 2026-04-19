"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient, Session } from "@supabase/supabase-js";
import { ADMIN_EMAILS } from "@/lib/adminEmails";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Routes that don't need auth
const PUBLIC_ROUTES = ["/login", "/driver", "/proposal"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  // Skip auth for public routes
  const isPublic = PUBLIC_ROUTES.some((r) => pathname?.startsWith(r));

  useEffect(() => {
    if (isPublic) {
      setSession(null); // Don't block public routes
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) {
        router.replace("/login");
        return;
      }

      const email = s.user.email?.toLowerCase() || "";
      if (!ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
        supabase.auth.signOut();
        router.replace("/login?error=unauthorized");
        return;
      }

      setSession(s);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s && !isPublic) {
        router.replace("/login");
      }
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, [router, isPublic, pathname]);

  // Public routes render immediately
  if (isPublic) return <>{children}</>;

  // Loading state
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  // Not authenticated
  if (!session) return null;

  return <>{children}</>;
}
