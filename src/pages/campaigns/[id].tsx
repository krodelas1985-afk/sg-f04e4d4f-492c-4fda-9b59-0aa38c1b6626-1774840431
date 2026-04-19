import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Lock, Unlock, Plus, Trash2, GripVertical } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

export default function CampaignDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [campaign, setCampaign] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);

  // State variables for sections
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("webform");
  const [status, setStatus] = useState("draft");
  const [targetAction, setTargetAction] = useState("");
  
  // Config states
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
  
  const [isLocked, setIsLocked] = useState(false);
  const [scheduledStepsEnabled, setScheduledStepsEnabled] = useState(true);
  const [conversationalAiEnabled, setConversationalAiEnabled] = useState(false);
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
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: p } = await supabase.from("profiles").select("role, client_id").eq("id", authData.user.id).single();
        setProfile(p);
      }

      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) throw new Error("Failed to fetch campaign");
      const data = await res.json();
      
      setCampaign(data);
      setName(data.name || "");
      setChannel(data.channel || "webform");
      setStatus(data.status || "draft");
      setTargetAction(data.target_action || "");
      setIsLocked(data.is_locked || false);
      setScheduledStepsEnabled(data.scheduled_steps_enabled ?? true);
      setConversationalAiEnabled(data.conversational_ai_enabled ?? false);
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
      setCurrency(data.currency || "PHP");
      setStartDate(data.start_date ? data.start_date.split('T')[0] : "");
      setEndDate(data.end_date ? data.end_date.split('T')[0] : "");
      setSuccessMetric(data.success_metric || "");
      setSourceDetail(data.source_detail || "");
      setTargetIndustries(Array.isArray(data.target_industries) ? data.target_industries : []);
      setJobTitles(Array.isArray(data.job_titles) ? data.job_titles : []);
      
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

      // Fetch knowledge base
      const kbRes = await fetch(`/api/campaigns/${id}/knowledge-base`);
      if (kbRes.ok) {
        const kbData = await kbRes.json();
        setKnowledgeBase(kbData);
      }

      // Fetch templates
      const tRes = await fetch(`/api/campaigns/${id}/templates`);
      if (tRes.ok) {
        const tData = await tRes.json();
        setTemplates(tData);
      }
      
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

  const removeLocation = (loc: string) => {
    setLocations(locations.filter(l => l !== loc));
  };

  const addPropertyType = () => {
    if (propertyTypeInput.trim() && !propertyTypes.includes(propertyTypeInput.trim())) {
      setPropertyTypes([...propertyTypes, propertyTypeInput.trim()]);
      setPropertyTypeInput("");
    }
  };

  const removePropertyType = (pt: string) => {
    setPropertyTypes(propertyTypes.filter(p => p !== pt));
  };

  const addIndustry = () => {
    if (industryInput.trim() && !targetIndustries.includes(industryInput.trim())) {
      setTargetIndustries([...targetIndustries, industryInput.trim()]);
      setIndustryInput("");
    }
  };

  const removeIndustry = (industry: string) => {
    setTargetIndustries(targetIndustries.filter(i => i !== industry));
  };

  const addJobTitle = () => {
    if (jobTitleInput.trim() && !jobTitles.includes(jobTitleInput.trim())) {
      setJobTitles([...jobTitles, jobTitleInput.trim()]);
      setJobTitleInput("");
    }
  };

  const removeJobTitle = (title: string) => {
    setJobTitles(jobTitles.filter(t => t !== title));
  };

  const addQuestion = () => {
    setQualificationQuestions([...qualificationQuestions, ""]);
  };

  const updateQuestion = (index: number, val: string) => {
    const newQs = [...qualificationQuestions];
    newQs[index] = val;
    setQualificationQuestions(newQs);
  };

  const removeQuestion = (index: number) => {
    const newQs = [...qualificationQuestions];
    newQs.splice(index, 1);
    setQualificationQuestions(newQs);
  };

  const toggleEmailSource = (source: string) => {
    if (emailSources.includes(source)) {
      setEmailSources(emailSources.filter(s => s !== source));
    } else {
      setEmailSources([...emailSources, source]);
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add entry");
      }
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
      const res = await fetch(`/api/campaigns/${id}/knowledge-base?entry_id=${entryId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete entry");
      setKnowledgeBase(prev => prev.filter(e => e.id !== entryId));
      toast({ title: "Entry removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    // Validate dates if both are provided
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      toast({ title: "Error", description: "End date must be after start date", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const updateData = {
        name,
        channel,
        status,
        target_action: targetAction,
        is_locked: isLocked,
        currency: currency || "PHP",
        start_date: startDate || null,
        end_date: endDate || null,
        success_metric: successMetric || null,
        source_detail: sourceDetail || null,
        target_industries: targetIndustries,
        scheduled_steps_enabled: scheduledStepsEnabled,
        conversational_ai_enabled: conversationalAiEnabled,
        enrollment_rules: enrollmentRules,
        campaign_rules: campaignRules,
        job_titles: jobTitles,
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
      };

      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update campaign");
      }
      
      toast({ title: "Campaign saved successfully" });
      fetchData(); // refresh data
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DashboardLayout><div className="p-8">Loading...</div></DashboardLayout>;
  if (error) return <DashboardLayout><div className="p-8 text-red-500">{error}</div></DashboardLayout>;
  if (!campaign) return <DashboardLayout><div className="p-8">Not found</div></DashboardLayout>;

  const canEdit = profile?.role === "baymo_admin" || (!campaign.is_locked && (profile?.role === "client_admin" || profile?.role === "manager"));
  const isViewer = profile?.role === "agent" || profile?.role === "viewer";

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold flex-1">{campaign.name}</h1>
          {campaign.is_locked && (
            <div className="flex items-center text-slate-500 bg-slate-100 px-3 py-1 rounded-md text-sm">
              <Lock className="w-4 h-4 mr-2" />
              LOCKED
            </div>
          )}
          {canEdit && !isViewer && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Campaign"}
            </Button>
          )}
        </div>

        {campaign.is_locked && profile?.role !== "baymo_admin" && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md mb-6 flex items-center">
            <Lock className="w-5 h-5 mr-3 text-amber-500" />
            LOCKED — contact BayMo admin to edit
          </div>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Section 1: Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={setChannel} disabled={!canEdit}>
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
                  <Select value={status} onValueChange={setStatus} disabled={!canEdit}>
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

          <Card>
            <CardHeader>
              <CardTitle>Section 2: Goal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Target Action</Label>
                <Textarea 
                  value={targetAction} 
                  onChange={e => setTargetAction(e.target.value)} 
                  disabled={!canEdit}
                  placeholder="e.g. Schedule a viewing, Qualify lead for mortgage"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section 3: Target Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Budget Min</Label>
                  <Input type="number" value={budgetMin} onChange={e => setBudgetMin(Number(e.target.value))} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label>Budget Max</Label>
                  <Input type="number" value={budgetMax} onChange={e => setBudgetMax(Number(e.target.value))} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency} disabled={!canEdit}>
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
                <Input value={buyerType} onChange={e => setBuyerType(e.target.value)} disabled={!canEdit} placeholder="e.g. First-time homebuyer, Investor" />
              </div>
              <div className="space-y-2">
                <Label>Locations</Label>
                <div className="flex gap-2 mb-2">
                  <Input 
                    value={locationInput} 
                    onChange={e => setLocationInput(e.target.value)} 
                    disabled={!canEdit} 
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLocation())}
                  />
                  <Button type="button" onClick={addLocation} disabled={!canEdit}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {locations.map(loc => (
                    <div key={loc} className="bg-slate-100 px-3 py-1 rounded-full text-sm flex items-center">
                      {loc}
                      {canEdit && <button type="button" className="ml-2 text-slate-500 hover:text-slate-800" onClick={() => removeLocation(loc)}>×</button>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Property Types</Label>
                <div className="flex gap-2 mb-2">
                  <Input 
                    value={propertyTypeInput} 
                    onChange={e => setPropertyTypeInput(e.target.value)} 
                    disabled={!canEdit}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPropertyType())}
                  />
                  <Button type="button" onClick={addPropertyType} disabled={!canEdit}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {propertyTypes.map(pt => (
                    <div key={pt} className="bg-slate-100 px-3 py-1 rounded-full text-sm flex items-center">
                      {pt}
                      {canEdit && <button type="button" className="ml-2 text-slate-500 hover:text-slate-800" onClick={() => removePropertyType(pt)}>×</button>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Industries</Label>
                <div className="flex gap-2 mb-2">
                  <Input 
                    value={industryInput} 
                    onChange={e => setIndustryInput(e.target.value)} 
                    disabled={!canEdit}
                    placeholder="e.g. Real Estate, Technology"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addIndustry())}
                  />
                  <Button type="button" onClick={addIndustry} disabled={!canEdit}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {targetIndustries.map(ind => (
                    <div key={ind} className="bg-slate-100 px-3 py-1 rounded-full text-sm flex items-center">
                      {ind}
                      {canEdit && <button type="button" className="ml-2 text-slate-500 hover:text-slate-800" onClick={() => removeIndustry(ind)}>×</button>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Job Titles</Label>
                <div className="flex gap-2 mb-2">
                  <Input 
                    value={jobTitleInput} 
                    onChange={e => setJobTitleInput(e.target.value)} 
                    disabled={!canEdit}
                    placeholder="e.g. Property Manager, Sales Director"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addJobTitle())}
                  />
                  <Button type="button" onClick={addJobTitle} disabled={!canEdit}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {jobTitles.map(jt => (
                    <div key={jt} className="bg-slate-100 px-3 py-1 rounded-full text-sm flex items-center">
                      {jt}
                      {canEdit && <button type="button" className="ml-2 text-slate-500 hover:text-slate-800" onClick={() => removeJobTitle(jt)}>×</button>}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section 4: Qualification Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {qualificationQuestions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical className="w-5 h-5 text-slate-300" />
                  <Input value={q} onChange={e => updateQuestion(i, e.target.value)} disabled={!canEdit} />
                  {canEdit && (
                    <Button variant="ghost" size="icon" onClick={() => removeQuestion(i)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
              {canEdit && (
                <Button variant="outline" onClick={addQuestion}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section 5: Tone & Persona</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                value={tonePersona} 
                onChange={e => setTonePersona(e.target.value)} 
                disabled={!canEdit}
                rows={4}
                placeholder="Describe the tone and persona..."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section 6: Additional Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                value={additionalInstructions} 
                onChange={e => setAdditionalInstructions(e.target.value)} 
                disabled={!canEdit}
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section 7: Campaign Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Success Metric (KPI)</Label>
                <Input 
                  value={successMetric} 
                  onChange={e => setSuccessMetric(e.target.value)} 
                  disabled={!canEdit}
                  placeholder="e.g. 10 booked viewings per month"
                />
              </div>
              <div className="space-y-2">
                <Label>Source Detail</Label>
                <Input 
                  value={sourceDetail} 
                  onChange={e => setSourceDetail(e.target.value)} 
                  disabled={!canEdit}
                  placeholder="e.g. Facebook Ads, LinkedIn Outreach"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section 7b: Knowledge Base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-slate-500">
                Add reference material that BayMo will use when replying to leads — 
                property details, FAQs, pricing, policies, and anything else 
                the AI should know about.
              </p>

              {knowledgeBase.length > 0 && (
                <div className="space-y-3">
                  {knowledgeBase.map(entry => (
                    <div key={entry.id} className="border rounded-lg p-4 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{entry.title}</p>
                          <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">{entry.content}</p>
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteKbEntry(entry.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {knowledgeBase.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm border border-dashed rounded-lg">
                  No knowledge base entries yet. Add your first entry below.
                </div>
              )}

              {canEdit && (
                <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
                  <p className="text-sm font-medium">Add New Entry</p>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={kbTitle}
                      onChange={e => setKbTitle(e.target.value)}
                      placeholder="e.g. Property FAQs, Pricing Guide, Payment Terms"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Textarea
                      value={kbContent}
                      onChange={e => setKbContent(e.target.value)}
                      rows={4}
                      placeholder="Enter the reference content BayMo should use when replying..."
                    />
                  </div>
                  <Button onClick={handleAddKbEntry} disabled={kbSaving}>
                    <Plus className="w-4 h-4 mr-2" />
                    {kbSaving ? "Adding..." : "Add Entry"}
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section 8a: Enrollment Triggers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="space-y-3">
                <Label>Lead Source — which channels enroll leads into this campaign</Label>
                <div className="space-y-3">
                  {[
                    { key: "messenger", label: "Facebook Messenger", idField: "fb_ad_id", idLabel: "FB Ad ID (optional)", idPlaceholder: "e.g. 1234567890" },
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
                          disabled={!canEdit}
                        />
                        <Label htmlFor={`src-${src.key}`} className="font-medium">{src.label}</Label>
                      </div>
                      {src.idField && (enrollmentRules.sources || []).includes(src.key) && (
                        <div className="ml-6 space-y-1">
                          <Label className="text-xs text-slate-500">{src.idLabel}</Label>
                          <Input
                            value={enrollmentRules[src.idField] || ""}
                            onChange={e => setEnrollmentRules({ ...enrollmentRules, [src.idField!]: e.target.value })}
                            placeholder={src.idPlaceholder || ""}
                            disabled={!canEdit}
                            className="max-w-xs"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Select all sources whose leads should be auto-enrolled in this campaign.</p>
              </div>

              <div className="space-y-3">
                <Label>Auto-Enroll Rules</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={enrollmentRules.new_leads_only}
                      onCheckedChange={val => setEnrollmentRules({ ...enrollmentRules, new_leads_only: val })}
                      disabled={!canEdit}
                    />
                    <div>
                      <p className="text-sm font-medium">New leads only</p>
                      <p className="text-xs text-slate-500">Only enroll leads that have never been in BayMo before.</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={enrollmentRules.skip_if_active_campaign}
                      onCheckedChange={val => setEnrollmentRules({ ...enrollmentRules, skip_if_active_campaign: val })}
                      disabled={!canEdit}
                    />
                    <div>
                      <p className="text-sm font-medium">Skip if already in an active campaign</p>
                      <p className="text-xs text-slate-500">Do not enroll leads that are currently active in another campaign.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Returning Lead Threshold (days)</Label>
                <Input
                  type="number"
                  value={enrollmentRules.returning_lead_threshold_days}
                  onChange={e => setEnrollmentRules({ ...enrollmentRules, returning_lead_threshold_days: Number(e.target.value) })}
                  disabled={!canEdit}
                  className="max-w-xs"
                  min={1}
                />
                <p className="text-xs text-slate-500">If a returning lead has not been contacted in this many days, notify the agent instead of auto-enrolling.</p>
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section 8b: Campaign Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="space-y-2">
                <Label>Reply Language</Label>
                <Select
                  value={campaignRules.language}
                  onValueChange={val => setCampaignRules({ ...campaignRules, language: val })}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Filipino">Filipino</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Taglish">Taglish</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">The language BayMo will use when replying to leads in this campaign.</p>
              </div>

              <div className="space-y-2">
                <Label>Sending Hours</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="time"
                    value={campaignRules.sending_hours_start}
                    onChange={e => setCampaignRules({ ...campaignRules, sending_hours_start: e.target.value })}
                    disabled={!canEdit}
                    className="w-36"
                  />
                  <span className="text-slate-500">to</span>
                  <Input
                    type="time"
                    value={campaignRules.sending_hours_end}
                    onChange={e => setCampaignRules({ ...campaignRules, sending_hours_end: e.target.value })}
                    disabled={!canEdit}
                    className="w-36"
                  />
                </div>
                <p className="text-xs text-slate-500">BayMo will only send messages within these hours.</p>
              </div>

              <div className="space-y-2">
                <Label>Do's — things BayMo should always do</Label>
                {(campaignRules.dos || []).map((item: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={e => {
                        const updated = [...campaignRules.dos];
                        updated[i] = e.target.value;
                        setCampaignRules({ ...campaignRules, dos: updated });
                      }}
                      disabled={!canEdit}
                      placeholder="e.g. Always greet the lead by first name"
                    />
                    {canEdit && (
                      <Button variant="ghost" size="icon" onClick={() => {
                        const updated = campaignRules.dos.filter((_: string, idx: number) => idx !== i);
                        setCampaignRules({ ...campaignRules, dos: updated });
                      }}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <Button variant="outline" onClick={() => setCampaignRules({ ...campaignRules, dos: [...(campaignRules.dos || []), ""] })}>
                    <Plus className="w-4 h-4 mr-2" />Add Do
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Don'ts — things BayMo should never do</Label>
                {(campaignRules.donts || []).map((item: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={e => {
                        const updated = [...campaignRules.donts];
                        updated[i] = e.target.value;
                        setCampaignRules({ ...campaignRules, donts: updated });
                      }}
                      disabled={!canEdit}
                      placeholder="e.g. Never discuss competitor properties"
                    />
                    {canEdit && (
                      <Button variant="ghost" size="icon" onClick={() => {
                        const updated = campaignRules.donts.filter((_: string, idx: number) => idx !== i);
                        setCampaignRules({ ...campaignRules, donts: updated });
                      }}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <Button variant="outline" onClick={() => setCampaignRules({ ...campaignRules, donts: [...(campaignRules.donts || []), ""] })}>
                    <Plus className="w-4 h-4 mr-2" />Add Don't
                  </Button>
                )}
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section 9: Automation Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Enable Scheduled Campaign Steps</h4>
                  <p className="text-sm text-slate-500">BayMo will automatically send messages to leads on the schedule defined in the Step Builder.</p>
                </div>
                <Switch
                  checked={scheduledStepsEnabled}
                  onCheckedChange={setScheduledStepsEnabled}
                  disabled={!canEdit}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Enable Conversational AI Replies</h4>
                  <p className="text-sm text-slate-500">BayMo will automatically reply to inbound messages from leads enrolled in this campaign, using the campaign knowledge base and rules as its guide.</p>
                  {conversationalAiEnabled && (
                    <p className="text-xs text-blue-600 mt-1">When active, BayMo will respond to lead messages automatically. Agents can remove automation per lead from the Lead Profile.</p>
                  )}
                </div>
                <Switch
                  checked={conversationalAiEnabled}
                  onCheckedChange={setConversationalAiEnabled}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>

          {profile?.role === "baymo_admin" && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader>
                <CardTitle className="text-red-700">Section 11: Lock Campaign</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-red-900">Lock this campaign</h4>
                    <p className="text-sm text-red-700/80">Prevent non-admins from making changes</p>
                  </div>
                  <Switch 
                    checked={isLocked} 
                    onCheckedChange={setIsLocked}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}