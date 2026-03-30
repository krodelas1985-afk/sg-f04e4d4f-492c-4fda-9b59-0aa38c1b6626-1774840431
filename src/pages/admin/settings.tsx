import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Settings</h1>
          <p className="text-muted-foreground">Configure system-wide settings</p>
        </div>

        <div className="space-y-6 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>Global platform settings</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">System configuration placeholder</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage platform API keys</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">API key management placeholder</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}