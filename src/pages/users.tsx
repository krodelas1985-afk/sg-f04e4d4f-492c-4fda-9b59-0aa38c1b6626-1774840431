import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function UsersPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Users</h1>
            <p className="text-muted-foreground">Manage team members and permissions</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        </div>

        <div className="text-center py-12 text-muted-foreground">
          No users yet. Invite your team members to collaborate.
        </div>
      </div>
    </DashboardLayout>
  );
}