
-- Public read for batch-covers, admin write
CREATE POLICY "batch_covers_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'batch-covers');

CREATE POLICY "batch_covers_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'batch-covers' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "batch_covers_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'batch-covers' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "batch_covers_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'batch-covers' AND has_role(auth.uid(), 'admin'::app_role));
