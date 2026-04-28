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
import { ArrowLeft, Save, Lock, Unlock, Plus, Trash2, GripVertical, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

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

  const [qualificationQuestions, setQualificationQuestions] = useState<string[]>([]);
  const [tonePersona, setTonePersona] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

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

  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [kbTitle, setKbTitle] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [kbSaving, setKbSaving] = useState(false);

  const [enrollmentRules, setEnrollmentRules] = useState<any>({
    sources: [],
    fb_ad_id: "",
    webform_id: "",
    sms_number: "",
    new_leads_only: true,
    skip_if_active_campaign: true,
    returning_lead_threshold_days: 180
  });

  const [campaignRules, setCampaignRules] = useState<any>({
    language: "Filipino",
    sending_hours_start: "08:00",
    sending_hours_end: "21:00",
    dos: [],
    donts: [],
    temperature_rules: {}
  });

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
        setEnrollmentRules({
          sources: data.enrollment_rules.sources || [],
          fb_ad_id: data.enrollment_rules.fb_ad_id || "",
          webform_id: data.enrollment_rules.webform_id || "",
          sms_number: data.enrollment_rules.sms_number || "",
          new_leads_only: data.enrollment_rules.new_leads_only ?? true,
          skip_if_active_campaign: data.enrollment_rules.skip_if_active_campaign ?? true,
          returning_lead_threshold_days: data.enrollment_rules.returning_lead_threshold_days || 180
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
      setQualificationQuestions(config.qualification_questions || []);
      setTonePersona(config.tone_persona || "");
      setAdditionalInstructions(config.additional_instructions || "");

      const emailTriggers = config.email_triggers || {};
      setEmailEnabled(emailTriggers.enabled || false);
      setEmailSources(emailTriggers.allowed_sources || []);
      setEmailTemplateId(emailTriggers.template_id || "");

      const stepsRes = await fetch(`/api/campaigns/${id}/steps`);
      if (stepsRes.ok) setCampaignSteps(await stepsRes.json());

      const kbRes = await fetch(`/api/campaigns/${id}/knowledge-base`);
      if (kbRes.ok) setKnowledgeBase(await kbRes.json());

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

  const addQuestion = () => setQualificationQuestions([...qualificationQuestions, ""]);

  const updateQuestion = (index: number, val: string) => {
    const newQs = [...qualificationQuestions];
    newQs[index] = val;
    setQualificationQuestions(newQs);
  };

  const removeQuestion = (index: number) => {
    setQualificationQuestions(qualificationQuestions.filter((_, i) => i !== index));
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
      const supabase = await import("@/lib/supabase/client").then(m => m.createClient());
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/campaigns/${id}/steps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
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
      const supabase = await import("@/lib/supabase/client").then(m => m.createClient());
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/campaigns/${id}/steps?step_id=${stepId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${session?.access_token}` }
      });
      if (!res.ok) throw new Error("Failed to delete step");
      setCampaignSteps(prev => prev.filter(s => s.id !== stepId));
      toast({ title: "Step removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAddKbEntry = async () => {
    if (!kbTitle.trim() || !kbContent.trim()) {
      toast({ title: "Error", description: "Title and content are required", variant: "destructive" });
      return;
    }
    try {
      setKbSaving(true);
      const res = await fetch(`/api/campaigns/${id}/knowledge-base`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: kbTitle.trim(), content: kbContent.trim() })
      });
      if (!res.ok) throw new Error("Failed to add entry");
      setKbTitle("");
      setKbContent("");
      const kbRes = await fetch(`/api/campaigns/${id}/knowledge-base`);
      if (kbRes.ok) setKnowledgeBase(await kbRes.json());
      toast({ title: "Knowledge base entry added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setKbSaving(false);
    }
  };

  const handleDeleteKbEntry = async (entryId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}/knowledge-base?entry_id=${entryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
      setKnowledgeBase(prev => prev.filter(e => e.id !== entryId));
      toast({ title: "Entry removed" });
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
          currency: currency || "PHP",
          start_date: startDate || null,
          end_date: endDate || null,
          success_metric: successMetric || null,
          source_detail: sourceDetail || null,
          target_industries: targetIndustries,
          job_titles: jobTitles,
          scheduled_steps_enabled: scheduledStepsEnabled,
          conversational_ai_enabled: conversationalAiEnabled,
          enrollment_rules: enrollmentRules,
          campaign_rules: campaignRules,
          config: {
            target_audience: {
              budget_min: budgetMin,
              budget_max: budgetMax,
              locations,
              property_types: propertyTypes,
              buyer_type: buyerType,
              custom_fields: campaign?.config?.target_audience?.custom_fields || []
            },
            qualification_questions: qualificationQuestions,
            tone_persona: tonePersona,
            additional_instructions: additionalInstructions,
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
                <Label>Allocate to Client</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
