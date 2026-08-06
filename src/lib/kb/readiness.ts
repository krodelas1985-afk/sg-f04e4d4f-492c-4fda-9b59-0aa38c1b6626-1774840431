import { createServerClient } from '@/lib/supabase/server'

/**
 * Whether a campaign's knowledge base can actually answer a lead.
 *
 * This is the app-side mirror of the SQL in
 * `supabase/migrations/20260806100000_campaign_kb_empty_guard.sql`, which is in
 * turn the mirror of W2's kb_text query ("Fetch Lead + Campaign + KB"). Three
 * copies of one predicate is one too many, but the DB is the enforcement layer
 * (it is the only one every writer shares) and this exists so the CRM can say
 * *why* before the write is rejected. If W2's query changes, change all three.
 */
export type KbReadiness = {
  /** At least one active, approved, non-empty knowledge row resolves for this campaign. */
  ready: boolean
  /** Combined characters W2 would inject as {{kb_text}} from approved rows. */
  approvedChars: number
  /** Rows that count towards `approvedChars`. */
  approvedCount: number
  /** Active knowledge rows still awaiting review — content W2 sees but no human approved. */
  pendingCount: number
  /** Combined characters sitting in those unapproved rows. */
  pendingChars: number
}

type KbRow = {
  content: string | null
  review_status: string | null
  scope: string | null
}

export function summarizeKbRows(rows: KbRow[]): KbReadiness {
  const len = (c: string | null) => (c ?? '').trim().length
  const approved = rows.filter(r => r.review_status === 'approved' && len(r.content) > 0)
  const pending = rows.filter(r => r.review_status !== 'approved')

  return {
    ready: approved.length > 0,
    approvedCount: approved.length,
    approvedChars: approved.reduce((a, r) => a + len(r.content), 0),
    pendingCount: pending.length,
    pendingChars: pending.reduce((a, r) => a + len(r.content), 0),
  }
}

/**
 * Reads with the service-role client on purpose: callers have already
 * authorised the user against the campaign, and a `client_admin` whose RLS
 * hides a client-scoped row would otherwise get a readiness answer that
 * disagrees with what W2 will actually inject.
 */
export async function getCampaignKbReadiness(
  campaignId: string,
  clientId: string
): Promise<KbReadiness> {
  const supabase = createServerClient()

  // Same predicate as W2: rows on this campaign, plus client-scoped rows that
  // apply to every campaign of the client.
  const { data, error } = await supabase
    .from('campaign_knowledge_base')
    .select('content, review_status, scope')
    .eq('is_active', true)
    .eq('type', 'knowledge')
    .or(`campaign_id.eq.${campaignId},and(scope.eq.client,client_id.eq.${clientId})`)

  if (error) throw new Error(`KB readiness lookup failed: ${error.message}`)
  return summarizeKbRows((data ?? []) as KbRow[])
}

/** Operator-facing explanation of why a campaign can't go live with AI on. */
export function kbBlockReason(r: KbReadiness): string {
  if (r.ready) return ''
  if (r.pendingCount > 0) {
    return `This campaign has ${r.pendingCount} knowledge source${r.pendingCount === 1 ? '' : 's'} awaiting review. ` +
      `Approve ${r.pendingCount === 1 ? 'it' : 'them'} in the Knowledge Base tab, then turn on conversational AI — ` +
      `otherwise BayMo answers leads with no facts at all and invents them.`
  }
  return 'This campaign has no approved knowledge source with content. Add and approve one in the ' +
    'Knowledge Base tab before turning on conversational AI — otherwise BayMo answers leads with no ' +
    'facts at all and invents them.'
}
