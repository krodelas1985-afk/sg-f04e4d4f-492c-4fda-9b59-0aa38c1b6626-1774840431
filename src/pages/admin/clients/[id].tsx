import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <DashboardLayout>
      <div className="p-8">
        <Link href="/admin/clients">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clients
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Client Details</h1>
          <p className="text-muted-foreground">Client ID: {id}</p>
        </div>

        <div className="text-center py-12 text-muted-foreground">
          Client detail view placeholder
        </div>
      </div>
    </DashboardLayout>
  );
}