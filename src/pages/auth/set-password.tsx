import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Use onAuthStateChange to detect session after token processing
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setHasSession(true);
        setLoading(false);
        setSessionChecked(true);
      } else if (event === 'INITIAL_SESSION') {
        if (session) {
          setHasSession(true);
        }
        setLoading(false);
        setSessionChecked(true);
      }
    });

    // Fallback: After 3 seconds, if still loading, show error
    const timeout = setTimeout(() => {
      if (!sessionChecked) {
        setLoading(false);
        setSessionChecked(true);
        setHasSession(false);
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [sessionChecked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      // Update password for the invited user
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Redirect to dashboard after successful password set
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Error setting password:", err);
      setError(err.message || "Failed to set password. Please try again.");
      setSubmitting(false);
    }
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

  // Invalid/expired link
  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B2F4E] to-[#0D1829]">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900">Invalid or Expired Link</h2>
              <p className="text-gray-600 text-center">
                This invitation link is invalid or has expired. Please contact your administrator for a new invitation.
              </p>
              <Button
                onClick={() => router.push("/login")}
                className="w-full"
                variant="outline"
              >
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B2F4E] to-[#0D1829] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="text-3xl font-bold text-[#1B2F4E]">BayMo</div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Welcome to BayMo — Set Your Password
          </CardTitle>
          <p className="text-sm text-gray-600">
            Create a secure password to activate your account
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                disabled={submitting}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#E8702A] hover:bg-[#D96520] text-white"
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