import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AdminClientRedirect() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (router.isReady && id) {
      router.replace(`/admin/clients/${id}/workspace`);
    }
  }, [router.isReady, id]);

  return null;
}
