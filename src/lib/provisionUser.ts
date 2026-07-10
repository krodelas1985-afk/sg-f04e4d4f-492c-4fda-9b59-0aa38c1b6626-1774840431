import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Create-or-link a login account for a client workspace.
 *
 * Both admin user-creation surfaces (Create Client, and a workspace's
 * "Add User") funnel through here so they behave identically. The important
 * property: if the email already has an account, we RESET its password to the
 * one the admin just typed (and re-link it to the target client) instead of
 * silently ignoring the new password — the old bug that made freshly "created"
 * accounts fail to log in.
 *
 * Email is normalised to lowercase so a case mismatch never falls through to a
 * duplicate-user error (auth is case-insensitive; a raw profiles `.eq` was not).
 */
export interface ProvisionUserParams {
  email: string;
  role: string;
  clientId: string;
  password?: string;
  fullName?: string;
  /** Where invited users land to set their password (only used when no password given). */
  inviteRedirectTo?: string;
}

export interface ProvisionUserResult {
  userId: string;
  /** true = brand-new auth user, false = existing account we re-linked. */
  created: boolean;
  /** true = we set/reset the password to the supplied value. */
  passwordSet: boolean;
  /** true = an invite email was sent instead of setting a password. */
  invited: boolean;
}

export async function provisionUser(
  admin: SupabaseClient,
  { email, role, clientId, password, fullName, inviteRedirectTo }: ProvisionUserParams
): Promise<ProvisionUserResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = (fullName || "").trim() || normalizedEmail.split("@")[0];

  // 1. Does this email already have a profile? (case-insensitive)
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (existing) {
    let passwordSet = false;
    if (password) {
      const { error: pwError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (pwError) throw pwError;
      passwordSet = true;
    }
    const { error: profileError } = await admin
      .from("profiles")
      .update({ client_id: clientId, role, full_name: displayName })
      .eq("id", existing.id);
    if (profileError) throw profileError;

    return { userId: existing.id, created: false, passwordSet, invited: false };
  }

  // 2. New account.
  let userId: string;
  let invited = false;

  if (password) {
    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName, role, client_id: clientId },
    });
    if (error || !data.user) {
      throw error ?? new Error("Failed to create user account");
    }
    userId = data.user.id;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: { full_name: displayName, role, client_id: clientId },
      ...(inviteRedirectTo ? { redirectTo: inviteRedirectTo } : {}),
    });
    if (error || !data?.user?.id) {
      throw error ?? new Error("Failed to send invitation email");
    }
    userId = data.user.id;
    invited = true;
  }

  // 3. Upsert the profile. handle_new_user (AFTER INSERT trigger) may have
  //    already seeded a least-privilege row; this elevates it to the intended
  //    role and links the client via the trusted service-role path.
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email: normalizedEmail,
    role,
    client_id: clientId,
    full_name: displayName,
    is_active: true,
  });
  if (profileError) throw profileError;

  return { userId, created: true, passwordSet: !!password, invited };
}
