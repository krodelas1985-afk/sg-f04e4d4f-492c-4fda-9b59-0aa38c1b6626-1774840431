import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Lock, Unlock, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import KnowledgeBaseSection from "@/components/kb/KnowledgeBaseSection";

interface Client {
  id: string;
  name: string;
  company_name: string;
}

export default function AdminCampaignDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState("webform");
  const [status, setStatus] = useState("draft");
  const [targetAction, setTargetAction] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [clientId, setClientId] = useState<string>("unallocated");

  const [budgetMin, setBudgetMin] = useState(0);
  const [budgetMax, setBudgetMax] = useState(0);
  const [currency, setCurrency] = useState("PHP");
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [propertyTypeInput, setPropertyTypeInput] = useState("");
  const [buyerType, setBuyerType] = useState("");
  const [targetIndustries, setTargetIndustries] = useState<string[]>([]);
  const [industryInput, setIndustryInput] = useState("");
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [jobTitleInput, setJobTitleInput] = useState("");

  const QUALIFICATION_FIELDS = [
    { field: 'current_location', label: "Lead's Current Location", placeholder: 'e.g. Saan po kayo nakatira ngayon?' },
    { field: 'property_type', label: 'Preferred Property Type', placeholder: 'e.g. Anong type ng property po ang hinahanap ninyo?' },
    { field: 'property_sub_type', label: 'Property Structure Type', placeholder: 'e.g. Bahay at lupa, condo, town house, o vacant lot lang?' },
    { field: 'payment_scheme', label: 'Payment Scheme', placeholder: 'e.g. Cash, installment, o bank financing ang plano?' },
    { field: 'budget', label: 'Budget', placeholder: 'e.g. May budget range po ba kayo?' },
    { field: 'timeframe', label: 'Buying Timeline', placeholder: 'e.g. Kailan kayo balak bumili?' },
    { field: 'phone', label: 'Contact Number', placeholder: 'e.g. May contact number po ba kayo?' },
    { field: 'purpose', label: 'Purpose of Purchase', placeholder: 'e.g. Para sa sariling tirahan o investment?' },
    { field: 'viewing_schedule', label: 'Viewing Availability', placeholder: 'e.g. Kelan po kayo available para sa viewing?' },
    { field: 'preferred_location', label: 'Preferred Location', placeholder: 'e.g. Saan po ang gusto ninyong lokasyon ng property?' },
    { field: 'bedroom', label: 'Bedroom Preference', placeholder: 'e.g. Ilang bedroom po ang hinahanap ninyo?' },
    { field: 'unit_preferred', label: 'Unit Preferred', placeholder: 'e.g. Anong type ng unit po ang gusto ninyo? (Studio, 1BR, 2BR?)' },
    { field: 'motivation', label: 'Motivation', placeholder: 'e.g. Ano po ang dahilan ng paghahanap ng property?' },
    { field: 'civil_status', label: 'Civil Status', placeholder: 'e.g. Ano po ang inyong civil status?' },
    { field: 'decision_maker', label: 'Decision Maker', placeholder: 'e.g. Kayo po ba ang mag-desisyon o may kasama kayong mag-aapprove?' },
    { field: 'email', label: 'Email Address', placeholder: 'e.g. May email address po ba kayo?' },
  ];

  const [qualificationFields, setQualificationFields] = useState<Record<string, string>>(
    Object.fromEntries(QUALIFICATION_FIELDS.map(f => [f.field, '']))
  );
  const [qualificationEnabled, setQualificationEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(QUALIFICATION_FIELDS.map(f => [f.field, true]))
  );
  const [tonePersona, setTonePersona] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailSources, setEmailSources] = useState<string[]>([]);
  const [emailTemplateId, setEmailTemplateId] = useState<string>("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [successMetric, setSuccessMetric] = useState("");
  const [sourceDetail, setSourceDetail] = useState("");

  const [scheduledStepsEnabled, setScheduledStepsEnabled] = useState(true);
  const [conversationalAiEnabled, setConversationalAiEnabled] = useState(false);
  const [campaignSteps, setCampaignSteps] = useState<any[]>([]);
  const [stepsSaving, setStepsSaving] = useState(false);
  const [newStep, setNewStep] = useState<any>({
    step_type: "message",
    delay_hours: 24,
    channel: "messenger",
    message_template: "",
    ai_screen_before_send: true,
    notification_message: ""
  });

  const [initialKb, setInitialKb] = useState<any>(null);

  const [aiDecisionInstructions, setAiDecisionInstructions] = useState("");
  const [aiMessageInstructions, setAiMessageInstructions] = useState("");
  const [assignedClientIds, setAssignedClientIds] = useState<string[]>([]);

  const [enrollmentRules, setEnrollmentRules] = useState<any>({
    sources: [],
    fb_ad_id: "",
    fb_ad_ids: ["", "", ""],
    webform_id: "",
    sms_number: "",
    new_leads_only: true,
    skip_if_active_campaign: true,
    returning_lead_threshold_days: 180,
    lead_temperature: ""
  });

  const [campaignRules, setCampaignRules] = useState<any>({
    language: "Filipino",
    sending_hours_start: "08:00",
    sending_hours_end: "21:00",
    dos: [],
    donts: [],
    temperature_rules: {}
  });

  // ── Auth token helper ────────────────────────────────────────────────────────
  const getToken = async () => {
    const supabase = await import("@/lib/supabase/client").then(m => m.createClient());
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [campRes, clientRes] = await Promise.all([
        fetch(`/api/admin/campaigns/${id}`),
        fetch("/api/admin/clients"),
      ]);

      if (!campRes.ok) throw new Error("Failed to fetch campaign");
      const data = await campRes.json();

      if (clientRes.ok) {
        const clientData = await clientRes.json();
        setClients(clientData.clients || []);
      }

      setCampaign(data);
      setName(data.name || "");
      setChannel(data.channel || "webform");
      setStatus(data.status || "draft");
      setTargetAction(data.target_action || "");
      setIsLocked(data.is_locked || false);
      setIsActive(data.is_active || false);
      setClientId(data.client_id || "unallocated");
      setAiDecisionInstructions(data.ai_decision_instructions || "");
      setAiMessageInstructions(data.ai_message_instructions || "");
      // Load all assigned clients from client_campaigns join
      const assigned = (data.client_campaigns || []).map((cc: any) => cc.client_id).filter(Boolean);
      setAssignedClientIds(assigned);
      setScheduledStepsEnabled(data.scheduled_steps_enabled ?? true);
      setConversationalAiEnabled(data.conversational_ai_enabled ?? false);
      setCurrency(data.currency || "PHP");
      setStartDate(data.start_date ? data.start_date.split('T')[0] : "");
      setEndDate(data.end_date ? data.end_date.split('T')[0] : "");
      setSuccessMetric(data.success_metric || "");
      setSourceDetail(data.source_detail || "");
      setTargetIndustries(Array.isArray(data.target_industries) ? data.target_industries : []);
      setJobTitles(Array.isArray(data.job_titles) ? data.job_titles : []);

      if (data.enrollment_rules) {
        // fb_ad_ids (up to 3) supersedes the legacy single fb_ad_id; merge
        // a legacy value into the array so it stays visible and editable.
        const loadedAdIds: string[] =
          Array.isArray(data.enrollment_rules.fb_ad_ids) && data.enrollment_rules.fb_ad_ids.length
            ? data.enrollment_rules.fb_ad_ids
            : data.enrollment_rules.fb_ad_id
            ? [data.enrollment_rules.fb_ad_id]
            : [];
        setEnrollmentRules({
          sources: data.enrollment_rules.sources || [],
          fb_ad_id: "",
          fb_ad_ids: [0, 1, 2].map(i => loadedAdIds[i] || ""),
          webform_id: data.enrollment_rules.webform_id || "",
          sms_number: data.enrollment_rules.sms_number || "",
          new_leads_only: data.enrollment_rules.new_leads_only ?? true,
          skip_if_active_campaign: data.enrollment_rules.skip_if_active_campaign ?? true,
          returning_lead_threshold_days: data.enrollment_rules.returning_lead_threshold_days || 180,
          lead_temperature: data.enrollment_rules.lead_temperature || ""
        });
      }

      if (data.campaign_rules) {
        setCampaignRules({
          language: data.campaign_rules.language || "Filipino",
          sending_hours_start: data.campaign_rules.sending_hours_start || "08:00",
          sending_hours_end: data.campaign_rules.sending_hours_end || "21:00",
          dos: data.campaign_rules.dos || [],
          donts: data.campaign_rules.donts || [],
          temperature_rules: data.campaign_rules.temperature_rules || {}
        });
      }

      const config = data.config || {};
      const targetAudience = config.target_audience || {};
      setBudgetMin(targetAudience.budget_min || 0);
      setBudgetMax(targetAudience.budget_max || 0);
      setLocations(targetAudience.locations || []);
      setPropertyTypes(targetAudience.property_types || []);
      setBuyerType(targetAudience.buyer_type || "");
      const savedFields = config.qualification_fields || [];
      const fieldMap: Record<string, string> = Object.fromEntries(QUALIFICATION_FIELDS.map(f => [f.field, '']));
      const enabledMap: Record<string, boolean> = Object.fromEntries(QUALIFICATION_FIELDS.map(f => [f.field, true]));
      savedFields.forEach((item: { field: string; question: string; enabled?: boolean }) => {
        if (item.field in fieldMap) fieldMap[item.field] = item.question || '';
        if (item.field in enabledMap) enabledMap[item.field] = item.enabled !== false;
      });
      setQualificationFields(fieldMap);
      setQualificationEnabled(enabledMap);
      setTonePersona(config.tone_persona || "");
      setAiInstruction(data.ai_instruction || config.additional_instructions || "");

      const emailTriggers = config.email_triggers || {};
      setEmailEnabled(emailTriggers.enabled || false);
      setEmailSources(emailTriggers.allowed_sources || []);
      setEmailTemplateId(emailTriggers.template_id || "");

      const stepsRes = await fetch(`/api/campaigns/${id}/steps`);
      if (stepsRes.ok) setCampaignSteps(await stepsRes.json());

      // ── Fetch active KB row from campaign_knowledge_base ──────────────────────
      const token = await getToken();
      const kbRes = await fetch(`/api/kb?campaign_id=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (kbRes.ok) {
        const { kb: kbData } = await kbRes.json();
        setInitialKb(kbData ?? null);
      }

      const tRes = await fetch(`/api/campaigns/${id}/templates`);
      if (tRes.ok) setTemplates(await tRes.json());

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addLocation = () => {
    if (locationInput.trim() && !locations.includes(locationInput.trim())) {
      setLocations([...locations, locationInput.trim()]);
      setLocationInput("");
    }
  };

  const addPropertyType = () => {
    if (propertyTypeInput.trim() && !propertyTypes.includes(propertyTypeInput.trim())) {
      setPropertyTypes([...propertyTypes, propertyTypeInput.trim()]);
      setPropertyTypeInput("");
    }
  };

  const addIndustry = () => {
    if (industryInput.trim() && !targetIndustries.includes(industryInput.trim())) {
      setTargetIndustries([...targetIndustries, industryInput.trim()]);
      setIndustryInput("");
    }
  };

  const addJobTitle = () => {
    if (jobTitleInput.trim() && !jobTitles.includes(jobTitleInput.trim())) {
      setJobTitles([...jobTitles, jobTitleInput.trim()]);
      setJobTitleInput("");
    }
  };

  const handleAddStep = async () => {
    if (newStep.step_type === "message" && !newStep.message_template.trim()) {
      toast({ title: "Error", description: "Message content is required", variant: "destructive" });
      return;
    }
    if (newStep.step_type === "notify_agent" && !newStep.notification_message.trim()) {
      toast({ title: "Error", description: "Notification message is required", variant: "destructive" });
      return;
    }
    try {
      setStepsSaving(true);
      const token = await getToken();
      const res = await fetch(`/api/campaigns/${id}/steps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newStep)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add step");
      }
      setNewStep({ step_type: "message", delay_hours: 24, channel: "messenger", message_template: "", ai_screen_before_send: true, notification_message: "" });
      const stepsRes = await fetch(`/api/campaigns/${id}/steps`);
      if (stepsRes.ok) setCampaignSteps(await stepsRes.json());
      toast({ title: "Step added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setStepsSaving(false);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/campaigns/${id}/steps?step_id=${stepId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete step");
      setCampaignSteps(prev => prev.filter(s => s.id !== stepId));
      toast({ title: "Step removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      toast({ title: "Error", description: "End date must be after start date", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channel,
          status,
          target_action: targetAction,
          is_locked: isLocked,
          is_active: isActive,
          client_id: clientId === "unallocated" ? null : clientId,
          ai_decision_instructions: aiDecisionInstructions || null,
          ai_message_instructions: aiMessageInstructions || null,
          assigned_client_ids: assignedClientIds,
          currency: currency || "PHP",
          start_date: startDate || null,
          end_date: endDate || null,
          success_metric: successMetric || null,
          source_detail: sourceDetail || null,
          target_industries: targetIndustries,
          job_titles: jobTitles,
          scheduled_steps_enabled: scheduledStepsEnabled,
          conversational_ai_enabled: conversationalAiEnabled,
          enrollment_rules: {
            ...enrollmentRules,
            fb_ad_id: "",
            fb_ad_ids: (enrollmentRules.fb_ad_ids || [])
              .map((s: string) => (s || "").trim())
              .filter(Boolean),
          },
          campaign_rules: campaignRules,
          ai_instruction: aiInstruction,
          config: {
            target_audience: {
              budget_min: budgetMin,
              budget_max: budgetMax,
              locations,
              property_types: propertyTypes,
              buyer_type: buyerType,
              custom_fields: campaign?.config?.target_audience?.custom_fields || []
            },
            qualification_fields: QUALIFICATION_FIELDS.map(f => ({
              field: f.field,
              label: f.label,
              question: qualificationFields[f.field] || '',
              enabled: qualificationEnabled[f.field] !== false
            })),
            tone_persona: tonePersona,
            email_triggers: {
              enabled: emailEnabled,
              allowed_sources: emailSources,
              template_id: emailTemplateId || null
            }
          }
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update campaign");
      }
      toast({ title: "Campaign saved successfully" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DashboardLayout><div className="p-8">Loading...</div></DashboardLayout>;
  if (error) return <DashboardLayout><div className="p-8 text-red-500">{error}</div></DashboardLayout>;
  if (!campaign) return <DashboardLayout><div className="p-8">Not found</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/campaigns")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold flex-1">{campaign.name}</h1>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Campaign"}
          </Button>
        </div>

        <div className="space-y-6">

          {/* Admin Controls */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="text-blue-700">Admin Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Primary Client</Label>
                <Select value={clientId} onValueChange={(val) => {
                  setClientId(val);
                  // Ensure primary client is always in assigned list
                  if (val !== "unallocated" && !assignedClientIds.includes(val)) {
                    setAssignedClientIds(prev => [...prev, val]);
                  }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unallocated">— Unallocated —</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.company_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">The main client that owns this campaign.</p>
              </div>

              {clients.length > 0 && (
                <div className="space-y-2">
                  <Label>Assign to Additional Clients</Label>
                  <p className="text-xs text-slate-500">These clients can view and edit this campaign alongside the primary client.</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2">
                    {clients
                      .filter(c => c.id !== (clientId === "unallocated" ? "" : clientId))
                      .map(c => (
                        <div key={c.id} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`cc-${c.id}`}
                            checked={assignedClientIds.includes(c.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setAssignedClientIds(prev => [...prev, c.id]);
                              } else {
                                setAssignedClientIds(prev => prev.filter(id => id !== c.id));
                              }
                            }}
                          />
                          <Label htmlFor={`cc-${c.id}`} className="text-sm font-normal">
                            {c.name} <span className="text-slate-400">({c.company_name})</span>
                          </Label>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-900">Active (visible to client)</p>
                  <p className="text-sm text-blue-700/80">Client can only see this campaign when active</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-900">Locked (prevent client edits)</p>
                  <p className="text-sm text-blue-700/80">When locked, only baymo_admin can edit</p>
                </div>
                <Switch checked={isLocked} onCheckedChange={setIsLocked} />
              </div>
            </CardContent>
          </Card>

          {/* Section 1 */}
          <Card>
            <CardHeader><CardTitle>Section 1: Basic Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webform">Webform</SelectItem>
                      <SelectItem value="bamo">Bamo</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2 */}
          <Card>
            <CardHeader><CardTitle>Section 2: Goal</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Target Action</Label>
                <Textarea value={targetAction} onChange={e => setTargetAction(e.target.value)} placeholder="e.g. Schedule a viewing, Qualify lead for mortgage" />
              </div>
            </CardContent>
          </Card>

          {/* Section 3 */}
          <Card>
            <CardHeader><CardTitle>Section 3: Target Audience</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Budget Min</Label>
                  <Input type="number" value={budgetMin} onChange={e => setBudgetMin(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Budget Max</Label>
                  <Input type="number" value={budgetMax} onChange={e => setBudgetMax(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHP">PHP (₱)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Buyer Type</Label>
                <Input value={buyerType} onChange={e => setBuyerType(e.target.value)} placeholder="e.g. First-time homebuyer, Investor" />
              </div>
              <div className="space-y-2">
                <Label>Locations</Label>
                <div className="flex gap-2 mb-2">
                  <Input value={locationInput} onChange={e => setLocationInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLocation())} />
                  <Button type="button" onClick={addLocation}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {locations.map(loc => (
                    <div key={loc} className="bg-slate-100 px-3 py-1 rounded-full text-sm flex items-center">
                      {loc}
                      <button type="button" className="ml-2 text-slate-500 hover:text-slate-800" onClick={() => setLocations(locations.filter(l => l !== loc))}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Property Types</Label>
                <div className="flex gap-2 mb-2">
                  <Input value={propertyTypeInput} onChange={e => setPropertyTypeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPropertyType())} />
                  <Button type="button" onClick={addPropertyType}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {propertyTypes.map(pt => (
                    <div key={pt} className="bg-slate-100 px-3 py-1 rounded-full text-sm flex items-center">
                      {pt}
                      <button type="button" className="ml-2 text-slate-500 hover:text-slate-800" onClick={() => setPropertyTypes(propertyTypes.filter(p => p !== pt))}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Industries</Label>
                <div className="flex gap-2 mb-2">
                  <Input value={industryInput} onChange={e => setIndustryInput(e.target.value)} placeholder="e.g. Real Estate, Technology" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addIndustry())} />
                  <Button type="button" onClick={addIndustry}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {targetIndustries.map(ind => (
                    <div key={ind} className="bg-slate-100 px-3 py-1 rounded-full text-sm flex items-center">
                      {ind}
                      <button type="button" className="ml-2 text-slate-500 hover:text-slate-800" onClick={() => setTargetIndustries(targetIndustries.filter(i => i !== ind))}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Job Titles</Label>
                <div className="flex gap-2 mb-2">
                  <Input value={jobTitleInput} onChange={e => setJobTitleInput(e.target.value)} placeholder="e.g. Property Manager, Sales Director" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addJobTitle())} />
                  <Button type="button" onClick={addJobTitle}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {jobTitles.map(jt => (
                    <div key={jt} className="bg-slate-100 px-3 py-1 rounded-full text-sm flex items-center">
                      {jt}
                      <button type="button" className="ml-2 text-slate-500 hover:text-slate-800" onClick={() => setJobTitles(jobTitles.filter(t => t !== jt))}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4 */}
          <Card>
            <CardHeader>
              <CardTitle>Section 4: Qualification Questions</CardTitle>
              <p className="text-sm text-slate-500">Toggle each question on or off. Enabled questions will be asked by the AI. Set custom wording or leave blank to let the AI ask naturally.</p>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {QUALIFICATION_FIELDS.map((item) => {
                  const isEnabled = qualificationEnabled[item.field] !== false;
                  return (
                    <div
                      key={item.field}
                      className={`grid grid-cols-3 gap-4 py-3 items-center transition-opacity ${!isEnabled ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={val => setQualificationEnabled(prev => ({ ...prev, [item.field]: val }))}
                          className="mt-0.5 shrink-0"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-700 leading-tight">{item.label}</p>
                          <p className="text-xs text-slate-400">{item.field}</p>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <Input
                          value={qualificationFields[item.field] || ''}
                          onChange={e => setQualificationFields(prev => ({ ...prev, [item.field]: e.target.value }))}
                          placeholder={isEnabled ? item.placeholder : 'Disabled — AI will skip this question'}
                          disabled={!isEnabled}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Section 5 */}
          <Card>
            <CardHeader><CardTitle>Section 5: Tone & Persona</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={tonePersona} onChange={e => setTonePersona(e.target.value)} rows={4} placeholder="Describe the tone and persona..." />
            </CardContent>
          </Card>

          {/* Section 6 */}
          <Card>
            <CardHeader>
              <CardTitle>Section 6: AI Instruction</CardTitle>
              <p className="text-sm text-slate-500">Define the AI's role, tone, and behavior. This is the system prompt that guides how BayMo responds to leads.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label>AI Instruction</Label>
              <Textarea
                value={aiInstruction}
                onChange={e => setAiInstruction(e.target.value)}
                rows={6}
                placeholder="e.g. You are a friendly real estate assistant for [Company]. Your goal is to qualify leads and schedule property viewings. Always respond in a warm, professional tone..."
              />
            </CardContent>
          </Card>

          {/* Section 6a — AI Instructions */}
          <Card className="border-violet-200 bg-violet-50/30">
            <CardHeader>
              <CardTitle className="text-violet-800">Section 6a: AI Instructions (Per-Campaign)</CardTitle>
              <p className="text-sm text-slate-500">
                Override the default AI behaviour for this campaign. Leave blank to use BayMo defaults.
                Use <code className="text-xs bg-slate-100 px-1 rounded">{`{{lead_name}}`}</code>,{" "}
                <code className="text-xs bg-slate-100 px-1 rounded">{`{{campaign_name}}`}</code>,{" "}
                <code className="text-xs bg-slate-100 px-1 rounded">{`{{next_field}}`}</code>,{" "}
                <code className="text-xs bg-slate-100 px-1 rounded">{`{{filled_fields}}`}</code> as variables.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-violet-700">Decision Prompt (used by AI to choose action: proceed / skip / pause / notify_agent)</Label>
                <Textarea
                  value={aiDecisionInstructions}
                  onChange={e => setAiDecisionInstructions(e.target.value)}
                  rows={6}
                  placeholder="Leave blank to use BayMo default decision prompt. Write a full system prompt to override it for this campaign."
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-violet-700">Message Prompt (used by AI to compose the reply)</Label>
                <Textarea
                  value={aiMessageInstructions}
                  onChange={e => setAiMessageInstructions(e.target.value)}
                  rows={6}
                  placeholder="Leave blank to use BayMo default message prompt. Write a full system prompt to override it for this campaign."
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 7 */}
          <Card>
            <CardHeader><CardTitle>Section 7: Campaign Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Success Metric (KPI)</Label>
                <Input value={successMetric} onChange={e => setSuccessMetric(e.target.value)} placeholder="e.g. 10 booked viewings per month" />
              </div>
              <div className="space-y-2">
                <Label>Source Detail</Label>
                <Input value={sourceDetail} onChange={e => setSourceDetail(e.target.value)} placeholder="e.g. Facebook Ads, LinkedIn Outreach" />
              </div>
            </CardContent>
          </Card>

          {/* Section 7a */}
          <Card>
            <CardHeader><CardTitle>Section 7a: Step Builder</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-slate-500">Define the sequence of messages BayMo will send to leads enrolled in this campaign.</p>
              {campaignSteps.length > 0 && (
                <div className="space-y-3">
                  {campaignSteps.map((step, index) => (
                    <div key={step.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded-full">Step {index + 1}</span>
                            <span className="text-xs font-medium capitalize text-slate-600">{step.step_type === "notify_agent" ? "Notify Agent" : step.step_type}</span>
                            {step.step_type === "message" && <span className="text-xs text-slate-400 capitalize">via {step.channel}</span>}
                            <span className="text-xs text-slate-400">· {step.delay_hours === 0 ? "Immediately" : `After ${step.delay_hours}h`}</span>
                          </div>
                          {step.step_type === "message" && step.message_template && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{step.message_template}</p>}
                          {step.step_type === "notify_agent" && step.notification_message && <p className="text-sm text-slate-600 mt-1">{step.notification_message}</p>}
                          {step.step_type === "message" && <p className="text-xs text-slate-400">AI screen: {step.ai_screen_before_send ? "ON" : "OFF"}</p>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteStep(step.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {campaignSteps.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm border border-dashed rounded-lg">No steps yet. Add your first step below.</div>
              )}
              <div className="border rounded-lg p-4 space-y-4 bg-slate-50">
                <p className="text-sm font-medium">Add New Step</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Step Type</Label>
                    <Select value={newStep.step_type} onValueChange={val => setNewStep({ ...newStep, step_type: val })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="message">Message</SelectItem>
                        <SelectItem value="wait">Wait</SelectItem>
                        <SelectItem value="notify_agent">Notify Agent</SelectItem>
                        <SelectItem value="stop">Stop Campaign</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Delay (hours)</Label>
                    <Input type="number" min={0} value={newStep.delay_hours} onChange={e => setNewStep({ ...newStep, delay_hours: Number(e.target.value) })} />
                  </div>
                </div>
                {newStep.step_type === "message" && (
                  <>
                    <div className="space-y-2">
                      <Label>Channel</Label>
                      <Select value={newStep.channel} onValueChange={val => setNewStep({ ...newStep, channel: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="messenger">Facebook Messenger</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Textarea value={newStep.message_template} onChange={e => setNewStep({ ...newStep, message_template: e.target.value })} rows={4} placeholder="Type the message BayMo will send. Use {first_name} to personalize." />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch checked={newStep.ai_screen_before_send} onCheckedChange={val => setNewStep({ ...newStep, ai_screen_before_send: val })} />
                      <div>
                        <p className="text-sm font-medium">AI screen before sending</p>
                        <p className="text-xs text-slate-500">BayMo will review the conversation before sending.</p>
                      </div>
                    </div>
                  </>
                )}
                {newStep.step_type === "notify_agent" && (
                  <div className="space-y-2">
                    <Label>Notification Message</Label>
                    <Input value={newStep.notification_message} onChange={e => setNewStep({ ...newStep, notification_message: e.target.value })} placeholder="e.g. Lead has not replied after 3 follow-ups — please call" />
                  </div>
                )}
                {newStep.step_type === "stop" && <p className="text-sm text-slate-500">This step will stop the campaign for this lead.</p>}
                {newStep.step_type === "wait" && <p className="text-sm text-slate-500">This step pauses the sequence for the delay period above.</p>}
                <Button onClick={handleAddStep} disabled={stepsSaving}>
                  <Plus className="w-4 h-4 mr-2" />{stepsSaving ? "Adding..." : "Add Step"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Section 7b */}
          <Card>
            <CardHeader>
              <CardTitle>Section 7b: Knowledge Base</CardTitle>
              <p className="text-sm text-slate-500">
                Configure the facts BayMo uses when replying to leads in this campaign. One source at a time.
              </p>
            </CardHeader>
            <CardContent>
              <KnowledgeBaseSection
                campaignId={id as string}
                initialKb={initialKb}
                getToken={getToken}
              />
            </CardContent>
          </Card>

          {/* Section 8a */}
          <Card>
            <CardHeader><CardTitle>Section 8a: Enrollment Triggers</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Lead Source</Label>
                <div className="space-y-3">
                  {[
                    { key: "messenger", label: "Facebook Messenger", idField: "fb_ad_ids", idLabel: "FB Ad IDs (optional — up to 3)", idPlaceholder: "e.g. 1234567890" },
                    { key: "webform", label: "Webform", idField: "webform_id", idLabel: "Webform ID (optional)", idPlaceholder: "e.g. contact-form-1" },
                    { key: "sms", label: "SMS", idField: "sms_number", idLabel: "SMS Number (optional)", idPlaceholder: "e.g. +639XXXXXXXXX" },
                    { key: "bamo", label: "BaMo Marketplace", idField: null, idLabel: null, idPlaceholder: null },
                    { key: "manual", label: "Manual (agent adds lead)", idField: null, idLabel: null, idPlaceholder: null },
                  ].map(src => (
                    <div key={src.key} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`src-${src.key}`}
                          checked={(enrollmentRules.sources || []).includes(src.key)}
                          onCheckedChange={(checked) => {
                            const updated = checked
                              ? [...(enrollmentRules.sources || []), src.key]
                              : (enrollmentRules.sources || []).filter((s: string) => s !== src.key);
                            setEnrollmentRules({ ...enrollmentRules, sources: updated });
                          }}
                        />
                        <Label htmlFor={`src-${src.key}`} className="font-medium">{src.label}</Label>
                      </div>
                      {src.idField && (enrollmentRules.sources || []).includes(src.key) && (
                        <div className="ml-6 space-y-1">
                          <Label className="text-xs text-slate-500">{src.idLabel}</Label>
                          {src.idField === "fb_ad_ids" ? (
                            <>
                              {[0, 1, 2].map(i => (
                                <Input
                                  key={i}
                                  value={(enrollmentRules.fb_ad_ids || [])[i] || ""}
                                  onChange={e => {
                                    const ids = [...(enrollmentRules.fb_ad_ids || ["", "", ""])];
                                    ids[i] = e.target.value;
                                    setEnrollmentRules({ ...enrollmentRules, fb_ad_ids: ids });
                                  }}
                                  placeholder={src.idPlaceholder || ""}
                                  className="max-w-xs"
                                />
                              ))}
                              <p className="text-xs text-slate-500">
                                If any Ad ID is set, ONLY Messenger leads arriving from one of these ads are enrolled — leads without ad attribution are excluded. Leave all empty to enroll from any Messenger conversation.
                              </p>
                            </>
                          ) : (
                            <Input
                              value={enrollmentRules[src.idField] || ""}
                              onChange={e => setEnrollmentRules({ ...enrollmentRules, [src.idField!]: e.target.value })}
                              placeholder={src.idPlaceholder || ""}
                              className="max-w-xs"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label>Auto-Enroll Rules</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch checked={enrollmentRules.new_leads_only} onCheckedChange={val => setEnrollmentRules({ ...enrollmentRules, new_leads_only: val })} />
                    <div>
                      <p className="text-sm font-medium">New leads only</p>
                      <p className="text-xs text-slate-500">Only enroll leads that have never been in BayMo before.</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch checked={enrollmentRules.skip_if_active_campaign} onCheckedChange={val => setEnrollmentRules({ ...enrollmentRules, skip_if_active_campaign: val })} />
                    <div>
                      <p className="text-sm font-medium">Skip if already in an active campaign</p>
                      <p className="text-xs text-slate-500">Do not enroll leads currently active in another campaign.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Returning Lead Threshold (days)</Label>
                <Input type="number" value={enrollmentRules.returning_lead_threshold_days} onChange={e => setEnrollmentRules({ ...enrollmentRules, returning_lead_threshold_days: Number(e.target.value) })} className="max-w-xs" min={1} />
              </div>
              <div className="space-y-2">
                <Label>Lead Temperature Filter</Label>
                <Select value={enrollmentRules.lead_temperature || "any"} onValueChange={val => setEnrollmentRules({ ...enrollmentRules, lead_temperature: val === "any" ? "" : val })}>
                  <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any temperature</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">Only enroll leads matching this temperature. Leave as "Any" to enroll regardless of temperature.</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 8b */}
          <Card>
            <CardHeader><CardTitle>Section 8b: Campaign Rules</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Reply Language</Label>
                <Select value={campaignRules.language} onValueChange={val => setCampaignRules({ ...campaignRules, language: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Filipino">Filipino</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Taglish">Taglish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>AI Auto-Reply Hours</Label>
                <div className="flex items-center gap-3">
                  <Input type="time" value={campaignRules.sending_hours_start} onChange={e => setCampaignRules({ ...campaignRules, sending_hours_start: e.target.value })} className="w-36" />
                  <span className="text-slate-500">to</span>
                  <Input type="time" value={campaignRules.sending_hours_end} onChange={e => setCampaignRules({ ...campaignRules, sending_hours_end: e.target.value })} className="w-36" />
                </div>
                <p className="text-xs text-slate-500">The AI auto-replies to leads only within these hours. Outside this window, conversations are left for the agent to handle manually.</p>
              </div>
              <div className="space-y-2">
                <Label>Do's</Label>
                {(campaignRules.dos || []).map((item: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={item} onChange={e => { const updated = [...campaignRules.dos]; updated[i] = e.target.value; setCampaignRules({ ...campaignRules, dos: updated }); }} placeholder="e.g. Always greet the lead by first name" />
                    <Button variant="ghost" size="icon" onClick={() => setCampaignRules({ ...campaignRules, dos: campaignRules.dos.filter((_: string, idx: number) => idx !== i) })}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setCampaignRules({ ...campaignRules, dos: [...(campaignRules.dos || []), ""] })}>
                  <Plus className="w-4 h-4 mr-2" />Add Do
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Don'ts</Label>
                {(campaignRules.donts || []).map((item: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={item} onChange={e => { const updated = [...campaignRules.donts]; updated[i] = e.target.value; setCampaignRules({ ...campaignRules, donts: updated }); }} placeholder="e.g. Never discuss competitor properties" />
                    <Button variant="ghost" size="icon" onClick={() => setCampaignRules({ ...campaignRules, donts: campaignRules.donts.filter((_: string, idx: number) => idx !== i) })}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setCampaignRules({ ...campaignRules, donts: [...(campaignRules.donts || []), ""] })}>
                  <Plus className="w-4 h-4 mr-2" />Add Don't
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Section 9 */}
          <Card>
            <CardHeader><CardTitle>Section 9: Automation Mode</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Enable Scheduled Campaign Steps</h4>
                  <p className="text-sm text-slate-500">BayMo will automatically send messages on the schedule defined in the Step Builder.</p>
                </div>
                <Switch checked={scheduledStepsEnabled} onCheckedChange={setScheduledStepsEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Enable Conversational AI Replies</h4>
                  <p className="text-sm text-slate-500">BayMo will automatically reply to inbound messages from leads enrolled in this campaign.</p>
                </div>
                <Switch checked={conversationalAiEnabled} onCheckedChange={setConversationalAiEnabled} />
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </DashboardLayout>
  );
}
