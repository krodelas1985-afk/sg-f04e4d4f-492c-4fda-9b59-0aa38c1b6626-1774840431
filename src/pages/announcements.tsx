import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { createClient } from "@/lib/supabase/client";
import { Pin, PinOff, Trash2 } from "lucide-react";

/**
 * Announcements authoring. RLS is the real gate: baymo_admin writes anything
 * (platform-wide 'baymo' scope or any client); client_admin writes only
 * 'client' scope for their own client; agents read-only (form hidden).
 * The mobile app shows these on the Home dashboard (read-only).
 */

interface Announcement {
  id: string;
  scope: "baymo" | "client";
  client_id: string | null;
  title: string;
  body: string;
  pinned: boolean;
  expires_at: string | null;
  created_at: string;
}

interface ClientOption {
  id: string;
  name: string;
}

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const supabase = createClient();

  const [items, setItems] = useState<Announcement[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState(""); // yyyy-mm-dd, optional
  const [targetClient, setTargetClient] = useState<string>("baymo"); // 'baymo' = platform-wide

  const isBaymoAdmin = profile?.role === "baymo_admin";
  const canWrite = isBaymoAdmin || profile?.role === "client_admin";

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, scope, client_id, title, body, pinned, expires_at, created_at")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as Announcement[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Client picker for baymo_admin (clients table is baymo-only RLS).
  useEffect(() => {
    if (!isBaymoAdmin) return;
    supabase
      .from("clients")
      .select("id, name")
      .order("name")
      .then(({ data }) => setClients((data as ClientOption[]) ?? []));
  }, [isBaymoAdmin, supabase]);

  const create = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const scope = isBaymoAdmin ? (targetClient === "baymo" ? "baymo" : "client") : "client";
    const client_id = scope === "baymo" ? null : isBaymoAdmin ? targetClient : profile?.client_id;
    if (scope === "client" && !client_id) {
      toast({ title: "Pick a client", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("announcements").insert({
      scope,
      client_id,
      title: title.trim(),
      body: body.trim(),
      pinned,
      expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59+08:00`).toISOString() : null,
      created_by: profile?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Failed to post", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Announcement posted" });
    setTitle("");
    setBody("");
    setPinned(false);
    setExpiresAt("");
    load();
  };

  const togglePin = async (a: Announcement) => {
    const { error } = await supabase
      .from("announcements")
      .update({ pinned: !a.pinned, updated_at: new Date().toISOString() })
      .eq("id", a.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else load();
  };

  const remove = async (a: Announcement) => {
    if (!window.confirm(`Delete announcement "${a.title}"?`)) return;
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Deleted" });
      load();
    }
  };

  const clientName = (id: string | null) =>
    id ? (clients.find((c) => c.id === id)?.name ?? "Client") : "Everyone";

  const expired = (a: Announcement) => !!a.expires_at && new Date(a.expires_at) < new Date();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-2xl font-semibold">Announcements</h1>

        {canWrite && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New announcement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isBaymoAdmin && (
                <select
                  className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                  value={targetClient}
                  onChange={(e) => setTargetClient(e.target.value)}>
                  <option value="baymo">🌐 Platform-wide (all clients)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
              <Textarea
                placeholder="Message (optional)"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={1000}
              />
              <div className="flex items-center gap-6 flex-wrap">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(v === true)} />
                  Pin to top
                </label>
                <label className="flex items-center gap-2 text-sm">
                  Expires:
                  <Input
                    type="date"
                    className="w-40 h-8"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </label>
                <Button onClick={create} disabled={saving} className="ml-auto">
                  {saving ? "Posting…" : "Post announcement"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            items.map((a) => (
              <Card key={a.id} className={expired(a) ? "opacity-50" : ""}>
                <CardContent className="pt-4 space-y-1">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Pin className="h-4 w-4 text-orange-500 shrink-0" />}
                    <span className="font-medium flex-1">{a.title}</span>
                    <Badge variant={a.scope === "baymo" ? "default" : "secondary"}>
                      {a.scope === "baymo" ? "BaMo · Everyone" : clientName(a.client_id)}
                    </Badge>
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => togglePin(a)} title={a.pinned ? "Unpin" : "Pin"}>
                          {a.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(a)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                  {a.body && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>}
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    {a.expires_at &&
                      ` · ${expired(a) ? "expired" : "expires"} ${new Date(a.expires_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
