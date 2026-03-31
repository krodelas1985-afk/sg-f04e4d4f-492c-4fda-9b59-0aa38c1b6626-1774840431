import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, ArrowRight } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Client settings
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  // Email settings
  const [emailSettings, setEmailSettings] = useState({
    sender_name: "",
    reply_to_email: "",
    email_signature: "",
  });

  // Profile settings
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        // Fetch client data
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*, client:clients(*)")
          .eq("id", session.user.id)
          .single();

        if (profileData) {
          // Set webhook info
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
          setWebhookUrl(`${appUrl}/api/webhooks/lead`);
          setWebhookSecret(profileData.client?.webhook_secret || "••••••••");

          // Set email settings (from client or defaults)
          setEmailSettings({
            sender_name: profileData.client?.settings?.sender_name || "",
            reply_to_email: profileData.client?.settings?.reply_to_email || "",
            email_signature: profileData.client?.settings?.email_signature || "",
          });

          // Set profile
          setProfile({
            full_name: profileData.full_name || "",
            email: profileData.email || "",
            phone: profileData.phone || "",
          });
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast({
          title: "Error",
          description: "Failed to load settings",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [router, toast]);

  // Copy to clipboard
  const copyToClipboard = async (text: string, type: "webhook" | "secret") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "webhook") {
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2000);
      } else {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      }
      toast({
        title: "Copied",
        description: "Copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  // Save email settings
  const handleSaveEmailSettings = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      // Get client_id
      const { data: profileData } = await supabase
        .from("profiles")
        .select("client_id")
        .eq("id", session.user.id)
        .single();

      if (!profileData?.client_id) throw new Error("Client ID not found");

      // Update client settings
      await supabase
        .from("clients")
        .update({
          settings: {
            sender_name: emailSettings.sender_name,
            reply_to_email: emailSettings.reply_to_email,
            email_signature: emailSettings.email_signature,
          },
        })
        .eq("id", profileData.client_id);

      toast({
        title: "Success",
        description: "Email settings saved",
      });
    } catch (error) {
      console.error("Error saving email settings:", error);
      toast({
        title: "Error",
        description: "Failed to save email settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Save profile
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
        })
        .eq("id", session.user.id);

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#1B3A5C]">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account and workspace settings</p>
        </div>

        <div className="space-y-6">
          {/* SECTION 1 — WEBHOOK */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#1B3A5C]">Webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : (
                <>
                  <div>
                    <Label>Webhook URL</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(webhookUrl, "webhook")}
                      >
                        {copiedWebhook ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Webhook Secret</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={webhookSecret}
                        readOnly
                        type="password"
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(webhookSecret, "secret")}
                      >
                        {copiedSecret ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Share this URL and secret with your form provider to receive leads automatically.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* SECTION 2 — INTEGRATIONS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#1B3A5C]">Integrations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <div className="font-medium">Webform</div>
                  <div className="text-sm text-gray-600">Receive leads from web forms</div>
                </div>
                <Switch checked disabled />
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <div className="font-medium">BaMo Marketplace — Phase 1B</div>
                  <div className="text-sm text-gray-600">Connection coming soon. Schema is ready.</div>
                </div>
                <Switch checked={false} disabled />
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <div className="font-medium">Facebook</div>
                  <div className="text-sm text-gray-600">Connect Facebook Lead Ads</div>
                </div>
                <Switch checked={false} disabled />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">LinkedIn</div>
                  <div className="text-sm text-gray-600">Connect LinkedIn Lead Gen Forms</div>
                </div>
                <Switch checked={false} disabled />
              </div>
              <p className="text-sm text-gray-600 pt-2">
                Contact BaMo admin to change integrations.
              </p>
            </CardContent>
          </Card>

          {/* SECTION 3 — MESSAGE TEMPLATES */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#1B3A5C]">Message Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Create and manage reusable message templates for Email, Messenger, and SMS
              </p>
              <Button
                onClick={() => router.push("/templates")}
                className="bg-[#E87722] hover:bg-[#d66a1e] text-white"
              >
                Go to Templates
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-sm text-gray-600">
                Templates created there will appear in your Inbox and Lead reply boxes automatically.
              </p>
            </CardContent>
          </Card>

          {/* SECTION 4 — EMAIL SETTINGS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#1B3A5C]">Email Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-32 w-full" />
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="sender-name">Sender Name</Label>
                    <Input
                      id="sender-name"
                      value={emailSettings.sender_name}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, sender_name: e.target.value })
                      }
                      placeholder="Your Company Name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reply-to">Reply-To Email</Label>
                    <Input
                      id="reply-to"
                      type="email"
                      value={emailSettings.reply_to_email}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, reply_to_email: e.target.value })
                      }
                      placeholder="hello@yourcompany.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="signature">Email Signature</Label>
                    <Textarea
                      id="signature"
                      value={emailSettings.email_signature}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, email_signature: e.target.value })
                      }
                      placeholder="Best regards,&#10;Your Name&#10;Your Company"
                      rows={4}
                    />
                  </div>
                  <Button
                    onClick={handleSaveEmailSettings}
                    disabled={saving}
                    className="bg-[#E87722] hover:bg-[#d66a1e] text-white"
                  >
                    {saving ? "Saving..." : "Save Email Settings"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* SECTION 5 — PROFILE */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#1B3A5C]">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      readOnly
                      disabled
                      className="bg-gray-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Email cannot be changed to prevent authentication issues
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <Button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="bg-[#E87722] hover:bg-[#d66a1e] text-white"
                  >
                    {saving ? "Saving..." : "Save Profile"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}