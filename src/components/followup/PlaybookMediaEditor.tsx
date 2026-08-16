import { useCallback, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  MediaAttachmentField,
  type MediaValue,
} from "@/components/followup/MediaAttachmentField";

/**
 * Attachments for the AI follow-up playbook.
 *
 * The engine's four follow-ups are a fixed playbook — the step is
 * `touch_count + 1`, decided before the model is called — so an attachment can
 * be pinned to a step number by a human and the AI never chooses a file. That
 * is the whole reason attachments are safe on the AI path.
 *
 * The description below each file is not decoration. The model cannot see the
 * image, so without it the copy can confidently describe the wrong thing. It is
 * the only part of this screen that prevents a mismatched caption.
 */

// Mirrors the playbook in W6's "Build Decision Request" node. Kept in sync by
// hand: if the playbook there changes, these labels must follow or the person
// choosing a photo is picking it for the wrong message.
const PLAYBOOK_STEPS = [
  {
    step: 1,
    label: "Follow-up 1 — Provide info",
    blurb: "Shares one concrete fact, then asks a qualifying question. No viewing ask yet.",
    suggestion: "A photo of the unit or project exterior.",
  },
  {
    step: 2,
    label: "Follow-up 2 — Invite to a viewing",
    blurb: "Invites the lead to see the property and asks when they are free.",
    suggestion: "A model-unit or amenity photo that makes a visit appealing.",
  },
  {
    step: 3,
    label: "Follow-up 3 — Open-ended question",
    blurb: "Asks what they are looking for. No pitch, no facts, no viewing ask.",
    suggestion: "Usually best left empty — this step is meant to be a plain question.",
  },
  {
    step: 4,
    label: "Follow-up 4 — Facts, then qualify",
    blurb: "Shares specifics (sqm, amortization, DP, turnover), then one last question.",
    suggestion: "A floor plan, price list, or computation sheet.",
  },
] as const;

interface StepMedia {
  playbook_step: number;
  media_url: string;
  media_type: "image" | "video" | "file";
  media_description: string | null;
}

interface Props {
  campaignId: string;
  clientId: string;
  getToken: () => Promise<string>;
  canEdit: boolean;
}

export default function PlaybookMediaEditor({
  campaignId,
  clientId,
  getToken,
  canEdit,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [provisioned, setProvisioned] = useState(true);
  const [media, setMedia] = useState<Record<number, StepMedia | undefined>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/campaigns/${campaignId}/follow-up-media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setProvisioned(Boolean(data.sequence_id));
      const byStep: Record<number, StepMedia> = {};
      const descriptions: Record<number, string> = {};
      for (const row of (data.media ?? []) as StepMedia[]) {
        byStep[row.playbook_step] = row;
        descriptions[row.playbook_step] = row.media_description ?? "";
      }
      setMedia(byStep);
      setDrafts(descriptions);
    } catch (e) {
      console.error("Failed to load follow-up media", e);
    } finally {
      setLoading(false);
    }
  }, [campaignId, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (
    step: number,
    value: MediaValue,
    description: string
  ) => {
    try {
      const token = await getToken();

      if (!value) {
        const res = await fetch(
          `/api/campaigns/${campaignId}/follow-up-media?playbook_step=${step}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Remove failed" }));
          throw new Error(error || "Remove failed");
        }
        setMedia((m) => ({ ...m, [step]: undefined }));
        setDrafts((d) => ({ ...d, [step]: "" }));
        return;
      }

      const res = await fetch(`/api/campaigns/${campaignId}/follow-up-media`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          playbook_step: step,
          media_url: value.url,
          media_type: value.type,
          media_description: description,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(error || "Save failed");
      }

      const saved = await res.json();
      setMedia((m) => ({ ...m, [step]: saved }));

      if (saved.media_warning) {
        toast({
          title: "Attachment saved, but Facebook rejected it",
          description: `${saved.media_warning}. It will still be attempted, but check the file.`,
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Could not save attachment",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading follow-up attachments…</p>;
  }

  if (!provisioned) {
    return (
      <p className="text-sm text-slate-500">
        Save the follow-up settings above once before adding attachments.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold">Attachments per follow-up</h4>
        <p className="mt-1 text-xs text-slate-500">
          Each follow-up always sends the file you pin here — the AI writes the
          words, it never picks the photo. Leave a step empty to send text only.
        </p>
      </div>

      {PLAYBOOK_STEPS.map(({ step, label, blurb, suggestion }) => {
        const current = media[step];
        const value: MediaValue = current
          ? { url: current.media_url, type: current.media_type }
          : null;

        return (
          <div key={step} className="rounded-md border p-4 space-y-3">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-slate-500">{blurb}</p>
            </div>

            <MediaAttachmentField
              clientId={clientId}
              folder="followup-media"
              value={value}
              onChange={(next) => void save(step, next, drafts[step] ?? "")}
              disabled={!canEdit}
              label=""
              helpText={value ? undefined : suggestion}
            />

            {value && (
              <div className="space-y-1">
                <Label htmlFor={`media-desc-${step}`} className="text-xs">
                  What does this show?
                </Label>
                <Textarea
                  id={`media-desc-${step}`}
                  rows={2}
                  disabled={!canEdit}
                  placeholder="e.g. Floor plan of the 2-bedroom unit, 54 sqm"
                  value={drafts[step] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [step]: e.target.value }))
                  }
                  onBlur={() => void save(step, value, drafts[step] ?? "")}
                />
                <p className="text-xs text-slate-500">
                  The AI cannot see the file. Without this it may describe it
                  wrongly in the message.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
