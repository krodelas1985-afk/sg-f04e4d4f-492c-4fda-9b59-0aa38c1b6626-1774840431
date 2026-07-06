import { useState, useEffect } from "react";
import { X, MessageSquare, Activity, CheckSquare, Home, Paperclip, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/router";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { TemplatePicker, type PickableTemplate } from "@/components/TemplatePicker";
import { substituteTemplateVariables } from "@/lib/templateVariables";
import { senderLabel } from "@/lib/utils";

interface LeadSlideOverProps {
  leadId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function LeadSlideOver({ leadId, isOpen, onClose, onUpdate }: LeadSlideOverProps) {
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [leadQual, setLeadQual] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("info");
  
  // Messages state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  
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
    if (isOpen && leadId) {
      fetchLead();
      fetchLeadQualification();
      fetchAgents();
      fetchCampaigns();
    }
  }, [isOpen, leadId]);

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

  const { profile: userProfile } = useUserProfile();

  const fetchLeadQualification = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("lead_qualifications")
        .select("*")
        .eq("lead_id", leadId)
        .maybeSingle();
      setLeadQual(data);
    } catch (err) {
      console.error("Error fetching lead qualifications:", err);
    }
  };

  const fetchAgents = async () => {
    try {
      if (!userProfile?.client_id) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("client_id", userProfile.client_id)
        .neq("role", "baymo_admin");
      setAgents(data || []);
    } catch (err) {
      console.error("Error fetching agents:", err);
    }
  };

  const fetchCampaigns = async () => {
    try {
      if (!userProfile?.client_id) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("client_id", userProfile.client_id);
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
      
      // Combine conversations and tasks
      const { data: convos } = await supabase
        .from("conversations")
        .select("*")
        .eq("lead_id", leadId);
      
      const { data: taskData } = await supabase
        .from("tasks")
        .select("*")
        .eq("lead_id", leadId);
      
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

  const handleCampaignUpdate = async (campaignId: string | null) => {
    try {
      await fetch(`/api/leads/${leadId}/campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      setLead((prev: any) => ({ ...prev, campaign_id: campaignId }));
      onUpdate?.();
    } catch (err) {
      console.error("Error updating campaign:", err);
    }
  };

  const handleFieldUpdate = async (field: string, value: any) => {
    try {
      const supabase = createClient();
      await supabase.from("leads").update({ [field]: value }).eq("id", leadId);

      setLead((prev: any) => ({ ...prev, [field]: value }));
      onUpdate?.();
    } catch (err) {
      console.error("Error updating field:", err);
    }
  };

  const handleQualificationUpdate = async (field: string, value: any) => {
    try {
      const supabase = createClient();
      await supabase
        .from("lead_qualifications")
        .upsert({ lead_id: leadId, client_id: lead.client_id, [field]: value }, { onConflict: "lead_id" });
      setLeadQual((prev: any) => ({ ...(prev || {}), [field]: value }));
    } catch (err) {
      console.error("Error updating qualification:", err);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    setSending(true);
    try {
      const channel = lead?.primary_channel || "email";
      
      if (channel === "email") {
        const response = await fetch("/api/send/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: lead.email,
            message: newMessage,
            lead_id: leadId,
          }),
        });
        
        if (response.ok) {
          setNewMessage("");
          fetchMessages();
        }
      } else {
        alert("Messenger sending coming soon");
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleAISuggest = async () => {
    setAiSuggesting(true);
    try {
      const response = await fetch("/api/ai/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      
      const data = await response.json();
      setNewMessage(data.suggestion || "");
    } catch (err) {
      console.error("Error getting AI suggestion:", err);
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.due_date) return;
    
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      
      await supabase.from("tasks").insert({
        lead_id: leadId,
        client_id: lead.client_id,
        title: newTask.title,
        task_type: newTask.task_type,
        due_date: newTask.due_date,
        notes: newTask.notes,
        status: "pending",
        created_by: session.session?.user.id,
      });
      
      setNewTask({ title: "", task_type: "follow_up", due_date: "", notes: "" });
      setShowTaskForm(false);
      fetchTasks();
    } catch (err) {
      console.error("Error creating task:", err);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const supabase = createClient();
      await supabase.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", taskId);
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

  const getQualityStyle = (quality: string) => {
    switch (quality) {
      case "Ready":     return "bg-green-100 text-green-800";
      case "Qualified": return "bg-blue-100 text-blue-800";
      case "Motivated": return "bg-purple-100 text-purple-800";
      case "Interested":return "bg-yellow-100 text-yellow-800";
      case "Browsing":  return "bg-gray-100 text-gray-600";
      case "Nurture":   return "bg-orange-100 text-orange-800";
      default:          return "bg-gray-100 text-gray-500";
    }
  };

  const qualityEmoji = (quality: string) => {
    const map: Record<string, string> = {
      Ready: "⭐", Qualified: "✅", Motivated: "💪",
      Interested: "👀", Browsing: "🔍", Nurture: "🌱",
    };
    return map[quality] || "";
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

  if (!isOpen) return null;
  if (loading) return null;

  const pending = tasks.filter(t => t.status !== "completed" && new Date(t.due_date) <= new Date());
  const upcoming = tasks.filter(t => t.status !== "completed" && new Date(t.due_date) > new Date());
  const completed = tasks.filter(t => t.status === "completed");

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[600px] p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header - Sticky */}
          <div className="border-b bg-white p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-[#1B3A5C]">{lead?.name}</h2>
                <div className="flex gap-2 mt-2">
                  <Badge className={getStageStyle(lead?.lead_temperature || "")}>
                    {lead?.lead_temperature === "Hot" && "🔥"} {lead?.lead_temperature}
                  </Badge>
                  <Badge className={getStatusStyle(lead?.status || "")}>
                    {lead?.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={getQualityStyle(lead?.lead_quality || "")}>
                    {qualityEmoji(lead?.lead_quality || "")} {lead?.lead_quality || "—"}
                  </Badge>
                  {(lead?.lead_score ?? 0) > 0 && (
                    <span className="text-xs text-gray-500">Score: {lead.lead_score}/100</span>
                  )}
                  {lead?.lead_quality_source === "manual" && (
                    <span className="text-xs text-orange-500 font-medium">🔒 Manual</span>
                  )}
                </div>
                {lead?.lead_quality_reason && (
                  <p className="text-xs text-gray-400 italic mt-1">{lead.lead_quality_reason}</p>
                )}
                {lead?.metadata?.is_ofw && (
                  <div className="flex items-center gap-1 text-xs text-blue-600 font-medium mt-1">
                    ✈️ OFW — {lead.metadata.current_location || "Abroad"}
                    {lead.metadata.ofw_source === "manual" && <span className="text-orange-500 ml-1">🔒</span>}
                  </div>
                )}
                {lead?.tags && lead.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {lead.tags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Source</p>
                <p className="font-medium">{lead?.source || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Assigned Agent</p>
                <p className="font-medium">{lead?.profiles?.full_name || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-gray-500">Last Contact</p>
                <p className="font-medium">{lead?.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString() : "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Next Action</p>
                <p className="font-medium">{lead?.next_follow_up_date ? new Date(lead.next_follow_up_date).toLocaleDateString() : "—"}</p>
              </div>
            </div>
            
            <Button 
              onClick={() => router.push(`/leads/${leadId}`)} 
              className="w-full bg-[#E87722] hover:bg-[#d66a1e]"
            >
              Open Full Profile →
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-gray-50">
              <TabsTrigger value="info" className="data-[state=active]:border-b-2 data-[state=active]:border-[#E87722]">Info</TabsTrigger>
              <TabsTrigger value="messages" className="data-[state=active]:border-b-2 data-[state=active]:border-[#E87722]">
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:border-b-2 data-[state=active]:border-[#E87722]">
                <Activity className="h-4 w-4 mr-2" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="tasks" className="data-[state=active]:border-b-2 data-[state=active]:border-[#E87722]">
                <CheckSquare className="h-4 w-4 mr-2" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="properties" className="data-[state=active]:border-b-2 data-[state=active]:border-[#E87722]">
                <Home className="h-4 w-4 mr-2" />
                Properties
              </TabsTrigger>
            </TabsList>

            {/* Tab Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              <TabsContent value="info" className="p-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input 
                      value={lead?.name || ""} 
                      onChange={(e) => setLead({ ...lead, name: e.target.value })}
                      onBlur={() => handleFieldUpdate("name", lead.name)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Phone</Label>
                      <Input 
                        value={lead?.phone || ""} 
                        onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                        onBlur={() => handleFieldUpdate("phone", lead.phone)}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input 
                        value={lead?.email || ""} 
                        onChange={(e) => setLead({ ...lead, email: e.target.value })}
                        onBlur={() => handleFieldUpdate("email", lead.email)}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Company</Label>
                      <Input 
                        value={lead?.company || ""} 
                        onChange={(e) => setLead({ ...lead, company: e.target.value })}
                        onBlur={() => handleFieldUpdate("company", lead.company)}
                      />
                    </div>
                    <div>
                      <Label>Industry</Label>
                      <Input 
                        value={lead?.industry || ""} 
                        onChange={(e) => setLead({ ...lead, industry: e.target.value })}
                        onBlur={() => handleFieldUpdate("industry", lead.industry)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Lead Type</Label>
                    <Select value={lead?.lead_type || ""} onValueChange={(val) => handleFieldUpdate("lead_type", val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Buyer", "Seller", "Agent", "Developer", "Affiliate", "Others"].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Status</Label>
                    <Select value={lead?.status || ""} onValueChange={(val) => {
                      handleFieldUpdate("status", val);
                      handleFieldUpdate("status_source", "manual");
                    }}>
                      <SelectTrigger>
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
                    <Label>Stage</Label>
                    <Select value={lead?.lead_temperature || ""} onValueChange={(val) => {
                      handleFieldUpdate("lead_temperature", val);
                      handleFieldUpdate("temperature_source", "manual");
                    }}>
                      <SelectTrigger>
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

                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Lead Quality</label>
                    <Select
                      value={lead?.lead_quality || ""}
                      onValueChange={(val) => {
                        handleFieldUpdate("lead_quality", val);
                        handleFieldUpdate("lead_quality_source", "manual");
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Set quality" /></SelectTrigger>
                      <SelectContent>
                        {["Browsing","Interested","Motivated","Qualified","Ready","Nurture"].map(q => (
                          <SelectItem key={q} value={q}>
                            {qualityEmoji(q)} {q}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lead?.lead_quality_source === "manual" && (
                      <button
                        className="text-xs text-blue-500 underline mt-1"
                        onClick={() => handleFieldUpdate("lead_quality_source", "auto")}
                      >
                        Release lock → let AI score this lead
                      </button>
                    )}
                  </div>

                  <div>
                    <Label>Source</Label>
                    <Select value={lead?.source || ""} onValueChange={(val) => handleFieldUpdate("source", val)}>
                      <SelectTrigger>
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
                    <Label>Assigned Agent</Label>
                    <Select value={lead?.assigned_user_id || "none"} onValueChange={(val) => handleFieldUpdate("assigned_user_id", val === "none" ? null : val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {agents.map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Campaign</Label>
                    <Select value={lead?.campaign_id || "none"} onValueChange={(val) => handleCampaignUpdate(val === "none" ? null : val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Campaign</SelectItem>
                        {campaigns.map(campaign => (
                          <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Primary Channel</Label>
                    <Select value={lead?.primary_channel || "none"} onValueChange={(val) => handleFieldUpdate("primary_channel", val === "none" ? null : val)}>
                      <SelectTrigger>
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
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Budget Min</Label>
                      <Input
                        type="number"
                        value={leadQual?.budget_min || ""}
                        onChange={(e) => setLeadQual({ ...(leadQual || {}), budget_min: parseInt(e.target.value) || null })}
                        onBlur={() => handleQualificationUpdate("budget_min", leadQual?.budget_min)}
                      />
                    </div>
                    <div>
                      <Label>Budget Max</Label>
                      <Input
                        type="number"
                        value={leadQual?.budget_max || ""}
                        onChange={(e) => setLeadQual({ ...(leadQual || {}), budget_max: parseInt(e.target.value) || null })}
                        onBlur={() => handleQualificationUpdate("budget_max", leadQual?.budget_max)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Location</Label>
                    <Input
                      value={leadQual?.preferred_location?.[0] || ""}
                      onChange={(e) => setLeadQual({ ...(leadQual || {}), preferred_location: e.target.value ? [e.target.value] : null })}
                      onBlur={() => handleQualificationUpdate("preferred_location", leadQual?.preferred_location)}
                    />
                  </div>

                  <div>
                    <Label>Property Type</Label>
                    <Input
                      value={leadQual?.property_type || ""}
                      onChange={(e) => setLeadQual({ ...(leadQual || {}), property_type: e.target.value })}
                      onBlur={() => handleQualificationUpdate("property_type", leadQual?.property_type)}
                    />
                  </div>

                  <div>
                    <Label>Bedrooms</Label>
                    <Input
                      type="number"
                      value={leadQual?.bedrooms || ""}
                      onChange={(e) => setLeadQual({ ...(leadQual || {}), bedrooms: parseInt(e.target.value) || null })}
                      onBlur={() => handleQualificationUpdate("bedrooms", leadQual?.bedrooms)}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="messages" className="p-6">
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Channel: {lead?.primary_channel || "Email"}</p>
                  
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${msg.direction === "outbound" ? "bg-[#E87722] text-white" : "bg-gray-100"}`}>
                          <div className="flex gap-2 items-center mb-1">
                            <span className="text-xs font-semibold">{senderLabel(msg)}</span>
                            <Badge variant="outline" className="text-xs">{msg.channel}</Badge>
                          </div>
                          <p className="text-sm">{msg.message_content}</p>
                          <p className="text-xs mt-1 opacity-70">{new Date(msg.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="space-y-2">
                    <Textarea 
                      placeholder="Type your message..." 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Paperclip className="h-4 w-4 mr-1" />
                        Attach
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTemplatePickerOpen(true)}
                      >
                        💬 Saved Response
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleAISuggest}
                        disabled={aiSuggesting}
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                        {aiSuggesting ? "Generating..." : "AI Suggest"}
                      </Button>
                      <Button 
                        className="ml-auto bg-[#E87722] hover:bg-[#d66a1e]" 
                        onClick={handleSendMessage}
                        disabled={sending || !newMessage.trim()}
                      >
                        {sending ? "Sending..." : "Send →"}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-0 p-6 space-y-4">
                {/* Lead Intake Snapshot Card */}
                {lead?.metadata && typeof lead?.metadata?.source === 'string' && lead?.metadata?.source?.trim() !== '' && (
                  <div className="rounded-xl border border-orange-100 bg-[#FFF3E8] overflow-hidden mb-6">
                    {/* Header */}
                    <div className="bg-[#1B3A5C] px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {lead?.metadata?.source?.includes('Sinag') ? '☀️' : '📋'}
                        </span>
                        <span className="text-white font-medium">
                          {lead?.metadata?.source}
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
                      {lead?.metadata?.estimate && (
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
                      )}

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

                {/* Existing Activity List */}
                <div className="space-y-3">
                  {activity.map((item, idx) => (
                    <div key={idx} className="flex gap-3 text-sm">
                      <div className="text-gray-500 w-20 flex-shrink-0">
                        {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                      <div className="flex-1">
                        {item.type === "message" ? (
                          <span>{senderLabel(item.data)} sent {item.data.channel}</span>
                        ) : (
                          <span>Task: {item.data.title}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="p-6 space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-[#1B3A5C]">PENDING ({pending.length})</h3>
                    <Button size="sm" className="bg-[#E87722] hover:bg-[#d66a1e]" onClick={() => setShowTaskForm(!showTaskForm)}>
                      + Create Task
                    </Button>
                  </div>
                  
                  {showTaskForm && (
                    <div className="mb-4 p-4 border rounded-lg space-y-3">
                      <Input placeholder="Task title" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
                      <Select value={newTask.task_type} onValueChange={(val) => setNewTask({ ...newTask, task_type: val })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="follow_up">Follow Up</SelectItem>
                          <SelectItem value="call">Call</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
                      <Textarea placeholder="Notes" value={newTask.notes} onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })} />
                      <div className="flex gap-2">
                        <Button onClick={handleCreateTask} className="bg-[#E87722] hover:bg-[#d66a1e]">Save</Button>
                        <Button variant="outline" onClick={() => setShowTaskForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {pending.map(task => (
                      <div key={task.id} className="p-3 border rounded-lg flex justify-between items-center">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-gray-500">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                        </div>
                        <Button size="sm" onClick={() => handleCompleteTask(task.id)} className="bg-[#E87722] hover:bg-[#d66a1e]">
                          Complete
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-[#1B3A5C] mb-4">UPCOMING ({upcoming.length})</h3>
                  <div className="space-y-2">
                    {upcoming.map(task => (
                      <div key={task.id} className="p-3 border rounded-lg">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-gray-500">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-400 mb-4">COMPLETED ({completed.length})</h3>
                  <div className="space-y-2">
                    {completed.map(task => (
                      <div key={task.id} className="p-3 border rounded-lg opacity-60">
                        <p className="font-medium line-through">{task.title}</p>
                        <p className="text-sm text-gray-500">Completed: {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="properties" className="p-6">
                <div className="text-center py-12">
                  <h3 className="text-xl font-semibold text-[#1B3A5C] mb-2">Suggested Property Matches</h3>
                  <p className="text-gray-500 mb-4">Property matching coming in Phase 1B</p>
                  <Button disabled className="bg-gray-200 cursor-not-allowed">
                    + Match Property Manually
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>

      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        channel={lead?.primary_channel === "messenger" ? "messenger" : "email"}
        onSelect={(template: PickableTemplate) => {
          const result = substituteTemplateVariables(template.body, {
            ...lead,
            property_type: leadQual?.property_type,
          });
          setNewMessage(result);
        }}
      />
    </Sheet>
  );
}