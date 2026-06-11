import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
import { ArrowLeft, Plus, Trash2, Milestone, MessageSquare, UserPlus, FileText, Upload, Download, Image as ImageIcon, History, Activity } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  getProject,
  updateProject,
  deleteProject,
  addProjectUpdate,
  assignWorker,
  unassignWorker,
  getSignedFileUrl,
} from "@/lib/projects.functions";
import { listWorkers } from "@/lib/workers.functions";
import { getProjectStats } from "@/lib/stats.functions";
import { recordQuotation, deleteQuotation } from "@/lib/quotations.functions";
import { uploadProjectFile } from "@/lib/upload";
import { formatNumber } from "@/lib/format";
import { EditProjectButton } from "@/components/edit-project-dialog";

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
  const statsFn = useServerFn(getProjectStats);

  const { data } = useQuery({ queryKey: ["project", id], queryFn: () => getFn({ data: { id } }) });
  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: () => workersFn() });
  const { data: stats } = useQuery({ queryKey: ["project-stats", id], queryFn: () => statsFn({ data: { id } }) });

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
    mutationFn: (v: { note: string; is_milestone: boolean; photo_path?: string | null }) =>
      addNoteFn({ data: { project_id: id, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });

  const assign = useMutation({
    mutationFn: (worker_id: string) => assignFn({ data: { project_id: id, worker_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["project-stats", id] });
    },
  });
  const unassign = useMutation({
    mutationFn: (worker_id: string) => unassignFn({ data: { project_id: id, worker_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["project-stats", id] });
    },
  });

  if (!data) return null;
  const { project, assignments, updates, quotations, activity } = data as any;
  const assignedIds = new Set(assignments.map((a: any) => a.worker_id));
  const unassigned = workers.filter((w) => !assignedIds.has(w.id));
  const currentQuote = quotations.find((q: any) => q.is_current);

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
            {project.notes && (
              <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap border-t pt-3">{project.notes}</p>
            )}
          </div>
          <div className="flex gap-1">
            <EditProjectButton project={project} />
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => confirm("Delete project?") && del.mutate()}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
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

      {stats && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Project statistics</h3>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Assigned" value={formatNumber(stats.assignedCount)} />
            <MiniStat label="Present today" value={formatNumber(stats.presentToday)} tone="success" />
            <MiniStat label="Absent today" value={formatNumber(stats.absentToday)} tone="warning" />
            <MiniStat label="Month labour cost" value={formatCurrency(stats.monthCost)} />
          </div>
        </section>
      )}

      {stats && stats.breakdown.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Labour cost breakdown</h3>
          <Card className="divide-y">
            {stats.breakdown.map((r: any) => (
              <div key={r.worker_id} className="p-3 flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.type || "Worker"} · {r.days} days</p>
                </div>
                <span className="font-semibold tabular-nums text-primary">{formatCurrency(r.earnings)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <QuotationsSection projectId={id} quotations={quotations} currentQuote={currentQuote} />

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
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Progress notes & site photos</h3>
          <NoteDialog projectId={id} onAdd={(v) => addNote.mutate(v)} />
        </div>
        <Card className="divide-y">
          {updates.length === 0 && <p className="p-4 text-sm text-muted-foreground">No updates yet.</p>}
          {updates.map((u: any) => (
            <UpdateRow key={u.id} update={u} />
          ))}
        </Card>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="size-3.5 text-muted-foreground" />
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Activity log</h3>
        </div>
        <Card className="divide-y">
          {activity.length === 0 && <p className="p-4 text-sm text-muted-foreground">No activity yet.</p>}
          {activity.map((a: any) => (
            <div key={a.id} className="p-3 text-sm">
              <p>{a.description || a.action}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{new Date(a.created_at).toLocaleString()}</p>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}

function QuotationsSection({
  projectId,
  quotations,
  currentQuote,
}: {
  projectId: string;
  quotations: any[];
  currentQuote: any;
}) {
  const qc = useQueryClient();
  const recordFn = useServerFn(recordQuotation);
  const delFn = useServerFn(deleteQuotation);
  const urlFn = useServerFn(getSignedFileUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const meta = await uploadProjectFile(file, "quotations", projectId);
      await recordFn({
        data: {
          project_id: projectId,
          file_path: meta.path,
          file_name: meta.name,
          file_type: meta.type || null,
          file_size: meta.size,
        },
      });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success(currentQuote ? "Quotation replaced" : "Quotation uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openFile(path: string) {
    try {
      const { url } = await urlFn({ data: { file_path: path } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Quotation</h3>
        <div className="flex gap-1">
          {quotations.length > 1 && (
            <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
              <History className="size-4" /> v{quotations.length}
            </Button>
          )}
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload className="size-4" /> {currentQuote ? "Replace" : "Upload"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.xls,.xlsx,.csv,image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      </div>
      <Card className="p-4">
        {!currentQuote ? (
          <p className="text-sm text-muted-foreground">No quotation uploaded. Upload PDF, Excel, or image.</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="size-8 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">{currentQuote.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  v{currentQuote.version} · Uploaded {new Date(currentQuote.created_at).toLocaleString()}
                </p>
                {currentQuote.updated_at !== currentQuote.created_at && (
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(currentQuote.updated_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => openFile(currentQuote.file_path)}>
              <Download className="size-4" /> Open
            </Button>
          </div>
        )}
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quotation history</DialogTitle></DialogHeader>
          <div className="divide-y max-h-[70vh] overflow-y-auto">
            {quotations.map((q: any) => (
              <div key={q.id} className="py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    v{q.version} · {q.file_name} {q.is_current && <Badge className="ml-1" variant="secondary">Current</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => openFile(q.file_path)}>Open</Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Delete this version?") && del.mutate(q.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function UpdateRow({ update }: { update: any }) {
  const urlFn = useServerFn(getSignedFileUrl);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  async function loadPhoto() {
    if (photoUrl || !update.photo_path) return;
    try {
      const { url } = await urlFn({ data: { file_path: update.photo_path } });
      setPhotoUrl(url);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="p-3 flex items-start gap-3 text-sm">
      {update.is_milestone
        ? <Milestone className="size-4 text-primary mt-0.5" />
        : <MessageSquare className="size-4 text-muted-foreground mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p>{update.note}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{new Date(update.created_at).toLocaleString()}</p>
        {update.photo_path && (
          <div className="mt-2">
            {photoUrl ? (
              <img src={photoUrl} alt="Site photo" className="rounded-md max-h-64 border" />
            ) : (
              <Button size="sm" variant="outline" onClick={loadPhoto}>
                <ImageIcon className="size-4" /> View photo
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteDialog({
  projectId,
  onAdd,
}: {
  projectId: string;
  onAdd: (v: { note: string; is_milestone: boolean; photo_path?: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> Note</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add update</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const note = String(f.get("note") || "").trim();
            if (!note) return;
            const photo = f.get("photo") as File | null;
            setBusy(true);
            try {
              let photo_path: string | null = null;
              if (photo && photo.size > 0) {
                const meta = await uploadProjectFile(photo, "photos", projectId);
                photo_path = meta.path;
              }
              onAdd({ note, is_milestone: f.get("is_milestone") === "on", photo_path });
              setOpen(false);
            } catch (err: any) {
              toast.error(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Textarea name="note" required rows={3} placeholder="Foundation completed, electrical started…" />
          <div className="space-y-1.5">
            <Label htmlFor="photo">Site photo (optional)</Label>
            <Input id="photo" name="photo" type="file" accept="image/*" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_milestone" /> Mark as milestone
          </label>
          <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add"}</Button></DialogFooter>
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
