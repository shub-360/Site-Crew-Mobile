import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  HardHat,
  ChevronRight,
  UserPlus,
  Sparkles,
  ChevronLeft,
} from "lucide-react-native";
import {
  listProjectsWithStats,
  getProjectAssignedWorkers,
  getAttendanceForProjectDay,
  listWorkersWithStats,
} from "@/lib/stats.functions";
import { upsertAttendance, bulkUpsertAttendance, clearAttendance } from "@/lib/attendance.functions";
import { assignWorker } from "@/lib/projects.functions";
import { ATTENDANCE_LABEL, type AttendanceType } from "@/lib/wages";
import { toLocalISODate } from "@/lib/format";
import { handleApiError } from "@/lib/errors";
import { useIsDark } from "@/hooks/use-is-dark";
import { PressableScale } from "@/components/PressableScale";

const TYPES: AttendanceType[] = ["full", "half", "overtime", "absent"];

interface ProjectStats {
  id: string;
  name: string;
  location: string | null;
  status: string;
  assignedCount: number;
}

export default function AttendanceScreen() {
  const [projectId, setProjectId] = useState<string | null>(null);

  if (projectId) {
    return (
      <ProjectAttendance projectId={projectId} onBack={() => setProjectId(null)} />
    );
  }

  return <ProjectPicker onPick={setProjectId} />;
}

function ProjectPicker({ onPick }: { onPick: (id: string) => void }) {
  const isDark = useIsDark();
  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ["projects", "stats"],
    queryFn: () => listProjectsWithStats() as Promise<ProjectStats[]>,
    staleTime: 1000 * 60 * 2, // 2 minutes stale time
  });

  const activeProjects = useMemo(() => {
    return projects.filter((p) => p.status === "active" || p.status === "planning");
  }, [projects]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className={`flex-1 ${isDark ? "bg-[#0F172A]" : "bg-[#F8FAFC]"}`}>
      <ScrollView
        contentContainerClassName="px-4 py-6 pb-32 gap-4"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            colors={[isDark ? "#B8CAD9" : "#173B6C"]}
          />
        }
      >
        {/* Header Info */}
        <View className={`border p-5 rounded-2xl flex-row items-center gap-3.5 shadow-xs ${
          isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
        }`}>
          <View className={`w-10 h-10 rounded-xl items-center justify-center ${
            isDark ? "bg-slate-800" : "bg-[#173B6C]/10"
          }`}>
            <HardHat size={20} color={isDark ? "#B8CAD9" : "#173B6C"} />
          </View>
          <View className="flex-1">
            <Text className={`text-base font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>Select Project</Text>
            <Text className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
              Mark attendance for workers assigned to this site.
            </Text>
          </View>
        </View>

        {/* Project Lists */}
        {isLoading ? (
          <ActivityIndicator size="large" color={isDark ? "#B8CAD9" : "#173B6C"} className="py-12" />
        ) : activeProjects.length === 0 ? (
          <View className={`border rounded-2xl p-6 items-center ${
            isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
          }`}>
            <Text className={`text-sm text-center ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
              No active or planning projects found. Add a project first to manage attendance.
            </Text>
          </View>
        ) : (
          <View className={`border rounded-2xl overflow-hidden shadow-xs divide-y ${
            isDark ? "bg-[#1E293B] border-slate-800 divide-slate-800" : "bg-white border-border divide-slate-100"
          }`}>
            {activeProjects.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => onPick(p.id)}
                className={`w-full p-4 flex-row justify-between items-center ${
                  isDark ? "bg-[#1E293B] active:bg-slate-800" : "bg-white active:bg-slate-50"
                }`}
              >
                <View className="flex-1 pr-3">
                  <Text className={`font-bold text-base truncate ${isDark ? "text-slate-200" : "text-slate-850"}`}>
                    {p.name}
                  </Text>
                  <Text className={`text-xs truncate mt-0.5 ${isDark ? "text-slate-450" : "text-muted-foreground"}`}>
                    {p.location || "No Location Specified"}
                  </Text>
                  <Text className={`text-[10px] font-bold uppercase tracking-wider mt-2 px-2 py-0.5 rounded-full self-start ${
                    isDark ? "bg-[#B8CAD9]/10 text-[#B8CAD9]" : "bg-[#173B6C]/5 text-primary"
                  }`}>
                    {p.assignedCount} workers
                  </Text>
                </View>
                <ChevronRight size={18} color={isDark ? "#64748B" : "#94A3B8"} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProjectAttendance({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const isDark = useIsDark();
  const [date, setDate] = useState(() => toLocalISODate(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Fetch Project stats to display name
  const { data: projects = [] } = useQuery<ProjectStats[]>({
    queryKey: ["projects", "stats"],
    queryFn: () => listProjectsWithStats() as Promise<ProjectStats[]>,
    staleTime: 1000 * 60 * 2,
  });
  const project = projects.find((p) => p.id === projectId);

  // Queries
  const { data: workers = [], isLoading: loadingWorkers, refetch: refetchWorkers } = useQuery({
    queryKey: ["project-workers", projectId],
    queryFn: () => getProjectAssignedWorkers({ project_id: projectId }),
    staleTime: 1000 * 60 * 1, // 1 minute stale time for project workers roster
  });

  const { data: dayRows = [], isLoading: loadingAttendance, refetch: refetchAttendance } = useQuery({
    queryKey: ["attendance", projectId, date],
    queryFn: () => getAttendanceForProjectDay({ project_id: projectId, date }),
    staleTime: 1000 * 30, // 30 seconds stale time for attendance list on selected day
  });

  const byWorker = useMemo(() => {
    return new Map<string, AttendanceType>(dayRows.map((r) => [r.worker_id, r.type as AttendanceType]));
  }, [dayRows]);

  // Yesterday's reference queries
  const yesterdayStr = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return toLocalISODate(d);
  }, [date]);

  const { data: yesterdayRows = [] } = useQuery({
    queryKey: ["attendance", projectId, yesterdayStr],
    queryFn: () => getAttendanceForProjectDay({ project_id: projectId, date: yesterdayStr }),
    staleTime: 1000 * 60 * 5, // Yesterday's status is historically stable
  });

  const yesterdayByWorker = useMemo(() => {
    return new Map<string, AttendanceType>(yesterdayRows.map((r) => [r.worker_id, r.type as AttendanceType]));
  }, [yesterdayRows]);

  // Unassigned workers
  const { data: workersWithStats = [] } = useQuery({
    queryKey: ["workers", "stats"],
    queryFn: () => listWorkersWithStats(),
    staleTime: 1000 * 60 * 2, // 2 minutes stale time
  });

  const unassignedWorkers = useMemo(() => {
    return workersWithStats.filter(
      (w: any) =>
        (!w.assignedProjects || w.assignedProjects.length === 0) &&
        w.status === "active"
    );
  }, [workersWithStats]);

  // Mutations
  const markMutation = useMutation({
    mutationFn: (vars: { worker_id: string; type: AttendanceType; isClear?: boolean }) =>
      vars.isClear
        ? clearAttendance({ worker_id: vars.worker_id, date })
        : upsertAttendance({ worker_id: vars.worker_id, type: vars.type, date, project_id: projectId }),
    onMutate: async ({ worker_id, type, isClear }) => {
      await qc.cancelQueries({ queryKey: ["attendance", projectId, date] });
      const prev = qc.getQueryData<any[]>(["attendance", projectId, date]) ?? [];
      const next = isClear
        ? prev.filter((r) => r.worker_id !== worker_id)
        : [
            ...prev.filter((r) => r.worker_id !== worker_id),
            { worker_id, type },
          ];
      qc.setQueryData(["attendance", projectId, date], next);
      return { prev };
    },
    onError: (err: any, _vars, context) => {
      if (context?.prev) {
        qc.setQueryData(["attendance", projectId, date], context.prev);
      }
      handleApiError(err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["attendance", projectId, date] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["projects", "stats"] });
      qc.invalidateQueries({ queryKey: ["att-matrix"] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: () =>
      bulkUpsertAttendance({
        date,
        project_id: projectId,
        workers: workers.map((w: any) => ({ worker_id: w.id, type: "full" })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", projectId, date] });
      qc.invalidateQueries({ queryKey: ["projects", "stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["att-matrix"] });
      Alert.alert("Success", "Marked all active crew as Full Day");
    },
    onError: (error: any) => handleApiError(error),
  });

  const assignMutation = useMutation({
    mutationFn: (workerId: string) => assignWorker({ project_id: projectId, worker_id: workerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-workers", projectId] });
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["projects", "stats"] });
      qc.invalidateQueries({ queryKey: ["att-matrix"] });
      Alert.alert("Success", "Worker assigned to project");
    },
    onError: (error: any) => handleApiError(error),
  });

  const presentTodayCount = useMemo(() => {
    return dayRows.filter((r) => r.type !== "absent").length;
  }, [dayRows]);

  // Navigate Date Helpers
  function incrementDate(days: number) {
    const parts = date.split("-");
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const d = new Date(year, month, day);
      d.setDate(d.getDate() + days);
      setDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }
  }

  const renderWorkerAttendanceItem = useCallback(({ item: w }: { item: any }) => {
    const current = byWorker.get(w.id);
    const yest = yesterdayByWorker.get(w.id);

    return (
      <View className={`border rounded-2xl p-4 shadow-xs mb-3 ${
        isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
      }`}>
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 pr-2">
            <Text className={`font-bold text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>{w.full_name}</Text>
            <Text className={`text-xs mt-0.5 ${isDark ? "text-slate-450" : "text-muted-foreground"}`}>
              {w.worker_type || "Worker"}
            </Text>
          </View>
          {yest && (
            <View className={`border px-2 py-0.5 rounded-lg ${
              isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
            }`}>
              <Text className={`text-[9px] font-semibold ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                Yest: {ATTENDANCE_LABEL[yest]}
              </Text>
            </View>
          )}
        </View>

        {/* Attendance Grid Selection */}
        <View className="flex-row gap-1.5">
          {TYPES.map((t) => {
            const active = current === t;
            let btnBg = isDark ? "bg-[#1E293B] border-slate-700" : "bg-white border-slate-200";
            let txtColor = isDark ? "text-slate-400" : "text-slate-600";
            if (active) {
              btnBg = isDark ? "bg-[#B8CAD9] border-[#B8CAD9]" : "bg-[#173B6C] border-[#173B6C]";
              txtColor = isDark ? "text-slate-900" : "text-white";
            }

            return (
              <TouchableOpacity
                key={t}
                onPress={() => markMutation.mutate({ worker_id: w.id, type: t, isClear: active })}
                className={`flex-1 items-center justify-center py-2.5 rounded-[14px] border ${btnBg}`}
              >
                <Text className={`text-xs font-bold ${txtColor}`}>
                  {ATTENDANCE_LABEL[t]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }, [byWorker, yesterdayByWorker, markMutation, isDark]);

  const isLoading = loadingWorkers || loadingAttendance;

  return (
    <SafeAreaView edges={["top", "left", "right"]} className={`flex-1 ${isDark ? "bg-[#0F172A]" : "bg-[#F8FAFC]"}`}>
      {/* Sub Header */}
      <View className={`px-4 py-3 border-b flex-row items-center gap-3 ${
        isDark ? "bg-[#0F172A] border-slate-800" : "bg-white border-slate-100"
      }`}>
        <TouchableOpacity
          onPress={onBack}
          className={`p-1 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
        >
          <ArrowLeft size={18} color={isDark ? "#B8CAD9" : "#64748B"} />
        </TouchableOpacity>
        <Text className={`text-sm font-semibold ${isDark ? "text-slate-350" : "text-slate-600"}`}>Change Project</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={isDark ? "#B8CAD9" : "#173B6C"} />
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(w: any) => w.id}
          extraData={byWorker}
          contentContainerClassName="px-4 py-5 pb-32"
          ListHeaderComponent={
            <View className="gap-4 mb-4">
              {/* Info Card with Date Navigation */}
              <View className={`border rounded-2xl p-5 shadow-xs gap-4 ${
                isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
              }`}>
                <View className="flex-row items-center gap-3">
                  <HardHat size={20} color={isDark ? "#B8CAD9" : "#173B6C"} />
                  <View className="flex-1">
                    <Text className={`text-base font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {project?.name ?? "Project"}
                    </Text>
                    <Text className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                      {project?.location || "—"}
                    </Text>
                  </View>
                </View>

                {/* Date Picker row */}
                <View className={`flex-row items-center gap-2 border-t pt-4 ${
                  isDark ? "border-slate-850" : "border-slate-100"
                }`}>
                  <TouchableOpacity
                    onPress={() => incrementDate(-1)}
                    className={`w-10 h-10 rounded-[14px] border justify-center items-center ${
                      isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <ChevronLeft size={16} color={isDark ? "#B8CAD9" : "#64748B"} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    className={`flex-1 flex-row items-center px-3 h-10 rounded-[14px] border ${
                      isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <Calendar size={14} color={isDark ? "#B8CAD9" : "#94A3B8"} />
                    <Text className={`flex-1 ml-2 text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {date}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => incrementDate(1)}
                    className={`w-10 h-10 rounded-[14px] border justify-center items-center ${
                      isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <ChevronRight size={16} color={isDark ? "#B8CAD9" : "#64748B"} />
                  </TouchableOpacity>

                  {/* Attendance Status Badge */}
                  <View className={`border rounded-[14px] h-10 px-3 justify-center items-center ${
                    isDark ? "bg-[#B8CAD9]/10 border-[#B8CAD9]/20" : "bg-[#173B6C]/5 border-[#173B6C]/20"
                  }`}>
                    <Text className={`text-xs font-bold font-mono ${isDark ? "text-[#B8CAD9]" : "text-primary"}`}>
                      {presentTodayCount}/{workers.length}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Mark All Full Day Button */}
              {workers.length > 0 && (
                <TouchableOpacity
                  onPress={() => bulkMutation.mutate()}
                  disabled={bulkMutation.isPending}
                  className={`flex-row items-center justify-center gap-2 py-3 rounded-[14px] border shadow-xs ${
                    isDark ? "bg-slate-800 border-slate-700" : "bg-[#173B6C] border-primary/10 active:bg-primary-600"
                  }`}
                >
                  <Sparkles size={14} color={isDark ? "#B8CAD9" : "#FFFFFF"} />
                  <Text className={`text-xs font-bold ${isDark ? "text-[#B8CAD9]" : "text-white"}`}>
                    {bulkMutation.isPending ? "Saving..." : "Mark All as Full Day"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            <View className={`border rounded-2xl p-6 items-center ${
              isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
            }`}>
              <Text className={`text-sm text-center ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                No workers are currently assigned to this project. Go to the project profile to assign workers.
              </Text>
            </View>
          }
          renderItem={renderWorkerAttendanceItem}
          ListFooterComponent={
            unassignedWorkers.length > 0 ? (
              <View className={`gap-2.5 mt-4 border-t pt-5 ${
                isDark ? "border-slate-800" : "border-slate-100"
              }`}>
                <View className="flex-row items-center gap-2 mb-1">
                  <UserPlus size={14} color={isDark ? "#B8CAD9" : "#64748B"} />
                  <Text className={`text-xs uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                    Unassigned Workers ({unassignedWorkers.length})
                  </Text>
                </View>

                <View className="gap-2.5">
                  {unassignedWorkers.map((w: any) => (
                    <View
                      key={w.id}
                      className={`border p-4 rounded-2xl flex-row justify-between items-center shadow-xs ${
                        isDark ? "bg-[#1E293B] border-slate-800 border-dashed" : "bg-white border-dashed border-slate-200"
                      }`}
                    >
                      <View className="flex-1 pr-3">
                        <Text className={`font-bold text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>{w.full_name}</Text>
                        <Text className="text-[10px] text-red-500 font-bold mt-0.5">
                          This worker is currently not assigned to any site.
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => assignMutation.mutate(w.id)}
                        disabled={assignMutation.isPending}
                        className={`border px-3.5 py-1.5 rounded-[14px] flex-row items-center gap-1 bg-white ${
                          isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 active:bg-slate-50"
                        }`}
                      >
                        <UserPlus size={11} color={isDark ? "#B8CAD9" : "#173B6C"} />
                        <Text className={`text-xs font-bold ${isDark ? "text-[#B8CAD9]" : "text-primary"}`}>Assign</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            ) : null
          }
        />
      )}
      {showDatePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={date ? new Date(date + "T00:00:00") : new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setDate(
                `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(
                  selectedDate.getDate()
                ).padStart(2, "0")}`
              );
            }
          }}
        />
      )}

      {showDatePicker && Platform.OS === "ios" && (
        <Modal transparent visible={showDatePicker} animationType="fade">
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
            className={`flex-1 justify-end ${isDark ? "bg-black/60" : "bg-black/40"}`}
          >
            <View className={`p-4 pb-8 rounded-t-3xl border-t ${
              isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
            }`}>
              <View className={`flex-row justify-between items-center mb-4 pb-2 border-b ${
                isDark ? "border-slate-850" : "border-slate-100"
              }`}>
                <Text className={`text-base font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>Select Date</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  className={`px-4 py-1.5 rounded-[14px] ${isDark ? "bg-slate-700" : "bg-[#173B6C]"}`}
                >
                  <Text className="text-sm font-semibold text-white">Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={date ? new Date(date + "T00:00:00") : new Date()}
                mode="date"
                display="spinner"
                textColor={isDark ? "#FFFFFF" : "#000000"}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setDate(
                      `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(
                        selectedDate.getDate()
                      ).padStart(2, "0")}`
                    );
                  }
                }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}
