import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Paperclip, X, Loader2, FileText, Film } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Attach one photo/video/file to a follow-up step.
 *
 * Uploads into the existing public `client-assets` bucket under the client's
 * own folder — that bucket's RLS already keys writes on `{client_id}/` as the
 * first path segment, so no new bucket or policy is needed and cross-tenant
 * writes stay impossible.
 *
 * The parent owns the value and decides where it is persisted (a sequence step
 * row, or an AI playbook step); this component only produces a URL and a type.
 */

export type MediaType = "image" | "video" | "file";

export type MediaValue = { url: string; type: MediaType } | null;

// Messenger's own ceilings. Enforcing them here turns a confusing Meta upload
// rejection at save time into an explanation before the bytes are sent.
const MAX_BYTES: Record<MediaType, number> = {
  image: 8 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  file: 25 * 1024 * 1024,
};

function mediaTypeFor(file: File): MediaType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

function humanSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface Props {
  clientId: string;
  value: MediaValue;
  onChange: (value: MediaValue) => void;
  /** Folder under the client's prefix, e.g. "sequence-media". */
  folder: string;
  disabled?: boolean;
  label?: string;
  helpText?: string;
}

export function MediaAttachmentField({
  clientId,
  value,
  onChange,
  folder,
  disabled,
  label = "Attachment",
  helpText,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    const type = mediaTypeFor(file);

    if (file.size > MAX_BYTES[type]) {
      toast({
        title: "File too large",
        description: `Messenger accepts up to ${humanSize(
          MAX_BYTES[type]
        )} for a ${type}. This one is ${humanSize(file.size)}.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      const supabase = createClient();

      // Randomised leaf name: two agents uploading "photo.jpg" must not
      // overwrite each other, and an overwrite would silently change what
      // already-configured steps send.
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const path = `${clientId}/${folder}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("client-assets")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) throw error;

      const { data } = supabase.storage.from("client-assets").getPublicUrl(path);
      onChange({ url: data.publicUrl, type });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message ?? "Could not upload the file.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {value ? (
        <div className="flex items-center gap-3 rounded-md border p-2">
          {value.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.url}
              alt="Attachment preview"
              className="h-16 w-16 rounded object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
              {value.type === "video" ? (
                <Film className="h-6 w-6 text-muted-foreground" />
              ) : (
                <FileText className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium capitalize">{value.type}</p>
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-xs text-muted-foreground underline"
            >
              {value.url.split("/").pop()}
            </a>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Paperclip className="mr-2 h-4 w-4" />
              Attach photo or video
            </>
          )}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}
