import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function ConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    const verifyToken = async () => {
      const { token_hash, type } = router.query;

      if (!token_hash || !type) {
        setError("This link is missing required information.");
        setVerifying(false);
        return;
      }

      const supabase = createClient();
      try {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token_hash as string,
          type: type as any,
        });

        if (verifyError) {
          setError(verifyError.message);
          setVerifying(false);
          return;
        }

        // recovery + invite both need the user to set a password
        if (type === "recovery" || type === "invite") {
          router.replace("/auth/set-password");
        } else {
          // Other verification types (email confirmation, etc.)
          router.replace("/dashboard");
        }
      } catch (err) {
        console.error("Verification error:", err);
        setError("An unexpected error occurred");
        setVerifying(false);
      }
    };

    verifyToken();
  }, [router.isReady, router.query]);

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying your link...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-semibold mb-2">
              Link Invalid or Expired
            </h1>
            <p className="text-gray-600">
              This link is invalid or has expired. Please contact your
              administrator for a new invitation.
            </p>
          </div>

          <Button
            onClick={() => router.push("/login")}
            className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white"
          >
            Go to Login
          </Button>

          {error && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              Error: {error}
            </p>
          )}
        </Card>
      </div>
    );
  }

  return null;
}