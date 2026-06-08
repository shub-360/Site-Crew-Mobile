import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listWorkers } from "@/lib/workers.functions";
import { getAttendanceForDay, upsertAttendance } from "@/lib/attendance.functions";
import { ATTENDANCE_LABEL, type AttendanceType } from "@/lib/wages";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const TYPES: AttendanceType[] = ["absent", "half", "full", "overtime"];

function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const qc = useQueryClient();

  const workersFn = useServerFn(listWorkers);
  const dayFn = useServerFn(getAttendanceForDay);
  const upsertFn = useServerFn(upsertAttendance);

  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: () => workersFn() });
  const { data: dayRows = [] } = useQuery({
    queryKey: ["attendance", date],
    queryFn: () => dayFn({ data: { date } }),
  });
  const byWorker = new Map(dayRows.map((r) => [r.worker_id, r.type as AttendanceType]));

  const mark = useMutation({
    mutationFn: (vars: { worker_id: string; type: AttendanceType }) =>
      upsertFn({ data: { ...vars, date } }),
    onMutate: async ({ worker_id, type }) => {
      await qc.cancelQueries({ queryKey: ["attendance", date] });
      const prev = qc.getQueryData<any[]>(["attendance", date]) ?? [];
      const next = [...prev.filter((r) => r.worker_id !== worker_id), { worker_id, type }];
      qc.setQueryData(["attendance", date], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["attendance", date], ctx?.prev);
      toast.error("Couldn't save");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  const active = workers.filter((w) => w.status === "active");
  const present = dayRows.filter((r) => r.type !== "absent").length;

  return (
    <div className="space-y-4">
      <Card className="p-4 glass flex items-center gap-3">
        <Calendar className="size-5 text-primary" />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" />
        <div className="text-sm text-muted-foreground tabular-nums">{present}/{active.length} present</div>
      </Card>

      {active.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">
          Add active workers first to mark attendance.
        </Card>
      ) : (
        <div className="space-y-2">
          {active.map((w) => {
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
