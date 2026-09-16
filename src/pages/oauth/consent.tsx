import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { createClient } from "@/lib/supabase/client";
import { bamoProductFor } from "@/lib/bamoOAuthClients";

/**
 * "Sign in with BaMo" - the consent step (Identity Standard §56; plan Phase 2).
 *
 * Another BaMo product (the Marketplace) sent the person here with an
 * authorization_id. The person is already signed in to the CRM - the middleware
 * sent them to /login first if not - so their password is only ever typed on
 * this domain (§56.3).
 *
 * THE RULE THAT MATTERS (plan R1): approve ONLY when the CRM holds a mailbox
 * proof for this person's current email. The live test on 2026-09-17 showed why:
 * approving someone whose email is not verified leaves an email-less stray login
 * on the Marketplace that later captures their sign-in - a duplicate account.
 * Declining creates nothing. So an unproven person is never approved, including
 * on the "remembered consent" path where Supabase would otherwise redirect
 * straight through.
 */

type Details = {
  authorization_id?: string;
  redirect_url?: string;
  redirect_uri?: string;
  client?: { id: string; name: string };
  user?: { id: string; email: string };
  scope?: string;
};

type Stage =
  | { kind: "loading" }
  | { kind: "ask"; details: Details; product: string; email: string }
  | { kind: "not_proven"; email: string | null; authorizationId: string | null }
  | { kind: "blocked"; title: string; body: string; authorizationId: string | null }
  | { kind: "working" }
  | { kind: "error"; message: string };

const BRAND = {
  navy: "#1F3C88",
  navyLight: "#2E4EA1",
  orange: "#E67E22",
  cream: "#FFF7ED",
  body: "#5B5B5B",
  heading: "#3A3A3A",
};

export default function ConsentPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  useEffect(() => {
    if (!router.isReady) return;
    const authorizationId = typeof router.query.authorization_id === "string" ? router.query.authorization_id : null;

    const run = async () => {
      if (!authorizationId) {
        setStage({ kind: "error", message: "This sign-in link is incomplete. Start again from the BaMo website." });
        return;
      }

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        // The middleware normally does this; kept for a session that expired on the page.
        router.replace(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);
        return;
      }

      // Eligibility first, before anything that could complete the sign-in.
      const eligibilityResponse = await fetch("/api/oauth/eligibility", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const eligibility = await eligibilityResponse.json().catch(() => null);
      if (!eligibilityResponse.ok || !eligibility) {
        setStage({ kind: "error", message: "BaMo could not check your account just now. Please try again in a moment." });
        return;
      }

      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (error || !data) {
        setStage({ kind: "error", message: "This sign-in request has expired. Start again from the BaMo website." });
        return;
      }
      const details = data as Details;

      if (!eligibility.eligible) {
        if (eligibility.reason === "mailbox_not_proven") {
          setStage({ kind: "not_proven", email: eligibility.email, authorizationId: details.authorization_id ?? null });
        } else {
          setStage({
            kind: "blocked",
            title: "This account can't sign in elsewhere",
            body:
              eligibility.reason === "inactive"
                ? "Your BaMo account is not active. Please contact BaMo."
                : "Your BaMo account isn't fully set up yet. Please contact BaMo.",
            authorizationId: details.authorization_id ?? null,
          });
        }
        return;
      }

      // Remembered consent: Supabase already has an approval and hands back the
      // redirect directly. Eligibility was checked above, so following it is safe.
      if (!details.authorization_id && details.redirect_url) {
        setStage({ kind: "working" });
        window.location.href = details.redirect_url;
        return;
      }

      const product = bamoProductFor(details.redirect_uri);
      if (!product) {
        setStage({
          kind: "blocked",
          title: "Unknown app",
          body: "This app is not a BaMo product, so BaMo won't sign you in to it.",
          authorizationId: details.authorization_id ?? null,
        });
        return;
      }

      setStage({ kind: "ask", details, product: product.name, email: eligibility.email ?? details.user?.email ?? "" });
    };

    run().catch((e) => {
      console.error("[oauth/consent]", e);
      setStage({ kind: "error", message: "Something went wrong. Please try again." });
    });
  }, [router.isReady, router.query.authorization_id]);

  async function approve(authorizationId: string) {
    setStage({ kind: "working" });
    const { data, error } = await createClient().auth.oauth.approveAuthorization(authorizationId);
    if (error || !data?.redirect_url) {
      setStage({ kind: "error", message: error?.message ?? "The sign-in could not be completed." });
      return;
    }
    window.location.href = data.redirect_url;
  }

  async function decline(authorizationId: string | null) {
    if (!authorizationId) {
      window.location.href = "/";
      return;
    }
    setStage({ kind: "working" });
    const { data, error } = await createClient().auth.oauth.denyAuthorization(authorizationId);
    // Declining creates nothing on the other product; send the person back there.
    window.location.href = !error && data?.redirect_url ? data.redirect_url : "/";
  }

  const button = (label: string, onClick: () => void, primary: boolean) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        padding: "12px 20px",
        borderRadius: 8,
        border: primary ? "none" : `1px solid ${BRAND.navy}`,
        background: primary ? BRAND.navy : "#fff",
        color: primary ? "#fff" : BRAND.navy,
        fontFamily: "Poppins, sans-serif",
        fontWeight: 600,
        fontSize: 16,
        lineHeight: "24px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  let content: React.ReactNode;
  switch (stage.kind) {
    case "loading":
    case "working":
      content = <p style={{ color: BRAND.body }}>One moment…</p>;
      break;
    case "ask":
      content = (
        <>
          <h1 style={{ color: BRAND.navy, fontSize: 24, lineHeight: "32px", fontWeight: 600, margin: 0 }}>
            Sign in to {stage.product}
          </h1>
          <p style={{ color: BRAND.body, marginTop: 12 }}>
            {stage.product} wants to sign you in with your BaMo account{" "}
            <strong style={{ color: BRAND.heading }}>{stage.email}</strong>. It will see your name and email address.
            Your password stays with BaMo.
          </p>
          <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
            {button("Continue", () => approve(stage.details.authorization_id!), true)}
            {button("Cancel", () => decline(stage.details.authorization_id ?? null), false)}
          </div>
        </>
      );
      break;
    case "not_proven":
      content = (
        <>
          <h1 style={{ color: BRAND.navy, fontSize: 24, lineHeight: "32px", fontWeight: 600, margin: 0 }}>
            Confirm your email first
          </h1>
          <p style={{ color: BRAND.body, marginTop: 12 }}>
            Before you can use your BaMo account on other BaMo websites, we need you to confirm that{" "}
            <strong style={{ color: BRAND.heading }}>{stage.email ?? "your email address"}</strong> is yours. Open
            the confirmation email from BaMo and click the link in it, then try again.
          </p>
          <p style={{ color: BRAND.body, marginTop: 12 }}>
            No email from BaMo? Please contact BaMo and we&apos;ll send it.
          </p>
          <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
            {button("Go back", () => decline(stage.authorizationId), true)}
          </div>
        </>
      );
      break;
    case "blocked":
      content = (
        <>
          <h1 style={{ color: BRAND.navy, fontSize: 24, lineHeight: "32px", fontWeight: 600, margin: 0 }}>
            {stage.title}
          </h1>
          <p style={{ color: BRAND.body, marginTop: 12 }}>{stage.body}</p>
          <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
            {button("Go back", () => decline(stage.authorizationId), true)}
          </div>
        </>
      );
      break;
    case "error":
      content = (
        <>
          <h1 style={{ color: BRAND.navy, fontSize: 24, lineHeight: "32px", fontWeight: 600, margin: 0 }}>
            Sign-in didn&apos;t work
          </h1>
          <p style={{ color: BRAND.body, marginTop: 12 }}>{stage.message}</p>
        </>
      );
      break;
  }

  return (
    <>
      <Head>
        <title>Sign in with BaMo</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div
        style={{
          minHeight: "100vh",
          background: BRAND.cream,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          fontFamily: "Poppins, sans-serif",
          fontSize: 16,
          lineHeight: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            background: "#fff",
            borderRadius: 16,
            padding: 32,
            boxShadow: "0 8px 24px rgba(31,60,136,0.10)",
          }}
        >
          <p style={{ color: BRAND.orange, fontWeight: 600, fontSize: 13, letterSpacing: 1, margin: "0 0 12px" }}>
            BaMo
          </p>
          {content}
        </div>
      </div>
    </>
  );
}
