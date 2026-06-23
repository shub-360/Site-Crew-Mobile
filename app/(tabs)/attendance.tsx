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
} from "react-native";
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
  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ["projects", "stats"],
    queryFn: () => listProjectsWithStats() as Promise<ProjectStats[]>,
    staleTime: 1000 * 60 * 2, // 2 minutes stale time
  });

  const activeProjects = useMemo(() => {
    return projects.filter((p) => p.status === "active" || p.status === "planning");
  }, [projects]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerClassName="px-4 py-6 pb-32 gap-4"
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} colors={["#1E3A5F"]} />
        }
      >
        {/* Header Info */}
        <View className="bg-white border border-border p-5 rounded-2xl flex-row items-center gap-3.5 shadow-xs">
          <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
            <HardHat size={20} color="#1E3A5F" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-slate-800">Select Project</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              Mark attendance for workers assigned to this site.
            </Text>
          </View>
        </View>

        {/* Project Lists */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#1E3A5F" className="py-12" />
        ) : activeProjects.length === 0 ? (
          <View className="bg-white border border-border rounded-2xl p-6 items-center">
            <Text className="text-sm text-muted-foreground text-center">
              No active or planning projects found. Add a project first to manage attendance.
            </Text>
          </View>
        ) : (
          <View className="bg-white border border-border rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
            {activeProjects.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => onPick(p.id)}
                className="w-full p-4 flex-row justify-between items-center bg-white active:bg-slate-50"
              >
                <View className="flex-1 pr-3">
                  <Text className="font-bold text-slate-850 text-base truncate">
                    {p.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground truncate mt-0.5">
                    {p.location || "No Location Specified"}
                  </Text>
                  <Text className="text-[10px] font-bold text-primary uppercase tracking-wider mt-2 bg-primary/5 px-2 py-0.5 rounded-full self-start">
                    {p.assignedCount} workers
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
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
  const [date, setDate] = useState(() => toLocalISODate(new Date()));

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
      <View className="bg-white border border-border rounded-2xl p-4 shadow-xs mb-3">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 pr-2">
            <Text className="font-bold text-slate-800 text-sm">{w.full_name}</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              {w.worker_type || "Worker"}
            </Text>
          </View>
          {yest && (
            <View className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
              <Text className="text-[9px] text-muted-foreground font-semibold">
                Yest: {ATTENDANCE_LABEL[yest]}
              </Text>
            </View>
          )}
        </View>

        {/* Attendance Grid Selection */}
        <View className="flex-row gap-1.5">
          {TYPES.map((t) => {
            const active = current === t;
            let btnBg = "bg-white border-slate-200";
            let txtColor = "text-slate-600";
            if (active) {
              btnBg = "bg-primary border-primary";
              txtColor = "text-white";
            }

            return (
              <TouchableOpacity
                key={t}
                onPress={() => markMutation.mutate({ worker_id: w.id, type: t, isClear: active })}
                className={`flex-1 items-center justify-center py-2.5 rounded-xl border ${btnBg}`}
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
  }, [byWorker, yesterdayByWorker, markMutation]);

  const isLoading = loadingWorkers || loadingAttendance;

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-slate-50">
      {/* Sub Header */}
      <View className="px-4 py-3 bg-white border-b border-slate-100 flex-row items-center gap-3">
        <TouchableOpacity onPress={onBack} className="p-1 rounded-full bg-slate-100">
          <ArrowLeft size={18} color="#64748B" />
        </TouchableOpacity>
        <Text className="text-sm font-semibold text-slate-600">Change Project</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#1E3A5F" />
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
              <View className="bg-white border border-border rounded-2xl p-5 shadow-xs gap-4">
                <View className="flex-row items-center gap-3">
                  <HardHat size={20} color="#1E3A5F" />
                  <View className="flex-1">
                    <Text className="text-base font-bold text-slate-800">{project?.name ?? "Project"}</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5">{project?.location || "—"}</Text>
                  </View>
                </View>

                {/* Date Picker row */}
                <View className="flex-row items-center gap-2 border-t border-slate-100 pt-4">
                  <TouchableOpacity
                    onPress={() => incrementDate(-1)}
                    className="w-10 h-10 rounded-xl border border-slate-200 justify-center items-center bg-slate-50"
                  >
                    <ChevronLeft size={16} color="#64748B" />
                  </TouchableOpacity>

                  <View className="flex-1 flex-row items-center bg-slate-50 border border-slate-200 px-3 h-10 rounded-xl">
                    <Calendar size={14} color="#94A3B8" />
                    <TextInput
                      value={date}
                      onChangeText={setDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94A3B8"
                      className="flex-1 ml-2 text-sm text-slate-800 font-semibold h-full"
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => incrementDate(1)}
                    className="w-10 h-10 rounded-xl border border-slate-200 justify-center items-center bg-slate-50"
                  >
                    <ChevronRight size={16} color="#64748B" />
                  </TouchableOpacity>

                  {/* Attendance Status Badge */}
                  <View className="bg-primary/5 border border-primary/20 rounded-xl h-10 px-3 justify-center items-center">
                    <Text className="text-xs font-bold text-primary font-mono">
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
                  className="bg-primary flex-row items-center justify-center gap-2 py-3 rounded-xl border border-primary/10 shadow-xs active:bg-primary-600"
                >
                  <Sparkles size={14} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white">
                    {bulkMutation.isPending ? "Saving..." : "Mark All as Full Day"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            <View className="bg-white border border-border rounded-2xl p-6 items-center">
              <Text className="text-sm text-muted-foreground text-center">
                No workers are currently assigned to this project. Go to the project profile to assign workers.
              </Text>
            </View>
          }
          renderItem={renderWorkerAttendanceItem}
          ListFooterComponent={
            unassignedWorkers.length > 0 ? (
              <View className="gap-2.5 mt-4 border-t border-slate-100 pt-5">
                <View className="flex-row items-center gap-2 mb-1">
                  <UserPlus size={14} color="#64748B" />
                  <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                    Unassigned Workers ({unassignedWorkers.length})
                  </Text>
                </View>

                <View className="gap-2.5">
                  {unassignedWorkers.map((w: any) => (
                    <View
                      key={w.id}
                      className="bg-white border border-dashed border-slate-200 p-4 rounded-2xl flex-row justify-between items-center shadow-xs"
                    >
                      <View className="flex-1 pr-3">
                        <Text className="font-bold text-slate-800 text-sm">{w.full_name}</Text>
                        <Text className="text-[10px] text-red-500 font-bold mt-0.5">
                          This worker is currently not assigned to any site.
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => assignMutation.mutate(w.id)}
                        disabled={assignMutation.isPending}
                        className="border border-slate-200 px-3.5 py-1.5 rounded-xl active:bg-slate-50 flex-row items-center gap-1 bg-white"
                      >
                        <UserPlus size={11} color="#1E3A5F" />
                        <Text className="text-xs font-bold text-primary">Assign</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
