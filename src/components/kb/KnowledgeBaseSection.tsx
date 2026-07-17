import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FileText, Globe, PenLine, Database,
  Plus, Trash2, RefreshCw, Upload, ChevronDown, ChevronUp, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import ApprovalModal from './ApprovalModal'

type SourceType = 'field' | 'document' | 'website' | 'listing' | 'image'

export interface KbEntry {
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
  raw_document_paths: string[] | null
  source_url: string | null
  source_label: string | null
  scope?: 'campaign' | 'client' | null
  replaces_kb_id?: string | null
  updated_at?: string
}

// Topics the AI gets asked about constantly — if the combined KB is missing one,
// the AI can't answer it and will refer the lead to the agent (or worse, guess).
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

// Combined size above which full-prompt injection starts to hurt quality/cost.
const KB_SIZE_WARN_CHARS = 16000

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

const SOURCE_META: Record<SourceType, { label: string; icon: typeof PenLine }> = {
  field: { label: 'Manual fields', icon: PenLine },
  document: { label: 'Document', icon: FileText },
  website: { label: 'Website', icon: Globe },
  listing: { label: 'Marketplace listing', icon: Database },
  image: { label: 'Images', icon: Upload },
}

interface Props {
  campaignId: string
  getToken: () => Promise<string>
}

export default function KnowledgeBaseSection({ campaignId, getToken }: Props) {
  const [sources, setSources] = useState<KbEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sourceType, setSourceType] = useState<SourceType>('field')
  const [fieldValues, setFieldValues] = useState<KbFields>({})
  const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>([])
  const [shareClientWide, setShareClientWide] = useState(false)
  const [availStatus, setAvailStatus] = useState('')
  const [promoUntil, setPromoUntil] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [reviewKb, setReviewKb] = useState<KbEntry | null>(null)
  const [editKb, setEditKb] = useState<KbEntry | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchSources = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch(`/api/kb?campaign_id=${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setSources(Array.isArray(data.sources) ? data.sources : (data.kb ? [data.kb] : []))
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [campaignId, getToken])

  useEffect(() => { fetchSources() }, [fetchSources])

  // Poll while any source is still extracting
  const extracting = sources.some(s => s.review_status === 'pending' && !s.proposed_content)
  useEffect(() => {
    if (!extracting) return
    const interval = setInterval(fetchSources, 5000)
    return () => clearInterval(interval)
  }, [extracting, fetchSources])

  const approvedSources = sources.filter(s => s.review_status === 'approved')
  const combinedContent = approvedSources.map(s => s.content).join('\n\n')
  const gaps = findKbGaps(combinedContent)
  const fieldSource = sources.find(s => s.source_type === 'field')

  function openFieldForm(existing?: KbEntry) {
    setSourceType('field')
    const f = (existing?.fields as KbFields) ?? {}
    setFieldValues(f)
    setCustomFields(Array.isArray(f.custom) ? f.custom : [])
    setAvailStatus(existing?.availability_status ?? '')
    setPromoUntil(existing?.promo_valid_until ?? '')
    setShareClientWide(existing?.scope === 'client')
    setShowForm(true)
  }

  function openAddForm() {
    setSourceType(fieldSource ? 'website' : 'field')
    setFieldValues({})
    setCustomFields([])
    setAvailStatus('')
    setPromoUntil('')
    setShareClientWide(false)
    setWebsiteUrl('')
    setDocFiles([])
    setError('')
    setShowForm(true)
  }

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
        const res = await fetch(`/api/kb?campaign_id=${campaignId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaignId, fields, availability_status: availStatus, promo_valid_until: promoUntil, scope: shareClientWide ? 'client' : 'campaign' }),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
      }

      if (sourceType === 'document' || sourceType === 'image') {
        if (docFiles.length === 0) { setError('Please select a file to upload.'); setSaving(false); return }
        setUploading(true)
        const fd = new FormData()
        for (const f of docFiles) fd.append('file', f)
        fd.append('campaign_id', campaignId)
        fd.append('scope', shareClientWide ? 'client' : 'campaign')
        const upRes = await fetch('/api/kb/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        setUploading(false)
        if (!upRes.ok) { const d = await upRes.json(); throw new Error(d.error ?? 'Upload failed') }
      }

      if (sourceType === 'website') {
        if (!websiteUrl.trim()) { setError('Please enter a website URL.'); setSaving(false); return }
        const res = await fetch('/api/kb/website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: campaignId, source_url: websiteUrl.trim(), scope: shareClientWide ? 'client' : 'campaign' }),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
      }

      await fetchSources()
      setShowForm(false)
      setDocFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  async function handleApprove(kb: KbEntry, content: string) {
    const token = await getToken()
    const res = await fetch('/api/kb/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kb_id: kb.id, proposed_content: content }),
    })
    if (!res.ok) throw new Error('Approve failed')
    await fetchSources()
    setReviewKb(null)
  }

  async function handleAiEdit(kb: KbEntry, currentContent: string, request: string) {
    const token = await getToken()
    const res = await fetch('/api/kb/ai-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kb_id: kb.id, proposed_content: currentContent, change_request: request }),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'AI edit failed') }
    return res.json()
  }

  async function handleEditSave(kb: KbEntry, content: string) {
    const token = await getToken()
    const res = await fetch('/api/kb', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kb_id: kb.id, content }),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
    await fetchSources()
    setEditKb(null)
  }

  async function checkConflicts(kb: KbEntry, content: string): Promise<string[]> {
    try {
      const token = await getToken()
      const res = await fetch('/api/kb/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kb_id: kb.id, content }),
      })
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data.conflicts) ? data.conflicts : []
    } catch {
      return []
    }
  }

  async function handleWebsiteRefresh(kb: KbEntry) {
    if (!kb.source_url) return
    setError('')
    setRefreshingId(kb.id)
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
      await fetchSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshingId(null)
    }
  }

  async function handleRemove(kb: KbEntry) {
    const label = kb.source_label ?? (kb.source_type ? SOURCE_META[kb.source_type].label : 'this source')
    if (!window.confirm(`Remove "${label}" from the knowledge base? The AI will stop using its facts.`)) return
    try {
      const token = await getToken()
      const res = await fetch(`/api/kb?kb_id=${kb.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Remove failed') }
      await fetchSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    }
  }

  // ── Source card ─────────────────────────────────────────────────────────────

  function SourceCard({ kb }: { kb: KbEntry }) {
    const meta = kb.source_type ? SOURCE_META[kb.source_type] : SOURCE_META.field
    const Icon = meta.icon
    const isShared = kb.scope === 'client'
    const fromOtherCampaign = isShared && kb.campaign_id !== campaignId
    const isExtracting = kb.review_status === 'pending' && !kb.proposed_content
    const needsReview = kb.review_status === 'pending' && !!kb.proposed_content
    const isApproved = kb.review_status === 'approved'
    const expanded = expandedId === kb.id

    return (
      <Card className={needsReview ? 'border-amber-300' : undefined}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`mt-0.5 flex-shrink-0 ${isApproved ? 'text-green-600' : 'text-amber-600'}`}>
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">
                  {kb.source_label ?? meta.label}
                </div>
                <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">
                    {meta.label}
                  </span>
                  {isApproved && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  )}
                  {isExtracting && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                      <RefreshCw size={9} className="animate-spin" /> Extracting…
                    </span>
                  )}
                  {needsReview && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Needs review
                    </span>
                  )}
                  {isShared && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Shared — all campaigns
                    </span>
                  )}
                  {kb.availability_status && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {AVAIL_OPTIONS.find(o => o.value === kb.availability_status)?.label ?? kb.availability_status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0">
              {needsReview && (
                <Button size="sm" onClick={() => setReviewKb(kb)}>Review &amp; Approve</Button>
              )}
              {isApproved && kb.source_type === 'field' && (
                <Button variant="ghost" size="sm" onClick={() => openFieldForm(kb)} title="Edit fields">
                  <PenLine size={13} />
                </Button>
              )}
              {isApproved && kb.source_type !== 'field' && (
                <Button variant="ghost" size="sm" onClick={() => setEditKb(kb)} title="Edit content">
                  <PenLine size={13} />
                </Button>
              )}
              {isApproved && kb.source_type === 'website' && kb.source_url && (
                <Button
                  variant="ghost" size="sm" title="Re-fetch website"
                  onClick={() => handleWebsiteRefresh(kb)}
                  disabled={refreshingId === kb.id}
                >
                  <RefreshCw size={13} className={refreshingId === kb.id ? 'animate-spin' : ''} />
                </Button>
              )}
              <Button
                variant="ghost" size="sm" title="Remove source"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(kb)}
              >
                <Trash2 size={13} />
              </Button>
            </div>
          </div>

          {fromOtherCampaign && (
            <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5 mt-2">
              Shared client-wide — created in another campaign.
            </p>
          )}

          {isApproved && kb.content && (
            <div className="mt-2">
              <pre className={`text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
                {kb.content}
              </pre>
              <button
                className="text-[11px] text-primary hover:underline mt-1 flex items-center gap-0.5"
                onClick={() => setExpandedId(expanded ? null : kb.id)}
              >
                {expanded ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Show all</>}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground animate-pulse">
          Loading knowledge base…
        </CardContent>
      </Card>
    )
  }

  const sourcePicker = [
    { id: 'field' as SourceType, label: fieldSource ? 'Edit fields' : 'Write fields', desc: 'Fill in labeled boxes — saved immediately, no AI needed.', icon: PenLine, disabled: false },
    { id: 'document' as SourceType, label: 'Upload document', desc: 'PDF or DOCX — AI extracts the facts for your review.', icon: FileText, disabled: false },
    { id: 'website' as SourceType, label: 'Website link', desc: 'Fetched once — AI extracts facts for your review. Refresh anytime.', icon: Globe, disabled: false },
    { id: 'listing' as SourceType, label: 'Marketplace listing', desc: 'Coming soon — pull facts from bahaymo.com.', icon: Database, disabled: true },
  ]

  return (
    <>
      {/* Summary header */}
      <Card>
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Layers size={15} className={approvedSources.length > 0 ? 'text-green-600' : 'text-muted-foreground'} />
            Knowledge Base
            <span className="text-xs font-normal text-muted-foreground">
              {sources.length === 0
                ? 'no sources yet'
                : `${sources.length} source${sources.length === 1 ? '' : 's'} · ~${Math.max(1, Math.round(combinedContent.length / 1000))} KB`}
            </span>
          </div>
          <Button size="sm" onClick={openAddForm}>
            <Plus size={13} className="mr-1" /> Add reference
          </Button>
        </CardHeader>
        <CardContent className="p-4 flex flex-col gap-2">
          {error && !showForm && <p className="text-xs text-destructive">{error}</p>}
          {sources.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add at least one source of truth — the AI can only answer with facts you put here.
              Combine manual fields, your website, brochures, and price lists; every source is
              reviewed by you before the bot uses it.
            </p>
          )}
          {sources.length > 0 && gaps.length > 0 && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <span className="font-semibold">KB gaps — the AI cannot answer questions about:</span>{' '}
              {gaps.join(' · ')}. Leads asking these will be told the team will confirm, and the agent gets notified.
              Add these details (in any source) so the AI can answer directly.
            </div>
          )}
          {combinedContent.length > KB_SIZE_WARN_CHARS && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <span className="font-semibold">Knowledge base is getting large</span>{' '}
              (~{Math.round(combinedContent.length / 1000)} KB). Very large KBs slow the AI down and
              raise costs — consider trimming outdated sections or removing overlapping sources.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source cards */}
      {sources.map(kb => <SourceCard key={kb.id} kb={kb} />)}

      {/* Add / edit form */}
      {showForm && (
        <Card className="mt-2">
          <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between space-y-0">
            <div className="text-sm font-semibold">Add Knowledge Source</div>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              <ChevronUp size={12} className="mr-1" />Close
            </Button>
          </CardHeader>
          <CardContent className="p-4 flex flex-col gap-4">

            {/* Source picker */}
            <div className="grid grid-cols-2 gap-2">
              {sourcePicker.map(s => {
                const Icon = s.icon
                const selected = sourceType === s.id
                return (
                  <button
                    key={s.id}
                    disabled={s.disabled}
                    onClick={() => {
                      if (s.disabled) return
                      if (s.id === 'field') { openFieldForm(fieldSource ?? undefined); return }
                      setSourceType(s.id)
                    }}
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
                  {docFiles.length > 0 ? (
                    <div className="text-xs font-medium">{docFiles.map(f => f.name).join(', ')}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Click to pick a file</div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={e => {
                      const list = Array.from(e.target.files ?? [])
                      if (list.length) setDocFiles(list)
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  After upload, AI will extract the facts. You review &amp; approve before the bot uses them.
                  This is added alongside your other sources.
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
                  Adding a URL that is already a source refreshes that source instead.
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
                For developers running several campaigns on the same project — this source feeds the AI in
                every campaign, instead of copying it per campaign.
              </span>
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
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

      {/* Review pending extraction */}
      {reviewKb?.proposed_content && (
        <ApprovalModal
          kb={reviewKb}
          onApprove={content => handleApprove(reviewKb, content)}
          onAiEdit={(content, request) => handleAiEdit(reviewKb, content, request)}
          onCheckConflicts={approvedSources.some(s => s.id !== reviewKb.id && s.id !== reviewKb.replaces_kb_id)
            ? (content => checkConflicts(reviewKb, content))
            : undefined}
          onClose={() => setReviewKb(null)}
        />
      )}

      {/* Edit approved source */}
      {editKb && (
        <ApprovalModal
          kb={editKb}
          mode="edit"
          onApprove={content => handleEditSave(editKb, content)}
          onAiEdit={(content, request) => handleAiEdit(editKb, content, request)}
          onCheckConflicts={approvedSources.some(s => s.id !== editKb.id)
            ? (content => checkConflicts(editKb, content))
            : undefined}
          onClose={() => setEditKb(null)}
        />
      )}
    </>
  )
}
