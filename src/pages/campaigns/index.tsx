import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createBrowserClient } from "@supabase/ssr";

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  leads_count: number;
  created_at: string;
  is_locked: boolean;
}

export default function CampaignsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetchProfileAndCampaigns();
  }, []);

  const fetchProfileAndCampaigns = async () => {
    try {
      setLoading(true);
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("role, client_id")
          .eq("id", authData.user.id)
          .single();
        setProfile(p);
      }

      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      setCampaigns(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-[#E8702A]/10 text-[#E8702A]";
      case "paused": return "bg-amber-100 text-amber-800";
      case "completed": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Campaigns</h1>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No campaigns have been assigned to you yet.
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
