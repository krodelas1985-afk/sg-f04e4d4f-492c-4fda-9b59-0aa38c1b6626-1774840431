-- KB image sources (Phase 3): the kb-docs storage bucket only allowed
-- PDF/DOCX/TXT, so image uploads failed with "mime type image/png is not
-- supported". Allow the image types the vision extraction accepts.
-- Applied live via MCP apply_migration (kb_docs_bucket_allow_images) 2026-07-17.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp'
]
WHERE id = 'kb-docs';
