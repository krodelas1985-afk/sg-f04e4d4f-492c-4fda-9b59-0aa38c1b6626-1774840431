import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";

interface Signup {
  id: string;
  status: "in_progress" | "submitted" | "reviewed" | "approved";
  business_type: string | null;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  created_at: string;
  submitted_at: string | null;
  client_id: string | null;
  clients?: { name: string; plan: string } | null;
}

const BUSINESS_LABELS: Record<string, string> = {
  individual: "Solo Agent",
  brokerage: "Broker",
  developer: "Developer",
};

function statusBadgeClass(status: string): string {
  if (status === "approved") return "bg-green-100 text-green-800 hover:bg-green-100";
  if (status === "submitted") return "bg-amber-100 text-amber-800 hover:bg-amber-100";
  return "bg-gray-100 text-gray-800 hover:bg-gray-100";
}

export default function AdminSignupsPage() {
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/signups");
        if (res.ok) {
          const data = await res.json();
          setSignups(Array.isArray(data.signups) ? data.signups : []);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const provisioned = signups.filter((s) => s.status === "approved").length;

  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-foreground">New Signups</h1>
          <p className="text-muted-foreground">
            Self-serve signups from the RE Assistant mobile app. Free workspaces are provisioned
            automatically on submit — this view is for visibility, not approval.
          </p>
        </div>

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card rounded-lg border shadow-sm p-6">
              <div className="text-sm font-medium text-muted-foreground">Total signups</div>
              <div className="text-2xl font-bold">{signups.length}</div>
            </div>
            <div className="bg-card rounded-lg border shadow-sm p-6">
              <div className="text-sm font-medium text-muted-foreground">Provisioned workspaces</div>
              <div className="text-2xl font-bold">{provisioned}</div>
            </div>
          </div>
        )}

        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Workspace</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Plan</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Signed up</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : signups.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                      No signups yet
                    </td>
                  </tr>
                ) : (
                  signups.map((s) => (
                    <tr key={s.id} className="bg-card hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium text-foreground">
                        {s.full_name || "—"}
                      </td>
                      <td className="px-6 py-4">
                        {s.client_id ? (
                          <Link
                            href={`/admin/clients/${s.client_id}`}
                            className="font-medium hover:underline text-primary"
                          >
                            {s.clients?.name || "Workspace"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {s.business_type ? BUSINESS_LABELS[s.business_type] ?? s.business_type : "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {s.clients?.plan ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border capitalize">
                            {s.clients.plan}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="outline" className={statusBadgeClass(s.status)}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {s.email || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
