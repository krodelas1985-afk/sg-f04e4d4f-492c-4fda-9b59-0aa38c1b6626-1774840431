import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Meta lifecycle-callback helpers for the CRM.
 *
 * The CRM owns the two app-level callbacks Meta calls directly — Deauthorize and
 * Data Deletion — because Meta allows exactly ONE URL for each per app, and this
 * host (app.bahaymo.com) is the one registered on the app under review. The OAuth
 * login/callback pair stays on the Ads Manager.
 *
 * This is a deliberate SUBSET of the Ads Manager's `src/lib/meta/crypto.ts`:
 * the lifecycle callbacks only ever null out or delete stored tokens, they never
 * read one back, so nothing here decrypts. That is why the CRM does NOT need
 * META_TOKEN_ENCRYPTION_KEY — keep it that way, and if a future callback needs to
 * read a token, route it through the Ads Manager rather than copying the key here.
 */

/**
 * The app secret used to verify Meta's signed_request.
 *
 * The CRM has historically used FACEBOOK_APP_SECRET (Messenger webhook) while the
 * Ads Manager uses META_APP_SECRET. Both must belong to the SAME Meta app — the
 * one under review — or signature verification here will fail for requests the
 * OAuth flow produced. Accepting either name avoids a silent config trap.
 */
export function metaAppSecret(): string | null {
  return process.env.META_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET ?? null;
}

export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Verify a Meta `signed_request` (base64url signature "." base64url payload).
 *
 * Throws `invalid_signed_request` for every rejection so callers can map the whole
 * class to 401 without leaking which check failed. Uses timingSafeEqual, pins the
 * algorithm to HMAC-SHA256, and rejects payloads older than 10 minutes.
 */
export function verifyMetaSignedRequest(
  signedRequest: string,
  appSecret: string
): { user_id: string; issued_at?: number; algorithm: string } {
  const parts = signedRequest.split(".");
  if (parts.length !== 2) throw new Error("invalid_signed_request");

  const [signatureValue, payloadValue] = parts;
  const received = Buffer.from(signatureValue, "base64url");
  const expected = createHmac("sha256", appSecret).update(payloadValue, "utf8").digest();
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("invalid_signed_request");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadValue, "base64url").toString("utf8"));
  } catch {
    throw new Error("invalid_signed_request");
  }

  if (!payload || typeof payload !== "object") throw new Error("invalid_signed_request");
  const parsed = payload as Record<string, unknown>;
  if (String(parsed.algorithm).toUpperCase() !== "HMAC-SHA256") {
    throw new Error("invalid_signed_request");
  }
  if (typeof parsed.user_id !== "string" || !parsed.user_id) {
    throw new Error("invalid_signed_request");
  }
  if (typeof parsed.issued_at === "number") {
    const ageSeconds = Math.abs(Date.now() / 1000 - parsed.issued_at);
    if (ageSeconds > 10 * 60) throw new Error("invalid_signed_request");
  }

  return {
    user_id: parsed.user_id,
    issued_at: typeof parsed.issued_at === "number" ? parsed.issued_at : undefined,
    algorithm: String(parsed.algorithm),
  };
}

/** Reads `signed_request` from a urlencoded or JSON body. */
export function readSignedRequest(body: unknown): string {
  const value = (body as Record<string, unknown> | null)?.signed_request;
  if (typeof value !== "string" || !value) throw new Error("invalid_signed_request");
  return value;
}

export function deletionStatusHtml(code: string, found: boolean): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Data deletion status · BaMo</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f6f8fc;color:#17233d;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(620px,calc(100% - 32px));margin:48px auto;background:#fff;border:1px solid #dfe5ef;border-radius:20px;padding:30px;box-shadow:0 18px 50px rgba(31,60,136,.1)}
    .brand{font-weight:800;color:#1f3c88;letter-spacing:.02em}
    .eyebrow{font-size:13px;font-weight:700;text-transform:uppercase;color:#5d6d91;letter-spacing:.08em}
    h1{font-size:28px;line-height:1.2;margin:10px 0}p{line-height:1.6;color:#53617d}.muted{font-size:13px;color:#7a879f}
  </style>
</head><body><main><div class="brand">BaMo</div>
  <div class="eyebrow">Meta data deletion</div>
  <h1>${found ? "Deletion completed" : "Request not found"}</h1>
  <p>${
    found
      ? "The Meta connection, stored access tokens, and Page connection data associated with this request were deleted."
      : "We could not find a deletion request with this confirmation code."
  }</p>
  <p class="muted">Confirmation code: ${escapeHtml(code)}</p>
</main></body></html>`;
}
