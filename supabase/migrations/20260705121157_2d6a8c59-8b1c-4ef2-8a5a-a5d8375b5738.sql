-- Allow public read access to batch-covers bucket (workspace blocks fully public buckets, so grant via RLS on storage.objects)
DROP POLICY IF EXISTS "Public read batch-covers" ON storage.objects;
CREATE POLICY "Public read batch-covers"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'batch-covers');