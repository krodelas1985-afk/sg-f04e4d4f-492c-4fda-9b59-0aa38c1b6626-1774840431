import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/admin/automation-reviews
 * baymo_admin only. The self-serve review queue: campaigns submitted from the
 * mobile wizard (status = pending_review) with an auto-computed validation
 * checklist, plus open page-connection requests.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => req.cookies[name],
          set: () => {},
          remove: () => {},
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    if (profile?.role !== "baymo_admin") return res.status(403).json({ error: "Forbidden" });

    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const [{ data: pending }, { data: connections }] = await Promise.all([
      adminClient
        .from("campaigns")
        .select(
          "id, name, client_id, status, automation_scope, is_organic_owner, target_action, tone, config, campaign_rules, enrollment_rules, created_by, created_at, clients(name, fb_page_id)"
        )
        .eq("status", "pending_review")
        .order("created_at", { ascending: true }),
      adminClient
        .from("page_connection_requests")
        .select("id, client_id, page_name, page_url, status, admin_notes, created_at, clients(name)")
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: true }),
    ]);

    const rows = pending ?? [];

    // Creator names (created_by references auth.users; merge from profiles).
    const creatorIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean)));
    const { data: creators } = creatorIds.length
      ? await adminClient.from("profiles").select("id, full_name, email").in("id", creatorIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const creatorById = new Map((creators ?? []).map((c) => [c.id, c]));

    // Per-client KB source counts for the checklist.
    const clientIds = Array.from(new Set(rows.map((r) => r.client_id)));
    const kbCounts = new Map<string, number>();
    if (clientIds.length) {
      const { data: kb } = await adminClient
        .from("campaign_knowledge_base")
        .select("client_id")
        .in("client_id", clientIds)
        .eq("is_active", true);
      for (const k of kb ?? []) kbCounts.set(k.client_id, (kbCounts.get(k.client_id) ?? 0) + 1);
    }

    const reviews = rows.map((r) => {
      const cfg = (r.config ?? {}) as Record<string, any>;
      const rules = (r.campaign_rules ?? {}) as Record<string, any>;
      const enroll = (r.enrollment_rules ?? {}) as Record<string, any>;
      const questions = ((cfg.qualification_fields ?? []) as { enabled?: boolean }[]).filter(
        (q) => q.enabled
      ).length;
      const kbCount = kbCounts.get(r.client_id) ?? 0;
      const client = r.clients as unknown as { name: string; fb_page_id: string | null } | null;
      const start = rules.sending_hours_start ?? null;
      const end = rules.sending_hours_end ?? null;
      const sources = (enroll.sources ?? []) as string[];

      const checklist = [
        { key: "kb", label: "Knowledge base has sources", pass: kbCount > 0, detail: `${kbCount} active source(s)` },
        { key: "questions", label: "At least 2 qualifying questions", pass: questions >= 2, detail: `${questions} enabled` },
        {
          key: "page",
          label: "Facebook Page connected",
          pass: !sources.includes("messenger") || !!client?.fb_page_id,
          detail: client?.fb_page_id ? `Page ${client.fb_page_id}` : "No fb_page_id on client",
        },
        {
          key: "window",
          label: "Reply window set",
          pass: !!start && !!end,
          detail: start && end ? `${start}–${end} MNL` : "Missing sending hours",
        },
        { key: "sources", label: "Lead source selected", pass: sources.length > 0, detail: sources.join(", ") || "none" },
      ];

      return {
        id: r.id,
        name: r.name,
        clientName: client?.name ?? "Unknown client",
        scope: r.automation_scope,
        isOrganicOwner: r.is_organic_owner,
        targetAction: r.target_action,
        tone: r.tone,
        selfserve: cfg.selfserve ?? null,
        questions: (cfg.qualification_fields ?? []).filter((q: any) => q.enabled),
        tonePersona: cfg.tone_persona ?? "",
        window: start && end ? `${start}–${end}` : null,
        sources,
        enrollExisting: !!cfg.selfserve?.enroll_existing,
        createdAt: r.created_at,
        creator: creatorById.get(r.created_by) ?? null,
        checklist,
        allPass: checklist.every((c) => c.pass),
      };
    });

    return res.status(200).json({ reviews, connections: connections ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
