-- Multi-source KB: per-source rows, edit-after-approval versioning, image sources.
-- Applied live via MCP apply_migration (kb_multi_source) on 2026-07-17.

-- 1) New columns
ALTER TABLE public.campaign_knowledge_base
  ADD COLUMN IF NOT EXISTS source_label text,
  ADD COLUMN IF NOT EXISTS raw_document_paths jsonb,
  ADD COLUMN IF NOT EXISTS replaces_kb_id uuid REFERENCES public.campaign_knowledge_base(id) ON DELETE SET NULL;

-- 2) Allow 'image' source_type
ALTER TABLE public.campaign_knowledge_base DROP CONSTRAINT IF EXISTS cgkb_source_type_chk;
ALTER TABLE public.campaign_knowledge_base
  ADD CONSTRAINT cgkb_source_type_chk
  CHECK (source_type = ANY (ARRAY['field'::text, 'document'::text, 'website'::text, 'listing'::text, 'image'::text]));

-- 3) Skip n8n extraction when the app already produced proposed_content
--    (in-app vision extraction for images / scanned PDFs presets it).
CREATE OR REPLACE FUNCTION public.notify_n8n_kb_extraction()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.source_type IN ('document','website') AND NEW.review_status = 'pending'
     AND NEW.proposed_content IS NULL
     AND (
       TG_OP = 'INSERT'
       OR OLD.review_status IS DISTINCT FROM 'pending'
       OR OLD.source_type IS DISTINCT FROM NEW.source_type
       OR OLD.raw_document_path IS DISTINCT FROM NEW.raw_document_path
       OR OLD.source_url IS DISTINCT FROM NEW.source_url
     )
  THEN
    PERFORM net.http_post(
      url     := 'https://n8n-bahaymo.onrender.com/webhook/kb-extraction',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'kb_id',             NEW.id,
        'campaign_id',       NEW.campaign_id,
        'source_type',       NEW.source_type,
        'raw_document_path', NEW.raw_document_path,
        'source_url',        NEW.source_url
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;
