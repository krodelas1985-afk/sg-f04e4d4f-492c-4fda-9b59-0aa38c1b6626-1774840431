import { useEffect } from "react";
import { useRouter } from "next/router";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { homeRouteFor } from "@/lib/homeRoute";

/**
 * "/" only decides where someone lands. Middleware has already sent signed-out
 * visitors to /login, and the other "go home" paths (login, email confirmation,
 * password set) come through here, so the role logic lives in one place.
 */
export default function HomePage() {
  const router = useRouter();
  const { profile, loading } = useUserProfile();

  useEffect(() => {
    if (loading) return;
    router.replace(homeRouteFor(profile?.role));
  }, [loading, profile, router]);

  return null;
}
