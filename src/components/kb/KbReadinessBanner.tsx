import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clock } from 'lucide-react'

export type KbReadinessResult = {
  ready: boolean
  approvedCount: number
  approvedChars: number
  pendingCount: number
  pendingChars: number
  serving_empty: boolean
  reason: string
}

/**
 * Top-of-page warning when a campaign's conversational AI has no facts to work
 * from, or has sources still stuck in review.
 *
 * Exists because the 2026-08-06 outage was invisible from this screen: the KB
 * lived behind the "AI Behavior" tab, the campaign read as healthy everywhere
 * else, and the bot stayed fluent (project facts are duplicated into
 * ai_message_instructions) while quoting prices it had made up. The signal has
 * to be somewhere you cannot miss it, not one tab deep.
 */
export default function KbReadinessBanner({
  campaignId,
  conversationalAiEnabled,
  getToken,
  refreshKey,
}: {
  campaignId: string
  /** Current *form* value, so the warning appears the moment the toggle flips. */
  conversationalAiEnabled: boolean
  getToken: () => Promise<string | null | undefined>
  /** Bump to re-check after saving the campaign or approving a KB source. */
  refreshKey?: number
}) {
  const [state, setState] = useState<KbReadinessResult | null>(null)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`/api/campaigns/${campaignId}/kb-readiness`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      setState(await res.json())
    } catch {
      // Advisory only — the DB trigger is what actually blocks the write, so a
      // failed check must never get in the way of editing the campaign.
    }
  }, [campaignId, getToken])

  useEffect(() => {
    if (campaignId) load()
  }, [campaignId, load, refreshKey])

  if (!state) return null

  // Already live and answering leads from nothing. Worst case, always shown.
  if (state.serving_empty) {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div>
          <p className="font-semibold">
            BayMo is replying to leads with an empty knowledge base
          </p>
          <p className="mt-1 text-sm text-red-700/90">
            This campaign is active with conversational AI on, but no approved knowledge
            source resolves for it. Replies are running on the prompt instructions alone —
            anything not written there is invented. Turn off conversational AI or approve a
            knowledge source now.
          </p>
          {state.pendingCount > 0 && (
            <p className="mt-2 text-sm text-red-700/90">
              {state.pendingCount} source{state.pendingCount === 1 ? ' is' : 's are'} waiting
              in the Knowledge Base tab — approving {state.pendingCount === 1 ? 'it' : 'them'} fixes this.
            </p>
          )}
        </div>
      </div>
    )
  }

  // AI is about to be switched on but there is nothing approved behind it.
  if (!state.ready && conversationalAiEnabled) {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className="font-semibold">Knowledge base is not ready for conversational AI</p>
          <p className="mt-1 text-sm text-amber-700/90">{state.reason}</p>
        </div>
      </div>
    )
  }

  // KB is usable, but extra sources are stranded in review. Informational — an
  // approved source is already answering, so this is not urgent.
  if (state.pendingCount > 0) {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-slate-700">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
        <div>
          <p className="font-medium">
            {state.pendingCount} knowledge source{state.pendingCount === 1 ? '' : 's'} awaiting review
          </p>
          <p className="mt-1 text-sm text-slate-500">
            BayMo is answering from {state.approvedCount} approved source
            {state.approvedCount === 1 ? '' : 's'}
            {state.pendingChars > 0
              ? ' — plus the unreviewed text in the pending one(s), which W2 injects regardless of review status'
              : ''}
            . Review them in the Knowledge Base tab.
          </p>
        </div>
      </div>
    )
  }

  return null
}
