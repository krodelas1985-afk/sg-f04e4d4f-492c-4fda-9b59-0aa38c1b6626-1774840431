import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { DashboardLayout } from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { 
  ArrowLeft, MessageSquare, Activity, CheckSquare, Home, 
  Paperclip, Sparkles, UserPlus, Bot, FileText, StickyNote,
  X, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";

export default function LeadDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const leadId = id as string;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Tabs state for right panel
  const [activeTab, setActiveTab] = useState("messages");
  
  // Messages state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  
  // Activity state
  const [activity, setActivity] = useState<any[]>([]);
  
  // Tasks state
  const [tasks, setTasks] = useState<any[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", task_type: "follow_up", due_date: "", notes: "" });
  
  // Agents and campaigns for dropdowns
  const [agents, setAgents] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    if (leadId) {
      fetchLead();
      fetchAgents();
      fetchCampaigns();
    }
  }, [leadId]);

  useEffect(() => {
    if (activeTab === "messages" && leadId) {
      fetchMessages();
    } else if (activeTab === "activity" && leadId) {
      fetchActivity();
    } else if (activeTab === "tasks" && leadId) {
      fetchTasks();
    }
  }, [activeTab, leadId]);

  const fetchLead = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("leads")
        .select("*, profiles!leads_assigned_user_id_fkey(full_name, role), campaigns(name)")
        .eq("id", leadId)
        .single();
      
      setLead(data);
    } catch (err) {
      console.error("Error fetching lead:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("client_id")
        .eq("id", session.session.user.id)
        .single();

      if (!profile?.client_id) return;

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("client_id", profile.client_id)
        .neq("role", "baymo_admin");
      
      setAgents(data || []);
    } catch (err) {
      console.error("Error fetching agents:", err);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("client_id")
        .eq("id", session.session.user.id)
        .single();

      if (!profile?.client_id) return;

      const { data } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("client_id", profile.client_id);
      
      setCampaigns(data || []);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
    }
  };

  const fetchMessages = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      
      setMessages(data || []);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const fetchActivity = async () => {
    try {
      const supabase = createClient();
      const { data: convos } = await supabase.from("conversations").select("*").eq("lead_id", leadId);
      const { data: taskData } = await supabase.from("tasks").select("*").eq("lead_id", leadId);
      
      const combined = [
        ...(convos || []).map(c => ({ type: "message", data: c, created_at: c.created_at })),
        ...(taskData || []).map(t => ({ type: "task", data: t, created_at: t.created_at })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setActivity(combined);
    } catch (err) {
      console.error("Error fetching activity:", err);
    }
  };

  const fetchTasks = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("lead_id", leadId)
        .order("due_date", { ascending: true });
      
      setTasks(data || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  };

  const handleFieldUpdate = async (field: string, value: any) => {
    try {
      const supabase = createClient();
      await supabase.from("leads").update({ [field]: value }).eq("id", leadId);
      setLead((prev: any) => ({ ...prev, [field]: value }));
    } catch (err) {
      console.error("Error updating field:", err);
    }
  };

  const handleAutomationToggle = async (enabled: boolean) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/automation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automation_enabled: enabled }),
      });
      if (response.ok) {
        setLead((prev: any) => ({ ...prev, automation_enabled: enabled }));
      }
    } catch (err) {
      console.error('Error updating automation:', err);
    }
  };

  const handleMetadataUpdate = async (field: string, value: any) => {
    try {
      const supabase = createClient();
      const updatedMetadata = { ...(lead?.metadata || {}), [field]: value };
      await supabase.from("leads").update({ metadata: updatedMetadata }).eq("id", leadId);
      setLead((prev: any) => ({ ...prev, metadata: updatedMetadata }));
    } catch (err) {
      console.error("Error updating metadata:", err);
    }
  };

  const handleCampaignUpdate = async (campaignId: string | null) => {
    try {
      const supabase = createClient();
      await supabase.from("leads").update({ campaign_id: campaignId }).eq("id", leadId);
      setLead((prev: any) => ({ ...prev, campaign_id: campaignId }));
    } catch (err) {
      console.error("Error updating campaign:", err);
    }
  };

  const handleAISuggest = async () => {
    setAiSuggesting(true);
    setTimeout(() => {
      setNewMessage("Hi there! I saw you were interested in our properties. Let me know if you have any questions.");
      setAiSuggesting(false);
    }, 1000);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const supabase = createClient();
      await supabase.from("conversations").insert({
        lead_id: leadId,
        message_content: newMessage,
        direction: "outbound",
        sender: "agent",
        channel: lead?.primary_channel || "email"
      });
      setNewMessage("");
      fetchMessages();
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !newTask.due_date) return;
    try {
      const supabase = createClient();
      await supabase.from("tasks").insert({
        lead_id: leadId,
        title: newTask.title,
        task_type: newTask.task_type,
        due_date: newTask.due_date,
        notes: newTask.notes,
        status: "pending"
      });
      setShowTaskForm(false);
      setNewTask({ title: "", task_type: "follow_up", due_date: "", notes: "" });
      fetchTasks();
    } catch (err) {
      console.error("Error creating task:", err);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const supabase = createClient();
      await supabase.from("tasks").update({ 
        status: "completed", 
        completed_at: new Date().toISOString() 
      }).eq("id", taskId);
      fetchTasks();
    } catch (err) {
      console.error("Error completing task:", err);
    }
  };

  const getStageStyle = (stage: string) => {
    switch (stage) {
      case "Hot": return "bg-red-100 text-red-800";
      case "Warm": return "bg-amber-100 text-amber-800";
      case "Cold": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "New": return "bg-blue-100 text-blue-800";
      case "Active": return "bg-green-100 text-green-800";
      case "In Contact": return "bg-purple-100 text-purple-800";
      case "Inactive": return "bg-gray-100 text-gray-600";
      case "Closed": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="text-[#1B3A5C]">Loading profile...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <Link href="/leads">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Leads
            </Button>
          </Link>
          <div className="text-center py-12 text-gray-500">Lead not found.</div>
        </div>
      </DashboardLayout>
    );
  }

  const pending = tasks.filter(t => t.status !== "completed" && new Date(t.due_date) <= new Date());
  const upcoming = tasks.filter(t => t.status !== "completed" && new Date(t.due_date) > new Date());
  const completed = tasks.filter(t => t.status === "completed");

  const automationMode = lead?.automation_enabled !== false ? "baymo" : "manual";

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-12">
        <Link href="/leads">
          <Button variant="ghost" className="mb-4 -ml-4 text-[#1B3A5C] hover:text-[#E87722]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leads
          </Button>
        </Link>

        {/* Page Header */}
        <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-[#1B3A5C]">{lead.name}</h1>
                <Badge className={getStageStyle(lead.lead_temperature || "")}>
                  {lead.lead_temperature === "Hot" && "🔥 "} {lead.lead_temperature || "Unqualified"}
                </Badge>
                <Badge className={getStatusStyle(lead.status || "")}>
                  {lead.status || "New"}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <span className="font-medium text-gray-900">Phone:</span> {lead.phone || "—"}
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-medium text-gray-900">Source:</span> {lead.source || "—"}
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-medium text-gray-900">Agent:</span> 
                  {lead.profiles?.full_name || "Unassigned"} 
                  {lead.profiles?.role && <span className="text-gray-400">({lead.profiles.role})</span>}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="text-[#1B3A5C] border-[#1B3A5C] hover:bg-[#1B3A5C]/10"
                onClick={() => handleAutomationToggle(automationMode !== "baymo")}
              >
                <Bot className="w-4 h-4 mr-2" />
                {automationMode === "baymo" ? "Disable Automation" : "Enable Automation"}
              </Button>
              
              <Select 
                value={lead.assigned_user_id || "none"} 
                onValueChange={(val) => handleFieldUpdate("assigned_user_id", val === "none" ? null : val)}
              >
                <SelectTrigger className="w-[160px] text-[#1B3A5C] border-[#1B3A5C]">
                  <UserPlus className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Assign Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {agents.filter(a => a.id && a.full_name).map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button variant="outline" disabled className="text-gray-400">
                        <FileText className="w-4 h-4 mr-2" />
                        Document
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Coming soon</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button className="bg-[#E87722] hover:bg-[#d66a1e] text-white">
                <StickyNote className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Lead Score</p>
              <p className="text-lg font-medium text-[#1B3A5C]">{lead.lead_score || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Last Contact</p>
              <p className="text-lg font-medium text-[#1B3A5C]">
                {lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString() : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Next Action</p>
              <p className="text-lg font-medium text-[#1B3A5C]">
                {lead.next_follow_up_date ? new Date(lead.next_follow_up_date).toLocaleDateString() : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Campaign</p>
              <Select
                value={lead.campaign_id || "none"}
                onValueChange={(val) => handleCampaignUpdate(val === "none" ? null : val)}
              >
                <SelectTrigger className="h-8 text-sm border-0 p-0 shadow-none font-medium text-[#1B3A5C] focus:ring-0">
                  <SelectValue placeholder="No Campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Campaign</SelectItem>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel (40%) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* BayMo Insights */}
            <div className="bg-white rounded-lg border shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[#1B3A5C] mb-4 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-[#E87722]" />
                BayMo Insights
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-xs text-gray-500 mb-1">Intent</p>
                    <p className="font-medium">{lead.metadata?.intent || "Unknown"}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-xs text-gray-500 mb-1">Interest Level</p>
                    <p className="font-medium">{lead.metadata?.interest_level || "Unknown"}</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md border flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#1B3A5C]">Automation Mode</p>
                    <p className="text-sm text-gray-500">Let BaMo handle initial responses</p>
                  </div>
                  <div className="flex bg-white rounded-lg border p-1">
                    <Switch
                      checked={automationMode === "baymo"}
                      onCheckedChange={handleAutomationToggle}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Editable Lead Info */}
            <div className="bg-white rounded-lg border shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[#1B3A5C] mb-4">Lead Information</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Name</Label>
                    <Input 
                      value={lead.name || ""} 
                      onChange={(e) => setLead({ ...lead, name: e.target.value })}
                      onBlur={() => handleFieldUpdate("name", lead.name)}
                      className="h-8 text-sm focus-visible:ring-[#E87722]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Company</Label>
                    <Input 
                      value={lead.company || ""} 
                      onChange={(e) => setLead({ ...lead, company: e.target.value })}
                      onBlur={() => handleFieldUpdate("company", lead.company)}
                      className="h-8 text-sm focus-visible:ring-[#E87722]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Phone</Label>
                    <Input 
                      value={lead.phone || ""} 
                      onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                      onBlur={() => handleFieldUpdate("phone", lead.phone)}
                      className="h-8 text-sm focus-visible:ring-[#E87722]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Email</Label>
                    <Input 
                      value={lead.email || ""} 
                      onChange={(e) => setLead({ ...lead, email: e.target.value })}
                      onBlur={() => handleFieldUpdate("email", lead.email)}
                      className="h-8 text-sm focus-visible:ring-[#E87722]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Status</Label>
                    <Select value={lead.status || ""} onValueChange={(val) => handleFieldUpdate("status", val)}>
                      <SelectTrigger className="h-8 text-sm focus:ring-[#E87722]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="In Contact">In Contact</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Stage</Label>
                    <Select value={lead.lead_temperature || ""} onValueChange={(val) => handleFieldUpdate("lead_temperature", val)}>
                      <SelectTrigger className="h-8 text-sm focus:ring-[#E87722]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Hot">🔥 Hot</SelectItem>
                        <SelectItem value="Warm">🟠 Warm</SelectItem>
                        <SelectItem value="Cold">❄️ Cold</SelectItem>
                        <SelectItem value="Unqualified">Unqualified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Source</Label>
                    <Select value={lead.source || ""} onValueChange={(val) => handleFieldUpdate("source", val)}>
                      <SelectTrigger className="h-8 text-sm focus:ring-[#E87722]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Facebook Ads">Facebook Ads</SelectItem>
                        <SelectItem value="Referral">Referral</SelectItem>
                        <SelectItem value="Walk-in">Walk-in</SelectItem>
                        <SelectItem value="BaMo Website">BaMo Website</SelectItem>
                        <SelectItem value="OFW Network">OFW Network</SelectItem>
                        <SelectItem value="PAREB">PAREB</SelectItem>
                        <SelectItem value="Developer Partner">Developer Partner</SelectItem>
                        <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Primary Channel</Label>
                    <Select value={lead.primary_channel || "none"} onValueChange={(val) => handleFieldUpdate("primary_channel", val === "none" ? null : val)}>
                      <SelectTrigger className="h-8 text-sm focus:ring-[#E87722]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not Set</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="messenger">Messenger</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Preferences</h4>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-xs text-gray-500">Budget Min</Label>
                      <Input 
                        type="number" 
                        value={lead.budget_min || ""} 
                        onChange={(e) => setLead({ ...lead, budget_min: parseInt(e.target.value) || null })}
                        onBlur={() => handleFieldUpdate("budget_min", lead.budget_min)}
                        className="h-8 text-sm focus-visible:ring-[#E87722]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Budget Max</Label>
                      <Input 
                        type="number" 
                        value={lead.budget_max || ""} 
                        onChange={(e) => setLead({ ...lead, budget_max: parseInt(e.target.value) || null })}
                        onBlur={() => handleFieldUpdate("budget_max", lead.budget_max)}
                        className="h-8 text-sm focus-visible:ring-[#E87722]"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-gray-500">Preferred Location</Label>
                      <Input 
                        value={lead.preferred_location || ""} 
                        onChange={(e) => setLead({ ...lead, preferred_location: e.target.value })}
                        onBlur={() => handleFieldUpdate("preferred_location", lead.preferred_location)}
                        className="h-8 text-sm focus-visible:ring-[#E87722]"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">Property Type</Label>
                        <Input 
                          value={lead.property_type || ""} 
                          onChange={(e) => setLead({ ...lead, property_type: e.target.value })}
                          onBlur={() => handleFieldUpdate("property_type", lead.property_type)}
                          className="h-8 text-sm focus-visible:ring-[#E87722]"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Bedrooms</Label>
                        <Input 
                          type="number" 
                          value={lead.bedrooms || ""} 
                          onChange={(e) => setLead({ ...lead, bedrooms: parseInt(e.target.value) || null })}
                          onBlur={() => handleFieldUpdate("bedrooms", lead.bedrooms)}
                          className="h-8 text-sm focus-visible:ring-[#E87722]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Label className="text-xs text-gray-500 mb-2 block">Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(lead.tags || []).map((tag: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1 bg-[#1B3A5C]/10 text-[#1B3A5C]">
                        {tag}
                        <X 
                          className="w-3 h-3 cursor-pointer hover:text-red-500" 
                          onClick={() => {
                            const newTags = lead.tags.filter((_: string, i: number) => i !== idx);
                            handleFieldUpdate("tags", newTags);
                          }}
                        />
                      </Badge>
                    ))}
                  </div>
                  <Input 
                    placeholder="Press Enter to add tag..."
                    className="h-8 text-sm focus-visible:ring-[#E87722]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value) {
                        const val = e.currentTarget.value.trim();
                        if (val && !(lead.tags || []).includes(val)) {
                          handleFieldUpdate("tags", [...(lead.tags || []), val]);
                        }
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel (60%) */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-lg border shadow-sm h-full flex flex-col min-h-[600px]">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="w-full justify-start border-b rounded-none h-14 bg-gray-50/50 px-4">
                  <TabsTrigger value="messages" className="data-[state=active]:border-b-2 data-[state=active]:border-[#E87722] data-[state=active]:text-[#E87722] rounded-none px-4 bg-transparent data-[state=active]:bg-transparent shadow-none">
                    <MessageSquare className="h-4 w-4 mr-2" /> Messages
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="data-[state=active]:border-b-2 data-[state=active]:border-[#E87722] data-[state=active]:text-[#E87722] rounded-none px-4 bg-transparent data-[state=active]:bg-transparent shadow-none">
                    <Activity className="h-4 w-4 mr-2" /> Activity
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="data-[state=active]:border-b-2 data-[state=active]:border-[#E87722] data-[state=active]:text-[#E87722] rounded-none px-4 bg-transparent data-[state=active]:bg-transparent shadow-none">
                    <CheckSquare className="h-4 w-4 mr-2" /> Tasks
                  </TabsTrigger>
                  <TabsTrigger value="properties" className="data-[state=active]:border-b-2 data-[state=active]:border-[#E87722] data-[state=active]:text-[#E87722] rounded-none px-4 bg-transparent data-[state=active]:bg-transparent shadow-none">
                    <Home className="h-4 w-4 mr-2" /> Properties
                  </TabsTrigger>
                </TabsList>

                {/* Messages Tab */}
                <TabsContent value="messages" className="flex-1 flex flex-col p-0 m-0">
                  <div className="px-6 py-3 border-b bg-gray-50/50">
                    <p className="text-sm font-medium text-[#1B3A5C]">
                      Channel: <span className="font-normal text-gray-600 capitalize">{lead.primary_channel || "Email"}</span>
                    </p>
                  </div>
                  
                  <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[450px]">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">No messages yet.</div>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.direction === "outbound" ? "bg-[#1B3A5C] text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                            <div className="flex gap-2 items-center mb-1">
                              <span className="text-xs font-semibold opacity-90">{msg.sender === "system" ? "🤖 BaMo" : msg.sender === "agent" ? "👤 Agent" : "👤 Lead"}</span>
                              <Badge variant="outline" className={`text-[10px] h-4 ${msg.direction === "outbound" ? "border-white/20 text-white" : "border-gray-300 text-gray-500"}`}>{msg.channel}</Badge>
                            </div>
                            <p className="text-sm leading-relaxed">{msg.message_content}</p>
                            <p className="text-[10px] mt-2 opacity-60 text-right">
                              {new Date(msg.created_at).toLocaleString([], {hour: '2-digit', minute:'2-digit', month: 'short', day: 'numeric'})}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="p-4 border-t bg-gray-50/30">
                    <Textarea 
                      placeholder="Type your message..." 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      rows={3}
                      className="resize-none focus-visible:ring-[#E87722] mb-3"
                    />
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="text-gray-600">
                          <Paperclip className="h-4 w-4 mr-1" /> Attach
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-[#E87722] border-[#E87722]/30 bg-[#E87722]/5 hover:bg-[#E87722]/10 hover:text-[#E87722]"
                          onClick={handleAISuggest}
                          disabled={aiSuggesting}
                        >
                          {aiSuggesting ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-1" />
                          )}
                          AI Suggest
                        </Button>
                      </div>
                      <Button 
                        className="bg-[#E87722] hover:bg-[#d66a1e] text-white px-6" 
                        onClick={handleSendMessage}
                        disabled={sending || !newMessage.trim()}
                      >
                        {sending ? "Sending..." : "Send →"}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="p-6">
                  {/* Lead Intake Snapshot Card */}
                  {lead?.metadata?.estimate && (
                    <div className="rounded-xl border border-orange-100 bg-[#FFF3E8] overflow-hidden mb-6">
                      {/* Header */}
                      <div className="bg-[#1B3A5C] px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {lead?.metadata?.source?.includes('Sinag') ? '☀️' : '📋'}
                          </span>
                          <span className="text-white font-medium">
                            {lead?.metadata?.source || 'Lead Intake'}
                          </span>
                        </div>
                        {lead?.metadata?.submitted_at && (
                          <span className="text-white text-xs opacity-60">
                            {new Date(lead.metadata.submitted_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-4">
                        {/* Estimate Fields */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                          {Object.entries(lead.metadata.estimate)
                            .filter(([key]) => key !== 'financing')
                            .map(([key, value]) => {
                              const label = key
                                .split('_')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
                              
                              const hasMoneySymbol = typeof value === 'string' && value.includes('₱');
                              const isMoneyField = ['cost', 'savings', 'total'].some(term => 
                                key.toLowerCase().includes(term)
                              );
                              const shouldHighlight = hasMoneySymbol || isMoneyField;
                              const displayValue = value ?? '—';

                              return (
                                <div key={key} className="text-sm">
                                  <div className="text-gray-500 mb-1">{label}</div>
                                  <div className={`font-medium ${shouldHighlight ? 'text-[#E87722]' : 'text-gray-900'}`}>
                                    {String(displayValue)}
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        {/* Financing Options */}
                        {lead?.metadata?.estimate?.financing && (
                          <>
                            <div className="border-t border-gray-200 my-4" />
                            <div className="text-sm">
                              <div className="text-gray-500 mb-2">Financing Options</div>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(lead.metadata.estimate.financing).map(([key, value]) => (
                                  <span
                                    key={key}
                                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                                  >
                                    {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}: {String(value ?? '—')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Preferences */}
                        {lead?.metadata?.preferences && (
                          <>
                            <div className="border-t border-gray-200 my-4" />
                            <div className="text-sm font-medium text-gray-700 mb-3">Preferences</div>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                              {Object.entries(lead.metadata.preferences).map(([key, value]) => {
                                const label = key
                                  .split('_')
                                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                  .join(' ');
                                const displayValue = value ?? '—';

                                return (
                                  <div key={key} className="text-sm">
                                    <div className="text-gray-500 mb-1">{label}</div>
                                    <div className="font-medium text-gray-900">{String(displayValue)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="relative border-l border-gray-200 pl-8 space-y-6">
                    {activity.length === 0 ? (
                      <p className="text-gray-500 pl-4">No activity recorded yet.</p>
                    ) : (
                      activity.map((item, idx) => (
                        <div key={idx} className="relative pl-6">
                          <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-[#1B3A5C] ring-4 ring-white" />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-gray-500 mb-1">
                              {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <div className="bg-gray-50 p-3 rounded-md border text-sm text-gray-800">
                              {item.type === "message" ? (
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-gray-400" />
                                  <span>
                                    <span className="font-medium">{item.data.direction === "outbound" ? (item.data.sender === "system" ? "BaMo" : "Agent") : "Lead"}</span> 
                                    {" sent a "} 
                                    <span className="font-medium capitalize">{item.data.channel}</span>
                                    {" message"}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <CheckSquare className="h-4 w-4 text-gray-400" />
                                  <span>Task <span className="font-medium">"{item.data.title}"</span> was {item.data.status === "completed" ? "completed" : "created"}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="p-6 m-0 overflow-y-auto max-h-[600px]">
                  <div className="space-y-8">
                    {/* Pending Section */}
                    <div>
                      <div className="flex justify-between items-center mb-4 pb-2 border-b">
                        <h3 className="font-semibold text-[#1B3A5C] flex items-center gap-2">
                          <span className="bg-red-100 text-red-700 py-0.5 px-2 rounded-full text-xs">{pending.length}</span>
                          PENDING
                        </h3>
                        <Button size="sm" className="bg-[#E87722] hover:bg-[#d66a1e]" onClick={() => setShowTaskForm(!showTaskForm)}>
                          + Create Task
                        </Button>
                      </div>
                      
                      {showTaskForm && (
                        <div className="mb-6 p-4 bg-gray-50 border rounded-lg space-y-4">
                          <div>
                            <Label className="text-xs">Task Title</Label>
                            <Input placeholder="E.g. Follow up on property viewing" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} className="bg-white" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs">Task Type</Label>
                              <Select value={newTask.task_type} onValueChange={(val) => setNewTask({ ...newTask, task_type: val })}>
                                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="follow_up">Follow Up</SelectItem>
                                  <SelectItem value="call">Call</SelectItem>
                                  <SelectItem value="meeting">Meeting</SelectItem>
                                  <SelectItem value="email">Email</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Due Date</Label>
                              <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} className="bg-white" />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Notes (Optional)</Label>
                            <Textarea placeholder="Additional details..." value={newTask.notes} onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })} className="bg-white resize-none" rows={2} />
                          </div>
                          <div className="flex gap-2 justify-end pt-2">
                            <Button variant="outline" size="sm" onClick={() => setShowTaskForm(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleCreateTask} className="bg-[#1B3A5C] hover:bg-[#122842] text-white">Save Task</Button>
                          </div>
                        </div>
                      )}
                      
                      {pending.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No pending tasks.</p>
                      ) : (
                        <div className="space-y-3">
                          {pending.map(task => (
                            <div key={task.id} className="p-4 border border-red-100 bg-white rounded-lg flex justify-between items-start shadow-sm">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-gray-900">{task.title}</p>
                                  {task.source === "BaMo" && <Badge variant="secondary" className="text-[10px] h-4 bg-blue-50 text-blue-700">🤖 BaMo</Badge>}
                                </div>
                                <p className="text-xs font-medium text-red-600 flex items-center gap-1">
                                  Due: {new Date(task.due_date).toLocaleDateString()}
                                </p>
                                {task.notes && <p className="text-sm text-gray-600 mt-2">{task.notes}</p>}
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button size="sm" onClick={() => handleCompleteTask(task.id)} className="bg-[#1D9E75] hover:bg-[#178263] h-8 text-xs">
                                  <CheckSquare className="w-3 h-3 mr-1" /> Complete
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs text-gray-600">Reschedule</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Upcoming Section */}
                    <div>
                      <div className="flex items-center mb-4 pb-2 border-b">
                        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                          <span className="bg-gray-100 text-gray-700 py-0.5 px-2 rounded-full text-xs">{upcoming.length}</span>
                          UPCOMING
                        </h3>
                      </div>
                      {upcoming.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No upcoming tasks.</p>
                      ) : (
                        <div className="space-y-3">
                          {upcoming.map(task => (
                            <div key={task.id} className="p-4 border bg-white rounded-lg flex justify-between items-start shadow-sm">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-gray-900">{task.title}</p>
                                  {task.source === "BaMo" && <Badge variant="secondary" className="text-[10px] h-4 bg-blue-50 text-blue-700">🤖 BaMo</Badge>}
                                </div>
                                <p className="text-xs text-gray-500">
                                  Due: {new Date(task.due_date).toLocaleDateString()}
                                </p>
                              </div>
                              <Button size="sm" onClick={() => handleCompleteTask(task.id)} variant="outline" className="h-8 text-xs text-gray-600">Complete</Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Completed Section */}
                    <div>
                      <div className="flex items-center mb-4 pb-2 border-b">
                        <h3 className="font-semibold text-gray-400 flex items-center gap-2">
                          <span className="bg-gray-100 text-gray-500 py-0.5 px-2 rounded-full text-xs">{completed.length}</span>
                          COMPLETED
                        </h3>
                      </div>
                      {completed.length > 0 && (
                        <div className="space-y-2 opacity-60">
                          {completed.slice(0, 5).map(task => (
                            <div key={task.id} className="p-3 border border-gray-100 bg-gray-50 rounded-lg flex justify-between items-center">
                              <p className="font-medium text-gray-500 line-through text-sm">{task.title}</p>
                              <p className="text-xs text-gray-400">Done: {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : "—"}</p>
                            </div>
                          ))}
                          {completed.length > 5 && <p className="text-xs text-center text-gray-400 pt-2">+ {completed.length - 5} more</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Properties Tab */}
                <TabsContent value="properties" className="p-6 m-0">
                  <div className="h-full flex flex-col items-center justify-center text-center py-20 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                    <Home className="w-12 h-12 text-gray-300 mb-4" />
                    <h3 className="text-xl font-semibold text-[#1B3A5C] mb-2">Suggested Property Matches</h3>
                    <p className="text-gray-500 mb-6 max-w-sm">
                      Our intelligent property matching algorithm is coming in Phase 1B. It will automatically suggest listings based on lead preferences.
                    </p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Button disabled className="bg-gray-200 text-gray-400 cursor-not-allowed border-none">
                              + Match Property Manually
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Coming in Phase 1B</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}