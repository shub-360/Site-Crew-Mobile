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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";
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
import { useThemeStore } from "@/store/theme-store";
import { useIsDark } from "@/hooks/use-is-dark";
import { PressableScale } from "@/components/PressableScale";
import { supabase } from "@/integrations/supabase/client";

export default function DashboardScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [isAboutVisible, setIsAboutVisible] = useState(false);

  const { preference, setPreference } = useThemeStore();
  const isDark = useIsDark();

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

  async function handleLogout() {
    setIsAboutVisible(false);
    await supabase.auth.signOut();
  }

  const isLoading = loadingK || loadingAct;

  function getGreetingTimeLabel() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning ☀️";
    if (hour >= 12 && hour < 17) return "Good Afternoon ☀️";
    if (hour >= 17 && hour < 22) return "Good Evening 🌙";
    return "Hello 👋";
  }

  function getFormattedDate() {
    try {
      return new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const now = new Date();
      return `${days[now.getDay()]} • ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }
  }

  const bgClass = isDark ? "bg-[#0F172A]" : "bg-[#F8FAFC]";
  const cardBorderClass = isDark ? "border-[#334155]" : "border-[#E2E8F0]";

  return (
    <SafeAreaView edges={["left", "right"]} className={`flex-1 ${bgClass}`}>
      <ScrollView
        contentContainerClassName="px-4 py-6 pb-32"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[isDark ? "#B8CAD9" : "#173B6C"]} />
        }
      >
        {/* Personalized Dynamic Greeting Header */}
        <View className={`mb-6 pb-5 border-b flex-row justify-between items-start ${isDark ? "border-slate-800" : "border-slate-100"}`}>
          <View className="flex-1 pr-4">
            <Text className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {profile?.full_name ? getGreetingTimeLabel() : "Hello 👋"}
            </Text>
            {profile?.full_name && (
              <Text className={`text-2xl font-bold mt-1.5 ${isDark ? "text-slate-100" : "text-[#173B6C]"}`}>
                {profile.full_name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
              </Text>
            )}
            <Text className={`text-xs mt-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {getFormattedDate()}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsAboutVisible(true)}
            className={`w-10 h-10 rounded-xl items-center justify-center border shadow-xs ${
              isDark ? "bg-[#1E293B] border-slate-700" : "bg-white border-slate-200 active:bg-slate-50"
            }`}
          >
            <Info size={18} color={isDark ? "#B8CAD9" : "#173B6C"} />
          </TouchableOpacity>
        </View>

        {/* Overview Sub-Header */}
        <View className="mb-5">
          <Text className={`text-xl font-extrabold ${isDark ? "text-slate-100" : "text-[#173B6C]"}`}>Overview</Text>
          <Text className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
            Contractor Operations Dashboard
          </Text>
        </View>

        {/* KPI Grid */}
        <View className="gap-3 mb-6">
          <View className="flex-row gap-3">
            <KpiCard
              icon={HardHat}
              label="Active projects"
              value={formatNumber(k?.activeProjects)}
              className="flex-1"
              isDark={isDark}
            />
            <KpiCard
              icon={Users}
              label="Total workers"
              value={formatNumber(k?.totalWorkers)}
              className="flex-1"
              isDark={isDark}
            />
          </View>
          <View className="flex-row gap-3">
            <KpiCard
              icon={UserCheck}
              label="Present today"
              value={formatNumber(k?.presentToday)}
              tone="success"
              className="flex-1"
              isDark={isDark}
            />
            <KpiCard
              icon={Banknote}
              label="Month labour cost"
              value={formatCurrency(k?.monthLabourCost)}
              className="flex-1"
              isDark={isDark}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mb-6">
          <Text className={`text-xs uppercase font-bold tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
            Quick Actions
          </Text>
          <View className="flex-row gap-2 flex-wrap">
            <QuickAction
              icon={CalendarCheck2}
              label="Attendance"
              onPress={() => router.push("/(tabs)/attendance")}
              isDark={isDark}
            />
            <QuickAction
              icon={Plus}
              label="Add Project"
              onPress={() => router.push("/(tabs)/projects")}
              isDark={isDark}
            />
            <QuickAction
              icon={UserPlus}
              label="Add Worker"
              onPress={() => router.push("/(tabs)/workers")}
              isDark={isDark}
            />
            <QuickAction
              icon={FileSpreadsheet}
              label="Reports"
              onPress={() => router.push("/(tabs)/reports")}
              isDark={isDark}
            />
          </View>
        </View>

        {/* Site Status */}
        <View className="mb-6">
          <Text className={`text-xs uppercase font-bold tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
            Site Status
          </Text>
          <View className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-100"}`}>
            {(!k?.sites || k.sites.length === 0) && !isLoading && (
              <View className="p-8 items-center justify-center gap-2">
                <Text className="text-3xl mb-1">🏗️</Text>
                <Text className={`text-sm font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  No Projects Yet
                </Text>
                <Text className={`text-xs text-center mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Create your first construction site.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/projects")}
                  className={`px-4 py-2 rounded-xl border ${
                    isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 active:bg-slate-50"
                  }`}
                >
                  <Text className={`text-xs font-bold ${isDark ? "text-[#B8CAD9]" : "text-[#173B6C]"}`}>
                    Create Project
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {(k?.sites ?? []).map((s) => {
              const isActive = s.assigned > 0;
              const dotColor = isActive ? "bg-green-500" : "bg-slate-300";

              return (
                <PressableScale
                  key={s.id}
                  onPress={() => router.push(`/projects/${s.id}` as any)}
                  className={`p-4 border-b ${isDark ? "border-slate-800" : "border-slate-50"}`}
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1 pr-4">
                      <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                        <View className={`w-2 h-2 rounded-full ${dotColor}`} />
                        <Text className={`font-semibold text-base truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                          {s.name}
                        </Text>
                      </View>
                      <Text className={`text-xs font-mono font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {s.presentToday} / {s.assigned} Workers Present
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <Text className={`text-base font-bold font-mono ${isDark ? "text-[#B8CAD9]" : "text-[#173B6C]"}`}>
                        {formatCurrency(s.monthCost)}
                      </Text>
                      <ChevronRight size={16} color={isDark ? "#64748B" : "#94A3B8"} />
                    </View>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </View>

        {/* Insights */}
        <View className="mb-6">
          <Text className={`text-xs uppercase font-bold tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
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
                isDark={isDark}
              />
              <InsightCard
                icon={Activity}
                label="Most active site"
                primary={k?.insights?.mostActiveProject?.name ?? "—"}
                secondary={k?.insights?.mostActiveProject ? `${k.insights.mostActiveProject.days} entries` : ""}
                className="flex-1"
                isDark={isDark}
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
                isDark={isDark}
              />
              <InsightCard
                icon={AlertTriangle}
                label="Lowest attendance"
                primary={k?.insights?.lowestWorker?.name ?? "—"}
                secondary={k?.insights?.lowestWorker ? `${k.insights.lowestWorker.days} days` : ""}
                tone="warning"
                className="flex-1"
                isDark={isDark}
              />
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View className="mb-4">
          <Text className={`text-xs uppercase font-bold tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
            Recent Activity
          </Text>
          <View className={`rounded-2xl border p-4 gap-4 ${isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-100"}`}>
            {(!activity || activity.length === 0) && !isLoading && (
              <Text className="text-sm text-muted-foreground">No recent activity.</Text>
            )}
            {(activity ?? []).map((a) => (
              <View key={a.id} className="flex-row gap-3 items-start">
                <View
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    a.kind === "attendance"
                      ? isDark ? "bg-[#B8CAD9]" : "bg-[#173B6C]"
                      : a.kind === "worker"
                        ? "bg-success"
                        : "bg-[#D4A94A]"
                  }`}
                />
                <View className="flex-1 min-w-0">
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>
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

      {/* About / Settings Modal */}
      <Modal
        visible={isAboutVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAboutVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className={`rounded-3xl p-6 w-full max-w-sm border shadow-2xl items-center ${
            isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-150"
          }`}>
            {/* Logo */}
            <Image
              source={require("../../assets/images/icon.png")}
              className={`w-16 h-16 rounded-2xl mb-4 border ${
                isDark ? "border-slate-700" : "border-slate-100"
              }`}
              resizeMode="contain"
            />

            {/* Title & Version */}
            <Text className={`text-xl font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>SiteCrew</Text>
            <Text className="text-xs text-muted-foreground mt-1 mb-4">Version 1.0.0 Beta</Text>

            {/* Theme Selector */}
            <Text className={`text-[10px] font-bold uppercase tracking-wider mb-2.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Theme
            </Text>
            <View className={`flex-row p-1 rounded-xl mb-4 w-full ${isDark ? "bg-slate-850" : "bg-slate-100"}`}>
              {(["light", "dark", "system"] as const).map((modeOption) => (
                <TouchableOpacity
                  key={modeOption}
                  onPress={() => setPreference(modeOption)}
                  style={
                    preference === modeOption && !isDark
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.05,
                          shadowRadius: 1.5,
                          elevation: 1,
                        }
                      : null
                  }
                  className={`flex-1 py-1.5 rounded-lg items-center ${
                    preference === modeOption
                      ? isDark
                        ? "bg-slate-700"
                        : "bg-white"
                      : ""
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold capitalize ${
                      preference === modeOption
                        ? isDark
                          ? "text-slate-200"
                          : "text-slate-800"
                        : "text-slate-500"
                    }`}
                  >
                    {modeOption}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className={`w-full h-[1px] mb-4 ${isDark ? "bg-slate-700" : "bg-slate-100"}`} />

            {/* Credits */}
            <Text className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Built with ❤️ by
            </Text>
            <Text className={`text-sm font-bold mb-0.5 ${isDark ? "text-slate-350" : "text-slate-700"}`}>Mitali Rawal</Text>
            <Text className={`text-sm font-bold mb-0.5 ${isDark ? "text-slate-350" : "text-slate-700"}`}>Shubham Sharma</Text>
            <Text className={`text-sm font-bold mb-4 ${isDark ? "text-slate-350" : "text-slate-700"}`}>Moksh Rawal</Text>

            <View className={`w-full h-[1px] mb-4 ${isDark ? "bg-slate-700" : "bg-slate-100"}`} />

            {/* Close & Logout Buttons */}
            <View className="flex-row gap-3 w-full">
              <TouchableOpacity
                onPress={() => setIsAboutVisible(false)}
                className={`flex-1 py-3 rounded-xl items-center border ${
                  isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 active:bg-slate-50"
                }`}
              >
                <Text className={`text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleLogout}
                className="flex-1 bg-red-50 border border-red-150 py-3 rounded-xl items-center active:bg-red-100"
              >
                <Text className="text-xs font-bold text-red-600">Logout</Text>
              </TouchableOpacity>
            </View>
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
  isDark = false,
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
  className?: string;
  isDark?: boolean;
}) {
  const getToneColor = () => {
    if (tone === "success") return isDark ? "#4ade80" : "#16a34a";
    if (tone === "warning") return "#D4A94A";
    return isDark ? "#B8CAD9" : "#173B6C";
  };

  const cardBg = isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-100";
  const textColor = isDark ? "text-slate-100" : "text-[#0F172A]";
  const labelColor = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <View className={`p-4 rounded-2xl border shadow-xs ${cardBg} ${className}`}>
      <View className="flex-row justify-between items-start mb-2">
        <Text className={`text-2xl font-extrabold font-mono tracking-tight ${textColor}`} numberOfLines={1}>
          {value}
        </Text>
        <Icon size={18} color={getToneColor()} />
      </View>
      <Text className={`text-xs font-bold ${labelColor}`}>
        {label}
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
  isDark = false,
}: {
  icon: any;
  label: string;
  primary: string;
  secondary: string;
  tone?: "default" | "success" | "warning";
  className?: string;
  isDark?: boolean;
}) {
  const getToneColor = () => {
    if (tone === "success") return isDark ? "#4ade80" : "#16a34a";
    if (tone === "warning") return "#D4A94A";
    return isDark ? "#B8CAD9" : "#173B6C";
  };

  const cardBg = isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-100";
  const textColor = isDark ? "text-slate-200" : "text-slate-800";
  const labelColor = isDark ? "text-slate-400" : "text-muted-foreground";

  return (
    <View className={`p-3 rounded-2xl border shadow-xs ${cardBg} ${className}`}>
      <View className="flex-row items-center gap-1.5 mb-1.5">
        <Icon size={12} color={getToneColor()} />
        <Text className={`text-[10px] uppercase font-bold tracking-wider ${labelColor}`}>
          {label}
        </Text>
      </View>
      <Text className={`text-xs font-bold truncate ${textColor}`} numberOfLines={1}>
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
  isDark = false,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  isDark?: boolean;
}) {
  const cardBg = isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-100";
  const textColor = isDark ? "text-slate-200" : "text-[#173B6C]";

  return (
    <PressableScale
      onPress={onPress}
      className={`flex-1 min-w-[76px] p-4 items-center justify-center border rounded-2xl shadow-xs ${cardBg}`}
    >
      <Icon size={22} color={isDark ? "#B8CAD9" : "#173B6C"} />
      <Text className={`text-[10px] font-bold text-center mt-2.5 ${textColor}`} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}
