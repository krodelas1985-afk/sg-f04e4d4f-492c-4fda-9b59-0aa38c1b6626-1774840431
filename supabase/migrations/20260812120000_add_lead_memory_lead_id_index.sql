-- lead_memory had ONLY lead_memory_pkey (id) -- no index on lead_id at all,
-- despite W2 and W5 both joining or filtering it by lead_id on every message.
-- Every one of those lookups was a sequential scan of the whole table.
--
-- Surfaced while planning the objection subqueries for W5's decay pass: those
-- alone did 100 seq scans per run (2 subqueries x 50 leads), 1,500 shared
-- buffers. With idx_lead_memory_lead_id_type_active they become index scans:
-- decay-pass EXPLAIN ANALYZE went 185ms -> 104ms, buffers 2,358 -> 1,060.
CREATE INDEX IF NOT EXISTS idx_lead_memory_lead_id_active
  ON public.lead_memory (lead_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_lead_memory_lead_id_type_active
  ON public.lead_memory (lead_id, memory_type)
  WHERE is_active;
