-- get_admin_ai_metrics runs on every /admin page load. Without these two
-- partial indexes it costs ~445ms and ~44k buffer hits, because both hot paths
-- fall back to idx_conversations_lead_created and then filter rows out:
--
--   * the 24h reply EXISTS re-filters direction='inbound' on every loop
--   * the latency lateral re-filters sender/direction/sent_via to find the
--     responder reply for each inbound message
--
-- With them: ~75-100ms and ~16k buffers (4.5x faster, 2.8x fewer buffers).
-- Both also serve the Inbox and lead-timeline reads, which filter the same way.
-- conversations is ~10MB/13.5k rows, so a plain CREATE INDEX locks writes for
-- only a few milliseconds.

create index if not exists idx_conv_inbound_lead_created
  on public.conversations (lead_id, created_at)
  where direction = 'inbound';

create index if not exists idx_conv_responder_lead_created
  on public.conversations (lead_id, created_at)
  where sender = 'ai' and direction = 'outbound' and sent_via is null;

analyze public.conversations;
