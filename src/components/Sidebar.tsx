import Link from "next/link";
import { useRouter } from "next/router";
import { LayoutDashboard, Users, MessageSquare, Megaphone, CheckSquare, UserCircle, Settings, Building2, LogOut, FileText, Workflow, Inbox, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  role: string;
}

export function Sidebar({ role }: SidebarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const adminNavItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Building2 },
  { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/follow-up", label: "Follow-Up AI", icon: Sparkles },
  { href: "/admin/requests", label: "Client Requests", icon: Inbox },
  { href: "/admin/settings", label: "Settings", icon: Settings },
 ];

  const clientNavItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/leads", label: "Leads", icon: Users },
    { href: "/inbox", label: "Inbox", icon: MessageSquare },
    { href: "/campaigns", label: "Campaigns", icon: Megaphone },
    { href: "/sequences", label: "Sequences", icon: Workflow },
    { href: "/templates", label: "Templates", icon: FileText },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/users", label: "Users", icon: UserCircle },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const navItems = role === "baymo_admin" ? adminNavItems : clientNavItems;

  return (
    <aside className="w-64 bg-sidebar-bg border-r border-sidebar-bg/20 flex flex-col h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-bg/20">
        <div className="flex flex-col">
          <h1 className="text-sidebar-text text-xl font-bold tracking-tight">
            BayMo
          </h1>
          <p className="text-primary text-sm font-semibold mt-0.5">
            Campaign Engine
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = router.pathname === item.href || router.pathname.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                isActive
                  ? "bg-primary text-white"
                  : "text-sidebar-text hover:bg-sidebar-bg/60"
              }`}
            >
              <Icon className="w-4 h-4 mr-3" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="p-4 border-t border-sidebar-bg/20">
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start text-sidebar-text hover:bg-sidebar-bg/60 hover:text-sidebar-text"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
