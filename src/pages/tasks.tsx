import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function TasksPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Tasks</h1>
            <p className="text-muted-foreground">Track and manage your follow-up tasks</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>

        <div className="text-center py-12 text-muted-foreground">
          No tasks yet. Create your first task to get started.
        </div>
      </div>
    </DashboardLayout>
  );
}