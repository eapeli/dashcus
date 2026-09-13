/*
# Storage policies for attachments bucket
Allows authenticated users to upload and read attachments.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "attachments_read" ON storage.objects;
CREATE POLICY "attachments_read" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_insert" ON storage.objects;
CREATE POLICY "attachments_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_update" ON storage.objects;
CREATE POLICY "attachments_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'attachments') WITH CHECK (bucket_id = 'attachments');
