import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { DatePickerField } from "@/components/DatePickerField";
import { Toast } from "@/components/Toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Search,
  Plus,
  ChevronRight,
  HardHat,
  Users,
  Banknote,
  Calendar,
  X,
  MapPin,
  Clipboard,
} from "lucide-react-native";
import { listProjectsWithStats } from "@/lib/stats.functions";
import { createProject, updateProject, type ProjectInput } from "@/lib/projects.functions";
import { formatCurrency, toLocalISODate } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import { handleApiError } from "@/lib/errors";
import { useIsDark } from "@/hooks/use-is-dark";
import { PressableScale } from "@/components/PressableScale";

type ProjectStatus = "planning" | "active" | "on_hold" | "completed";

interface ProjectStats {
  id: string;
  name: string;
  client: string | null;
  location: string | null;
  start_date: string | null;
  expected_end: string | null;
  contract_value: number;
  status: ProjectStatus;
  progress_pct: number;
  notes: string | null;
  assignedCount: number;
  monthCost: number;
  presentToday: number;
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
};

export default function ProjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const isDark = useIsDark();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterTab, setFilterTab] = useState<"all" | "active" | "planning" | "on_hold" | "completed">("all");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const validateField = (fieldName: string, value: string) => {
    let err = "";
    if (fieldName === "name") {
      if (!value.trim()) {
        err = "This field is required.";
      }
    } else if (fieldName === "contractValue") {
      const valNum = Number(value);
      if (value.trim() === "") {
        err = "This field is required.";
      } else if (isNaN(valNum) || valNum <= 0) {
        err = "Please enter a valid amount greater than ₹0.";
      }
    }
    setErrors((prev) => {
      const next = { ...prev };
      if (err) {
        next[fieldName] = err;
      } else {
        delete next[fieldName];
      }
      return next;
    });
    return err === "";
  };

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expectedEnd, setExpectedEnd] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");

  // Queries
  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ["projects", "stats"],
    queryFn: () => listProjectsWithStats() as Promise<ProjectStats[]>,
    staleTime: 1000 * 60 * 2, // 2 minutes stale time for projects list
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: ProjectInput) => createProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setToastMessage("Project created successfully");
      setToastVisible(true);
      closeModal();
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  function openAddModal() {
    setName("");
    setClient("");
    setLocation("");
    setStartDate(toLocalISODate(new Date()));
    setExpectedEnd("");
    setContractValue("0");
    setStatus("planning");
    setErrors({});
    setShowAddModal(true);
  }

  function closeModal() {
    setShowAddModal(false);
  }

  function handleSave() {
    const isNameValid = validateField("name", name);
    const isContractValid = validateField("contractValue", contractValue);

    if (!isNameValid || !isContractValid) {
      return;
    }

    const valNum = Number(contractValue);
    createMutation.mutate({
      name: name.trim(),
      client: client.trim() || null,
      location: location.trim() || null,
      start_date: startDate || null,
      expected_end: expectedEnd || null,
      contract_value: valNum,
      status,
      progress_pct: 0,
    });
  }

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (filterTab === "active") return p.status === "active";
      if (filterTab === "planning") return p.status === "planning";
      if (filterTab === "on_hold") return p.status === "on_hold";
      if (filterTab === "completed") return p.status === "completed";
      return true;
    });
  }, [projects, debouncedSearch, filterTab]);

  const renderItem = useCallback(({ item: p }: { item: ProjectStats }) => {
    let statusBadgeClass = isDark
      ? "bg-slate-800 border-slate-700 text-slate-350"
      : "bg-slate-100 border-slate-200 text-slate-700";
    let statusTextClass = isDark ? "text-slate-300" : "text-slate-700";

    if (p.status === "active") {
      statusBadgeClass = isDark ? "bg-green-950/40 border-green-900/60" : "bg-green-50 border-green-200";
      statusTextClass = isDark ? "text-green-400" : "text-green-700";
    } else if (p.status === "on_hold") {
      statusBadgeClass = isDark ? "bg-amber-950/40 border-amber-900/60" : "bg-amber-50 border-amber-200";
      statusTextClass = isDark ? "text-amber-400" : "text-amber-700";
    } else if (p.status === "completed") {
      statusBadgeClass = isDark ? "bg-blue-950/40 border-blue-900/60" : "bg-blue-50 border-blue-200";
      statusTextClass = isDark ? "text-blue-400" : "text-blue-700";
    }

    return (
      <PressableScale
        onPress={() => router.push(`/projects/${p.id}` as any)}
        className={`border rounded-2xl p-4 mb-3 shadow-xs ${
          isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-100"
        }`}
      >
        <View className="flex-row justify-between items-start mb-1 flex-wrap gap-2">
          <Text className={`font-bold text-base flex-1 pr-1 truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>
            {p.name}
          </Text>
          <View className={`border px-2.5 py-0.5 rounded-full ${statusBadgeClass}`}>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${statusTextClass}`}>
              {STATUS_LABEL[p.status]}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-1 mb-3">
          <MapPin size={12} color={isDark ? "#64748B" : "#94A3B8"} />
          <Text className={`text-xs truncate ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
            {p.client ? `${p.client} · ` : ""}
            {p.location || "No Location Specified"}
          </Text>
        </View>

        {/* Progress Bar */}
        <View className="gap-1 mb-4">
          <View className="flex-row justify-between items-center">
            <Text className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Progress</Text>
            <Text className={`text-xs font-bold font-mono ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              {p.progress_pct}%
            </Text>
          </View>
          <View className={`h-2 w-full rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
            <View
              className={`h-full rounded-full ${isDark ? "bg-[#B8CAD9]" : "bg-[#173B6C]"}`}
              style={{ width: `${p.progress_pct}%` }}
            />
          </View>
        </View>

        {/* Summary Metrics */}
        <View className={`flex-row flex-wrap gap-2 border-t pt-3 ${isDark ? "border-slate-800" : "border-slate-50"}`}>
          <View className={`flex-row items-center gap-1 border rounded-lg px-2 py-1 ${
            isDark ? "bg-slate-800/60 border-slate-700" : "bg-slate-50 border-slate-200"
          }`}>
            <Users size={11} color={isDark ? "#94A3B8" : "#64748B"} />
            <Text className={`text-[10px] font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              {p.assignedCount} workers
            </Text>
          </View>
          <View className={`flex-row items-center gap-1 border rounded-lg px-2 py-1 ${
            isDark ? "bg-slate-800/60 border-slate-700" : "bg-slate-50 border-slate-200"
          }`}>
            <Banknote size={11} color={isDark ? "#94A3B8" : "#64748B"} />
            <Text className={`text-[10px] font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              {formatCurrency(p.monthCost)}
            </Text>
          </View>
          {p.presentToday > 0 && (
            <View className={`flex-row items-center gap-1 border rounded-lg px-2 py-1 ${
              isDark ? "bg-green-950/40 border-green-900/60" : "bg-green-50 border-green-200"
            }`}>
              <Text className={`text-[10px] font-bold ${isDark ? "text-green-400" : "text-green-700"}`}>
                {p.presentToday} present today
              </Text>
            </View>
          )}
        </View>
      </PressableScale>
    );
  }, [router, isDark]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className={`flex-1 ${isDark ? "bg-[#0F172A]" : "bg-[#F8FAFC]"}`}>
      {/* Search Header */}
      <View className={`px-4 pt-4 pb-2 border-b flex-row gap-2 items-center ${
        isDark ? "bg-[#0F172A] border-slate-800" : "bg-white border-slate-100"
      }`}>
        <View className={`flex-1 flex-row items-center px-3 h-10 rounded-[14px] ${
          isDark ? "bg-slate-800" : "bg-slate-100"
        }`}>
          <Search size={16} color={isDark ? "#64748B" : "#94A3B8"} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search projects..."
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            className={`flex-1 ml-2 text-sm text-base h-full ${isDark ? "text-slate-200" : "text-slate-850"}`}
          />
        </View>
        <TouchableOpacity
          onPress={openAddModal}
          className={`h-10 w-10 rounded-[14px] items-center justify-center ${
            isDark ? "bg-slate-800 border border-slate-700" : "bg-[#173B6C]"
          }`}
        >
          <Plus size={20} color={isDark ? "#B8CAD9" : "#FFFFFF"} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName={`border-b py-2.5 px-4 gap-2 flex-row items-center ${
            isDark ? "bg-[#0F172A] border-slate-800" : "bg-white border-slate-100"
          }`}
        >
          {(
            [
              { id: "all", label: "All Projects" },
              { id: "active", label: "Active" },
              { id: "planning", label: "Planning" },
              { id: "on_hold", label: "On Hold" },
              { id: "completed", label: "Completed" },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setFilterTab(tab.id)}
              className={`py-1.5 px-4 rounded-full border ${
                filterTab === tab.id
                  ? isDark
                    ? "bg-[#B8CAD9] border-[#B8CAD9]"
                    : "bg-[#173B6C] border-[#173B6C]"
                  : isDark
                    ? "bg-[#1E293B] border-slate-700"
                    : "bg-white border-slate-200"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  filterTab === tab.id
                    ? isDark
                      ? "text-slate-900"
                      : "text-white"
                    : isDark
                      ? "text-slate-400"
                      : "text-slate-655"
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Projects List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={isDark ? "#B8CAD9" : "#173B6C"} />
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
          keyExtractor={(p) => p.id}
          contentContainerClassName="px-4 py-4 pb-32"
          refreshing={isLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            <View className="py-12 items-center justify-center gap-2">
              <Text className="text-4xl mb-2">🏗️</Text>
              <Text className={`text-base font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                No Projects Yet
              </Text>
              <Text className={`text-xs text-center px-6 mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                No projects matched your filters. Create your first construction site.
              </Text>
              <TouchableOpacity
                onPress={openAddModal}
                className={`px-4 py-2.5 rounded-[14px] border ${
                  isDark ? "bg-[#1E293B] border-slate-700 active:bg-slate-800" : "bg-white border-slate-200 active:bg-slate-50"
                }`}
              >
                <Text className={`text-xs font-bold ${isDark ? "text-[#B8CAD9]" : "text-[#173B6C]"}`}>
                  Create Project
                </Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      {/* Add Project Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-end bg-black/60">
            <View
              style={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
              className={`rounded-t-3xl p-6 gap-4 border-t max-h-[85%] ${
                isDark ? "bg-[#0F172A] border-slate-800" : "bg-white border-border"
              }`}
            >
              {/* Header */}
              <View className={`flex-row justify-between items-center pb-2 border-b ${
                isDark ? "border-slate-800" : "border-slate-100"
              }`}>
                <View className="flex-row items-center gap-2">
                  <View className={`w-8 h-8 rounded-lg items-center justify-center ${
                    isDark ? "bg-slate-800" : "bg-slate-100"
                  }`}>
                    <HardHat size={16} color={isDark ? "#B8CAD9" : "#173B6C"} />
                  </View>
                  <Text className={`text-lg font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>Add Project</Text>
                </View>
                <TouchableOpacity
                  onPress={closeModal}
                  className={`p-1 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
                >
                  <X size={18} color={isDark ? "#94A3B8" : "#64748B"} />
                </TouchableOpacity>
              </View>

              {/* Scrollable Form */}
              <ScrollView
                contentContainerClassName="gap-4 pb-6"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Project Name */}
                <View className="gap-1.5">
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Project / Site Name
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={(val) => {
                      setName(val);
                      validateField("name", val);
                    }}
                    placeholder="e.g. Royal Heights Block A"
                    placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                    className={`h-11 px-3 border rounded-[14px] text-base ${
                      isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                  {errors.name && <Text className="text-xs text-red-500">{errors.name}</Text>}
                </View>

                {/* Client & Location */}
                <View className="flex-row gap-3">
                  <View className="flex-1 gap-1.5">
                    <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      Client Name
                    </Text>
                    <TextInput
                      value={client}
                      onChangeText={setClient}
                      placeholder="e.g. Raj Builders"
                      placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                      className={`h-11 px-3 border rounded-[14px] text-base ${
                        isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                  </View>
                  <View className="flex-1 gap-1.5">
                    <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      Site Location
                    </Text>
                    <TextInput
                      value={location}
                      onChangeText={setLocation}
                      placeholder="e.g. Sector 62, Noida"
                      placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                      className={`h-11 px-3 border rounded-[14px] text-base ${
                        isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                  </View>
                </View>

                {/* Start Date & Expected End */}
                <View className="flex-row gap-3">
                  <DatePickerField
                    value={startDate}
                    onChange={(d) => setStartDate(d)}
                    label="Start Date"
                  />
                  <DatePickerField
                    value={expectedEnd}
                    onChange={(d) => setExpectedEnd(d)}
                    label="Expected End"
                  />
                </View>

                {/* Contract Value & Status */}
                <View className="flex-row gap-3">
                  <View className="flex-1 gap-1.5">
                    <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      Contract Value (₹)
                    </Text>
                    <TextInput
                      value={contractValue}
                      onChangeText={(val) => {
                        const cleaned = val.replace(/[^0-9]/g, "");
                        setContractValue(cleaned);
                        validateField("contractValue", cleaned);
                      }}
                      placeholder="e.g. 500000"
                      placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                      keyboardType="number-pad"
                      className={`h-11 px-3 border rounded-[14px] text-base ${
                        isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                    {errors.contractValue && <Text className="text-xs text-red-500">{errors.contractValue}</Text>}
                  </View>
                  <View className="flex-1 gap-1.5">
                    <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Status</Text>
                    <View className={`h-11 border rounded-[14px] justify-center px-3 ${
                      isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}>
                      <Text className={`text-base capitalize ${isDark ? "text-slate-300" : "text-slate-850"}`}>
                        {status}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Status Select Grid */}
                <View className="gap-1.5">
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Select Status
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(["planning", "active", "on_hold", "completed"] as const).map((st) => (
                      <TouchableOpacity
                        key={st}
                        onPress={() => setStatus(st)}
                        className={`py-2 px-3 border rounded-[14px] flex-1 min-w-[100px] items-center ${
                          status === st
                            ? isDark
                              ? "bg-[#B8CAD9] border-[#B8CAD9]"
                              : "bg-[#173B6C] border-[#173B6C]"
                            : isDark
                              ? "bg-slate-800 border-slate-700"
                              : "bg-white border-slate-200"
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold capitalize ${
                            status === st
                              ? isDark
                                ? "text-slate-900"
                                : "text-white"
                              : isDark
                                ? "text-slate-400"
                                : "text-slate-600"
                          }`}
                        >
                          {STATUS_LABEL[st]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              {/* Footer Actions */}
              <View className={`flex-row gap-3 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                <TouchableOpacity
                  onPress={closeModal}
                  className={`flex-1 h-12 rounded-[14px] border justify-center items-center ${
                    isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 active:bg-slate-50"
                  }`}
                >
                  <Text className={`text-base font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={createMutation.isPending}
                  className={`flex-1 h-12 rounded-[14px] justify-center items-center ${
                    isDark ? "bg-[#B8CAD9]" : "bg-[#173B6C] active:bg-primary-600"
                  } ${createMutation.isPending ? "opacity-50" : ""}`}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator size="small" color={isDark ? "#1E293B" : "#FFFFFF"} />
                  ) : (
                    <Text className={`text-base font-semibold ${isDark ? "text-slate-900" : "text-white"}`}>
                      {createMutation.isPending ? "Creating..." : "Create Project"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Toast visible={toastVisible} message={toastMessage} onHide={() => setToastVisible(false)} />
    </SafeAreaView>
  );
}
