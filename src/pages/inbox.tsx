import { DashboardLayout } from "@/components/DashboardLayout";

export default function InboxPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Inbox</h1>
          <p className="text-muted-foreground">Manage conversations with your leads</p>
        </div>

        <div className="text-center py-12 text-muted-foreground">
          No conversations yet
        </div>
      </div>
    </DashboardLayout>
  );
}