import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function SetPassword() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    // Listen for auth changes to catch the session once URL hash is processed
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;
        if (newSession) {
          setSession(newSession);
          setLoading(false);
        }
      }
    );

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      
      if (data.session) {
        setSession(data.session);
        setLoading(false);
      } else {
        // If URL contains access_token, Supabase needs time to process it
        if (window.location.hash && window.location.hash.includes("access_token")) {
          // Wait up to 3 seconds for onAuthStateChange to fire
          setTimeout(() => {
            if (isMounted) {
              setLoading(false);
            }
          }, 3000);
        } else {
          // No session and no token in URL, safe to show error
          setLoading(false);
        }
      }
    }).catch((err) => {
      console.error("Error checking session:", err);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    // Redirect to dashboard after successful password set
    router.push("/dashboard");
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B2F4E] to-[#0D1829]">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#E8702A]" />
              <p className="text-gray-600">Verifying your invitation link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid/expired link state
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B2F4E] to-[#0D1829]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-xl">Invalid or Expired Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600 text-center">
              This invitation link is invalid or has expired. Please contact your administrator for a new invitation.
            </p>
            <Button
              onClick={() => router.push("/login")}
              className="w-full bg-[#E8702A] hover:bg-[#d66424]"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid session - show password form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B2F4E] to-[#0D1829]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="text-3xl font-bold text-[#E8702A]">BayMo</div>
          </div>
          <CardTitle className="text-center text-xl">Welcome to BayMo — Set Your Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={submitting}
              />
              <p className="text-xs text-gray-500">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm Password</label>
              <Input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={submitting}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#E8702A] hover:bg-[#d66424]"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting Password...
                </>
              ) : (
                "Set Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}