import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  HardHat,
  Calendar as CalendarIcon,
  Users,
  FileSpreadsheet,
  Download,
  ChevronRight,
  X,
  Banknote,
  Info,
} from "lucide-react-native";
import { listProjects } from "@/lib/projects.functions";
import { listWorkers } from "@/lib/workers.functions";
import { generateMonthlyReport, shareReport } from "@/lib/reports.functions";
import { getAttendanceMatrix, listProjectsWithStats } from "@/lib/stats.functions";
import { formatCurrency } from "@/lib/format";
import { handleApiError } from "@/lib/errors";


const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function ReportsScreen() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [projectId, setProjectId] = useState<string>("all");
  const [workerId, setWorkerId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"summary" | "calendar" | "cost">("summary");

  // Selection Overlay states
  const [showMonthSelect, setShowMonthSelect] = useState(false);
  const [showYearSelect, setShowYearSelect] = useState(false);
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [showWorkerSelect, setShowWorkerSelect] = useState(false);

  // Queries
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
    staleTime: 1000 * 60 * 5, // 5 minutes stale time for dropdown filter values
  });

  const { data: workers = [], isLoading: loadingWorkers } = useQuery({
    queryKey: ["workers"],
    queryFn: () => listWorkers(),
    staleTime: 1000 * 60 * 5, // 5 minutes stale time for dropdown filter values
  });

  const { data: matrix, isLoading: loadingMatrix, refetch: refetchMatrix } = useQuery({
    queryKey: ["att-matrix", year, month, projectId],
    queryFn: () =>
      getAttendanceMatrix({
        year,
        month,
        project_id: projectId === "all" ? null : projectId,
      }),
    staleTime: 1000 * 60 * 2, // 2 minutes stale time for attendance matrix
  });

  const { data: projStats = [], isLoading: loadingProjStats, refetch: refetchProjStats } = useQuery({
    queryKey: ["projects", "stats"],
    queryFn: () => listProjectsWithStats(),
    staleTime: 1000 * 60 * 2, // 2 minutes stale time for cost stats
  });

  // Excel Generation Mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await generateMonthlyReport({
        year,
        month,
        project_id: projectId === "all" ? null : projectId,
        worker_id: workerId === "all" ? null : workerId,
      });
      await shareReport(res.fileUri);
      return res;
    },
    onSuccess: (res) => {
      Alert.alert("Success", `Report generated: ${res.filename}. ${res.rowCount} worker rows exported.`);
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const selectedProjectName = useMemo(() => {
    if (projectId === "all") return "All Projects";
    const p = projects.find((x) => x.id === projectId);
    return p ? p.name : "All Projects";
  }, [projectId, projects]);

  const selectedWorkerName = useMemo(() => {
    if (workerId === "all") return "All Workers";
    const w = workers.find((x) => x.id === workerId);
    return w ? w.full_name : "All Workers";
  }, [workerId, workers]);

  function cellLabel(c: string) {
    if (c === "full") return "P";
    if (c === "half") return "H";
    if (c === "overtime") return "O";
    if (c === "absent") return "A";
    return "";
  }

  function cellStyle(c: string) {
    if (c === "full") return "bg-primary/10 border-primary/20 text-primary";
    if (c === "half") return "bg-amber-50 border-amber-200 text-amber-700";
    if (c === "overtime") return "bg-green-50 border-green-200 text-green-700";
    if (c === "absent") return "bg-red-50 border-red-200 text-red-700";
    return "bg-slate-50 border-slate-100 text-slate-350";
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-5 gap-4">
        {/* Filters Card */}
        <View className="bg-white border border-border rounded-2xl p-4 shadow-xs gap-3">
          <View className="flex-row gap-3">
            {/* Month Filter */}
            <View className="flex-1 gap-1">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Month
              </Text>
              <TouchableOpacity
                onPress={() => setShowMonthSelect(true)}
                className="bg-slate-50 border border-slate-200 px-3 h-10 rounded-xl flex-row items-center justify-between"
              >
                <Text className="text-sm font-semibold text-slate-700">
                  {MONTHS[month - 1]}
                </Text>
                <CalendarIcon size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Year Filter */}
            <View className="flex-1 gap-1">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Year
              </Text>
              <TouchableOpacity
                onPress={() => setShowYearSelect(true)}
                className="bg-slate-50 border border-slate-200 px-3 h-10 rounded-xl flex-row items-center justify-between"
              >
                <Text className="text-sm font-semibold text-slate-700">{year}</Text>
                <CalendarIcon size={14} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row gap-3">
            {/* Project Filter */}
            <View className="flex-1 gap-1">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Project Filter
              </Text>
              <TouchableOpacity
                onPress={() => setShowProjectSelect(true)}
                className="bg-slate-50 border border-slate-200 px-3 h-10 rounded-xl flex-row items-center justify-between"
              >
                <Text className="text-xs font-semibold text-slate-700 truncate flex-1 pr-1" numberOfLines={1}>
                  {selectedProjectName}
                </Text>
                <HardHat size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Worker Filter (Only affects summary export) */}
            <View className="flex-1 gap-1">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Worker Filter
              </Text>
              <TouchableOpacity
                onPress={() => setShowWorkerSelect(true)}
                className="bg-slate-50 border border-slate-200 px-3 h-10 rounded-xl flex-row items-center justify-between"
              >
                <Text className="text-xs font-semibold text-slate-700 truncate flex-1 pr-1" numberOfLines={1}>
                  {selectedWorkerName}
                </Text>
                <Users size={14} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Custom Tab Bar */}
        <View className="flex-row bg-slate-200/60 border border-slate-200 rounded-2xl p-1">
          <TouchableOpacity
            onPress={() => setActiveTab("summary")}
            className={`flex-1 py-2.5 rounded-xl items-center ${
              activeTab === "summary" ? "bg-white shadow-xs" : ""
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === "summary" ? "text-slate-800" : "text-slate-500"
              }`}
            >
              XLSX Export
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("calendar")}
            className={`flex-1 py-2.5 rounded-xl items-center ${
              activeTab === "calendar" ? "bg-white shadow-xs" : ""
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === "calendar" ? "text-slate-800" : "text-slate-500"
              }`}
            >
              Calendar Matrix
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("cost")}
            className={`flex-1 py-2.5 rounded-xl items-center ${
              activeTab === "cost" ? "bg-white shadow-xs" : ""
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === "cost" ? "text-slate-800" : "text-slate-500"
              }`}
            >
              Cost Report
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Contents */}
        {activeTab === "summary" && (
          <View className="bg-white border border-border rounded-2xl p-5 shadow-xs gap-5">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                <FileSpreadsheet size={20} color="#1E3A5F" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-800">Sitecrew Report (XLSX)</Text>
                <Text className="text-xs text-muted-foreground mt-0.5 leading-normal">
                  Generates an Excel spreadsheet with 3 worksheets: Workforce Summary, Attendance Calendar, and Labour Cost.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="bg-primary flex-row items-center justify-center gap-2 h-12 rounded-xl active:bg-primary-600 shadow-xs"
            >
              {generateMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Download size={16} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">Generate & Share Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === "calendar" && (
          <View className="bg-white border border-border rounded-2xl shadow-xs overflow-hidden">
            {loadingMatrix ? (
              <ActivityIndicator size="large" color="#1E3A5F" className="py-12" />
            ) : !matrix || matrix.rows.length === 0 ? (
              <Text className="p-8 text-sm text-muted-foreground text-center">
                No attendance logs found for this filter in {MONTHS[month - 1]} {year}.
              </Text>
            ) : (
              <View>
                {/* Scrollable Matrix Table */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    {/* Header Row */}
                    <View className="flex-row border-b border-slate-100 items-center h-10 bg-slate-50/50">
                      {/* Name sticky space header */}
                      <View className="w-24 px-3 justify-center h-full border-r border-slate-100">
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Worker
                        </Text>
                      </View>
                      {/* Days headers */}
                      {Array.from({ length: matrix.days }, (_, i) => i + 1).map((d) => (
                        <View
                          key={d}
                          className="w-8 items-center justify-center h-full border-r border-slate-100"
                        >
                          <Text className="text-[10px] font-bold text-slate-600 font-mono">
                            {d}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Matrix Rows */}
                    {matrix.rows.map((row: any) => (
                      <View
                        key={row.worker_id}
                        className="flex-row border-b border-slate-100 items-center h-10 bg-white"
                      >
                        <View className="w-24 px-3 justify-center h-full border-r border-slate-100 bg-white">
                          <Text className="text-xs font-bold text-slate-800 truncate" numberOfLines={1}>
                            {row.name}
                          </Text>
                        </View>
                        {row.cells.map((cell: string, idx: number) => (
                          <View
                            key={idx}
                            className="w-8 items-center justify-center h-full border-r border-slate-100"
                          >
                            <View
                              className={`w-6 h-6 rounded-md items-center justify-center border ${cellStyle(
                                cell
                              )}`}
                            >
                              <Text className="text-[9px] font-bold font-mono">
                                {cellLabel(cell)}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>

                {/* Legend panel */}
                <View className="p-4 border-t border-slate-100 bg-slate-50/50 flex-row gap-4 flex-wrap justify-center">
                  <Text className="text-[10px] font-semibold text-slate-500">
                    <Text className="font-bold text-primary font-mono">P</Text> = Present (Full)
                  </Text>
                  <Text className="text-[10px] font-semibold text-slate-500">
                    <Text className="font-bold text-amber-600 font-mono">H</Text> = Half Day
                  </Text>
                  <Text className="text-[10px] font-semibold text-slate-500">
                    <Text className="font-bold text-green-600 font-mono">O</Text> = Overtime
                  </Text>
                  <Text className="text-[10px] font-semibold text-slate-500">
                    <Text className="font-bold text-red-500 font-mono">A</Text> = Absent
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {activeTab === "cost" && (
          <View className="bg-white border border-border rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
            {loadingProjStats ? (
              <ActivityIndicator size="large" color="#1E3A5F" className="py-12" />
            ) : projStats.length === 0 ? (
              <Text className="p-8 text-sm text-muted-foreground text-center">
                No active projects found.
              </Text>
            ) : (
              projStats.map((p: any) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => router.push(`/projects/${p.id}` as any)}
                  className="p-4 flex-row justify-between items-center bg-white active:bg-slate-50"
                >
                  <View className="flex-1 pr-3">
                    <Text className="font-bold text-slate-800 text-sm truncate">
                      {p.name}
                    </Text>
                    <Text className="text-xs text-slate-400 mt-0.5 font-mono">
                      {p.assignedCount} workers · avg{" "}
                      {formatCurrency(
                        p.assignedCount > 0 ? Math.round(p.monthCost / p.assignedCount) : 0
                      )}
                      /worker
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-base font-bold text-primary font-mono">
                      {formatCurrency(p.monthCost)}
                    </Text>
                    <ChevronRight size={14} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Month Selection Modal */}
      <Modal visible={showMonthSelect} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowMonthSelect(false)}
          className="flex-1 bg-black/40 justify-center items-center"
        >
          <View className="bg-white w-[80%] rounded-2xl p-4 gap-3 max-h-[70%]">
            <Text className="text-base font-bold text-slate-800 pb-2 border-b border-slate-100">
              Select Month
            </Text>
            <ScrollView contentContainerClassName="gap-1">
              {MONTHS.map((mName, idx) => (
                <TouchableOpacity
                  key={mName}
                  onPress={() => {
                    setMonth(idx + 1);
                    setShowMonthSelect(false);
                  }}
                  className={`py-3 px-4 rounded-xl ${month === idx + 1 ? "bg-primary/5" : ""}`}
                >
                  <Text
                    className={`font-semibold ${
                      month === idx + 1 ? "text-primary text-base" : "text-slate-700 text-sm"
                    }`}
                  >
                    {mName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Year Selection Modal */}
      <Modal visible={showYearSelect} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowYearSelect(false)}
          className="flex-1 bg-black/40 justify-center items-center"
        >
          <View className="bg-white w-[80%] rounded-2xl p-4 gap-3">
            <Text className="text-base font-bold text-slate-800 pb-2 border-b border-slate-100">
              Select Year
            </Text>
            {years.map((y) => (
              <TouchableOpacity
                key={y}
                onPress={() => {
                  setYear(y);
                  setShowYearSelect(false);
                }}
                className={`py-3 px-4 rounded-xl ${year === y ? "bg-primary/5" : ""}`}
              >
                <Text
                  className={`font-semibold ${
                    year === y ? "text-primary text-base" : "text-slate-700 text-sm"
                  }`}
                >
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Project Selection Modal */}
      <Modal visible={showProjectSelect} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowProjectSelect(false)}
          className="flex-1 bg-black/40 justify-center items-center"
        >
          <View className="bg-white w-[85%] rounded-2xl p-4 gap-3 max-h-[70%]">
            <Text className="text-base font-bold text-slate-800 pb-2 border-b border-slate-100">
              Select Project Filter
            </Text>
            <ScrollView contentContainerClassName="gap-1">
              <TouchableOpacity
                onPress={() => {
                  setProjectId("all");
                  setShowProjectSelect(false);
                }}
                className={`py-3 px-4 rounded-xl ${projectId === "all" ? "bg-primary/5" : ""}`}
              >
                <Text
                  className={`font-semibold ${
                    projectId === "all" ? "text-primary text-base" : "text-slate-700 text-sm"
                  }`}
                >
                  All Projects
                </Text>
              </TouchableOpacity>
              {projects.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => {
                    setProjectId(p.id);
                    setShowProjectSelect(false);
                  }}
                  className={`py-3 px-4 rounded-xl ${projectId === p.id ? "bg-primary/5" : ""}`}
                >
                  <Text
                    className={`font-semibold ${
                      projectId === p.id ? "text-primary text-base" : "text-slate-700 text-sm"
                    }`}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Worker Selection Modal */}
      <Modal visible={showWorkerSelect} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowWorkerSelect(false)}
          className="flex-1 bg-black/40 justify-center items-center"
        >
          <View className="bg-white w-[85%] rounded-2xl p-4 gap-3 max-h-[70%]">
            <Text className="text-base font-bold text-slate-800 pb-2 border-b border-slate-100">
              Select Worker Filter
            </Text>
            <ScrollView contentContainerClassName="gap-1">
              <TouchableOpacity
                onPress={() => {
                  setWorkerId("all");
                  setShowWorkerSelect(false);
                }}
                className={`py-3 px-4 rounded-xl ${workerId === "all" ? "bg-primary/5" : ""}`}
              >
                <Text
                  className={`font-semibold ${
                    workerId === "all" ? "text-primary text-base" : "text-slate-700 text-sm"
                  }`}
                >
                  All Workers
                </Text>
              </TouchableOpacity>
              {workers.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  onPress={() => {
                    setWorkerId(w.id);
                    setShowWorkerSelect(false);
                  }}
                  className={`py-3 px-4 rounded-xl ${workerId === w.id ? "bg-primary/5" : ""}`}
                >
                  <Text
                    className={`font-semibold ${
                      workerId === w.id ? "text-primary text-base" : "text-slate-700 text-sm"
                    }`}
                  >
                    {w.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
