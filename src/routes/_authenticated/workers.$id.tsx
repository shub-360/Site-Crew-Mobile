import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { getWorkerSummary } from "@/lib/worker-summary.functions";
import { deleteWorker } from "@/lib/workers.functions";
import { getWorkerAttendance } from "@/lib/attendance.functions";
import { listPayments, recordPayment } from "@/lib/payments.functions";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { ATTENDANCE_LABEL } from "@/lib/wages";
import { EditWorkerButton } from "@/components/edit-worker-dialog";

export const Route = createFileRoute("/_authenticated/workers/$id")({
  component: WorkerPage,
});

function WorkerPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const summaryFn = useServerFn(getWorkerSummary);
  const attFn = useServerFn(getWorkerAttendance);
  const paymentsFn = useServerFn(listPayments);
  const delFn = useServerFn(deleteWorker);

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data: summary } = useQuery({
    queryKey: ["worker-summary", id],
    queryFn: () => summaryFn({ data: { worker_id: id } }),
  });
  const { data: att = [] } = useQuery({
    queryKey: ["worker-att", id],
    queryFn: () => attFn({ data: { worker_id: id, from, to } }),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments", id],
    queryFn: () => paymentsFn({ data: { worker_id: id } }),
  });

  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Worker deleted");
      navigate({ to: "/workers" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!summary) return null;
  const w = summary.worker;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/workers"><ArrowLeft className="size-4" /> Workers</Link>
      </Button>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{w.full_name}</h2>
            <p className="text-sm text-muted-foreground">
              {w.worker_type || "Worker"} · {formatCurrency(w.daily_wage)}/day
            </p>
            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
              {w.mobile && <span>📞 {w.mobile}</span>}
              {w.status === "inactive" && <Badge variant="secondary">Inactive</Badge>}
            </div>
            {w.address && <p className="text-xs text-muted-foreground mt-1">{w.address}</p>}
          </div>
          <div className="flex gap-1">
            <EditWorkerDialog worker={w} />
            <Button variant="ghost" size="icon" onClick={() => confirm("Delete this worker?") && del.mutate()}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Month present" value={String(summary.monthPresent)} />
        <Stat label="Month OT days" value={String(summary.monthOvertime)} />
        <Stat label="Month earnings" value={formatCurrency(summary.monthEarnings)} />
        <Stat label="Total paid" value={formatCurrency(summary.totalPaid)} />
        <Stat label="Lifetime earnings" value={formatCurrency(summary.lifetimeEarnings)} />
        <Stat label="Balance due" value={formatCurrency(summary.balance)} highlight />
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Payments</h3>
          <PaymentDialog workerId={id} />
        </div>
        <Card className="divide-y">
          {payments.length === 0 && <p className="p-4 text-sm text-muted-foreground">No payments recorded.</p>}
          {payments.map((p) => (
            <div key={p.id} className="p-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{formatCurrency(p.amount)}</p>
                <p className="text-xs text-muted-foreground">{p.paid_on}{p.note ? ` · ${p.note}` : ""}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recent attendance</h3>
        <Card className="divide-y">
          {att.length === 0 && <p className="p-4 text-sm text-muted-foreground">No attendance recorded yet.</p>}
          {att.slice(0, 30).map((a) => (
            <div key={a.date} className="p-3 flex items-center justify-between text-sm">
              <span>{a.date}</span>
              <Badge variant={a.type === "absent" ? "secondary" : "default"}>{ATTENDANCE_LABEL[a.type as keyof typeof ATTENDANCE_LABEL]}</Badge>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={`p-3 ${highlight ? "bg-primary text-primary-foreground" : ""}`}>
      <p className={`text-xs ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-1">{value}</p>
    </Card>
  );
}

function PaymentDialog({ workerId }: { workerId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const fn = useServerFn(recordPayment);
  const m = useMutation({
    mutationFn: (d: any) => fn({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments", workerId] });
      qc.invalidateQueries({ queryKey: ["worker-summary", workerId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Payment recorded");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4" /> Payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            m.mutate({
              worker_id: workerId,
              amount: Number(f.get("amount")),
              paid_on: f.get("paid_on") || new Date().toISOString().slice(0, 10),
              note: f.get("note") || null,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" name="amount" type="number" min="1" step="1" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paid_on">Date</Label>
            <Input id="paid_on" name="paid_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Record"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditWorkerDialog({ worker }: { worker: any }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const fn = useServerFn(updateWorker);
  const m = useMutation({
    mutationFn: (d: any) => fn({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worker-summary", worker.id] });
      qc.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Worker updated");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Pencil className="size-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit worker</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            m.mutate({
              id: worker.id,
              full_name: f.get("full_name"),
              mobile: f.get("mobile") || null,
              address: f.get("address") || null,
              worker_type: f.get("worker_type") || null,
              joining_date: f.get("joining_date") || worker.joining_date,
              daily_wage: Number(f.get("daily_wage") || 0),
              status: f.get("status") || "active",
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ef_full_name">Full name</Label>
            <Input id="ef_full_name" name="full_name" required defaultValue={worker.full_name} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ef_mobile">Mobile</Label>
              <Input id="ef_mobile" name="mobile" type="tel" defaultValue={worker.mobile ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef_worker_type">Type</Label>
              <Input id="ef_worker_type" name="worker_type" defaultValue={worker.worker_type ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ef_daily_wage">Daily wage</Label>
              <Input id="ef_daily_wage" name="daily_wage" type="number" min="0" step="1" required defaultValue={worker.daily_wage} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef_joining_date">Joining date</Label>
              <Input id="ef_joining_date" name="joining_date" type="date" defaultValue={worker.joining_date} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ef_address">Address</Label>
            <Input id="ef_address" name="address" defaultValue={worker.address ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select name="status" defaultValue={worker.status}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
