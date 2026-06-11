import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listProjectsWithStats, getProjectAssignedWorkers, getAttendanceForProjectDay } from "@/lib/stats.functions";
import { upsertAttendance } from "@/lib/attendance.functions";
import { ATTENDANCE_LABEL, type AttendanceType } from "@/lib/wages";
import { toast } from "sonner";
import { Calendar, ArrowLeft, HardHat, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const TYPES: AttendanceType[] = ["full", "half", "overtime", "absent"];

function AttendancePage() {
  const [projectId, setProjectId] = useState<string | null>(null);

  return projectId
    ? <ProjectAttendance projectId={projectId} onBack={() => setProjectId(null)} />
    : <ProjectPicker onPick={setProjectId} />;
}

function ProjectPicker({ onPick }: { onPick: (id: string) => void }) {
  const fn = useServerFn(listProjectsWithStats);
  const { data: projects = [] } = useQuery({ queryKey: ["projects", "stats"], queryFn: () => fn() });
  const active = projects.filter((p) => p.status === "active" || p.status === "planning");

  return (
    <div className="space-y-4">
      <Card className="p-4 glass flex items-center gap-3">
        <HardHat className="size-5 text-primary" />
        <div>
          <p className="font-medium text-sm">Select project</p>
          <p className="text-xs text-muted-foreground">Mark attendance for workers assigned to this site.</p>
        </div>
      </Card>

      {active.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">
          No active projects. Create a project and assign workers first.
        </Card>
      ) : (
        <Card className="divide-y">
          {active.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className="w-full text-left p-4 hover:bg-accent/40 transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.location || "—"}</p>
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {p.assignedCount} assigned · {p.presentToday} present today
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

function ProjectAttendance({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const qc = useQueryClient();

  const workersFn = useServerFn(getProjectAssignedWorkers);
  const dayFn = useServerFn(getAttendanceForProjectDay);
  const upsertFn = useServerFn(upsertAttendance);
  const projectsFn = useServerFn(listProjectsWithStats);

  const { data: projects = [] } = useQuery({ queryKey: ["projects", "stats"], queryFn: () => projectsFn() });
  const project = projects.find((p) => p.id === projectId);

  const { data: workers = [] } = useQuery({
    queryKey: ["project-workers", projectId],
    queryFn: () => workersFn({ data: { project_id: projectId } }),
  });
  const { data: dayRows = [] } = useQuery({
    queryKey: ["attendance", projectId, date],
    queryFn: () => dayFn({ data: { project_id: projectId, date } }),
  });
  const byWorker = new Map(dayRows.map((r) => [r.worker_id, r.type as AttendanceType]));

  const mark = useMutation({
    mutationFn: (vars: { worker_id: string; type: AttendanceType }) =>
      upsertFn({ data: { ...vars, date, project_id: projectId } }),
    onMutate: async ({ worker_id, type }) => {
      await qc.cancelQueries({ queryKey: ["attendance", projectId, date] });
      const prev = qc.getQueryData<any[]>(["attendance", projectId, date]) ?? [];
      const next = [...prev.filter((r) => r.worker_id !== worker_id), { worker_id, type }];
      qc.setQueryData(["attendance", projectId, date], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["attendance", projectId, date], ctx?.prev);
      toast.error("Couldn't save");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["projects", "stats"] });
    },
  });

  const present = dayRows.filter((r) => r.type !== "absent").length;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft className="size-4" /> Change project
      </Button>

      <Card className="p-4 glass">
        <div className="flex items-center gap-3 mb-3">
          <HardHat className="size-5 text-primary" />
          <div className="min-w-0">
            <p className="font-medium truncate">{project?.name ?? "Project"}</p>
            <p className="text-xs text-muted-foreground truncate">{project?.location || "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="size-4 text-muted-foreground" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" />
          <Badge variant="secondary" className="tabular-nums">{present}/{workers.length}</Badge>
        </div>
      </Card>

      {workers.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">
          No workers assigned to this project. Assign workers from the project page.
        </Card>
      ) : (
        <div className="space-y-2">
          {workers.map((w: any) => {
            const current = byWorker.get(w.id);
            return (
              <Card key={w.id} className="p-3">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{w.full_name}</p>
                    <p className="text-xs text-muted-foreground">{w.worker_type || "Worker"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => mark.mutate({ worker_id: w.id, type: t })}
                      className={`tap-target rounded-md text-xs font-medium px-1 py-2 border transition-colors ${
                        current === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent border-border"
                      }`}
                    >
                      {ATTENDANCE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
