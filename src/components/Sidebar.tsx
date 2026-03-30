import Link from "next/link";
import { useRouter } from "next/router";
import { LayoutDashboard, Users, Inbox, Megaphone, CheckSquare, UserCog, Settings, Building2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

interface SidebarProps {
  role: UserRole;
}

const adminNavItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Building2 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const clientNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/users", label: "Users", icon: UserCog },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ role }: SidebarProps) {
  const router = useRouter();
  const navItems = role === "baymo_admin" ? adminNavItems : clientNavItems;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-screen">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-teal flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <div>
            <h1 className="font-semibold text-lg">BayMo</h1>
            <p className="text-xs text-muted-foreground">Campaign Engine</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = router.pathname === item.href || router.pathname.startsWith(item.href + "/");

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-teal/10 text-teal"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}