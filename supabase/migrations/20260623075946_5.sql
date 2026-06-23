[?25l[90m│[39m
[35m◒[39m  Downloading snippet[1G[J[35m◐[39m  Downloading snippet[1G[J[35m◓[39m  Downloading snippet[1G[J[35m◑[39m  Downloading snippet[1G[J[35m◒[39m  Downloading snippet[1G[J[35m◐[39m  Downloading snippet[1G[J[?25hALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS work_area text;
CREATE INDEX IF NOT EXISTS idx_attendance_work_area ON public.attendance(project_id, work_area);
