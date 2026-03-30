import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your campaign performance and activity</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardDescription>Total Leads</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Active Campaigns</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Pending Tasks</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}