import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, GripVertical, Lock } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

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
              <CardTitle>Section 8: Email Triggers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="email-trigger" 
                  checked={emailEnabled} 
                  onCheckedChange={setEmailEnabled}
                  disabled={!canEdit}
                />
                <Label htmlFor="email-trigger">Enable Email Triggers</Label>
              </div>
              
              {emailEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>Allowed Sources</Label>
                    <div className="flex flex-wrap gap-4">
                      {["webform", "bamo", "facebook", "linkedin", "manual", "all"].map(src => (
                        <div key={src} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`src-${src}`} 
                            checked={emailSources.includes(src)}
                            onCheckedChange={() => toggleEmailSource(src)}
                            disabled={!canEdit}
                          />
                          <Label htmlFor={`src-${src}`} className="capitalize">{src}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email Template</Label>
                    <Select value={emailTemplateId} onValueChange={setEmailTemplateId} disabled={!canEdit}>
                      <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
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
                <CardTitle className="text-red-700">Section 10: Lock Campaign</CardTitle>
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