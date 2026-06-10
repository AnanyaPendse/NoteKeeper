
CREATE POLICY "Users read own note images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own note images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own note images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own note images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);
