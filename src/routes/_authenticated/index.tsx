import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboard, getRecentActivity } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, UserX, Zap, HardHat, Wallet, Banknote, CalendarCheck2, Plus, FileSpreadsheet } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const dash = useServerFn(getDashboard);
  const act = useServerFn(getRecentActivity);
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => dash() });
  const { data: activity } = useQuery({ queryKey: ["activity"], queryFn: () => act() });

  const k = data;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Today</h2>
        <div className="grid grid-cols-2 gap-3">
          <Kpi icon={Users} label="Active workers" value={formatNumber(k?.activeWorkers)} />
          <Kpi icon={UserCheck} label="Present" value={formatNumber(k?.presentToday)} tone="success" />
          <Kpi icon={UserX} label="Absent" value={formatNumber(k?.absentToday)} tone="destructive" />
          <Kpi icon={Zap} label="Overtime" value={formatNumber(k?.overtimeToday)} tone="warning" />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">This month</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Kpi icon={HardHat} label="Active projects" value={`${k?.activeProjects ?? 0} / ${k?.totalProjects ?? 0}`} />
          <Kpi icon={Banknote} label="Labour cost" value={formatCurrency(k?.monthLabourCost)} />
          <Kpi icon={Wallet} label="Pending wages" value={formatCurrency(k?.pendingWages)} tone="warning" />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <QuickAction to="/attendance" icon={CalendarCheck2} label="Mark attendance" />
          <QuickAction to="/workers" icon={Plus} label="Add worker" />
          <QuickAction to="/projects" icon={HardHat} label="Add project" />
          <QuickAction to="/reports" icon={FileSpreadsheet} label="Monthly report" />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recent activity</h2>
        <Card className="divide-y">
          {(activity ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No activity yet. Start by adding workers and marking attendance.</p>
          )}
          {(activity ?? []).map((a) => (
            <div key={a.id} className="p-3 text-sm flex items-start gap-3">
              <span className={`mt-1.5 size-2 rounded-full shrink-0 ${
                a.kind === "attendance" ? "bg-primary" : a.kind === "worker" ? "bg-[oklch(var(--success))]" : "bg-[oklch(var(--warning))]"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="truncate">{a.text}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone = "default" }: { icon: any; label: string; value: string; tone?: "default" | "success" | "destructive" | "warning" }) {
  const toneClass = {
    default: "text-primary",
    success: "text-[var(--success)]",
    destructive: "text-destructive",
    warning: "text-[var(--warning)]",
  }[tone];
  return (
    <Card className="p-4 glass">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${toneClass}`} />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </Card>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Button asChild variant="outline" className="h-auto py-3 flex-col gap-1.5 tap-target">
      <Link to={to}>
        <Icon className="size-5" />
        <span className="text-xs">{label}</span>
      </Link>
    </Button>
  );
}
