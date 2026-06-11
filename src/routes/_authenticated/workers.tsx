import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createWorker } from "@/lib/workers.functions";
import { listWorkersWithStats } from "@/lib/stats.functions";
import { Plus, Search, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { EditWorkerButton } from "@/components/edit-worker-dialog";

export const Route = createFileRoute("/_authenticated/workers")({
  component: WorkersPage,
});

function WorkersPage() {
  const fetchList = useServerFn(listWorkersWithStats);
  const { data: workers = [] } = useQuery({ queryKey: ["workers", "stats"], queryFn: () => fetchList() });
  const [q, setQ] = useState("");

  const filtered = workers.filter((w) => w.full_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search workers" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <AddWorkerDialog />
      </div>

      <Card className="divide-y">
        {filtered.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground text-center">No workers yet. Add your first worker.</p>
        )}
        {filtered.map((w: any) => (
          <div key={w.id} className="relative group">
            <Link
              to="/workers/$id"
              params={{ id: w.id }}
              className="block p-4 pr-20 hover:bg-accent/40 transition-colors tap-target"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{w.full_name}</p>
                    {w.status === "inactive" && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {w.worker_type || "Worker"} · {formatCurrency(w.daily_wage)}/day
                  </p>
                  {w.assignedProjects?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {w.assignedProjects.slice(0, 3).map((p: string) => (
                        <Badge key={p} variant="outline" className="text-[10px] font-normal">{p}</Badge>
                      ))}
                      {w.assignedProjects.length > 3 && (
                        <Badge variant="outline" className="text-[10px] font-normal">+{w.assignedProjects.length - 3}</Badge>
                      )}
                    </div>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground tabular-nums">
                    <span><span className="text-foreground font-medium">{w.monthDays}</span> days</span>
                    <span><span className="text-foreground font-medium">{formatCurrency(w.monthEarnings)}</span> earned</span>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground mt-1" />
              </div>
            </Link>
            <div className="absolute right-10 top-4">
              <EditWorkerButton worker={w} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function AddWorkerDialog() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const create = useServerFn(createWorker);
  const m = useMutation({
    mutationFn: (data: any) => create({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Worker added");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="tap-target"><Plus className="size-4" /> Add</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add worker</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            m.mutate({
              full_name: f.get("full_name"),
              mobile: f.get("mobile") || null,
              address: f.get("address") || null,
              worker_type: f.get("worker_type") || null,
              joining_date: f.get("joining_date") || new Date().toISOString().slice(0, 10),
              daily_wage: Number(f.get("daily_wage") || 0),
              status: f.get("status") || "active",
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mobile">Mobile</Label>
              <Input id="mobile" name="mobile" type="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="worker_type">Type</Label>
              <Input id="worker_type" name="worker_type" placeholder="Mason, Helper…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="daily_wage">Daily wage</Label>
              <Input id="daily_wage" name="daily_wage" type="number" min="0" step="1" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="joining_date">Joining date</Label>
              <Input id="joining_date" name="joining_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select name="status" defaultValue="active">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Add worker"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { AddWorkerDialog };
