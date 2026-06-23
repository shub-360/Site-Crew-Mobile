import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  HardHat,
  Users,
  UserCheck,
  Banknote,
  CalendarCheck2,
  Plus,
  UserPlus,
  FileSpreadsheet,
  TrendingUp,
  Activity,
  Trophy,
  AlertTriangle,
  ChevronRight,
  Info,
} from "lucide-react-native";
import { getDashboardOverview } from "@/lib/stats.functions";
import { getRecentActivity } from "@/lib/dashboard.functions";
import { formatCurrency, formatNumber } from "@/lib/format";

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [isAboutVisible, setIsAboutVisible] = useState(false);

  const {
    data: k,
    isLoading: loadingK,
    refetch: refetchK,
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboardOverview(),
    staleTime: 1000 * 60 * 1, // 1 minute stale time for dashboard metrics
  });

  const {
    data: activity,
    isLoading: loadingAct,
    refetch: refetchAct,
  } = useQuery({
    queryKey: ["activity"],
    queryFn: () => getRecentActivity(),
    staleTime: 1000 * 60 * 1, // 1 minute stale time for recent activity log
  });

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetchK(), refetchAct()]);
    setRefreshing(false);
  }

  const isLoading = loadingK || loadingAct;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerClassName="px-4 py-6 pb-12"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1E3A5F"]} />
        }
      >
        {/* Header */}
        <View className="mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-2xl font-bold text-foreground">Overview</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              Contractor Operations Dashboard
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            {isLoading && !refreshing && (
              <ActivityIndicator size="small" color="#1E3A5F" />
            )}
            <TouchableOpacity
              onPress={() => setIsAboutVisible(true)}
              className="w-10 h-10 rounded-xl bg-white border border-border items-center justify-center shadow-xs active:bg-slate-50"
            >
              <Info size={20} color="#1E3A5F" />
            </TouchableOpacity>
          </View>
        </View>

        {/* KPI Grid */}
        <View className="gap-3 mb-6">
          <View className="flex-row gap-3">
            <KpiCard
              icon={HardHat}
              label="Active projects"
              value={formatNumber(k?.activeProjects)}
              className="flex-1"
            />
            <KpiCard
              icon={Users}
              label="Total workers"
              value={formatNumber(k?.totalWorkers)}
              className="flex-1"
            />
          </View>
          <View className="flex-row gap-3">
            <KpiCard
              icon={UserCheck}
              label="Present today"
              value={formatNumber(k?.presentToday)}
              tone="success"
              className="flex-1"
            />
            <KpiCard
              icon={Banknote}
              label="Month labour cost"
              value={formatCurrency(k?.monthLabourCost)}
              className="flex-1"
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mb-6">
          <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-3">
            Quick Actions
          </Text>
          <View className="flex-row gap-2 flex-wrap">
            <QuickAction
              icon={CalendarCheck2}
              label="Mark Attendance"
              onPress={() => router.push("/(tabs)/attendance")}
            />
            <QuickAction
              icon={Plus}
              label="Add Project"
              onPress={() => router.push("/(tabs)/projects")}
            />
            <QuickAction
              icon={UserPlus}
              label="Add Worker"
              onPress={() => router.push("/(tabs)/workers")}
            />
            <QuickAction
              icon={FileSpreadsheet}
              label="Reports"
              onPress={() => router.push("/(tabs)/reports")}
            />
          </View>
        </View>

        {/* Site Status */}
        <View className="mb-6">
          <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-3">
            Site Status
          </Text>
          <View className="bg-white rounded-2xl border border-border overflow-hidden">
            {(!k?.sites || k.sites.length === 0) && !isLoading && (
              <Text className="p-6 text-sm text-muted-foreground text-center">
                No active projects yet.
              </Text>
            )}
            {(k?.sites ?? []).map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => router.push(`/projects/${s.id}` as any)}
                className="p-4 border-b border-slate-100 flex-row justify-between items-center active:bg-slate-50"
              >
                <View className="flex-1 pr-2">
                  <Text className="font-semibold text-foreground text-base truncate">
                    {s.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground truncate mb-2">
                    {s.location || "No location"}
                  </Text>
                  <View className="flex-row gap-3">
                    <Text className="text-xs text-muted-foreground">
                      <Text className="text-slate-800 font-medium">{s.assigned}</Text> assigned
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      <Text className="text-slate-800 font-medium">{s.presentToday}</Text> present today
                    </Text>
                  </View>
                </View>
                <View className="items-end gap-1 flex-row">
                  <Text className="text-base font-bold text-primary font-mono">
                    {formatCurrency(s.monthCost)}
                  </Text>
                  <ChevronRight size={16} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Insights */}
        <View className="mb-6">
          <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-3">
            Insights
          </Text>
          <View className="gap-3">
            <View className="flex-row gap-3">
              <InsightCard
                icon={TrendingUp}
                label="Top labour cost"
                primary={k?.insights?.topProject?.name ?? "—"}
                secondary={k?.insights?.topProject ? formatCurrency(k.insights.topProject.value) : ""}
                className="flex-1"
              />
              <InsightCard
                icon={Activity}
                label="Most active site"
                primary={k?.insights?.mostActiveProject?.name ?? "—"}
                secondary={k?.insights?.mostActiveProject ? `${k.insights.mostActiveProject.days} entries` : ""}
                className="flex-1"
              />
            </View>
            <View className="flex-row gap-3">
              <InsightCard
                icon={Trophy}
                label="Top earner"
                primary={k?.insights?.topWorker?.name ?? "—"}
                secondary={k?.insights?.topWorker ? formatCurrency(k.insights.topWorker.value) : ""}
                tone="success"
                className="flex-1"
              />
              <InsightCard
                icon={AlertTriangle}
                label="Lowest attendance"
                primary={k?.insights?.lowestWorker?.name ?? "—"}
                secondary={k?.insights?.lowestWorker ? `${k.insights.lowestWorker.days} days` : ""}
                tone="warning"
                className="flex-1"
              />
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View>
          <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-3">
            Recent Activity
          </Text>
          <View className="bg-white rounded-2xl border border-border p-4 gap-4">
            {(!activity || activity.length === 0) && !isLoading && (
              <Text className="text-sm text-muted-foreground">No recent activity.</Text>
            )}
            {(activity ?? []).map((a) => (
              <View key={a.id} className="flex-row gap-3 items-start">
                <View
                  className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${a.kind === "attendance"
                    ? "bg-primary"
                    : a.kind === "worker"
                      ? "bg-success"
                      : "bg-warning"
                    }`}
                />
                <View className="flex-1 min-w-0">
                  <Text className="text-sm text-slate-800 font-medium">
                    {a.text}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {new Date(a.at).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* About Modal */}
      <Modal
        visible={isAboutVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAboutVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm border border-border shadow-2xl items-center">
            {/* Logo */}
            <Image
              source={require("../../assets/images/icon.png")}
              className="w-20 h-20 rounded-2xl mb-4 border border-slate-100"
              resizeMode="contain"
            />

            {/* Title & Version */}
            <Text className="text-xl font-bold text-slate-800">SiteCrew</Text>
            <Text className="text-xs text-muted-foreground mt-1 mb-5">Version 1.0.0-beta.2</Text>

            <View className="w-full h-[1px] bg-slate-100 mb-5" />

            {/* Credits */}
            <Text className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Built with passion by
            </Text>
            <Text className="text-sm font-bold text-slate-700 mb-1">Mitali Rawal</Text>
            <Text className="text-sm font-bold text-slate-700 mb-1">Shubham sharma</Text>
            <Text className="text-sm font-bold text-slate-700 mb-5">Moksh Rawal</Text>

            <Text className="text-[10px] text-slate-400 font-medium">© 2026 SiteCrew</Text>

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setIsAboutVisible(false)}
              className="w-full bg-slate-900 py-3 rounded-xl items-center mt-6 active:bg-slate-850"
            >
              <Text className="text-sm font-bold text-white">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone = "default",
  className = "",
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
  className?: string;
}) {
  const toneColor =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-primary";

  return (
    <View className={`bg-white p-4 rounded-2xl border border-border shadow-sm ${className}`}>
      <View className="flex-row justify-between items-center mb-1.5">
        <Text className="text-xs text-muted-foreground font-medium truncate flex-1 pr-1">
          {label}
        </Text>
        <Icon size={16} className={toneColor} />
      </View>
      <Text className="text-lg font-bold text-foreground tracking-tight font-mono" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function InsightCard({
  icon: Icon,
  label,
  primary,
  secondary,
  tone = "default",
  className = "",
}: {
  icon: any;
  label: string;
  primary: string;
  secondary: string;
  tone?: "default" | "success" | "warning";
  className?: string;
}) {
  const toneColor =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-primary";

  return (
    <View className={`bg-white p-3 rounded-xl border border-border shadow-sm ${className}`}>
      <View className="flex-row items-center gap-1.5 mb-1">
        <Icon size={12} className={toneColor} />
        <Text className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
          {label}
        </Text>
      </View>
      <Text className="text-xs font-semibold text-slate-800 truncate" numberOfLines={1}>
        {primary}
      </Text>
      <Text className="text-[10px] text-muted-foreground mt-0.5 font-mono" numberOfLines={1}>
        {secondary}
      </Text>
    </View>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 min-w-[70px] bg-white border border-border rounded-xl p-3 items-center justify-center shadow-xs active:bg-slate-50"
    >
      <Icon size={20} color="#1E3A5F" />
      <Text className="text-[10px] font-semibold text-slate-800 text-center mt-1.5" numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
