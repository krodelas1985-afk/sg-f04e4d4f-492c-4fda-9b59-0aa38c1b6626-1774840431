import { ReactNode, useEffect } from "react";
import { useRouter } from "next/router";
import { Sidebar } from "./Sidebar";
import { useUserProfile } from "@/contexts/UserProfileContext";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { profile, loading } = useUserProfile();

  useEffect(() => {
    if (!loading && !profile) {
      router.push("/login");
    }
  }, [loading, profile, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} />
      <main className="flex-1 overflow-y-auto bg-slate-bg">
        {children}
      </main>
    </div>
  );
}