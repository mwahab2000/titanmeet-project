CREATE POLICY "Public can view client basics"
ON public.clients
FOR SELECT
TO anon, authenticated
USING (true);