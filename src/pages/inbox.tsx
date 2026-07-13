import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Send, Paperclip, Sparkles, MessageSquare, 
  FileText, Loader2, Download, X, AlertCircle, Mail, Phone
} from "lucide-react";
import { cn, senderLabel } from "@/lib/utils";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { TemperatureBadge, ChannelBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/EmptyState";
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

  const { profile: userProfile } = useUserProfile();

  const fetchCurrentUser = async () => {
    if (userProfile) {
      setCurrentUserId(userProfile.id);
      setClientId(userProfile.client_id);
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
        sender_profile:profiles(full_name, role)
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
        direction: "outbound",
        sent_via: "manual",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // If this is a messenger lead, send via Facebook API
      if (selectedLead.messenger_id) {
        const messengerResponse = await fetch("/api/send/messenger", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messenger_id: selectedLead.messenger_id,
            message: replyMessage,
            lead_id: selectedLead.id,
            client_id: selectedLead.client_id,
          }),
        });

        const messengerData = await messengerResponse.json();

        if (!messengerResponse.ok) {
          throw new Error(messengerData.error?.message || messengerData.error || "Failed to send via Messenger");
        }
      }

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
        description: error instanceof Error ? error.message : "Failed to send message",
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

  const getStageBadge = (stage: string) => <TemperatureBadge value={stage} />;

  const getChannelBadge = (channel: string) => <ChannelBadge channel={channel} />;

  const getSenderLabel = (msg: any) => {
    const label = senderLabel(msg);
    // Show the actual human's name when the message is tied to an agent profile.
    if (label === "Agent" && msg.sender_profile?.full_name) {
      return `${msg.sender_profile.full_name} (${msg.sender_profile.role || "Agent"})`;
    }
    return label;
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
          <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full">
        {/* LEFT PANEL - Lead List */}
        <div className="flex w-[35%] max-w-md flex-col border-r bg-card">
          {/* Header */}
          <div className="border-b p-4">
            <h2 className="mb-3 text-lg font-semibold">Inbox</h2>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search leads…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-muted pl-10 border-transparent focus-visible:border-input focus-visible:bg-card"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
              {["All", "Unread", "Hot", "Warm"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterType(filter)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    filterType === filter
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Lead List */}
          <div className="flex-1 overflow-y-auto">
            {leads.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No conversations yet"
                description="New lead messages will show up here."
              />
            ) : (
              leads.map((lead) => {
                const unread = (lead.unread_count || 0) > 0;
                const selected = selectedLead?.id === lead.id;
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={cn(
                      "relative flex cursor-pointer gap-3 border-b px-4 py-3 transition-colors",
                      selected ? "bg-accent/70" : "hover:bg-muted/50"
                    )}
                  >
                    {selected && (
                      <span className="absolute inset-y-0 left-0 w-1 bg-brand-orange" />
                    )}
                    <InitialsAvatar name={lead.name} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm",
                            unread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                          )}
                        >
                          {lead.name || "Unnamed lead"}
                        </span>
                        <span className="shrink-0 font-inter text-[11px] text-muted-foreground">
                          {lead.latest_conversation?.[0]?.created_at
                            ? formatTimeAgo(lead.latest_conversation[0].created_at)
                            : formatTimeAgo(lead.created_at)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mb-1.5 truncate text-xs",
                          unread ? "font-medium text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {lead.latest_conversation?.[0]?.message_content || "No messages yet"}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {getStageBadge(lead.lead_temperature || "Cold")}
                        {lead.latest_conversation?.[0]?.channel &&
                          getChannelBadge(lead.latest_conversation[0].channel)}
                        {unread && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-semibold text-white">
                            {lead.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Conversation Thread */}
        <div className="flex flex-1 flex-col bg-slate-bg">
          {!selectedLead ? (
            <EmptyState
              icon={MessageSquare}
              title="Select a conversation"
              description="Pick a lead on the left to read and reply to their messages."
              className="flex-1"
            />
          ) : (
            <>
              {/* Header */}
              <div className="border-b bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <InitialsAvatar name={selectedLead.name} size="lg" />
                    <div className="min-w-0">
                      <h2 className="mb-1.5 truncate text-lg font-semibold">
                        {selectedLead.name || "Unnamed lead"}
                      </h2>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TemperatureBadge value={selectedLead.lead_temperature || "Cold"} />
                        {selectedLead.status && (
                          <Badge variant="outline" className="text-xs font-medium">
                            {selectedLead.status}
                          </Badge>
                        )}

                        {/* Campaign Indicator - Inline */}
                        {selectedLead.campaign ? (
                          <>
                            <Badge variant="outline" className="border-emerald-200 bg-success/10 text-xs text-emerald-700">
                              Campaign: {typeof selectedLead.campaign === "object" && selectedLead.campaign.name
                                ? selectedLead.campaign.name
                                : "Active Campaign"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowStopCampaignDialog(true)}
                              className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              Stop Campaign
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            No campaign assigned
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-inter text-xs text-muted-foreground">
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
                          "max-w-[70%] rounded-2xl p-3 shadow-sm",
                          msg.direction === "inbound"
                            ? "rounded-tl-sm border bg-card"
                            : "rounded-tr-sm bg-primary text-white"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {getSenderLabel(msg)}
                          </span>
                          {getChannelBadge(msg.channel)}
                          {msg.sent_via === "baymo" && (
                            <Badge className="bg-brand-orange text-white text-xs">
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
                <div className="border-t bg-card p-4">
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
                      className="text-primary border-primary/20 hover:bg-primary/5"
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
                      className="text-primary border-primary/20 hover:bg-primary/5"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Insert Template
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAISuggest}
                      disabled={generating}
                      className="text-primary border-primary/20 hover:bg-primary/5"
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
                      className="bg-brand-orange hover:bg-brand-orange-dark text-white"
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