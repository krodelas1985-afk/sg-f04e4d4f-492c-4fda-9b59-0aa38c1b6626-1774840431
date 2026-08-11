import { useState } from "react";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Confirm page for the agent's viewing-outcome email.
 *
 * Public by design — no login. The token is the authorisation: per-recipient, single-use,
 * 30-day expiry. Requiring a sign-in here is what killed the task queue (195 pending, zero
 * completions); every step of friction moves this toward the same fate.
 *
 * The GET renders only. Recording happens on the POST behind the Confirm button, because
 * email security scanners fetch links but do not submit forms.
 *
 * Not covered by src/middleware.ts — its matcher does not include this path, so the
 * auth gate never runs for it. Keep it that way.
 */

const LABELS: Record<string, string> = {
  happened: "It happened",
  not_happened: "It didn't happen",
  rescheduled: "Rescheduled",
  ambiguous: "Still to come",
};

/**
 * Optional second step. Asked here rather than in a follow-up email because this is the
 * one moment we know an agent is present, has just answered, and has the lead in mind —
 * and because Won/Lost has sat at 1 and 0 across 1,083 leads for want of anywhere to
 * record it. Skipping is a first-class option; nothing is blocked on answering.
 */
const LOST_REASONS: Array<{ value: string; label: string }> = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "cannot_finance", label: "Couldn't get financing" },
  { value: "bought_elsewhere", label: "Bought somewhere else" },
  { value: "too_far", label: "Location too far" },
  { value: "not_a_buyer", label: "Not really a buyer" },
  { value: "wrong_inventory", label: "Wanted something we don't have" },
  { value: "timing", label: "Interested, but not yet" },
  { value: "unreachable", label: "Can't reach them" },
  { value: "other", label: "Something else" },
];

type Peek = {
  status: string;
  lead_name: string | null;
  scheduled_at: string | null;
  source_text: string | null;
  date_known: boolean | null;
  recorded_polarity: string | null;
};

type Props = {
  token: string;
  polarity: string;
  peek: Peek | null;
  /**
   * True when the lookup itself failed (bad/absent service key, DB unreachable) as opposed
   * to the link genuinely being bad. Without this a misconfigured server renders
   * "This link isn't valid" and sends whoever is debugging after the wrong problem —
   * which is exactly what happened the first time this page was run locally against a
   * disabled legacy API key.
   */
  serverError: boolean;
};

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-PH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const token = typeof ctx.query.t === "string" ? ctx.query.t : "";
  const polarity = typeof ctx.query.o === "string" ? ctx.query.o : "";

  // Never cache: the state changes the moment anyone answers.
  ctx.res.setHeader("Cache-Control", "no-store, max-age=0");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("viewing-outcome: Supabase env not configured");
    return { props: { token, polarity, peek: null, serverError: true } };
  }
  if (!token || !polarity) {
    // genuinely a malformed link
    return { props: { token, polarity, peek: null, serverError: false } };
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("peek_viewing_outcome_token", {
    p_token: token,
    p_polarity: polarity,
  });

  if (error) {
    console.error("viewing-outcome peek failed", error.message);
    return { props: { token, polarity, peek: null, serverError: true } };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { props: { token, polarity, peek: (row as Peek) ?? null, serverError: false } };
};

export default function ViewingOutcome({ token, polarity, peek, serverError }: Props) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [result, setResult] = useState<{
    status: string;
    recordedPolarity: string | null;
  } | null>(null);

  // second step: where did the lead end up
  const [dispStep, setDispStep] = useState<"hidden" | "ask" | "reasons" | "saving" | "saved" | "skipped">(
    "hidden"
  );
  const [dispResult, setDispResult] = useState<string | null>(null);

  const label = LABELS[polarity] ?? "this outcome";
  const leadName = peek?.lead_name ?? "this lead";
  const when = peek?.date_known ? formatWhen(peek?.scheduled_at ?? null) : null;

  async function confirm() {
    setState("saving");
    try {
      const res = await fetch("/api/viewing-outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, polarity }),
      });
      const json = await res.json();
      setResult({ status: json.status, recordedPolarity: json.recordedPolarity ?? null });
      // Offer the follow-up only once the outcome is safely on file, so a failure there
      // never costs us the answer we already have.
      if (json.status === "ok" || json.status === "already") setDispStep("ask");
    } catch {
      setResult({ status: "error", recordedPolarity: null });
    }
    setState("done");
  }

  async function recordDisposition(disposition: "Won" | "Lost", lostReason?: string) {
    setDispStep("saving");
    try {
      const res = await fetch("/api/lead-disposition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, disposition, lostReason: lostReason ?? null }),
      });
      const json = await res.json();
      setDispResult(json.status === "ok" ? disposition : "error");
    } catch {
      setDispResult("error");
    }
    setDispStep("saved");
  }

  // ---- what to show -------------------------------------------------------
  let heading: string;
  let body: React.ReactNode;
  let tone: "ask" | "good" | "warn" | "mute" = "ask";
  let showConfirm = false;

  const status = result?.status ?? (serverError ? "unavailable" : peek?.status ?? "invalid");

  if (status === "unavailable") {
    heading = "We can't check this right now";
    tone = "warn";
    body = (
      <p className="sub">
        Your link is probably fine — this is on our side. Try again in a few minutes, or
        update the lead in BaMo.
      </p>
    );
  } else if (state !== "done" && status === "valid") {
    heading = label;
    tone = "ask";
    showConfirm = true;
    body = (
      <>
        <p className="sub">
          {leadName}&rsquo;s viewing
          {when ? (
            <>
              <br />
              {when}
            </>
          ) : peek?.source_text ? (
            <>
              <br />
              <span className="quoted">&ldquo;{peek.source_text}&rdquo;</span>
            </>
          ) : null}
        </p>
      </>
    );
  } else if (status === "ok") {
    heading = "Thanks — that's logged";
    tone = "good";
    body = (
      <p className="sub">
        Recorded as <strong>{label}</strong> for {leadName}. You can close this page.
      </p>
    );
  } else if (status === "already") {
    heading = "Already logged";
    tone = "good";
    body = (
      <p className="sub">
        {leadName}&rsquo;s viewing was already recorded as <strong>{label}</strong>. Nothing
        changed.
      </p>
    );
  } else if (status === "answered") {
    const other = result?.recordedPolarity ?? peek?.recorded_polarity;
    heading = "Someone got there first";
    tone = "warn";
    body = (
      <p className="sub">
        This one&rsquo;s already answered
        {other ? (
          <>
            {" "}
            — logged as <strong>{LABELS[other] ?? other}</strong>
          </>
        ) : null}
        . If that&rsquo;s wrong, change it on the lead in BaMo.
      </p>
    );
  } else if (status === "used") {
    heading = "This link has been used";
    tone = "mute";
    body = <p className="sub">Each link works once. Use a fresh email, or open BaMo.</p>;
  } else if (status === "expired") {
    heading = "This link has expired";
    tone = "mute";
    body = <p className="sub">Outcome links last 30 days. You can still update the lead in BaMo.</p>;
  } else if (status === "error") {
    heading = "That didn't save";
    tone = "warn";
    body = <p className="sub">Something went wrong on our side. Try the button again.</p>;
    showConfirm = true;
  } else {
    heading = "This link isn't valid";
    tone = "mute";
    body = <p className="sub">Check you opened the most recent email, or open BaMo directly.</p>;
  }

  return (
    <>
      <Head>
        <title>Viewing outcome | BaMo</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="page">
        <div className="card">
          <p className="brand">
            Ba<span>Mo</span>
          </p>

          {showConfirm && state !== "done" ? <p className="kicker">You&rsquo;re recording</p> : null}
          <h1 className={`head tone-${tone}`}>{heading}</h1>
          {body}

          {showConfirm ? (
            <button className="btn" onClick={confirm} disabled={state === "saving"}>
              {state === "saving" ? "Saving…" : "Confirm"}
            </button>
          ) : null}

          {showConfirm && state !== "saving" ? (
            <p className="foot">
              Wrong one? Close this and tap a different button in the email.
            </p>
          ) : null}

          {/* ---- optional second step: where did the lead end up ---- */}
          {dispStep !== "hidden" ? (
            <div className="step2">
              {dispStep === "ask" ? (
                <>
                  <p className="q">While you&rsquo;re here — where&rsquo;s this lead now?</p>
                  <button className="btn btn-sm" onClick={() => recordDisposition("Won")}>
                    Reserved / bought
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDispStep("reasons")}>
                    Lost it
                  </button>
                  <button className="linkbtn" onClick={() => setDispStep("skipped")}>
                    Still working on it
                  </button>
                </>
              ) : null}

              {dispStep === "reasons" ? (
                <>
                  <p className="q">What happened?</p>
                  <div className="reasons">
                    {LOST_REASONS.map((r) => (
                      <button
                        key={r.value}
                        className="btn btn-sm btn-ghost"
                        onClick={() => recordDisposition("Lost", r.value)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <button className="linkbtn" onClick={() => setDispStep("ask")}>
                    Back
                  </button>
                </>
              ) : null}

              {dispStep === "saving" ? <p className="q">Saving…</p> : null}

              {dispStep === "saved" ? (
                <p className="q">
                  {dispResult === "Won"
                    ? "Marked as reserved — nice one."
                    : dispResult === "Lost"
                    ? "Marked as lost. We'll stop following up."
                    : "That didn't save, but your viewing answer is safe."}
                </p>
              ) : null}

              {dispStep === "skipped" ? (
                <p className="q">Got it — we&rsquo;ll leave it open.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: #efeae1;
          font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .card {
          width: 100%;
          max-width: 26rem;
          background: #fff;
          border: 1px solid #e6ddd0;
          border-radius: 10px;
          padding: 2.25rem 1.75rem 1.75rem;
          text-align: center;
          box-shadow: 0 1px 3px rgba(31, 60, 136, 0.06);
        }
        .brand {
          font-size: 1.05rem;
          font-weight: 800;
          color: #1f3c88;
          letter-spacing: -0.02em;
          margin: 0 0 1.75rem;
        }
        .brand span {
          color: #e67e22;
        }
        .kicker {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #868b9c;
          font-weight: 700;
          margin: 0 0 0.35rem;
        }
        .head {
          font-size: 1.5rem;
          font-weight: 700;
          color: #2a2e38;
          margin: 0 0 0.5rem;
          letter-spacing: -0.02em;
          line-height: 1.25;
        }
        .tone-good {
          color: #1f3c88;
        }
        .tone-warn {
          color: #bf6516;
        }
        .sub {
          font-size: 0.95rem;
          color: #55596a;
          margin: 0 0 1.5rem;
          line-height: 1.55;
        }
        .quoted {
          font-style: italic;
          color: #1f3c88;
        }
        .btn {
          display: block;
          width: 100%;
          max-width: 15rem;
          margin: 0 auto 1rem;
          padding: 0.85rem 1rem;
          border: 0;
          border-radius: 6px;
          background: #1f3c88;
          color: #fff;
          font-size: 1rem;
          font-weight: 650;
          cursor: pointer;
        }
        .btn:hover:not(:disabled) {
          background: #162d6b;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .btn:focus-visible {
          outline: 2px solid #e67e22;
          outline-offset: 2px;
        }
        .foot {
          font-size: 0.78rem;
          color: #868b9c;
          margin: 0;
        }
        .step2 {
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px solid #ece6dc;
        }
        .q {
          font-size: 0.92rem;
          color: #55596a;
          margin: 0 0 0.85rem;
          line-height: 1.5;
        }
        .btn-sm {
          font-size: 0.9rem;
          padding: 0.7rem 1rem;
          margin-bottom: 0.5rem;
        }
        .btn-ghost {
          background: #fff;
          color: #1f3c88;
          border: 1px solid #dfd8cc;
        }
        .btn-ghost:hover:not(:disabled) {
          background: #fbf7f1;
        }
        .reasons {
          display: grid;
          gap: 0.4rem;
          margin-bottom: 0.5rem;
        }
        .reasons .btn-sm {
          margin-bottom: 0;
          max-width: none;
        }
        .linkbtn {
          background: none;
          border: 0;
          color: #868b9c;
          font-size: 0.82rem;
          cursor: pointer;
          text-decoration: underline;
          padding: 0.35rem;
        }
        .linkbtn:hover {
          color: #55596a;
        }
        .linkbtn:focus-visible {
          outline: 2px solid #e67e22;
          outline-offset: 2px;
        }
        strong {
          color: #2a2e38;
          font-weight: 650;
        }
      `}</style>
    </>
  );
}
