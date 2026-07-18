import { useEffect, useRef, useState } from "react";
import { Building2, Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import psgc from "@/data/psgc.json";

/**
 * Admin edit of an agent's profile (Agent Profile Phase 3).
 * Same fields as the mobile /profile screen. Writes are covered by the
 * profiles_update RLS (client_admin limited to own workspace) and the
 * guard trigger blocks role/client_id changes; uploads to profile-media go
 * under the TARGET user's folder via the profile_media_admin_* policies.
 */

const NONE = "__none__"; // shadcn Select can't represent null with an empty value

type EditableProfile = {
  full_name: string;
  phone: string;
  prc_number: string;
  company: string;
  whatsapp: string;
  service_area: string;
  location_province: string | null;
  location_city: string | null;
  avatar_url: string | null;
  company_logo_url: string | null;
};

const EMPTY: EditableProfile = {
  full_name: "",
  phone: "",
  prc_number: "",
  company: "",
  whatsapp: "",
  service_area: "",
  location_province: null,
  location_city: null,
  avatar_url: null,
  company_logo_url: null,
};

const citiesOf = (province: string | null): string[] =>
  psgc.find((p) => p.province === province)?.cities ?? [];

export function UserProfileEditDialog({
  userId,
  userLabel,
  onClose,
  onSaved,
}: {
  /** Target profile id, or null when the dialog is closed. */
  userId: string | null;
  userLabel: string;
  onClose: () => void;
  /** Called after a successful save so the list can refresh the name. */
  onSaved: (userId: string, fullName: string) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<EditableProfile>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "logo" | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<EditableProfile>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("profiles")
      .select(
        "full_name, phone, prc_number, company, whatsapp, service_area, location_province, location_city, avatar_url, company_logo_url"
      )
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        setLoading(false);
        if (error || !data) {
          toast({ title: "Could not load profile", description: error?.message, variant: "destructive" });
          onClose();
          return;
        }
        setForm({
          full_name: data.full_name ?? "",
          phone: data.phone ?? "",
          prc_number: data.prc_number ?? "",
          company: data.company ?? "",
          whatsapp: data.whatsapp ?? "",
          service_area: data.service_area ?? "",
          location_province: data.location_province,
          location_city: data.location_city,
          avatar_url: data.avatar_url,
          company_logo_url: data.company_logo_url,
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const uploadImage = async (kind: "avatar" | "logo", file: File) => {
    if (!userId) return;
    setUploading(kind);
    const supabase = createClient();
    const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("profile-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(null);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return;
    }
    const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
    if (kind === "avatar") set({ avatar_url: data.publicUrl });
    else set({ company_logo_url: data.publicUrl });
  };

  const save = async () => {
    if (!userId) return;
    if (!form.full_name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        prc_number: form.prc_number.trim() || null,
        company: form.company.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        service_area: form.service_area.trim() || null,
        location_province: form.location_province,
        location_city: form.location_city,
        avatar_url: form.avatar_url,
        company_logo_url: form.company_logo_url,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Profile updated" });
    onSaved(userId, form.full_name.trim());
    onClose();
  };

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit profile — {userLabel}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="space-y-4 py-2">
            {/* Photo & logo */}
            <div className="flex items-center gap-6">
              <button
                type="button"
                className="relative"
                onClick={() => avatarInput.current?.click()}
                disabled={uploading !== null}
              >
                {form.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.avatar_url}
                    alt="Profile photo"
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
                    {(form.full_name || "?")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase())
                      .join("")}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-orange p-1 text-white">
                  <Camera className="h-3 w-3" />
                </span>
              </button>
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg border p-2 text-left"
                onClick={() => logoInput.current?.click()}
                disabled={uploading !== null}
              >
                {form.company_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.company_logo_url}
                    alt="Company logo"
                    className="h-10 w-10 rounded object-contain"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-gray-400">
                    <Building2 className="h-5 w-5" />
                  </span>
                )}
                <span className="text-xs text-gray-600">
                  {uploading ? "Uploading…" : "Company logo"}
                </span>
              </button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadImage("avatar", e.target.files[0])}
              />
              <input
                ref={logoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadImage("logo", e.target.files[0])}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="pf-name">Name *</Label>
                <Input
                  id="pf-name"
                  value={form.full_name}
                  onChange={(e) => set({ full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pf-phone">Phone</Label>
                <Input
                  id="pf-phone"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  placeholder="0917 123 4567"
                />
              </div>
              <div>
                <Label htmlFor="pf-whatsapp">WhatsApp</Label>
                <Input
                  id="pf-whatsapp"
                  value={form.whatsapp}
                  onChange={(e) => set({ whatsapp: e.target.value })}
                  placeholder="0917 123 4567"
                />
              </div>
              <div>
                <Label htmlFor="pf-prc">PRC License No.</Label>
                <Input
                  id="pf-prc"
                  value={form.prc_number}
                  onChange={(e) => set({ prc_number: e.target.value })}
                  placeholder="e.g. 0012345"
                />
              </div>
              <div>
                <Label htmlFor="pf-company">Company / Brokerage</Label>
                <Input
                  id="pf-company"
                  value={form.company}
                  onChange={(e) => set({ company: e.target.value })}
                  placeholder="e.g. BaMo Realty"
                />
              </div>
              <div>
                <Label>Province</Label>
                <Select
                  value={form.location_province ?? NONE}
                  onValueChange={(v) =>
                    set({
                      location_province: v === NONE ? null : v,
                      location_city: null,
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value={NONE}>—</SelectItem>
                    {psgc.map((p) => (
                      <SelectItem key={p.province} value={p.province}>
                        {p.province}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>City / Municipality</Label>
                <Select
                  value={form.location_city ?? NONE}
                  onValueChange={(v) => set({ location_city: v === NONE ? null : v })}
                  disabled={!form.location_province}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value={NONE}>—</SelectItem>
                    {citiesOf(form.location_province).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="pf-area">Servicing area</Label>
                <Textarea
                  id="pf-area"
                  value={form.service_area}
                  onChange={(e) => set({ service_area: e.target.value })}
                  placeholder="e.g. Cavite, Laguna, and Tagaytay area"
                  rows={2}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || loading || uploading !== null}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white"
          >
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
