import { useState, useEffect, useRef } from 'react'
import {
  CheckCircle2, Clock, FileText, Globe, PenLine, Database,
  Plus, Trash2, RefreshCw, Upload, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import ApprovalModal from './ApprovalModal'

type SourceType = 'field' | 'document' | 'website' | 'listing'

interface KbEntry {
  id: string
  campaign_id: string
  client_id: string
  source_type: SourceType | null
  review_status: 'draft' | 'pending' | 'approved'
  content: string
  proposed_content: string | null
  review_notes: string | null
  fields: Record<string, unknown> | null
  availability_status: string | null
  promo_valid_until: string | null
  raw_document_path: string | null
  source_url: string | null
  scope?: 'campaign' | 'client' | null
}

// Topics the AI gets asked about constantly — if a KB is missing one, the AI
// can't answer it and will refer the lead to the agent (or worse, guess).
const COMPLETENESS_CHECKS: { label: string; test: (c: string) => boolean }[] = [
  { label: 'Pricing / TCP', test: c => /pricing|price|tcp|₱\s?[\d,]|php\s?[\d,]/i.test(c) },
  { label: 'Unit sizes (floor & lot area)', test: c => /floor\s?area|lot\s?area|sq\.?\s?m\b|sqm/i.test(c) },
  { label: 'Financing options', test: c => /financing|pag-?ibig|bank|in-?house/i.test(c) },
  { label: 'Location details', test: c => /location|address|brgy|barangay|city of|,\s?(laguna|cavite|batangas|rizal|quezon|bulacan|pampanga|metro manila)/i.test(c) },
  { label: 'Turnover / availability', test: c => /turnover|rfo|ready for occupancy|pre-?selling|move-?in/i.test(c) },
  { label: 'Reservation process & fees', test: c => /reservation/i.test(c) },
  { label: 'Viewing / tripping', test: c => /viewing|tripping|site visit/i.test(c) },
  { label: 'Contact person', test: c => /contact|agent/i.test(c) },
]

function findKbGaps(content: string): string[] {
  if (!content?.trim()) return COMPLETENESS_CHECKS.map(c => c.label)
  return COMPLETENESS_CHECKS.filter(c => !c.test(content)).map(c => c.label)
}

type KbFields = {
  project_name?: string
  location?: string
  pricing?: string
  financing?: string
  promos?: string
  amenities?: string
  turnover?: string
  reservation?: string
  viewing?: string
  contact?: string
  other?: string
  custom?: Array<{ label: string; value: string }>
}

const FIELD_DEFS: { key: keyof KbFields; label: string; rows: number; placeholder: string }[] = [
  { key: 'project_name', label: 'Project / Offering', rows: 2, placeholder: 'e.g. Vermira by Keyland — single detached & townhouse in Calamba, Laguna' },
  { key: 'location', label: 'Location', rows: 2, placeholder: 'e.g. Brgy. Parian, Calamba, Laguna · 3km from Sta. Rosa interchange' },
  { key: 'pricing', label: 'Pricing & Units', rows: 5, placeholder: 'List each unit type with its TCP and monthly amortization.' },
  { key: 'financing', label: 'Financing', rows: 3, placeholder: 'e.g. Pag-IBIG, bank financing, in-house — terms and rates' },
  { key: 'promos', label: 'Promos / Discounts', rows: 3, placeholder: 'e.g. ₱500k discount, free parking, no down payment — include validity dates' },
  { key: 'amenities', label: 'Amenities', rows: 3, placeholder: 'e.g. clubhouse, pool, playground, CCTV, perimeter fence' },
  { key: 'turnover', label: 'Turnover', rows: 2, placeholder: 'e.g. Ready for occupancy / Q4 2026 / pre-selling' },
  { key: 'reservation', label: 'Reservation / Next step', rows: 2, placeholder: 'e.g. ₱20,000 reservation fee; docs needed; steps after reservation' },
  { key: 'viewing', label: 'Viewing', rows: 2, placeholder: 'e.g. tripping schedule, how to book' },
  { key: 'contact', label: 'Contact', rows: 2, placeholder: 'Agent name, phone, email, FB page' },
  { key: 'other', label: 'Other', rows: 2, placeholder: 'FAQs, notes, anything else the bot should know' },
]

const AVAIL_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'pre_selling', label: 'Pre-selling' },
  { value: 'rfo', label: 'Ready for Occupancy (RFO)' },
  { value: 'available', label: 'Available' },
  { value: 'sold_out', label: 'Sold Out' },
]

interface Props {
  campaignId: string
  initialKb: KbEntry | null
  getToken: () => Promise<string>
}

export default function KnowledgeBaseSection({ campaignId, initialKb, getToken }: Props) {
  const [kb, setKb] = useState<KbEntry | null>(initialKb)
  const [showForm, setShowForm] = useState(!initialKb || initialKb.review_status === 'draft')
  const [sourceType, setSourceType] = useState<SourceType>(
    (initialKb?.source_type as SourceType) ?? 'field'
  )
  const [fieldValues, setFieldValues] = useState<KbFields>(
    initialKb?.source_type === 'field' && initialKb?.fields
      ? (initialKb.fields as KbFields)
      : {}
  )
  const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>(
    Array.isArray((initialKb?.fields as KbFields)?.custom)
      ? ((initialKb!.fields as KbFields).custom ?? [])
      : []
  )
  const [shareClientWide, setShareClientWide] = useState(initialKb?.scope === 'client')
  const [availStatus, setAvailStatus] = useState(initialKb?.availability_status ?? '')
  const [promoUntil, setPromoUntil] = useState(initialKb?.promo_valid_until ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(initialKb?.source_url ?? '')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docFileName, setDocFileName] = useState(initialKb?.raw_document_path?.split('/').pop() ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [showApproval, setShowApproval] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Poll when pending + no proposed_content yet
  useEffect(() => {
    if (kb?.review_status !== 'pending' || kb.proposed_content) return
    const interval = setInterval(async () => {
      try {
        const token = await getToken()
        const res = await fetch(`/api/kb?campaign_id=${campaignId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const { kb: fresh } = await res.json()
        if (fresh) setKb(fresh)
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [kb?.review_status, kb?.proposed_content, campaignId, getToken])

  function setField(key: keyof KbFields, value: string) {
    setFieldValues(prev => ({ ...prev, [key]: value }))
  }

  function addCustomField() {
    setCustomFields(prev => [...prev, { label: '', value: '' }])
  }

  function updateCustomField(i: number, part: 'label' | 'value', val: string) {
    setCustomFields(prev => prev.map((f, idx) => idx === i ? { ...f, [part]: val } : f))
  }

  function removeCustomField(i: number) {
    setCustomFields(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      const token = await getToken()

      if (sourceType === 'field') {
        const fields = { ...fieldValues, custom: customFields }
        const res = await fetch('/api/kb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaignId, fields, availability_status: availStatus, promo_valid_until: promoUntil, scope: shareClientWide ? 'client' : 'campaign' }),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
        const { kb: saved } = await res.json()
        setKb(saved)
        setShowForm(false)
      }

      if (sourceType === 'document') {
        if (!docFile) { setError('Please select a document to upload.'); setSaving(false); return }
        setUploading(true)
        const fd = new FormData()
        fd.append('file', docFile)
        fd.append('campaign_id', campaignId)
        fd.append('scope', shareClientWide ? 'client' : 'campaign')
        const upRes = await fetch('/api/kb/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        setUploading(false)
        if (!upRes.ok) { const d = await upRes.json(); throw new Error(d.error ?? 'Upload failed') }
        const { kb: saved } = await upRes.json()
        setKb(saved)
        setShowForm(false)
      }

      if (sourceType === 'website') {
        if (!websiteUrl.trim()) { setError('Please enter a website URL.'); setSaving(false); return }
        const res = await fetch('/api/kb/website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaignId, source_url: websiteUrl.trim(), scope: shareClientWide ? 'client' : 'campaign' }),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
        const { kb: saved } = await res.json()
        setKb(saved)
        setShowForm(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  async function handleApprove(content: string) {
    if (!kb) return
    const token = await getToken()
    const res = await fetch('/api/kb/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kb_id: kb.id, proposed_content: content }),
    })
    if (!res.ok) throw new Error('Approve failed')
    const { kb: updated } = await res.json()
    setKb(updated)
    setShowApproval(false)
  }

  async function handleAiEdit(currentContent: string, request: string) {
    if (!kb) throw new Error('No KB entry')
    const token = await getToken()
    const res = await fetch('/api/kb/ai-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kb_id: kb.id, proposed_content: currentContent, change_request: request }),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'AI edit failed') }
    return res.json()
  }

  async function handleRefresh() {
    try {
      const token = await getToken()
      const res = await fetch(`/api/kb?campaign_id=${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const { kb: fresh } = await res.json()
      if (fresh) setKb(fresh)
    } catch { /* ignore */ }
  }

  // Edit an approved KB → PUT saves a new approved version
  async function handleEditSave(content: string) {
    if (!kb) return
    const token = await getToken()
    const res = await fetch('/api/kb', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kb_id: kb.id, content }),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
    const { kb: updated } = await res.json()
    setKb(updated)
    setShowEdit(false)
  }

  // Re-fetch a website source → new pending extraction; old KB stays live until approval
  async function handleWebsiteRefresh() {
    if (!kb?.source_url) return
    setError('')
    setRefreshing(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/kb/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campaign_id: campaignId,
          source_url: kb.source_url,
          scope: kb.scope ?? 'campaign',
          replace_kb_id: kb.id,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Refresh failed') }
      const { kb: fresh } = await res.json()
      setKb(fresh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  // ── Status panel ────────────────────────────────────────────────────────────

  function StatusPanel() {
    if (!kb) return null

    if (kb.review_status === 'approved') {
      const gaps = findKbGaps(kb.content)
      const hasRealNotes = !!kb.review_notes?.trim()
        && !/all facts appear complete/i.test(kb.review_notes)
      return (
        <Card>
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
              <CheckCircle2 size={15} />
              Knowledge Base Active
            </div>
            <div className="flex items-center gap-1">
              {kb.source_type === 'field' ? (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { setSourceType('field'); setShowForm(true) }}
                >
                  <PenLine size={12} className="mr-1" />Edit fields
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setShowEdit(true)}>
                  <PenLine size={12} className="mr-1" />Edit
                </Button>
              )}
              {kb.source_type === 'website' && kb.source_url && (
                <Button variant="ghost" size="sm" onClick={handleWebsiteRefresh} disabled={refreshing}>
                  <RefreshCw size={12} className={`mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Fetching…' : 'Refresh'}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowForm(f => !f)}>
                {showForm
                  ? <><ChevronUp size={12} className="mr-1" />Hide form</>
                  : <><ChevronDown size={12} className="mr-1" />Change source</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {error && !showForm && <p className="text-xs text-destructive mb-2">{error}</p>}
            <div className="flex gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 uppercase">
                {kb.source_type}
              </span>
              {kb.scope === 'client' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase">
                  Shared — all campaigns
                </span>
              )}
              {kb.availability_status && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {AVAIL_OPTIONS.find(o => o.value === kb.availability_status)?.label ?? kb.availability_status}
                </span>
              )}
            </div>
            {kb.scope === 'client' && kb.campaign_id !== campaignId && (
              <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 mb-2">
                This knowledge base is shared client-wide and was created in another campaign.
                Saving a new KB here creates a version for this campaign (or replaces the shared one if you keep it shared).
              </p>
            )}
            {gaps.length > 0 && (
              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2">
                <span className="font-semibold">KB gaps — the AI cannot answer questions about:</span>{' '}
                {gaps.join(' · ')}. Leads asking these will be told the team will confirm, and the agent gets notified.
                Add these details so the AI can answer directly.
              </div>
            )}
            {hasRealNotes && (
              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2 whitespace-pre-wrap">
                <span className="font-semibold">Review notes from extraction:</span>{'\n'}{kb.review_notes}
              </div>
            )}
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans line-clamp-6 leading-relaxed">
              {kb.content || '(empty)'}
            </pre>
          </CardContent>
        </Card>
      )
    }

    if (kb.review_status === 'pending') {
      if (kb.proposed_content) {
        return (
          <Card className="border-amber-300">
            <CardContent className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                <Clock size={14} />
                Extraction complete — review &amp; approve
              </div>
              <Button size="sm" onClick={() => setShowApproval(true)}>Review &amp; Approve</Button>
            </CardContent>
          </Card>
        )
      }
      return (
        <Card className="border-amber-200">
          <CardContent className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <RefreshCw size={14} className="animate-spin" />
              Extracting knowledge base… this may take a minute
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw size={12} className="mr-1" /> Refresh
            </Button>
          </CardContent>
        </Card>
      )
    }

    return null
  }

  // ── Source picker ───────────────────────────────────────────────────────────

  const sources = [
    { id: 'field' as SourceType, label: 'Write fields', desc: 'Fill in labeled boxes — saved immediately, no AI needed.', icon: PenLine, disabled: false },
    { id: 'document' as SourceType, label: 'Upload document', desc: 'PDF or DOCX — AI extracts the facts for your review.', icon: FileText, disabled: false },
    { id: 'website' as SourceType, label: 'Website link', desc: 'One-time fetch — AI extracts facts for your review.', icon: Globe, disabled: false },
    { id: 'listing' as SourceType, label: 'Marketplace listing', desc: 'Coming soon — pull facts from bahaymo.com.', icon: Database, disabled: true },
  ]

  return (
    <>
      <StatusPanel />

      {showForm && (
        <Card className="mt-4">
          <CardHeader className="py-3 px-4 border-b">
            <div className="text-sm font-semibold">
              {kb ? 'Change Knowledge Base Source' : 'Set Up Knowledge Base'}
            </div>
          </CardHeader>
          <CardContent className="p-4 flex flex-col gap-4">

            {/* Source picker */}
            <div className="grid grid-cols-2 gap-2">
              {sources.map(s => {
                const Icon = s.icon
                const selected = sourceType === s.id
                return (
                  <button
                    key={s.id}
                    disabled={s.disabled}
                    onClick={() => !s.disabled && setSourceType(s.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      s.disabled
                        ? 'opacity-40 cursor-not-allowed border-border bg-muted'
                        : selected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:bg-muted cursor-pointer'
                    }`}
                  >
                    <div className={`mt-0.5 flex-shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className={`text-xs font-semibold ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {s.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{s.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Field entry */}
            {sourceType === 'field' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Availability</Label>
                    <Select value={availStatus} onValueChange={setAvailStatus}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Not specified" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAIL_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value || '_none'}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Promo valid until</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={promoUntil}
                      onChange={e => setPromoUntil(e.target.value)}
                    />
                  </div>
                </div>

                {FIELD_DEFS.map(f => (
                  <div key={f.key}>
                    <Label className="text-xs mb-1.5 block">{f.label}</Label>
                    <Textarea
                      className="resize-y text-sm"
                      rows={f.rows}
                      placeholder={f.placeholder}
                      value={(fieldValues[f.key] as string) ?? ''}
                      onChange={e => setField(f.key, e.target.value)}
                    />
                  </div>
                ))}

                {customFields.map((cf, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="w-36 flex-shrink-0">
                      <Input
                        className="text-xs h-8"
                        placeholder="Label"
                        value={cf.label}
                        onChange={e => updateCustomField(i, 'label', e.target.value)}
                      />
                    </div>
                    <Textarea
                      className="flex-1 resize-none text-xs"
                      rows={2}
                      placeholder="Value"
                      value={cf.value}
                      onChange={e => updateCustomField(i, 'value', e.target.value)}
                    />
                    <button
                      onClick={() => removeCustomField(i)}
                      className="mt-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="self-start" onClick={addCustomField}>
                  <Plus size={12} className="mr-1" /> Add custom field
                </Button>
              </>
            )}

            {/* Document upload */}
            {sourceType === 'document' && (
              <div>
                <Label className="text-xs mb-1.5 block">
                  Document <span className="text-muted-foreground font-normal">PDF, DOCX, or TXT — max 50 MB</span>
                </Label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <Upload size={20} className="mx-auto text-muted-foreground mb-2" />
                  {docFileName ? (
                    <div className="text-xs font-medium">{docFileName}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Click to pick a file</div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) { setDocFile(f); setDocFileName(f.name) }
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  After upload, AI will extract the facts. You review &amp; approve before the bot uses them.
                </p>
              </div>
            )}

            {/* Website link */}
            {sourceType === 'website' && (
              <div>
                <Label className="text-xs mb-1.5 block">Website URL</Label>
                <Input
                  type="url"
                  placeholder="https://developer-site.com/project-page"
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  The page is fetched once. AI extracts facts. You review &amp; approve before the bot uses them.
                </p>
              </div>
            )}

            <label className="flex items-start gap-2 text-xs cursor-pointer select-none border rounded-md p-3 bg-muted/40">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 accent-primary"
                checked={shareClientWide}
                onChange={e => setShareClientWide(e.target.checked)}
              />
              <span>
                <span className="font-semibold">Share with all campaigns of this client.</span>{' '}
                For developers running several campaigns on the same project — one KB feeds the AI in every campaign,
                instead of copying it per campaign. Replaces any previous shared KB for this client.
              </span>
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              {kb && (
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || uploading}
              >
                {uploading ? 'Uploading...' : saving ? 'Saving...' : sourceType === 'field' ? 'Save Knowledge Base' : 'Submit for Extraction'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showApproval && kb?.proposed_content && (
        <ApprovalModal
          kb={kb}
          onApprove={handleApprove}
          onAiEdit={handleAiEdit}
          onClose={() => setShowApproval(false)}
        />
      )}

      {showEdit && kb && (
        <ApprovalModal
          kb={kb}
          mode="edit"
          onApprove={handleEditSave}
          onAiEdit={handleAiEdit}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  )
}
