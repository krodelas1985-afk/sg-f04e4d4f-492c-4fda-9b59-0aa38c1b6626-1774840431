import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeadSlideOver } from "@/components/LeadSlideOver";

const STATUS_OPTIONS = ["New", "Active", "In Contact", "Inactive", "Closed"];
const STAGE_OPTIONS = [
  { value: "Hot", emoji: "🔥", color: "bg-red-100 text-red-800" },
  { value: "Warm", emoji: "🟠", color: "bg-amber-100 text-amber-800" },
  { value: "Cold", emoji: "❄️", color: "bg-gray-100 text-gray-800" },
  { value: "Unqualified", emoji: "", color: "bg-gray-100 text-gray-600" },
];
const LEAD_TYPE_OPTIONS = ["Buyer", "Seller", "Agent", "Developer", "Affiliate", "Others"];
const SOURCE_OPTIONS = [
  "FB Messenger",
  "Viber",
  "BaMo Marketplace",
  "Website Chat",
  "Web Form",
  "Quick Form",
  "Manually Added",
  "Referral",
  "Phone Call",
  "Event / Open House",
];

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  status: string;
  lead_temperature: string;
  lead_quality: string;
  lead_score: number;
  lead_quality_source: string;
  source: string;
  source_override: boolean;
  assigned_user_id: string | null;
  campaign_id: string | null;
  agent_name: string | null;
  agent_role: string | null;
  campaign_name: string | null;
  last_message: string | null;
  next_task_title: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_location: string | null;
  property_type: string | null;
  bedrooms: number | null;
  lead_type: string | null;
  last_inbound_at: string | null;
  last_contacted_at: string | null;
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [stageFilter, setStageFilter] = useState<string>("All");
  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [assignedAgentFilter, setAssignedAgentFilter] = useState<string>("All");
  const [campaignFilter, setCampaignFilter] = useState<string>("All");
  const [qualityFilter, setQualityFilter] = useState<string>("All");
  const [leadTypeFilter, setLeadTypeFilter] = useState<string>("All");
  const [scoreSort, setScoreSort] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastInboundSort, setLastInboundSort] = useState<string>("");
  const [lastContactedSort, setLastContactedSort] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Summary counts
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [baymoCount, setBaymoCount] = useState(0);
  const [manualCount, setManualCount] = useState(0);
  
  // Dropdown data
  const [agents, setAgents] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  
  // Modals
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showFullAdd, setShowFullAdd] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  
  // Quick Add form
  const [quickAddData, setQuickAddData] = useState({
    name: "",
    phone: "",
    source: "",
    lead_temperature: "",
    assigned_user_id: "",
  });
  
  // Full Add form
  const [fullAddData, setFullAddData] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    lead_type: "",
    status: "New",
    lead_temperature: "",
    source: "",
    preferred_location: "",
    property_type: "",
    bedrooms: "",
    budget_min: "",
    budget_max: "",
    assigned_user_id: "",
    campaign_id: "",
    notes: "",
  });
  
  const [clientId, setClientId] = useState<string | null>(null);
  
  useEffect(() => {
    fetchClientId();
  }, []);

  // Reset to page 1 whenever any filter or sort changes
  useEffect(() => {
    setCurrentPage(0);
  }, [statusFilter, stageFilter, sourceFilter, assignedAgentFilter, campaignFilter, leadTypeFilter, searchQuery, lastInboundSort, lastContactedSort]);

  useEffect(() => {
    if (clientId) {
      fetchLeads();
      fetchStatusCounts();
      fetchAgents();
      fetchCampaigns();
    }
  }, [clientId, statusFilter, stageFilter, sourceFilter, assignedAgentFilter, campaignFilter, qualityFilter, leadTypeFilter, scoreSort, searchQuery, lastInboundSort, lastContactedSort, currentPage]);
  
  const { profile: userProfile } = useUserProfile();

  const fetchClientId = async () => {
    if (userProfile?.client_id) {
      setClientId(userProfile.client_id);
    }
  };
  
  const fetchLeads = async () => {
    setLoading(true);
    setError("");
    
    try {
      const supabase = createClient();
      const sortBy = lastInboundSort
        ? "last_inbound_at"
        : lastContactedSort
        ? "last_contacted_at"
        : "created_at";
      const sortDir = lastInboundSort || lastContactedSort || "desc";

      const { data, error: rpcError } = await supabase.rpc("get_leads_with_details", {
        p_client_id: clientId,
        p_limit: 51,
        p_offset: currentPage * 50,
        p_status: statusFilter === "All" ? null : statusFilter,
        p_stage: stageFilter === "All" ? null : stageFilter,
        p_source: sourceFilter === "All" ? null : sourceFilter,
        p_assigned_user_id: assignedAgentFilter === "All" ? null : assignedAgentFilter,
        p_campaign_id: campaignFilter === "All" ? null : (campaignFilter === "No Campaign" ? "00000000-0000-0000-0000-000000000000" : campaignFilter),
        p_quality: qualityFilter === "All" ? null : qualityFilter,
        p_lead_type: leadTypeFilter === "All" ? null : leadTypeFilter,
        p_search: searchQuery || null,
        p_sort_by: scoreSort ? "lead_score" : sortBy,
        p_sort_dir: scoreSort || sortDir,
      });

      if (rpcError) throw rpcError;
      const raw = data || [];
      setHasNextPage(raw.length > 50);
      setLeads(raw.slice(0, 50));
    } catch (err) {
      console.error("Error fetching leads:", err);
      setError("Failed to load leads. Please refresh.");
    } finally {
      setLoading(false);
    }
  };
  
  const fetchStatusCounts = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("leads")
        .select("status, source")
        .eq("client_id", clientId);
      
      if (data) {
        const counts: Record<string, number> = {};
        let baymo = 0;
        let manual = 0;
        
        data.forEach((lead) => {
          counts[lead.status] = (counts[lead.status] || 0) + 1;
          if (lead.source === "BaMo Marketplace") {
            baymo++;
          } else if (lead.source === "Manually Added") {
            manual++;
          }
        });
        
        setStatusCounts(counts);
        setBaymoCount(baymo);
        setManualCount(manual);
      }
    } catch (err) {
      console.error("Error fetching status counts:", err);
    }
  };
  
  const fetchAgents = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("client_id", clientId)
        .neq("role", "baymo_admin");
      
      setAgents(data || []);
    } catch (err) {
      console.error("Error fetching agents:", err);
    }
  };
  
  const fetchCampaigns = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("client_id", clientId);
      
      setCampaigns(data || []);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
    }
  };

  // Debounced text update
  const handleTextEdit = async (leadId: string, field: string, value: string, originalValue: string | null) => {
    if (value === (originalValue || "")) return;
    
    const supabase = createClient();
    
    // Optimistic update
    setLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? { ...lead, [field]: value } : lead))
    );
    
    await supabase.from("leads").update({ [field]: value }).eq("id", leadId);
  };
  
  const handleCampaignEdit = async (leadId: string, campaignId: string | null) => {
    // Optimistic UI update
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id !== leadId) return lead;
        const campaign = campaigns.find((c) => c.id === campaignId);
        return {
          ...lead,
          campaign_id: campaignId,
          campaign_name: campaign?.name || null,
        };
      })
    );

    await fetch(`/api/leads/${leadId}/campaign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: campaignId }),
    });
  };
  
  const handleInlineEdit = async (leadId: string, field: string, value: any) => {
    const supabase = createClient();
    
    // Optimistic update
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          const updated = { ...lead, [field]: value };
          
          // If changing assigned_user_id, update agent_name and agent_role
          if (field === "assigned_user_id") {
            const agent = agents.find((a) => a.id === value);
            updated.agent_name = agent?.full_name || null;
            updated.agent_role = agent?.role || null;
          }
          
          // If changing source manually, set source_override
          if (field === "source") {
            updated.source_override = true;
          }
          
          return updated;
        }
        return lead;
      })
    );
    
    // Update in database
    const updateData: any = { [field]: value };
    if (field === "source") {
      updateData.source_override = true;
    }
    
    await supabase.from("leads").update(updateData).eq("id", leadId);
  };
  
  const handleQuickAdd = async () => {
    if (!quickAddData.name || !quickAddData.phone) {
      alert("Name and Phone are required");
      return;
    }
    
    const supabase = createClient();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        client_id: clientId,
        name: quickAddData.name,
        phone: quickAddData.phone,
        source: quickAddData.source || "Manually Added",
        lead_temperature: quickAddData.lead_temperature || "Cold",
        assigned_user_id: quickAddData.assigned_user_id || null,
        status: "New",
      })
      .select()
      .single();
    
    if (error) {
      alert("Failed to create lead");
      return;
    }
    
    setShowQuickAdd(false);
    router.push(`/leads/${data.id}`);
  };
  
  const handleFullAdd = async () => {
    if (!fullAddData.name || !fullAddData.phone) {
      alert("Name and Phone are required");
      return;
    }
    
    const supabase = createClient();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        client_id: clientId,
        name: fullAddData.name,
        phone: fullAddData.phone,
        email: fullAddData.email,
        company: fullAddData.company,
        lead_type: fullAddData.lead_type || null,
        status: fullAddData.status,
        lead_temperature: fullAddData.lead_temperature,
        source: fullAddData.source,
        assigned_user_id: fullAddData.assigned_user_id || null,
        campaign_id: fullAddData.campaign_id || null,
      })
      .select()
      .single();
    
    if (error) {
      alert("Failed to create lead");
      return;
    }

    await supabase.from("lead_qualifications").insert({
      lead_id: data.id,
      client_id: clientId,
      preferred_location: fullAddData.preferred_location ? [fullAddData.preferred_location] : null,
      property_type: fullAddData.property_type || null,
      bedrooms: fullAddData.bedrooms ? parseInt(fullAddData.bedrooms) : null,
      budget_min: fullAddData.budget_min ? parseFloat(fullAddData.budget_min) : null,
      budget_max: fullAddData.budget_max ? parseFloat(fullAddData.budget_max) : null,
    });

    // Create initial note if provided
    if (fullAddData.notes) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("lead_notes").insert({
        lead_id: data.id,
        client_id: clientId,
        content: fullAddData.notes,
        created_by: user?.id,
      });
    }
    
    setShowFullAdd(false);
    router.push(`/leads/${data.id}`);
  };
  
  const getStageStyle = (stage: string) => {
    const stageConfig = STAGE_OPTIONS.find((s) => s.value === stage);
    return stageConfig || { emoji: "", color: "bg-gray-100 text-gray-600" };
  };

  const getQualityStyle = (quality: string) => {
    switch (quality) {
      case "Ready":     return { color: "bg-green-100 text-green-800",   emoji: "⭐" };
      case "Qualified": return { color: "bg-blue-100 text-blue-800",     emoji: "✅" };
      case "Motivated": return { color: "bg-purple-100 text-purple-800", emoji: "💪" };
      case "Interested":return { color: "bg-yellow-100 text-yellow-800", emoji: "👀" };
      case "Browsing":  return { color: "bg-gray-100 text-gray-600",     emoji: "🔍" };
      case "Nurture":   return { color: "bg-orange-100 text-orange-800", emoji: "🌱" };
      default:          return { color: "bg-gray-100 text-gray-500",     emoji: "" };
    }
  };
  
  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      "New": "bg-blue-100 text-blue-800",
      "Active": "bg-green-100 text-green-800",
      "In Contact": "bg-purple-100 text-purple-800",
      "Inactive": "bg-gray-100 text-gray-600",
      "Closed": "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-600";
  };
  
  if (loading && leads.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Leads</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowQuickAdd(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Quick Add
            </Button>
            <Button onClick={() => setShowFullAdd(true)} className="bg-brand-orange hover:bg-brand-orange-dark">
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </div>
        </div>
        
        {/* Summary Bar */}
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-4">
            {STATUS_OPTIONS.map((status) => (
              <Card
                key={status}
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                  statusFilter === status ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setStatusFilter(statusFilter === status ? "All" : status)}
              >
                <div className="text-sm text-gray-600">{status}</div>
                <div className="text-2xl font-bold">{statusCounts[status] || 0}</div>
              </Card>
            ))}
          </div>
          
          <div className="flex gap-4">
            <Card className="p-3 flex-1">
              <div className="text-sm text-gray-600">BayMo Automation</div>
              <div className="text-xl font-semibold">{baymoCount}</div>
            </Card>
            <Card className="p-3 flex-1">
              <div className="text-sm text-gray-600">Manual</div>
              <div className="text-xl font-semibold">{manualCount}</div>
            </Card>
          </div>
        </div>
        
        {/* Filter Row */}
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={statusFilter === "All" ? "default" : "outline"}
              onClick={() => setStatusFilter("All")}
              size="sm"
            >
              All
            </Button>
            {STATUS_OPTIONS.map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                onClick={() => setStatusFilter(status)}
                size="sm"
              >
                {status}
              </Button>
            ))}
          </div>
          
          <div className="flex gap-4 flex-wrap items-center">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Stages</SelectItem>
                <SelectItem value="Hot">🔥 Hot</SelectItem>
                <SelectItem value="Warm">🟠 Warm</SelectItem>
                <SelectItem value="Cold">❄️ Cold</SelectItem>
                <SelectItem value="Unqualified">Unqualified</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Sources</SelectItem>
                <SelectItem value="FB Messenger">FB Messenger</SelectItem>
                <SelectItem value="Viber">Viber</SelectItem>
                <SelectItem value="BaMo Marketplace">BaMo Marketplace</SelectItem>
                <SelectItem value="Website Chat">Website Chat</SelectItem>
                <SelectItem value="Web Form">Web Form</SelectItem>
                <SelectItem value="Quick Form">Quick Form</SelectItem>
                <SelectItem value="Manually Added">Manually Added</SelectItem>
                <SelectItem value="Referral">Referral</SelectItem>
                <SelectItem value="Phone Call">Phone Call</SelectItem>
                <SelectItem value="Event / Open House">Event / Open House</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={assignedAgentFilter} onValueChange={setAssignedAgentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Agents</SelectItem>
                {(agents || []).filter(agent => agent.id && agent.full_name).map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Campaigns</SelectItem>
                <SelectItem value="No Campaign">No Campaign</SelectItem>
                {(campaigns || []).filter(campaign => campaign.id && campaign.name).map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={lastInboundSort || "default"}
              onValueChange={(val) => {
                setLastInboundSort(val === "default" ? "" : val);
                setLastContactedSort("");
                setScoreSort("");
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Last Inbound" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Last Inbound</SelectItem>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={lastContactedSort || "default"}
              onValueChange={(val) => {
                setLastContactedSort(val === "default" ? "" : val);
                setLastInboundSort("");
                setScoreSort("");
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Last Contacted" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Last Contacted</SelectItem>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>

            <Select value={qualityFilter} onValueChange={setQualityFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Quality</SelectItem>
                {["Browsing","Interested","Motivated","Qualified","Ready","Nurture"].map(q => (
                  <SelectItem key={q} value={q}>{getQualityStyle(q).emoji} {q}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={leadTypeFilter} onValueChange={setLeadTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Lead Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Types</SelectItem>
                {LEAD_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={scoreSort || "default"} onValueChange={(val) => { setScoreSort(val === "default" ? "" : val); setLastInboundSort(""); setLastContactedSort(""); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Sort by Score</SelectItem>
                <SelectItem value="asc">Score: Low → High</SelectItem>
                <SelectItem value="desc">Score: High → Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search name, phone, email, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
        
        {/* Leads Table */}
        {error ? (
          <div className="text-center py-12 text-red-600">{error}</div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No leads found</p>
            <Button onClick={() => setShowFullAdd(true)} className="bg-brand-orange hover:bg-brand-orange-dark">
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Message</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Task</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => {
                          sessionStorage.setItem("bamo_lead_nav", JSON.stringify(leads.map(l => l.id)));
                          setSelectedLeadId(lead.id);
                        }}
                        className="text-primary hover:text-brand-orange hover:underline font-medium"
                      >
                        {lead.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <InlineEditableText 
                        value={lead.phone || ""} 
                        onSave={(val) => handleTextEdit(lead.id, "phone", val, lead.phone)} 
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <InlineEditableText 
                        value={lead.email || ""} 
                        onSave={(val) => handleTextEdit(lead.id, "email", val, lead.email)} 
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <InlineEditableText 
                        value={lead.company || ""} 
                        onSave={(val) => handleTextEdit(lead.id, "company", val, lead.company)} 
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Select
                        value={lead.status}
                        onValueChange={(value) => handleInlineEdit(lead.id, "status", value)}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusStyle(lead.status)}`}>
                            {lead.status}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Select
                        value={lead.lead_temperature || ""}
                        onValueChange={(value) => handleInlineEdit(lead.id, "lead_temperature", value)}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStageStyle(lead.lead_temperature).color}`}>
                            {getStageStyle(lead.lead_temperature).emoji} {lead.lead_temperature || "—"}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {STAGE_OPTIONS.map((stage) => (
                            <SelectItem key={stage.value} value={stage.value}>
                              {stage.emoji} {stage.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-col gap-1 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getQualityStyle(lead.lead_quality).color}`}>
                          {getQualityStyle(lead.lead_quality).emoji} {lead.lead_quality || "—"}
                        </span>
                        {lead.lead_score > 0 && (
                          <span className="text-xs text-gray-400 font-mono">Score: {lead.lead_score}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Select
                        value={lead.source || ""}
                        onValueChange={(value) => handleInlineEdit(lead.id, "source", value)}
                      >
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Select
                        value={lead.lead_type || ""}
                        onValueChange={(value) => handleInlineEdit(lead.id, "lead_type", value)}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_TYPE_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Select
                        value={lead.assigned_user_id || "none"}
                        onValueChange={(value) => handleInlineEdit(lead.id, "assigned_user_id", value === "none" ? null : value)}
                      >
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {(agents || []).filter(agent => agent.id && agent.full_name).map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{lead.agent_role || "—"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Select
                        value={lead.campaign_id || "none"}
                        onValueChange={(value) => handleCampaignEdit(lead.id, value === "none" ? null : value)}
                      >
                        <SelectTrigger className="h-8 w-full text-xs border-gray-200">
                          <SelectValue placeholder="No Campaign" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Campaign</SelectItem>
                          {campaigns.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {lead.last_message || "No messages"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {lead.next_task_title || "No pending tasks"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination bar */}
            <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50/50">
              <span className="text-sm text-gray-500">
                Page {currentPage + 1}{hasNextPage ? "" : ` · ${leads.length} lead${leads.length !== 1 ? "s" : ""}`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p - 1)}
                  disabled={currentPage === 0}
                  className="text-primary border-primary hover:bg-primary/10 disabled:opacity-40"
                >
                  ← Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={!hasNextPage}
                  className="text-primary border-primary hover:bg-primary/10 disabled:opacity-40"
                >
                  Next →
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Modal */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Add Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={quickAddData.name}
                onChange={(e) => setQuickAddData({ ...quickAddData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                value={quickAddData.phone}
                onChange={(e) => setQuickAddData({ ...quickAddData, phone: e.target.value })}
                placeholder="+63 912 345 6789"
              />
            </div>
            <div>
              <Label>Source</Label>
              <Select
                value={quickAddData.source}
                onValueChange={(val) => setQuickAddData({ ...quickAddData, source: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FB Messenger">FB Messenger</SelectItem>
                  <SelectItem value="Viber">Viber</SelectItem>
                  <SelectItem value="BaMo Marketplace">BaMo Marketplace</SelectItem>
                  <SelectItem value="Website Chat">Website Chat</SelectItem>
                  <SelectItem value="Web Form">Web Form</SelectItem>
                  <SelectItem value="Quick Form">Quick Form</SelectItem>
                  <SelectItem value="Manually Added">Manually Added</SelectItem>
                  <SelectItem value="Referral">Referral</SelectItem>
                  <SelectItem value="Phone Call">Phone Call</SelectItem>
                  <SelectItem value="Event / Open House">Event / Open House</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stage</Label>
              <Select
                value={quickAddData.lead_temperature}
                onValueChange={(val) => setQuickAddData({ ...quickAddData, lead_temperature: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hot">🔥 Hot</SelectItem>
                  <SelectItem value="Warm">🟠 Warm</SelectItem>
                  <SelectItem value="Cold">❄️ Cold</SelectItem>
                  <SelectItem value="Unqualified">Unqualified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned Agent</Label>
              <Select
                value={quickAddData.assigned_user_id}
                onValueChange={(val) => setQuickAddData({ ...quickAddData, assigned_user_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {(agents || []).filter(agent => agent.id && agent.full_name).map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickAdd(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleQuickAdd}
              disabled={!quickAddData.name || !quickAddData.phone}
              className="bg-brand-orange hover:bg-brand-orange-dark"
            >
              Save & Open Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Full Add Modal */}
      <Dialog open={showFullAdd} onOpenChange={setShowFullAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Identity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={fullAddData.name}
                    onChange={(e) => setFullAddData({ ...fullAddData, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input
                    value={fullAddData.phone}
                    onChange={(e) => setFullAddData({ ...fullAddData, phone: e.target.value })}
                    placeholder="+63 912 345 6789"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={fullAddData.email}
                    onChange={(e) => setFullAddData({ ...fullAddData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label>Company</Label>
                  <Input
                    value={fullAddData.company}
                    onChange={(e) => setFullAddData({ ...fullAddData, company: e.target.value })}
                    placeholder="Acme Corp"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Classification</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Lead Type</Label>
                  <Select
                    value={fullAddData.lead_type}
                    onValueChange={(value) => setFullAddData({ ...fullAddData, lead_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={fullAddData.status}
                    onValueChange={(value) => setFullAddData({ ...fullAddData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Stage</Label>
                  <Select
                    value={fullAddData.lead_temperature}
                    onValueChange={(value) => setFullAddData({ ...fullAddData, lead_temperature: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_OPTIONS.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.emoji} {stage.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Source</Label>
                  <Select
                    value={fullAddData.source}
                    onValueChange={(value) => setFullAddData({ ...fullAddData, source: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Preferences</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preferred Location</Label>
                  <Input
                    value={fullAddData.preferred_location}
                    onChange={(e) => setFullAddData({ ...fullAddData, preferred_location: e.target.value })}
                    placeholder="Downtown, BGC, etc."
                  />
                </div>
                <div>
                  <Label>Property Type</Label>
                  <Input
                    value={fullAddData.property_type}
                    onChange={(e) => setFullAddData({ ...fullAddData, property_type: e.target.value })}
                    placeholder="Condo, House, Lot"
                  />
                </div>
                <div>
                  <Label>Bedrooms</Label>
                  <Input
                    type="number"
                    value={fullAddData.bedrooms}
                    onChange={(e) => setFullAddData({ ...fullAddData, bedrooms: e.target.value })}
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label>Budget Min</Label>
                  <Input
                    type="number"
                    value={fullAddData.budget_min}
                    onChange={(e) => setFullAddData({ ...fullAddData, budget_min: e.target.value })}
                    placeholder="500000"
                  />
                </div>
                <div>
                  <Label>Budget Max</Label>
                  <Input
                    type="number"
                    value={fullAddData.budget_max}
                    onChange={(e) => setFullAddData({ ...fullAddData, budget_max: e.target.value })}
                    placeholder="1000000"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Assignment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Assigned Agent</Label>
                  <Select
                    value={fullAddData.assigned_user_id || "none"}
                    onValueChange={(value) => setFullAddData({ ...fullAddData, assigned_user_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {(agents || []).filter(agent => agent.id && agent.full_name).map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Campaign</Label>
                  <Select
                    value={fullAddData.campaign_id || "none"}
                    onValueChange={(value) => setFullAddData({ ...fullAddData, campaign_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Campaign</SelectItem>
                      {(campaigns || []).filter(campaign => campaign.id && campaign.name).map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Notes</h3>
              <Textarea
                value={fullAddData.notes}
                onChange={(e) => setFullAddData({ ...fullAddData, notes: e.target.value })}
                placeholder="Add initial notes..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFullAdd(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFullAdd}
              disabled={!fullAddData.name || !fullAddData.phone}
              className="bg-brand-orange hover:bg-brand-orange-dark"
            >
              Save & Open Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedLeadId && (
        <LeadSlideOver
          leadId={selectedLeadId}
          isOpen={!!selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdate={fetchLeads}
        />
      )}
    </DashboardLayout>
  );
}

// Inline Editable Text Component
function InlineEditableText({ 
  value, 
  onSave, 
  placeholder 
}: { 
  value: string; 
  onSave: (val: string) => void;
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    onSave(editValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-7 py-1 px-2 text-sm w-32"
      />
    );
  }

  return (
    <div 
      onClick={() => setIsEditing(true)} 
      className="cursor-text hover:bg-gray-100 px-2 py-1 -mx-2 rounded border border-transparent hover:border-gray-200 min-w-[3rem] min-h-[1.75rem] flex items-center"
      title="Click to edit"
    >
      {value || placeholder || ""}
    </div>
  );
}

// Inline Dropdown Component
function InlineDropdown({
  value,
  options,
  onSelect,
  placeholder,
  className,
}: {
  value: string | null;
  options: Array<{ value: string; label: string }>;
  onSelect: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Select
      value={value || undefined}
      onValueChange={(val) => {
        onSelect(val);
        setIsOpen(false);
      }}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <SelectTrigger
        className={cn(
          "h-7 px-2 text-sm border-transparent hover:border-gray-200 bg-transparent hover:bg-gray-50",
          className
        )}
      >
        <SelectValue placeholder={placeholder || "Select..."} />
      </SelectTrigger>
      <SelectContent>
        {options.filter(opt => opt.value && opt.value.trim() !== "").map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}