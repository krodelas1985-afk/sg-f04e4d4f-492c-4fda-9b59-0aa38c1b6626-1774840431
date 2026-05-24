import { createClient } from "@/lib/supabase/client";

// Helper to get redirect URL dynamically for auth flows
const getRedirectURL = (path: string = "/dashboard") => {
  if (typeof window !== "undefined") {
    const { protocol, host } = window.location;
    return `${protocol}//${host}${path}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}${path}`
    : `http://localhost:3000${path}`;
};

export const authService = {
  // Sign in with email and password
  async signIn(email: string, password: string) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  // Sign out
  async signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current session
  async getSession() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  // Get current user
  async getUser() {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // Get user profile with role and client_id
  async getUserProfile() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, role, client_id, full_name, email, phone, is_active, created_at")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    return profile;
  },

  // Update user password (for invited users on /auth/set-password)
  async updatePassword(newPassword: string) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    return data;
  },

  // OAuth sign in (Google, etc.) - if needed in the future
  async signInWithOAuth(provider: "google" | "github") {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getRedirectURL("/dashboard"),
      },
    });

    if (error) throw error;
    return data;
  },
};