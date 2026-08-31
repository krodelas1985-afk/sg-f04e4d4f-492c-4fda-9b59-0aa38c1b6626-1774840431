import { useState } from "react";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Confirm page for the day-before viewing reminder.
 *
 * Public by design — no login. The token is the authorisation: per-recipient, single-use,
 * 30-day expiry. Requiring a sign-in here is what killed the task queue (195 pending, zero
 * completions); every step of friction moves this toward the same fate.
 *
 * The GET renders only. Recording happens on the POST behind the Confirm button, because
 * email security scanners fetch links but do not submit forms — and here a forged answer
 * would be worse than a lost one, since "Going ahead" is what releases the outcome email.
 *
 * Not covered by src/middleware.ts — its matcher is an allowlist of protected paths and
 * does not include this one, so the auth gate never runs for it. Keep it that way.
 */

const LABELS: Record<string, string> = {
  going_ahead: "Going ahead",
  not_happening: "Not happening",
  rescheduled: "Rescheduled",
};

/** What each answer means for the lead, in the agent's terms rather than the schema's. */
const CONSEQUENCE: Record<string, string> = {
  going_ahead: "We'll check in with you the morning after to see how it went.",
  not_happening: "We'll leave it there — no follow-up about this one.",
  rescheduled: "We'll wait for the new date before asking anything.",
};

type Peek = {
  status: string;
  lead_name: string | null;
  scheduled_at: string | null;
  source_text: string | null;
  date_known: boolean | null;
  recorded_answer: string | null;
};

type Props = {
  token: string;
  answer: string;
  peek: Peek | null;
  /**
   * True when the lookup itself failed (bad/absent service key, DB unreachable) rather than
   * the link genuinely being bad. Without this a misconfigured server renders "This link
   * isn't valid" and sends whoever is debugging after the wrong problem.
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
  const answer = typeof ctx.query.a === "string" ? ctx.query.a : "";

  // Never cache: the state changes the moment anyone answers.
  ctx.res.setHeader("Cache-Control", "no-store, max-age=0");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("viewing-confirm: Supabase env not configured");
    return { props: { token, answer, peek: null, serverError: true } };
  }
  if (!token || !answer) {
    // genuinely a malformed link
    return { props: { token, answer, peek: null, serverError: false } };
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("peek_viewing_prep_token", {
    p_token: token,
    p_answer: answer,
  });

  if (error) {
    console.error("viewing-confirm peek failed", error.message);
    return { props: { token, answer, peek: null, serverError: true } };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { props: { token, answer, peek: (row as Peek) ?? null, serverError: false } };
};

export default function ViewingConfirm({ token, answer, peek, serverError }: Props) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [result, setResult] = useState<{
    status: string;
    recordedAnswer: string | null;
  } | null>(null);

  const label = LABELS[answer] ?? "this answer";
  const leadName = peek?.lead_name ?? "this lead";
  const when = peek?.date_known ? formatWhen(peek?.scheduled_at ?? null) : null;

  async function confirm() {
    setState("saving");
    try {
      const res = await fetch("/api/viewing-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answer }),
      });
      const json = await res.json();
      setResult({ status: json.status, recordedAnswer: json.recordedAnswer ?? null });
    } catch {
      setResult({ status: "error", recordedAnswer: null });
    }
    setState("done");
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
        open the lead in BaMo.
      </p>
    );
  } else if (state !== "done" && status === "valid") {
    heading = label;
    tone = "ask";
    showConfirm = true;
    body = (
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
    );
  } else if (status === "ok") {
    heading = "Thanks — that's noted";
    tone = "good";
    body = (
      <p className="sub">
        Marked <strong>{label.toLowerCase()}</strong> for {leadName}.{" "}
        {CONSEQUENCE[answer] ?? ""} You can close this page.
      </p>
    );
  } else if (status === "already") {
    heading = "Already noted";
    tone = "good";
    body = (
      <p className="sub">
        {leadName}&rsquo;s viewing was already marked <strong>{label.toLowerCase()}</strong>.
        Nothing changed.
      </p>
    );
  } else if (status === "answered") {
    const other = result?.recordedAnswer ?? peek?.recorded_answer;
    heading = "Someone got there first";
    tone = "warn";
    body = (
      <p className="sub">
        This one&rsquo;s already settled
        {other ? (
          <>
            {" "}
            — marked <strong>{(LABELS[other] ?? other).toLowerCase()}</strong>
          </>
        ) : null}
        . If that&rsquo;s wrong, update the lead in BaMo.
      </p>
    );
  } else if (status === "used") {
    heading = "This link has been used";
    tone = "mute";
    body = <p className="sub">Each link works once. Use a fresh email, or open BaMo.</p>;
  } else if (status === "expired") {
    heading = "This link has expired";
    tone = "mute";
    body = (
      <p className="sub">Reminder links last 30 days. You can still update the lead in BaMo.</p>
    );
  } else if (status === "error") {
    heading = "That didn't save";
    tone = "warn";
    body = <p className="sub">Something went wrong on our side. Try the button again.</p>;
    showConfirm = true;
  } else {
    heading = "This link isn't valid";
    tone = "mute";
    body = (
      <p className="sub">Check you opened the most recent email, or open BaMo directly.</p>
    );
  }

  return (
    <>
      <Head>
        <title>Viewing confirmation | BaMo</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="page">
        <div className="card">
          <p className="brand">
            Ba<span>Mo</span>
          </p>

          {showConfirm && state !== "done" ? (
            <p className="kicker">You&rsquo;re confirming</p>
          ) : null}
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
        strong {
          color: #2a2e38;
          font-weight: 650;
        }
      `}</style>
    </>
  );
}
