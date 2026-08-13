-- Phase 1 of bamo-ops/BaMo_Objection_Handling_and_Hot_Ladder_Plan.md
--
-- Every one of the 50 active objection rows carries memory_label='hesitation'.
-- That is not the model's doing: the label was impossible to express. The CHECK
-- constraint allowed 12 values, none of them an objection KIND, and W1's
-- "Split Memories" node coerced anything unrecognised to 'hesitation' --
--
--   let label = VALID_LABELS.includes(m.memory_label) ? m.memory_label
--             : (m.memory_type === 'hesitation' ? 'hesitation' : 'hesitation');
--
-- (both branches return the same value).
--
-- Widen the constraint first so the extractor and Split Memories have somewhere
-- to put a real classification. Purely additive -- every existing value stays
-- legal, so no row needs rewriting and legacy 'hesitation' keeps counting toward
-- the handoff budget (Kathy 2026-08-12: "let the agent handle them").
ALTER TABLE public.lead_memory DROP CONSTRAINT lead_memory_memory_label_check;

ALTER TABLE public.lead_memory ADD CONSTRAINT lead_memory_memory_label_check
  CHECK (memory_label = ANY (ARRAY[
    -- existing 12, unchanged
    'budget_min','budget_max','preferred_location','property_type','hesitation',
    'financing_concern','urgency','move_in_timeline','payment_preference',
    'buying_signal','language_preference','tone_preference',
    -- objection taxonomy (Phase 1). financing objections reuse financing_concern.
    'price','location','timing','trust','spouse_family','competitor',
    -- hard_refusal bypasses the rebuttal counter entirely and stops the AI
    'hard_refusal'
  ]));

COMMENT ON COLUMN public.lead_memory.memory_label IS
  'With memory_type=''objection'': price | location | timing | trust | spouse_family | competitor | financing_concern are rebuttable; hard_refusal is not -- it bypasses the objection counter and stops the AI outright. Legacy ''hesitation'' rows predate the taxonomy and count as rebuttable.';

-- Verified in a rolled-back transaction: all 7 new labels accepted on insert,
-- 0 rows persisted afterwards.
