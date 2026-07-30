import { useState, useEffect } from "react";
import { X, MessageSquare, Activity, CheckSquare, Home, Paperclip, Sparkles, Clock, ExternalLink } from "lucide-react";
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
import { getMessengerWindow, windowCountdownLabel } from "@/lib/messengerWindow";

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

  // Messenger 24h-window state (mirrors the Inbox composer)
  const [windowNow, setWindowNow] = useState(new Date());
  const [messengerLinkUrl, setMessengerLinkUrl] = useState<string | null>(null);

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

  // Keep the window countdown live while the slide-over is open.
  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setWindowNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, [isOpen]);

  // Resolve the Business Suite thread link for a Messenger lead. The Page ID
  // belongs to the LEAD's client, so it is resolved server-side per lead — a
  // baymo_admin viewing another workspace must not get their own Page.
  useEffect(() => {
    setMessengerLinkUrl(null);
    if (!isOpen || !lead?.id || !lead?.messenger_id) return;

    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch(`/api/leads/${lead.id}/messenger-link`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMessengerLinkUrl(data.url ?? null);
      } catch {
        // Non-fatal: the banner still explains the window, just without a link.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, lead?.id, lead?.messenger_id]);

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

    const channel = lead?.primary_channel || "email";

    if (channel === "email") {
      setSending(true);
      try {
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
      } catch (err) {
        console.error("Error sending message:", err);
      } finally {
        setSending(false);
      }
      return;
    }

    // Messenger path — mirrors the Inbox composer. Facebook would reject a send
    // outside the 24h window, so don't even write a row that can never deliver.
    if (getMessengerWindow(lead).canSend === false) return;

    setSending(true);
    try {
      const supabase = createClient();

      // The row is inserted BEFORE the send so the thread updates immediately;
      // if the Graph call fails we flip it to delivery_status: "failed" below.
      const { data: inserted, error } = await supabase
        .from("conversations")
        .insert({
          lead_id: leadId,
          client_id: lead.client_id,
          sender: "agent",
          message_content: newMessage,
          channel: lead.primary_channel || "messenger",
          direction: "outbound",
          sent_via: "manual",
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;

      if (lead.messenger_id) {
        // The route is auth-hardened: it derives recipient + Page token from the
        // lead server-side and scopes it to the caller, so we send only these two.
        const messengerResponse = await fetch("/api/send/messenger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: newMessage,
            lead_id: leadId,
          }),
        });

        const messengerData = await messengerResponse.json();

        if (!messengerResponse.ok) {
          // Row was written before the send, so leaving it "sent" would show an
          // undelivered message as delivered. Mark it failed and re-render.
          if (inserted?.id) {
            await supabase
              .from("conversations")
              .update({ delivery_status: "failed" })
              .eq("id", inserted.id);
          }
          fetchMessages();
          throw new Error(
            messengerData.error?.message || messengerData.error || "Failed to send via Messenger"
          );
        }
      }

      setNewMessage("");
      fetchMessages();
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
      case "New": return "bg-[#F1EFE8] text-[#5F5E5A]";
      case "In Contact": return "bg-[#EEF3FF] text-primary";
      case "Qualifying": return "bg-[#EEF3FF] text-primary";
      case "Qualified": return "bg-[#ECFDF5] text-[#065F46]";
      case "Viewing": return "bg-[#FDF2E6] text-brand-orange-dark";
      case "Negotiating": return "bg-[#FDF2E6] text-brand-orange-dark";
      case "Nurture": return "bg-[#F5F3FF] text-[#5B21B6]";
      case "Won": return "bg-[#ECFDF5] text-[#065F46]";
      case "Lost": return "bg-[#FEF2F2] text-[#991B1B]";
      case "Unqualified": return "bg-[#F3F4F6] text-[#6B7280]";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  if (!isOpen) return null;
  if (loading) return null;

  // Messenger 24h window for the loaded lead. "not_messenger" (email/SMS leads)
  // returns canSend: true, so this is a no-op for every non-Messenger thread.
  const messengerWindow = getMessengerWindow(lead, windowNow);
  const isMessengerLead = messengerWindow.state !== "not_messenger";
  const windowBlocked = isMessengerLead && !messengerWindow.canSend;

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
                <h2 className="text-2xl font-bold text-primary">{lead?.name}</h2>
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
              className="w-full bg-brand-orange hover:bg-brand-orange-dark"
            >
              Open Full Profile →
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-gray-50">
              <TabsTrigger value="info" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-orange">Info</TabsTrigger>
              <TabsTrigger value="messages" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-orange">
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-orange">
                <Activity className="h-4 w-4 mr-2" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="tasks" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-orange">
                <CheckSquare className="h-4 w-4 mr-2" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="properties" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-orange">
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
                        <SelectItem value="In Contact">In Contact</SelectItem>
                        <SelectItem value="Qualifying">Qualifying</SelectItem>
                        <SelectItem value="Qualified">Qualified</SelectItem>
                        <SelectItem value="Viewing">Viewing</SelectItem>
                        <SelectItem value="Negotiating">Negotiating</SelectItem>
                        <SelectItem value="Nurture">Nurture</SelectItem>
                        <SelectItem value="Won">Won</SelectItem>
                        <SelectItem value="Lost">Lost</SelectItem>
                        <SelectItem value="Unqualified">Unqualified</SelectItem>
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
                        <div className={`max-w-[80%] rounded-lg p-3 ${msg.direction === "outbound" ? "bg-brand-orange text-white" : "bg-gray-100"}`}>
                          <div className="flex gap-2 items-center mb-1">
                            <span className="text-xs font-semibold">{senderLabel(msg)}</span>
                            <Badge variant="outline" className="text-xs">{msg.channel}</Badge>
                          </div>
                          <p className="text-sm">{msg.message_content}</p>
                          <p className="text-xs mt-1 opacity-70">{new Date(msg.created_at).toLocaleString()}</p>
                          {msg.direction === "outbound" && msg.delivery_status === "failed" && (
                            <p className="text-xs mt-1 font-semibold text-red-100">
                              ⚠ Not delivered
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {windowBlocked ? (
                    /* Facebook will not deliver here — offer the Page inbox
                       instead of a composer that silently fails. */
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 flex-shrink-0 text-amber-600" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-amber-900">
                            {messengerWindow.state === "never_opened"
                              ? "This lead hasn't messaged you yet"
                              : "Messenger's 24-hour reply window has closed"}
                          </p>
                          <p className="mt-1 text-sm text-amber-800">
                            {messengerWindow.state === "never_opened"
                              ? "Facebook only allows a Page to message someone who messaged it first, so replies can't be delivered from here yet."
                              : "Facebook won't deliver new messages until this lead replies again. If they reply, the window reopens for another 24 hours."}
                          </p>
                          {messengerWindow.lastInboundAt && (
                            <p className="mt-1 text-xs text-amber-700">
                              Lead last messaged{" "}
                              {messengerWindow.lastInboundAt.toLocaleString()}
                            </p>
                          )}

                          {messengerLinkUrl ? (
                            <>
                              <Button
                                asChild
                                size="sm"
                                className="mt-3 bg-brand-orange hover:bg-brand-orange-dark text-white"
                              >
                                <a
                                  href={messengerLinkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Open in Messenger
                                  <ExternalLink className="ml-2 h-4 w-4" />
                                </a>
                              </Button>
                              <p className="mt-2 text-xs text-amber-700">
                                Opens this conversation in your Facebook Page
                                inbox. If it doesn&apos;t load, ask your admin
                                for &ldquo;Messages&rdquo; access to the Page.
                              </p>
                            </>
                          ) : (
                            <p className="mt-3 text-xs text-amber-700">
                              No Facebook Page is linked for this client, so the
                              conversation can&apos;t be opened from here.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                  <div className="space-y-2">
                    {isMessengerLead && messengerWindow.state === "open" && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700">
                        <Clock className="h-3.5 w-3.5" />
                        {windowCountdownLabel(messengerWindow)}
                      </div>
                    )}
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
                        className="ml-auto bg-brand-orange hover:bg-brand-orange-dark"
                        onClick={handleSendMessage}
                        disabled={sending || !newMessage.trim()}
                      >
                        {sending ? "Sending..." : "Send →"}
                      </Button>
                    </div>
                  </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-0 p-6 space-y-4">
                {/* Lead Intake Snapshot Card */}
                {lead?.metadata && typeof lead?.metadata?.source === 'string' && lead?.metadata?.source?.trim() !== '' && (
                  <div className="rounded-xl border border-orange-100 bg-[#FFF3E8] overflow-hidden mb-6">
                    {/* Header */}
                    <div className="bg-primary px-4 py-3 flex items-center justify-between">
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
                                  <div className={`font-medium ${shouldHighlight ? 'text-brand-orange' : 'text-gray-900'}`}>
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
                    <h3 className="font-semibold text-primary">PENDING ({pending.length})</h3>
                    <Button size="sm" className="bg-brand-orange hover:bg-brand-orange-dark" onClick={() => setShowTaskForm(!showTaskForm)}>
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
                        <Button onClick={handleCreateTask} className="bg-brand-orange hover:bg-brand-orange-dark">Save</Button>
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
                        <Button size="sm" onClick={() => handleCompleteTask(task.id)} className="bg-brand-orange hover:bg-brand-orange-dark">
                          Complete
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-primary mb-4">UPCOMING ({upcoming.length})</h3>
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
                  <h3 className="text-xl font-semibold text-primary mb-2">Suggested Property Matches</h3>
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