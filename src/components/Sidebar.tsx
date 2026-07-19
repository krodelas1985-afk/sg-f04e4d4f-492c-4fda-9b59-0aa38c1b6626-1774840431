import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Megaphone,
  CheckSquare,
  UserCircle,
  Settings,
  Building2,
  FileText,
  Workflow,
  Inbox,
  Bell,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  role: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/clients", label: "Clients", icon: Building2 },
      { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/requests", label: "Client Requests", icon: Inbox },
      { href: "/admin/automation-reviews", label: "Automation Reviews", icon: Sparkles },
      { href: "/announcements", label: "Announcements", icon: Bell },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

const CLIENT_NAV: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/inbox", label: "Inbox", icon: MessageSquare },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/sequences", label: "Sequences", icon: Workflow },
      { href: "/templates", label: "Templates", icon: FileText },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/announcements", label: "Announcements", icon: Bell },
      { href: "/users", label: "Users", icon: UserCircle },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar({ role }: SidebarProps) {
  const router = useRouter();
  const groups = role === "baymo_admin" ? ADMIN_NAV : CLIENT_NAV;

  const isItemActive = (href: string) => {
    // Exact match, or a sub-route — but don't let "/admin" match every admin page
    if (router.pathname === href) return true;
    if (href === "/admin" || href === "/dashboard") return false;
    return router.pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-sidebar-bg">
      {/* Logo */}
      <div className="px-5 pb-5 pt-6">
        <Link href={role === "baymo_admin" ? "/admin" : "/dashboard"} className="block">
          <span className="text-xl font-bold tracking-tight text-white">
            Ba<span className="text-brand-orange">Mo</span>
          </span>
          <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-text/60">
            Campaign Engine
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-text/40">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-white/10 text-white"
                        : "text-sidebar-text/75 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {active && (
                      <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-orange" />
                    )}
                    <Icon
                      className={cn(
                        "mr-3 h-4 w-4",
                        active ? "text-brand-orange" : "text-sidebar-text/50"
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
