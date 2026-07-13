// src/pages/templates/generate.tsx
// AI Template Generator for the BaMo Campaign Engine (Templates module).
// Next.js 15 Pages Router. Uses the unified @supabase/ssr browser client.
//
// Flow: pick client (auto for client_admin) -> goal -> optional topic ->
// optional agent notes -> optional "use KB" toggle -> Generate (calls the
// `generate-template` edge function) -> review/edit -> Save to message_templates.
//
// Design intentionally minimal: this is a working harness first. The raw
// edge-function error is shown on screen so any failure is unambiguous.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_FN_URL =
  "https://zyfkjxepykwpfzmkxitb.supabase.co/functions/v1/generate-template";

const GOALS = [
  { value: "invite_viewing", label: "Invite to Viewing" },
  { value: "invite_open_house", label: "Invite to Open House / Event" },
  { value: "send_info", label: "Send Info (topic)" },
  { value: "ask_qualifying_question", label: "Ask One Qualifying Question" },
  { value: "other", label: "Other (free)" },
] as const;

const LANGS = [
  { value: "english", label: "English" },
  { value: "taglish", label: "Taglish" },
  { value: "filipino", label: "Filipino" },
] as const;

// The delivery channel shapes the format the AI produces (and is saved on the
// template). Values must match the message_templates.channel CHECK constraint.
const CHANNELS = [
  { value: "messenger", label: "Messenger" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
] as const;

type Goal = (typeof GOALS)[number]["value"];
type Lang = (typeof LANGS)[number]["value"];
type Channel = (typeof CHANNELS)[number]["value"];

type GenResult = {
  title: string;
  body: string;
  category: Goal;
  topic: string | null;
  language: Lang;
  placeholders_used: string[];
  used_kb: boolean;
  missing: string[];
};

const GOAL_TO_CATEGORY: Record<string, string> = {
  invite_viewing: "Call-to-Action",
  invite_open_house: "Call-to-Action",
  send_info: "Introduction",
  ask_qualifying_question: "Qualification",
  other: "Follow-up",
};

export default function GenerateTemplatePage() {
  const supabase = useMemo(() => createClient(), []);

  const [clientId, setClientId] = useState<string>("");
  const [channel, setChannel] = useState<Channel>("messenger");
  const [goal, setGoal] = useState<Goal>("invite_viewing");
  const [topic, setTopic] = useState("");
  const [agentNotes, setAgentNotes] = useState("");
  const [language, setLanguage] = useState<Lang>("taglish");
  const [useKb, setUseKb] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const topicRequired = goal === "send_info";
  const notesRequired = goal === "other";

  // This page is client_admin-only. A client_admin is scoped to exactly one
  // client via get_my_client_id(); they do not pick a client. Resolve the
  // caller's own client_id from the RPC and use it for generate + save.
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_my_client_id");
      if (error || !data) {
        setError("No client scope found for your account. This page is for client accounts.");
        return;
      }
      setClientId(data as string);
    })();
  }, [supabase]);

  const canGenerate =
    !!clientId &&
    !!goal &&
    (!topicRequired || topic.trim() !== "") &&
    (!notesRequired || agentNotes.trim() !== "");

  async function handleGenerate() {
    setError(null);
    setSaved(null);
    setResult(null);
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("No active session. Please log in again.");
        return;
      }

      const res = await fetch(SUPABASE_FN_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          channel,
          goal,
          topic: topic.trim() || undefined,
          agent_notes: agentNotes.trim() || undefined,
          language,
          use_kb: useKb,
        }),
      });

      const raw = await res.text();
      let json: any;
      try {
        json = JSON.parse(raw);
      } catch {
        setError(`Function returned non-JSON (HTTP ${res.status}):\n${raw}`);
        return;
      }

      if (!res.ok || json.error) {
        // Surface the exact function error so failures are unambiguous.
        setError(`HTTP ${res.status}\n${JSON.stringify(json, null, 2)}`);
        return;
      }

      const r = json as GenResult;
      setResult(r);
      setEditTitle(r.title ?? "");
      setEditBody(r.body ?? "");
    } catch (e: any) {
      setError(`Request failed: ${String(e?.message ?? e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setError(null);
    setSaved(null);
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("message_templates")
        .insert({
          client_id: clientId,
          title: editTitle.trim() || `${goal} template`,
          body: editBody,
          channel,
          category: GOAL_TO_CATEGORY[goal],
          goal,
          topic: topic.trim() || null,
          placeholders_used: result.placeholders_used ?? [],
          used_kb: result.used_kb ?? false,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (error) {
        // Most likely cause: RLS withcheck (client_id vs get_my_client_id()).
        setError(`Save failed (raw):\n${JSON.stringify(error, null, 2)}`);
        return;
      }
      setSaved(`Saved template ${data?.id}`);
    } catch (e: any) {
      setError(`Save failed: ${String(e?.message ?? e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={S.page}>
      <Link href="/templates" style={S.backLink}>
        ← Back to Templates
      </Link>
      <h1 style={S.h1}>AI Template Generator</h1>
      <p style={S.sub}>
        Pick a goal, optionally add your own notes, optionally pull from the
        approved Knowledge Base, then generate a reusable template.
      </p>

      <div style={S.card}>
        {/* Channel — drives the format of the generated message */}
        <label style={S.label}>Message type</label>
        <select
          style={S.input}
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
        >
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Goal */}
        <label style={S.label}>Goal</label>
        <select
          style={S.input}
          value={goal}
          onChange={(e) => setGoal(e.target.value as Goal)}
        >
          {GOALS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>

        {/* Topic (required for send_info) */}
        {(goal === "send_info" || goal === "other") && (
          <>
            <label style={S.label}>
              Topic {topicRequired ? "(required)" : "(optional)"}
            </label>
            <input
              style={S.input}
              placeholder="e.g. payment terms, location, amenities"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </>
        )}

        {/* Agent notes */}
        <label style={S.label}>
          Your notes {notesRequired ? "(required)" : "(optional)"}
        </label>
        <textarea
          style={{ ...S.input, height: 90, resize: "vertical" }}
          placeholder="Facts YOU want included verbatim, e.g. 'Open house this weekend, June 27-28, limited slots'."
          value={agentNotes}
          onChange={(e) => setAgentNotes(e.target.value)}
        />

        {/* Language */}
        <label style={S.label}>Language</label>
        <select
          style={S.input}
          value={language}
          onChange={(e) => setLanguage(e.target.value as Lang)}
        >
          {LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        {/* KB toggle */}
        <label style={S.checkRow}>
          <input
            type="checkbox"
            checked={useKb}
            onChange={(e) => setUseKb(e.target.checked)}
          />
          <span>
            Use approved Knowledge Base for this client (optional). Facts pulled
            from the KB are written into the message.
          </span>
        </label>

        <button
          style={{ ...S.btn, opacity: canGenerate && !loading ? 1 : 0.5 }}
          disabled={!canGenerate || loading}
          onClick={handleGenerate}
        >
          {loading ? "Generating…" : "Generate with AI"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <pre style={S.error}>{error}</pre>
      )}

      {/* Result */}
      {result && (
        <div style={S.card}>
          <div style={S.metaRow}>
            <span style={S.badge}>{useKb ? "KB" : "No KB"}</span>
            <span style={{ ...S.badge, background: result.used_kb ? "#1F3C88" : "#888" }}>
              used_kb: {String(result.used_kb)}
            </span>
            {result.placeholders_used?.map((p) => (
              <span key={p} style={S.tokenBadge}>{p}</span>
            ))}
          </div>

          {result.missing?.length > 0 && (
            <div style={S.missing}>
              KB had nothing on: {result.missing.join(", ")}. Add it to the KB or
              type it into your notes — the AI did not invent it.
            </div>
          )}

          <label style={S.label}>Template title</label>
          <input
            style={S.input}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />

          <label style={S.label}>Message</label>
          <textarea
            style={{ ...S.input, height: 160, resize: "vertical" }}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
          />

          <button
            style={{ ...S.btn, background: "#E67E22", opacity: saving ? 0.5 : 1 }}
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save Template"}
          </button>
          {saved && <div style={S.saved}>{saved}</div>}
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "Poppins, system-ui, sans-serif", color: "#1F3C88" },
  backLink: { display: "inline-block", marginBottom: 16, fontSize: 14, fontWeight: 600, color: "#1F3C88", textDecoration: "none" },
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 14, color: "#555", marginBottom: 20 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
  label: { display: "block", fontSize: 13, fontWeight: 600, margin: "12px 0 6px" },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" },
  checkRow: { display: "flex", gap: 8, alignItems: "flex-start", margin: "16px 0", fontSize: 13, color: "#444" },
  btn: { marginTop: 16, width: "100%", padding: "12px", background: "#1F3C88", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" },
  error: { background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", padding: 14, borderRadius: 8, fontSize: 12, whiteSpace: "pre-wrap", overflowX: "auto" },
  metaRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  badge: { fontSize: 11, fontWeight: 600, color: "#fff", background: "#1F3C88", padding: "3px 8px", borderRadius: 999 },
  tokenBadge: { fontSize: 11, fontFamily: "monospace", color: "#1F3C88", background: "#eef2ff", padding: "3px 8px", borderRadius: 999 },
  missing: { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 12 },
  saved: { marginTop: 10, color: "#166534", fontSize: 13, fontWeight: 600 },
};
