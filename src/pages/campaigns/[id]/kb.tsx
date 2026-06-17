import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useUserProfile } from '@/contexts/UserProfileContext'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import KnowledgeBaseSection from '@/components/kb/KnowledgeBaseSection'

export default function CampaignKbPage() {
  const router = useRouter()
  const { id } = router.query
  const { profile, loading: profileLoading } = useUserProfile()
  const [campaign, setCampaign] = useState<{ id: string; name: string } | null>(null)
  const [initialKb, setInitialKb] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const getSupabase = () => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const getToken = async () => {
    const { data } = await getSupabase().auth.getSession()
    return data.session?.access_token || ''
  }

  useEffect(() => {
    if (!id || profileLoading) return
    if (!profile) { router.push('/login'); return }
    fetchData()
  }, [id, profile, profileLoading])

  async function fetchData() {
    try {
      const supabase = getSupabase()
      const token = await getToken()

      // Fetch campaign name directly from the browser client
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('id', id as string)
        .single()
      if (!campaignData) { router.push('/campaigns'); return }
      setCampaign({ id: campaignData.id, name: campaignData.name })

      // Fetch active KB row via service-role API
      const kbRes = await fetch(`/api/kb?campaign_id=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (kbRes.ok) {
        const { kb } = await kbRes.json()
        setInitialKb(kb ?? null)
      }
    } catch {
      // ignore, will show empty state
    } finally {
      setLoading(false)
    }
  }

  if (profileLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/campaigns')}>
            <ArrowLeft size={14} className="mr-1" /> All Campaigns
          </Button>
        </div>
        <div>
          <h1 className="text-xl font-semibold">{campaign?.name ?? 'Campaign'}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure the knowledge base the lead-response bot uses for this campaign.
          </p>
        </div>

        {campaign && (
          <KnowledgeBaseSection
            campaignId={campaign.id}
            initialKb={initialKb}
            getToken={getToken}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
