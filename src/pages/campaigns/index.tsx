import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function CampaignsPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Campaigns</h1>
            <p className="text-muted-foreground">Create and manage your marketing campaigns</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>

        <div className="text-center py-12 text-muted-foreground">
          No campaigns yet. Create your first campaign to get started.
        </div>
      </div>
    </DashboardLayout>
  );
}