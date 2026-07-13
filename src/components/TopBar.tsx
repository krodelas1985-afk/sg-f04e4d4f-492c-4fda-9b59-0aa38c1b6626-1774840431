import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Search, Bell, LogOut, Settings, ChevronDown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { TemperatureBadge } from "@/components/shared/badges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface LeadResult {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  lead_temperature: string | null;
}

interface ClientResult {
  id: string;
  company_name: string | null;
  contact_name: string | null;
}

export function TopBar() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const isAdmin = profile?.role === "baymo_admin";

  const [query, setQuery] = useState("");
  const [leadResults, setLeadResults] = useState<LeadResult[]>([]);
  const [clientResults, setClientResults] = useState<ClientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasNewAnnouncement, setHasNewAnnouncement] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ctrl+K / Cmd+K focuses the global search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // New-announcement dot (last 7 days)
  useEffect(() => {
    const check = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("announcements")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1);
        const latest = data?.[0]?.created_at;
        if (latest) {
          const ageMs = Date.now() - new Date(latest).getTime();
          setHasNewAnnouncement(ageMs < 7 * 24 * 60 * 60 * 1000);
        }
      } catch {
        /* non-critical */
      }
    };
    check();
  }, []);

  // Debounced search — leads for client users, clients for baymo_admin
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setLeadResults([]);
      setClientResults([]);
      setOpen(false);
      return;
    }
    const q = query.trim();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const supabase = createClient();
        if (isAdmin) {
          const { data } = await supabase
            .from("clients")
            .select("id, company_name, contact_name")
            .or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%`)
            .limit(8);
          setClientResults(data || []);
        } else {
          const { data } = await supabase
            .from("leads")
            .select("id, name, phone, email, lead_temperature")
            .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
            .order("created_at", { ascending: false })
            .limit(8);
          setLeadResults(data || []);
        }
        setOpen(true);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, isAdmin]);

  const goTo = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery("");
      router.push(path);
    },
    [router]
  );

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const roleLabel = isAdmin ? "BaMo Admin" : profile?.role === "client_admin" ? "Client Admin" : "Agent";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-card px-4 lg:px-6">
      {/* Global search */}
      <div ref={containerRef} className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={isAdmin ? "Search clients…" : "Search leads by name, phone, or email…"}
          className="h-9 border-transparent bg-muted pl-9 pr-12 text-sm focus-visible:border-input focus-visible:bg-card"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-card px-1.5 font-inter text-[10px] text-muted-foreground sm:inline-block">
          Ctrl K
        </kbd>

        {open && (
          <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border bg-popover shadow-lg">
            {searching ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : isAdmin ? (
              clientResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">No clients match “{query.trim()}”</div>
              ) : (
                clientResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => goTo(`/admin/clients/${c.id}/workspace`)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                  >
                    <InitialsAvatar name={c.company_name || c.contact_name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.company_name || "—"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.contact_name}</span>
                    </span>
                  </button>
                ))
              )
            ) : leadResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No leads match “{query.trim()}”</div>
            ) : (
              leadResults.map((l) => (
                <button
                  key={l.id}
                  onClick={() => goTo(`/leads/${l.id}`)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                >
                  <InitialsAvatar name={l.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.name || "Unnamed lead"}</span>
                    <span className="block truncate font-inter text-xs text-muted-foreground">
                      {[l.phone, l.email].filter(Boolean).join(" · ") || "No contact info"}
                    </span>
                  </span>
                  <TemperatureBadge value={l.lead_temperature} />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        <Link
          href="/announcements"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Announcements"
        >
          <Bell className="h-[18px] w-[18px]" />
          {hasNewAnnouncement && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-orange ring-2 ring-card" />
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg py-1 pl-1.5 pr-2 transition-colors hover:bg-accent">
              <InitialsAvatar name={profile?.full_name || profile?.email} size="sm" />
              <span className="hidden max-w-[140px] truncate text-sm font-medium md:block">
                {profile?.full_name || profile?.email}
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block truncate text-sm font-medium">{profile?.full_name || "—"}</span>
              <span className="block truncate font-inter text-xs font-normal text-muted-foreground">
                {profile?.email}
              </span>
              <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {roleLabel}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(isAdmin ? "/admin/settings" : "/settings")}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
