import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        <div className="space-y-6 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Profile settings placeholder</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Connect external services</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Integrations placeholder</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>BayMo Connection</CardTitle>
              <CardDescription>Configure your BayMo API connection</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">BayMo settings placeholder</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}