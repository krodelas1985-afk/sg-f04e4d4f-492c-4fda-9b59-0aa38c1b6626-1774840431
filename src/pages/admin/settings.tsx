import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, RefreshCw, Eye, EyeOff } from "lucide-react";

interface Client {
  id: string;
  name: string;
  company_name: string;
  webhook_secret: string | null;
  bamo_api_key: string | null;
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [loadingClient, setLoadingClient] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const res = await fetch("/api/admin/clients");
    if (res.ok) {
      const data = await res.json();
      setClients(data.clients || []);
    }
  };

  const handleSelectClient = async (clientId: string) => {
    setSelectedClientId(clientId);
    setShowSecret(false);
    if (!clientId) {
      setSelectedClient(null);
      return;
    }
    try {
      setLoadingClient(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedClient(data.client);
      }
    } finally {
      setLoadingClient(false);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!selectedClientId) return;
    if (!confirm("Regenerate webhook secret? The old key will stop working immediately.")) return;
    try {
      setIsRegenerating(true);
      const res = await fetch(`/api/admin/clients/${selectedClientId}/regenerate-secret`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to regenerate");
      const data = await res.json();
      setSelectedClient(prev => prev ? { ...prev, webhook_secret: data.webhook_secret } : prev);
      setShowSecret(true);
      toast({ title: "Webhook secret regenerated" });
    } catch {
      toast({ title: "Error", description: "Could not regenerate secret", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: `${label} copied to clipboard` });
  };

  const maskSecret = (secret: string) =>
    secret.slice(0, 8) + "••••••••••••••••••••••••" + secret.slice(-4);

  const integrations = [
    { name: "OpenAI", envKey: "OPENAI_API_KEY", description: "AI reply suggestions & template generation" },
    { name: "Facebook Messenger", envKey: "FACEBOOK_APP_SECRET", description: "Messenger channel integration" },
    { name: "Resend (Email)", envKey: "RESEND_API_KEY", description: "Transactional email delivery" },
    { name: "Bamo", envKey: "BAMO_API_KEY", description: "Bamo lead capture integration" },
  ];

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Settings</h1>
          <p className="text-muted-foreground">Platform configuration and API key management</p>
        </div>

        <div className="space-y-6 max-w-3xl">
          {/* Client Webhook Secret */}
          <Card>
            <CardHeader>
              <CardTitle>Client Webhook Secret</CardTitle>
              <CardDescription>
                Generate or regenerate the webhook secret used to authenticate incoming leads for a client.
                Share this key with the client's integration setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Client</Label>
                <Select value={selectedClientId} onValueChange={handleSelectClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.company_name ? `(${c.company_name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loadingClient && (
                <p className="text-sm text-muted-foreground">Loading client details...</p>
              )}

              {selectedClient && !loadingClient && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label>Webhook Secret</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={
                          selectedClient.webhook_secret
                            ? showSecret
                              ? selectedClient.webhook_secret
                              : maskSecret(selectedClient.webhook_secret)
                            : "No secret generated yet"
                        }
                        className="font-mono text-sm"
                      />
                      {selectedClient.webhook_secret && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowSecret(v => !v)}
                            title={showSecret ? "Hide" : "Show"}
                          >
                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(selectedClient.webhook_secret!, "Webhook secret")}
                            title="Copy"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={handleRegenerateSecret}
                    disabled={isRegenerating}
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
                    {isRegenerating ? "Regenerating..." : selectedClient.webhook_secret ? "Regenerate Secret" : "Generate Secret"}
                  </Button>

                  {selectedClient.webhook_secret && (
                    <p className="text-xs text-muted-foreground">
                      Include this as the <code className="bg-muted px-1 rounded">X-Webhook-Secret</code> header
                      in all incoming webhook requests for this client.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Platform Integrations Status */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Integrations</CardTitle>
              <CardDescription>
                Integration keys are configured via environment variables on the server.
                Contact your deployment team to update these values.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {integrations.map(integration => (
                  <div
                    key={integration.envKey}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">{integration.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono bg-muted px-2 py-0.5 rounded">{integration.envKey}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Webhook Endpoint Reference */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook Endpoint</CardTitle>
              <CardDescription>
                Use this URL to send lead data into the platform. Append the client's webhook secret as a header.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Lead Intake Endpoint</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/lead-intake`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        `${window.location.origin}/api/webhooks/lead-intake`,
                        "Webhook URL"
                      )
                    }
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="bg-muted rounded p-3 text-xs font-mono space-y-1">
                <p className="text-muted-foreground">Required headers:</p>
                <p>X-Webhook-Secret: {"<client_webhook_secret>"}</p>
                <p>Content-Type: application/json</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
