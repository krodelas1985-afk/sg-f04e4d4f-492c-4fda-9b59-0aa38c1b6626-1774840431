import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Sparkles, Edit, Trash2, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/router";

interface MessageTemplate {
  id: string;
  client_id: string;
  title: string;
  body: string;
  channel: "email" | "messenger" | "sms";
  category: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  creator_name?: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"created_at" | "last_used_at">("created_at");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  // Create/Edit Template
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    channel: "email" as "email" | "messenger" | "sms",
    category: "Introduction",
    body: "",
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<MessageTemplate | null>(null);

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);

  useEffect(() => {
    checkAuth();
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchQuery, activeFilter, sortBy]);

  const checkAuth = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, id")
      .eq("id", session.user.id)
      .single();

    if (profile) {
      setUserRole(profile.role);
      setCurrentUserId(profile.id);
    }

    // client_id is NOT NULL on message_templates with no default, so creating
    // a template must supply the caller's own client scope. RLS scopes this to
    // the client_admin's single client.
    const { data: myClientId } = await supabase.rpc("get_my_client_id");
    if (myClientId) setClientId(myClientId as string);
  };

  const fetchTemplates = async () => {
    try {
      const supabase = createClient();

      let query = supabase
        .from("message_templates")
        .select(`
          *,
          creator:profiles!message_templates_created_by_fkey(full_name, role)
        `);

      // Apply filters. "All" is the default sentinel (no filter) — note the
      // capital A must match the Tabs value, otherwise this fetches
      // category = "All", which matches nothing and hides every template.
      // Tab switches are handled client-side by filterTemplates().
      if (activeFilter !== "All") {
        if (["email", "messenger", "sms"].includes(activeFilter)) {
          query = query.eq("channel", activeFilter);
        } else {
          query = query.eq("category", activeFilter);
        }
      }

      // Apply search
      if (searchQuery) {
        query = query.ilike("title", `%${searchQuery}%`);
      }

      // Apply sort - FIXED: Correct Supabase syntax
      if (sortBy === "created_at") {
        query = query.order("created_at", { ascending: false });
      } else {
        query = query.order("last_used_at", { ascending: false, nullsFirst: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase query error:", error);
        throw error;
      }

      const templatesWithCreator = (data || []).map((t) => ({
        ...t,
        creator_name: t.creator?.full_name || "Unknown",
      }));

      setTemplates(templatesWithCreator);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    // Filter by channel/category
    if (activeFilter !== "All") {
      if (["email", "messenger", "sms"].includes(activeFilter.toLowerCase())) {
        filtered = filtered.filter((t) => t.channel === activeFilter.toLowerCase());
      } else {
        filtered = filtered.filter((t) => t.category === activeFilter);
      }
    }

    // Search
    if (searchQuery) {
      filtered = filtered.filter((t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === "last_used_at") {
        const aDate = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
        const bDate = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
        return bDate - aDate;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setFilteredTemplates(filtered);
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setFormData({
      title: "",
      channel: "email",
      category: "Introduction",
      body: "",
    });
    setShowTemplateForm(true);
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      title: template.title,
      channel: template.channel,
      category: template.category,
      body: template.body,
    });
    setShowTemplateForm(true);
  };

  const handleSaveTemplate = async () => {
    if (!formData.title.trim() || !formData.body.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and body are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      if (editingTemplate) {
        // Update existing
        await supabase
          .from("message_templates")
          .update({
            title: formData.title,
            channel: formData.channel,
            category: formData.category,
            body: formData.body,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTemplate.id);

        toast({
          title: "Template updated",
          description: "Template updated successfully",
        });
      } else {
        // Create new
        if (!clientId) {
          toast({
            title: "No client scope",
            description: "Could not determine your client. Please re-login.",
            variant: "destructive",
          });
          return;
        }
        const { error } = await supabase.from("message_templates").insert({
          client_id: clientId,
          title: formData.title,
          channel: formData.channel,
          category: formData.category,
          body: formData.body,
          created_by: currentUserId,
        });
        if (error) throw error;

        toast({
          title: "Template saved",
          description: "Template saved successfully",
        });
      }

      setShowTemplateForm(false);
      fetchTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;

    try {
      const supabase = createClient();
      await supabase
        .from("message_templates")
        .delete()
        .eq("id", deletingTemplate.id);

      toast({
        title: "Template deleted",
        description: "Template deleted successfully",
      });

      setShowDeleteDialog(false);
      setDeletingTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    }
  };

  const insertVariable = (variable: string) => {
    setFormData({ ...formData, body: formData.body + variable });
  };

  const replaceVariables = (text: string, preview: boolean = false) => {
    if (!preview) return text;

    return text
      .replace(/{lead_name}/g, "Juan dela Cruz")
      .replace(/{lead_property_type}/g, "Condominium")
      .replace(/{company_name}/g, "BaMo Realty");
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case "email":
        return "bg-primary text-white";
      case "messenger":
        return "bg-brand-orange text-white";
      case "sms":
        return "bg-gray-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const isAdmin = userRole === "admin" || userRole === "baymo_admin";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold text-primary">Message Templates</h1>
              <p className="text-gray-600 mt-1">
                Manage reusable message templates for Email, Messenger, and SMS
              </p>
            </div>
            {/* Temporarily show for all users to test visibility */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCreateNew}
                className="bg-primary hover:bg-primary-dark text-white"
              >
                + New Template
              </Button>
              <Button
                onClick={() => router.push("/templates/generate")}
                className="bg-brand-orange hover:bg-brand-orange-dark text-white"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AI Template Generator
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mt-4">
            <Tabs value={activeFilter} onValueChange={setActiveFilter}>
              <TabsList>
                <TabsTrigger value="All">All</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="messenger">Messenger</TabsTrigger>
                <TabsTrigger value="sms">SMS</TabsTrigger>
                <TabsTrigger value="Introduction">Introduction</TabsTrigger>
                <TabsTrigger value="Follow-up">Follow-up</TabsTrigger>
                <TabsTrigger value="Qualification">Qualification</TabsTrigger>
                <TabsTrigger value="Property Offer">Property Offer</TabsTrigger>
                <TabsTrigger value="Closing">Closing</TabsTrigger>
                <TabsTrigger value="Call-to-Action">Call-to-Action</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex-1" />

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Created Date</SelectItem>
                <SelectItem value="last_used_at">Last Used</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-[250px]"
              />
            </div>
          </div>
        </div>

        {/* Template Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No templates found. {isAdmin && "Create your first template to get started."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-primary mb-2">{template.title}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={cn("text-xs capitalize", getChannelColor(template.channel))}>
                        {template.channel}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-3">
                    {template.body.substring(0, 100)}
                    {template.body.length > 100 && "..."}
                  </p>

                  <div className="text-xs text-gray-500">
                    <div>Created by: {template.creator_name}</div>
                    <div>Created: {new Date(template.created_at).toLocaleDateString()}</div>
                    {template.last_used_at && (
                      <div>Last used: {new Date(template.last_used_at).toLocaleDateString()}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPreviewTemplate(template);
                        setShowPreview(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(template)}
                          className="text-primary hover:text-primary-dark"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingTemplate(template);
                            setShowDeleteDialog(true);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Template Sheet */}
      <Sheet open={showTemplateForm} onOpenChange={setShowTemplateForm}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Introduction - First Contact"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Channel *</Label>
                <Select
                  value={formData.channel}
                  onValueChange={(v) => setFormData({ ...formData, channel: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="messenger">Messenger</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Introduction">Introduction</SelectItem>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Qualification">Qualification</SelectItem>
                    <SelectItem value="Property Offer">Property Offer</SelectItem>
                    <SelectItem value="Closing">Closing</SelectItem>
                    <SelectItem value="Call-to-Action">Call-to-Action</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Body *</Label>
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-600">
                <span>Insert variables:</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertVariable("{lead_name}")}
                  className="h-6 px-2 text-xs"
                >
                  {"{lead_name}"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertVariable("{lead_property_type}")}
                  className="h-6 px-2 text-xs"
                >
                  {"{lead_property_type}"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertVariable("{company_name}")}
                  className="h-6 px-2 text-xs"
                >
                  {"{company_name}"}
                </Button>
              </div>
              <Textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Type your message template..."
                className="min-h-[150px]"
              />
            </div>

            {/* Live Preview */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <Label className="text-xs font-semibold text-gray-700 mb-2 block">
                Live Preview
              </Label>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {replaceVariables(formData.body, true)}
              </p>
            </div>
          </div>

          <SheetFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTemplateForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={saving}
              className="bg-brand-orange hover:bg-brand-orange-dark text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Template"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deletingTemplate?.title}</span>? This cannot be
              undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Badge className={cn("text-xs capitalize", getChannelColor(previewTemplate?.channel || ""))}>
                {previewTemplate?.channel}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {previewTemplate?.category}
              </Badge>
            </div>

            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="text-sm whitespace-pre-wrap">{previewTemplate?.body}</p>
            </div>

            <div className="border rounded-lg p-4 bg-blue-50">
              <Label className="text-xs font-semibold text-gray-700 mb-2 block">
                With Sample Data
              </Label>
              <p className="text-sm whitespace-pre-wrap">
                {replaceVariables(previewTemplate?.body || "", true)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}