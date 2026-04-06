import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Send, Paperclip, Sparkles, MessageSquare, 
  FileText, Loader2, Download, X, AlertCircle, Mail, Phone
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function Inbox() {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Reply input
  const [replyMessage, setReplyMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [aiSuggestionWarning, setAiSuggestionWarning] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<"email" | "messenger" | "sms">("email");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [showStopCampaignDialog, setShowStopCampaignDialog] = useState(false);

  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (clientId) {
      fetchLeads();
      fetchMessageTemplates();
    }
  }, [clientId, filterType, searchQuery]);

  useEffect(() => {
    if (selectedLead) {
      fetchConversations();
      fetchMessageTemplates();
      
      // Determine channel from latest inbound message or lead's primary_channel
      const latestInbound = conversations.find(c => c.direction === "inbound");
      const detectedChannel = latestInbound?.channel || selectedLead.primary_channel || "email";
      setSelectedChannel(detectedChannel as "email" | "messenger" | "sms");
    }
  }, [selectedLead?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [conversations]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleChannelChange = async (channel: "email" | "messenger" | "sms") => {
    setSelectedChannel(channel);
    
    if (selectedLead) {
      const supabase = createClient();
      
      // Update lead's primary_channel
      await supabase
        .from("leads")
        .update({ primary_channel: channel })
        .eq("id", selectedLead.id);
      
      // Optimistic update
      const updatedLeads = leads.map(lead =>
        lead.id === selectedLead.id ? { ...lead, primary_channel: channel } : lead
      );
      setLeads(updatedLeads);
      setSelectedLead({ ...selectedLead, primary_channel: channel });
    }
  };

  const handleStopCampaign = async () => {
    if (!selectedLead) return;

    try {
      const supabase = createClient();
      
      await supabase
        .from("leads")
        .update({ campaign_id: null })
        .eq("id", selectedLead.id);

      // Update local state
      setSelectedLead({ ...selectedLead, campaign_id: null, campaign: null });
      
      const updatedLeads = leads.map(lead =>
        lead.id === selectedLead.id ? { ...lead, campaign_id: null, campaign: null } : lead
      );
      setLeads(updatedLeads);

      setShowStopCampaignDialog(false);
      
      toast({
        title: "Campaign stopped",
        description: `Campaign stopped for ${selectedLead.name}`,
      });
    } catch (error) {
      console.error("Error stopping campaign:", error);
      toast({
        title: "Error",
        description: "Failed to stop campaign. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fetchCurrentUser = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, client_id")
        .eq("id", session.user.id)
        .single();
      
      if (profile) {
        setCurrentUserId(profile.id);
        setClientId(profile.client_id);
      }
    }
  };

  const fetchLeads = async () => {
    if (!clientId) return;
    
    setLoading(true);
    const supabase = createClient();

    try {
      // Get leads with their latest conversation
      const { data: leadsData } = await supabase
        .from("leads")
        .select(`
          *,
          latest_conversation:conversations(
            created_at,
            message_content,
            channel
          )
        `)
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false });

      let filtered = leadsData || [];

      // Apply filters
      if (filterType === "Unread") {
        filtered = filtered.filter(lead => (lead.unread_count || 0) > 0);
      } else if (filterType === "Hot") {
        filtered = filtered.filter(lead => lead.lead_temperature === "Hot");
      } else if (filterType === "Warm") {
        filtered = filtered.filter(lead => lead.lead_temperature === "Warm");
      }

      // Apply search
      if (searchQuery) {
        filtered = filtered.filter(lead =>
          lead.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Sort by latest message
      filtered.sort((a, b) => {
        const aTime = a.latest_conversation?.[0]?.created_at || a.created_at;
        const bTime = b.latest_conversation?.[0]?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setLeads(filtered);
      
      // Auto-select first lead if none selected
      if (!selectedLead && filtered.length > 0) {
        setSelectedLead(filtered[0]);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("conversations")
      .select(`
        *,
        sender:profiles(full_name, role)
      `)
      .eq("lead_id", selectedLead.id)
      .order("created_at", { ascending: true });

    setConversations(data || []);

    // Mark as read
    await supabase
      .from("leads")
      .update({ unread_count: 0 })
      .eq("id", selectedLead.id);
  };

  const fetchMessageTemplates = async () => {
    if (!clientId) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .eq("client_id", clientId)
      .order("name", { ascending: true });

    setMessageTemplates(data || []);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Only images (.jpg, .png, .gif) and files (.pdf, .docx) are allowed.");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must not exceed 5MB.");
      return;
    }

    setAttachment(file);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachmentPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const uploadAttachment = async (leadId: string): Promise<{ url: string; type: string } | null> => {
    if (!attachment || !clientId) return null;

    setUploadingAttachment(true);
    const supabase = createClient();

    try {
      const fileExt = attachment.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${clientId}/${leadId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from("conversation-attachments")
        .upload(filePath, attachment);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("conversation-attachments")
        .getPublicUrl(filePath);

      const attachmentType = attachment.type.startsWith("image/") ? "image" : "file";

      return { url: urlData.publicUrl, type: attachmentType };
    } catch (error) {
      console.error("Error uploading attachment:", error);
      alert("Failed to upload attachment");
      return null;
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSendMessage = async () => {
    if (!replyMessage.trim() || !selectedLead) return;

    setSending(true);

    try {
      const supabase = createClient();

      // Insert conversation
      const { error } = await supabase.from("conversations").insert({
        lead_id: selectedLead.id,
        client_id: selectedLead.client_id,
        sender: "agent",
        message_content: replyMessage,
        channel: selectedLead.primary_channel || "webform",
        direction: "outgoing",
        sent_via: "manual",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Update lead's last_message_at
      await supabase
        .from("leads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", selectedLead.id);

      toast({
        title: "Success",
        description: "Message sent successfully",
      });

      setReplyMessage("");
      fetchConversations();
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleAISuggest = async () => {
    if (!selectedLead) return;

    setGenerating(true);

    try {
      const response = await fetch("/api/ai/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: selectedLead.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate suggestion");
      }

      const data = await response.json();
      setReplyMessage(data.suggestion || "");
      setAiGenerated(true);

      // Show warning note if no campaign
      if (data.warning) {
        alert(data.warning);
      }
    } catch (error) {
      console.error("Error generating AI reply:", error);
      alert("AI reply failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const getStageBadge = (stage: string) => {
    const styles = {
      Hot: "bg-red-100 text-red-800",
      Warm: "bg-amber-100 text-amber-800",
      Cold: "bg-gray-100 text-gray-800",
      Unqualified: "bg-gray-100 text-gray-600",
    };
    const icons = {
      Hot: "🔥",
      Warm: "🟠",
      Cold: "❄️",
      Unqualified: "",
    };

    return (
      <Badge className={cn("text-xs", styles[stage as keyof typeof styles] || "bg-gray-100")}>
        {icons[stage as keyof typeof icons]} {stage}
      </Badge>
    );
  };

  const getChannelBadge = (channel: string) => {
    const styles = {
      email: "bg-blue-100 text-blue-800",
      messenger: "bg-purple-100 text-purple-800",
      manual: "bg-gray-100 text-gray-800",
    };

    return (
      <Badge className={cn("text-xs", styles[channel as keyof typeof styles] || "bg-gray-100")}>
        {channel}
      </Badge>
    );
  };

  const getSenderLabel = (msg: any) => {
    if (msg.direction === "inbound") {
      return "Lead";
    }

    if (msg.sent_via === "baymo") {
      return "BaMo";
    }

    if (msg.sent_via === "system") {
      return "System";
    }

    if (msg.sender?.full_name) {
      return `${msg.sender.full_name} (${msg.sender.role || "Agent"})`;
    }

    return "Agent";
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return messageDate.toLocaleDateString();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-[#E87722]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* LEFT PANEL - Lead List */}
        <div className="w-[35%] border-r border-gray-200 flex flex-col bg-white">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-[#1B3A5C] mb-4">Inbox</h2>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {["All", "Unread", "Hot", "Warm"].map((filter) => (
                <Button
                  key={filter}
                  variant={filterType === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType(filter)}
                  className={cn(
                    "text-xs",
                    filterType === filter
                      ? "bg-[#1B3A5C] text-white hover:bg-[#152d47]"
                      : "text-[#1B3A5C] border-[#1B3A5C]/20 hover:bg-[#1B3A5C]/5"
                  )}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>

          {/* Lead List */}
          <div className="flex-1 overflow-y-auto">
            {leads.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No conversations yet</p>
              </div>
            ) : (
              leads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={cn(
                    "p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors",
                    selectedLead?.id === lead.id && "bg-[#1B3A5C]/5 border-l-4 border-l-[#E87722]"
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-medium text-[#1B3A5C]">{lead.name}</div>
                    <div className="text-xs text-gray-500">
                      {lead.latest_conversation?.[0]?.created_at
                        ? formatTimeAgo(lead.latest_conversation[0].created_at)
                        : formatTimeAgo(lead.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {getStageBadge(lead.lead_temperature || "Cold")}
                    {lead.latest_conversation?.[0]?.channel &&
                      getChannelBadge(lead.latest_conversation[0].channel)}
                    {(lead.unread_count || 0) > 0 && (
                      <Badge className="bg-[#E87722] text-white text-xs">
                        {lead.unread_count}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {lead.latest_conversation?.[0]?.message_content || "No messages yet"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Conversation Thread */}
        <div className="w-[65%] flex flex-col bg-gray-50">
          {!selectedLead ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>Select a conversation to start</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#1B3A5C] mb-2">
                      {selectedLead.name}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          selectedLead.lead_temperature === "Hot" && "bg-red-100 text-red-700 border-red-300",
                          selectedLead.lead_temperature === "Warm" && "bg-orange-100 text-orange-700 border-orange-300",
                          selectedLead.lead_temperature === "Cold" && "bg-blue-100 text-blue-700 border-blue-300",
                          selectedLead.lead_temperature === "Unqualified" && "bg-gray-100 text-gray-700 border-gray-300"
                        )}
                      >
                        {selectedLead.lead_temperature === "Hot" && "🔥"}
                        {selectedLead.lead_temperature === "Warm" && "🟠"}
                        {selectedLead.lead_temperature === "Cold" && "❄️"}
                        {selectedLead.lead_temperature === "Unqualified" && "⚫"}
                        {" "}
                        {selectedLead.lead_temperature || "Cold"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          selectedLead.status === "New" && "bg-blue-100 text-blue-700 border-blue-300",
                          selectedLead.status === "Active" && "bg-green-100 text-green-700 border-green-300",
                          selectedLead.status === "In Contact" && "bg-yellow-100 text-yellow-700 border-yellow-300",
                          selectedLead.status === "Inactive" && "bg-gray-100 text-gray-700 border-gray-300",
                          selectedLead.status === "Closed" && "bg-red-100 text-red-700 border-red-300"
                        )}
                      >
                        {selectedLead.status || "New"}
                      </Badge>
                      
                      {/* Campaign Indicator - Inline */}
                      {selectedLead.campaign ? (
                        <>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
                            ✅ Campaign: {typeof selectedLead.campaign === "object" && selectedLead.campaign.name 
                              ? selectedLead.campaign.name 
                              : "Active Campaign"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowStopCampaignDialog(true)}
                            className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Stop Campaign
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300 text-xs">
                          ⚠️ No Campaign Assigned
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedLead.email && <div>{selectedLead.email}</div>}
                    {selectedLead.phone && <div>{selectedLead.phone}</div>}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {conversations.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No messages yet.
                  </div>
                ) : (
                  conversations.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.direction === "inbound" ? "justify-start" : "justify-end"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-lg p-3",
                          msg.direction === "inbound"
                            ? "bg-white border border-gray-200"
                            : "bg-[#1B3A5C] text-white"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {getSenderLabel(msg)}
                          </span>
                          {getChannelBadge(msg.channel)}
                          {msg.sent_via === "baymo" && (
                            <Badge className="bg-[#E87722] text-white text-xs">
                              AI suggestion
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message_content}</p>
                        
                        {/* Attachment Display */}
                        {msg.attachment_url && (
                          <div className="mt-2">
                            {msg.attachment_type === "image" ? (
                              <img
                                src={msg.attachment_url}
                                alt="Attachment"
                                className="max-w-full h-auto rounded border"
                              />
                            ) : (
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm underline"
                              >
                                <Download className="h-4 w-4" />
                                Download File
                              </a>
                            )}
                          </div>
                        )}
                        
                        <div
                          className={cn(
                            "text-xs mt-1",
                            msg.direction === "inbound" ? "text-gray-500" : "text-white/70"
                          )}
                        >
                          {new Date(msg.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Box */}
              {selectedLead && (
                <div className="border-t p-4 bg-gray-50">
                  {aiSuggestionWarning && (
                    <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                      {aiSuggestionWarning}
                    </div>
                  )}

                  {/* Channel Selector Row */}
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm text-gray-600">Sending via:</span>
                    <Select value={selectedChannel} onValueChange={handleChannelChange}>
                      <SelectTrigger className="w-[160px] h-8">
                        <SelectValue>
                          {selectedChannel === "email" && (
                            <span className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email
                            </span>
                          )}
                          {selectedChannel === "messenger" && (
                            <span className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Messenger
                            </span>
                          )}
                          {selectedChannel === "sms" && (
                            <span className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              SMS
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">
                          <span className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
                          </span>
                        </SelectItem>
                        <SelectItem value="messenger">
                          <span className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Messenger
                          </span>
                        </SelectItem>
                        <SelectItem value="sms">
                          <span className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            SMS
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="mb-3 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("file-upload")?.click()}
                      className="text-[#1B3A5C] border-[#1B3A5C]/20 hover:bg-[#1B3A5C]/5"
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Attach
                    </Button>
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*,.pdf,.docx"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplateDialog(true)}
                      className="text-[#1B3A5C] border-[#1B3A5C]/20 hover:bg-[#1B3A5C]/5"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Insert Template
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAISuggest}
                      disabled={generating}
                      className="text-[#1B3A5C] border-[#1B3A5C]/20 hover:bg-[#1B3A5C]/5"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          AI Suggest
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Attachment Preview */}
                  {(attachmentPreview || attachment) && (
                    <div className="mb-3 p-3 bg-white border rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {attachment?.type.startsWith("image/") && attachmentPreview ? (
                          <img
                            src={attachmentPreview}
                            alt="Preview"
                            className="h-16 w-16 object-cover rounded"
                          />
                        ) : (
                          <Paperclip className="h-5 w-5 text-gray-400" />
                        )}
                        <span className="text-sm text-gray-600">
                          {attachment?.name || "Attachment"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAttachment(null);
                          setAttachmentPreview(null);
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  )}

                  {/* Message Input */}
                  <Textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="min-h-[100px] mb-3 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />

                  {/* Send Button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSendMessage}
                      disabled={(!replyMessage.trim() && !attachment) || sending}
                      className="bg-[#E87722] hover:bg-[#d66a1e] text-white"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send
                          <Send className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Insert Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {messageTemplates.length === 0 ? (
              <p className="text-sm text-gray-500">
                No templates found. Create templates in Settings &gt; Message Templates.
              </p>
            ) : (
              messageTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => {
                    setReplyMessage(template.content);
                    setShowTemplateDialog(false);
                  }}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <div className="font-medium text-sm">{template.name}</div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {template.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Stop Campaign Confirmation Dialog */}
      <Dialog open={showStopCampaignDialog} onOpenChange={setShowStopCampaignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop Campaign</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Are you sure you want to stop this campaign for <span className="font-semibold">{selectedLead?.name}</span>?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStopCampaignDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStopCampaign}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Stop Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}