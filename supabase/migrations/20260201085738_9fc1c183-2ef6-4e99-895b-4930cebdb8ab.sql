-- Create bucket for email attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload attachments
CREATE POLICY "Authenticated users can upload email attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'email-attachments');

-- Allow public read access for attachments
CREATE POLICY "Public can read email attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'email-attachments');

-- Allow authenticated users to delete their own attachments
CREATE POLICY "Authenticated users can delete email attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'email-attachments');