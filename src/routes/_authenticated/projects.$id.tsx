import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, Trash2, Milestone, MessageSquare, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { getProject, updateProject, deleteProject, addProjectUpdate, assignWorker, unassignWorker } from "@/lib/projects.functions";
import { listWorkers } from "@/lib/workers.functions";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getFn = useServerFn(getProject);
  const updateFn = useServerFn(updateProject);
  const delFn = useServerFn(deleteProject);
  const addNoteFn = useServerFn(addProjectUpdate);
  const assignFn = useServerFn(assignWorker);
  const unassignFn = useServerFn(unassignWorker);
  const workersFn = useServerFn(listWorkers);

  const { data } = useQuery({ queryKey: ["project", id], queryFn: () => getFn({ data: { id } }) });
  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: () => workersFn() });

  const update = useMutation({
    mutationFn: (patch: any) => updateFn({ data: { id, ...patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/projects" });
    },
  });

  const addNote = useMutation({
    mutationFn: (v: { note: string; is_milestone: boolean }) =>
      addNoteFn({ data: { project_id: id, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });

  const assign = useMutation({
    mutationFn: (worker_id: string) => assignFn({ data: { project_id: id, worker_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });
  const unassign = useMutation({
    mutationFn: (worker_id: string) => unassignFn({ data: { project_id: id, worker_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });

  if (!data) return null;
  const { project, assignments, updates } = data;
  const assignedIds = new Set(assignments.map((a: any) => a.worker_id));
  const unassigned = workers.filter((w) => !assignedIds.has(w.id));

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/projects"><ArrowLeft className="size-4" /> Projects</Link>
      </Button>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{project.name}</h2>
            <p className="text-sm text-muted-foreground">
              {project.client ? `${project.client} · ` : ""}{project.location || "—"}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <Badge>{project.status}</Badge>
              {project.start_date && <span className="text-muted-foreground">Start {project.start_date}</span>}
              {project.expected_end && <span className="text-muted-foreground">→ {project.expected_end}</span>}
              {Number(project.contract_value) > 0 && (
                <span className="text-muted-foreground">{formatCurrency(project.contract_value)}</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => confirm("Delete project?") && del.mutate()}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Progress</Label>
            <span className="text-sm font-medium tabular-nums">{project.progress_pct}%</span>
          </div>
          <Slider
            defaultValue={[project.progress_pct]}
            min={0} max={100} step={5}
            onValueCommit={(v) => update.mutate({ progress_pct: v[0] })}
          />
          <Progress value={project.progress_pct} className="h-1.5 mt-3" />
        </div>
        <div>
          <Label className="mb-2 block">Status</Label>
          <Select defaultValue={project.status} onValueChange={(v) => update.mutate({ status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Workers on site ({assignments.length})</h3>
          <AssignDialog unassigned={unassigned} onAssign={(wid) => assign.mutate(wid)} />
        </div>
        <Card className="divide-y">
          {assignments.length === 0 && <p className="p-4 text-sm text-muted-foreground">No workers assigned yet.</p>}
          {assignments.map((a: any) => (
            <div key={a.worker_id} className="p-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{a.workers?.full_name}</p>
                <p className="text-xs text-muted-foreground">{a.workers?.worker_type || "Worker"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => unassign.mutate(a.worker_id)}>
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Progress notes & milestones</h3>
          <NoteDialog onAdd={(v) => addNote.mutate(v)} />
        </div>
        <Card className="divide-y">
          {updates.length === 0 && <p className="p-4 text-sm text-muted-foreground">No updates yet.</p>}
          {updates.map((u: any) => (
            <div key={u.id} className="p-3 flex items-start gap-3 text-sm">
              {u.is_milestone
                ? <Milestone className="size-4 text-primary mt-0.5" />
                : <MessageSquare className="size-4 text-muted-foreground mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p>{u.note}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(u.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}

function NoteDialog({ onAdd }: { onAdd: (v: { note: string; is_milestone: boolean }) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> Note</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add update</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            onAdd({ note: String(f.get("note")), is_milestone: f.get("is_milestone") === "on" });
            setOpen(false);
          }}
        >
          <Textarea name="note" required rows={3} placeholder="Foundation completed, electrical started…" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_milestone" /> Mark as milestone
          </label>
          <DialogFooter><Button type="submit">Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ unassigned, onAssign }: { unassigned: any[]; onAssign: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><UserPlus className="size-4" /> Assign</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign worker</DialogTitle></DialogHeader>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {unassigned.length === 0 && <p className="text-sm text-muted-foreground">All workers already assigned.</p>}
          {unassigned.map((w) => (
            <button
              key={w.id}
              onClick={() => { onAssign(w.id); setOpen(false); }}
              className="w-full text-left p-3 rounded-md hover:bg-accent text-sm tap-target"
            >
              <p className="font-medium">{w.full_name}</p>
              <p className="text-xs text-muted-foreground">{w.worker_type || "Worker"}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
