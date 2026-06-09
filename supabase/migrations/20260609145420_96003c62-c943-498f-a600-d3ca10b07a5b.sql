
-- Quotations table for project quotation files (version history)
CREATE TABLE public.project_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  note text,
  is_current boolean NOT NULL DEFAULT true,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_quotations TO authenticated;
GRANT ALL ON public.project_quotations TO service_role;
ALTER TABLE public.project_quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages project_quotations" ON public.project_quotations
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER project_quotations_updated_at BEFORE UPDATE ON public.project_quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX project_quotations_project_idx ON public.project_quotations(project_id, version DESC);

-- Activity log
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  actor_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  action text NOT NULL,
  description text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads activity_log" ON public.activity_log
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owner inserts activity_log" ON public.activity_log
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE INDEX activity_log_owner_created_idx ON public.activity_log(owner_id, created_at DESC);
CREATE INDEX activity_log_project_idx ON public.activity_log(project_id, created_at DESC);

-- Add photo_url to project_updates
ALTER TABLE public.project_updates ADD COLUMN IF NOT EXISTS photo_path text;

-- Storage RLS for project-files bucket
CREATE POLICY "Owner reads project-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner uploads project-files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner updates project-files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner deletes project-files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);
