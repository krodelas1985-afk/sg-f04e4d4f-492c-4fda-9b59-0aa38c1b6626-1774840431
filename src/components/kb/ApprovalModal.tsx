import { useState } from 'react'
import { X, CheckCircle, Sparkles, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

interface KbEntry {
  id: string
  campaign_id: string
  proposed_content: string | null
  review_notes: string | null
}

interface Props {
  kb: KbEntry
  onApprove: (content: string) => Promise<void>
  onAiEdit: (currentContent: string, request: string) => Promise<{ proposed_content: string; review_notes: string }>
  onClose: () => void
}

export default function ApprovalModal({ kb, onApprove, onAiEdit, onClose }: Props) {
  const [editedContent, setEditedContent] = useState(kb.proposed_content ?? '')
  const [reviewNotes, setReviewNotes] = useState(kb.review_notes ?? '')
  const [aiRequest, setAiRequest] = useState('')
  const [aiEditing, setAiEditing] = useState(false)
  const [approving, setApproving] = useState(false)
  const [aiError, setAiError] = useState('')

  const hasReviewFlags = reviewNotes && (
    reviewNotes.includes('MISSING:') ||
    reviewNotes.includes('CONFLICTS:') ||
    reviewNotes.includes('UNSURE:')
  )

  async function handleAiEdit() {
    if (!aiRequest.trim()) return
    setAiEditing(true)
    setAiError('')
    try {
      const result = await onAiEdit(editedContent, aiRequest)
      setEditedContent(result.proposed_content)
      setReviewNotes(result.review_notes)
      setAiRequest('')
    } catch {
      setAiError('AI edit failed. Please try again.')
    } finally {
      setAiEditing(false)
    }
  }

  async function handleApprove() {
    if (!editedContent.trim()) return
    setApproving(true)
    try {
      await onApprove(editedContent)
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl my-8 flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-sm font-semibold">Review AI Extraction</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Verify all facts before approving. Check MISSING / CONFLICTS below.
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Review notes */}
          {reviewNotes && (
            <div className={`rounded-lg border px-4 py-3 text-xs ${
              hasReviewFlags
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-muted border-border text-muted-foreground'
            }`}>
              <div className="flex items-center gap-1.5 font-semibold mb-1.5">
                <AlertTriangle size={12} />
                AI Review Notes
              </div>
              <pre className="whitespace-pre-wrap font-sans">{reviewNotes}</pre>
            </div>
          )}

          {/* Editable fact sheet */}
          <div>
            <label className="text-xs font-medium mb-1.5 block">
              Fact Sheet — edit anything before approving
            </label>
            <Textarea
              className="min-h-[320px] font-mono text-xs resize-y"
              value={editedContent}
              onChange={e => setEditedContent(e.target.value)}
            />
          </div>

          {/* Ask AI to change */}
          <div className="flex gap-2">
            <Input
              className="flex-1 text-sm"
              type="text"
              placeholder="Ask AI to change something, e.g. 'Remove the promo section'"
              value={aiRequest}
              onChange={e => setAiRequest(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !aiEditing && handleAiEdit()}
              disabled={aiEditing}
            />
            <Button
              variant="outline"
              onClick={handleAiEdit}
              disabled={aiEditing || !aiRequest.trim()}
              className="whitespace-nowrap"
            >
              <Sparkles size={13} className="mr-1" />
              {aiEditing ? 'Editing...' : 'Ask AI'}
            </Button>
          </div>
          {aiError && <p className="text-xs text-destructive">{aiError}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30 rounded-b-xl">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleApprove}
            disabled={approving || !editedContent.trim()}
          >
            <CheckCircle size={14} className="mr-1" />
            {approving ? 'Approving...' : 'Approve & Use'}
          </Button>
        </div>
      </div>
    </div>
  )
}
