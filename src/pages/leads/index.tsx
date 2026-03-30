import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function LeadsPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Leads</h1>
            <p className="text-muted-foreground">Manage your customer leads and contacts</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>

        <div className="text-center py-12 text-muted-foreground">
          No leads yet. Start by adding your first lead.
        </div>
      </div>
    </DashboardLayout>
  );
}