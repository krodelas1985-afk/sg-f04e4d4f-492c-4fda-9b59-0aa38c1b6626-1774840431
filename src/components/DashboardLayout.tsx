import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Sidebar } from "./Sidebar";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserRole = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setRole(profile.role);
      }
      setLoading(false);
    };

    loadUserRole();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!role) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} />
      <main className="flex-1 overflow-y-auto bg-slate-bg">
        {children}
      </main>
    </div>
  );
}