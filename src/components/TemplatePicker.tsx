import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickableTemplate {
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
}

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: "email" | "messenger" | "sms";
  onSelect: (template: PickableTemplate) => void;
}

function channelColor(channel: string) {
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
}

export function TemplatePicker({
  open,
  onOpenChange,
  channel,
  onSelect,
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<PickableTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      // RLS scopes rows to the user's client_id — do not add a manual filter.
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .eq("channel", channel)
        .order("last_used_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setTemplates((data as PickableTemplate[]) || []);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const handleSelect = (template: PickableTemplate) => {
    // Copy the template into the calling surface first, then close.
    onSelect(template);
    onOpenChange(false);

    // Best-effort bump of last_used_at — don't block selection on this write.
    const supabase = createClient();
    supabase
      .from("message_templates")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", template.id)
      .then(({ error }) => {
        if (error) console.error("Error bumping last_used_at:", error);
      });
  };

  const filtered = searchQuery
    ? templates.filter((t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : templates;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a template</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            autoFocus
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              {searchQuery
                ? "No templates match your search."
                : `No ${channel} templates yet.`}
            </div>
          ) : (
            <div className="space-y-2 py-1">
              {filtered.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelect(template)}
                  className="w-full text-left border rounded-lg p-3 hover:border-brand-orange hover:bg-orange-50/40 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-primary">
                      {template.title}
                    </span>
                    <Badge
                      className={cn(
                        "text-xs capitalize",
                        channelColor(template.channel)
                      )}
                    >
                      {template.channel}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {template.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 whitespace-pre-wrap">
                    {template.body}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
