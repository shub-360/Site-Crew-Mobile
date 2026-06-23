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
    let statusBadgeClass = "bg-slate-100 border-slate-200 text-slate-700";
    let statusTextClass = "text-slate-700";
    if (p.status === "active") {
      statusBadgeClass = "bg-green-50 border-green-200";
      statusTextClass = "text-green-700";
    } else if (p.status === "on_hold") {
      statusBadgeClass = "bg-amber-50 border-amber-200";
      statusTextClass = "text-amber-700";
    } else if (p.status === "completed") {
      statusBadgeClass = "bg-blue-50 border-blue-200";
      statusTextClass = "text-blue-700";
    }

    return (
      <TouchableOpacity
        onPress={() => router.push(`/projects/${p.id}` as any)}
        className="bg-white border border-border rounded-2xl p-4 mb-3 shadow-xs active:bg-slate-50"
      >
        <View className="flex-row justify-between items-start mb-1 flex-wrap gap-2">
          <Text className="font-bold text-slate-800 text-base flex-1 pr-1 truncate">
            {p.name}
          </Text>
          <View className={`border px-2.5 py-0.5 rounded-full ${statusBadgeClass}`}>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${statusTextClass}`}>
              {STATUS_LABEL[p.status]}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-1 mb-3">
          <MapPin size={12} color="#94A3B8" />
          <Text className="text-xs text-muted-foreground truncate">
            {p.client ? `${p.client} · ` : ""}
            {p.location || "No Location Specified"}
          </Text>
        </View>

        {/* Progress Bar */}
        <View className="gap-1 mb-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-semibold text-slate-500">Progress</Text>
            <Text className="text-xs font-bold text-slate-700 font-mono">
              {p.progress_pct}%
            </Text>
          </View>
          <View className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${p.progress_pct}%` }}
            />
          </View>
        </View>

        {/* Summary Metrics */}
        <View className="flex-row flex-wrap gap-2 border-t border-slate-50 pt-3">
          <View className="flex-row items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Users size={11} color="#64748B" />
            <Text className="text-[10px] font-semibold text-slate-600">
              {p.assignedCount} workers
            </Text>
          </View>
          <View className="flex-row items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Banknote size={11} color="#64748B" />
            <Text className="text-[10px] font-semibold text-slate-600">
              {formatCurrency(p.monthCost)}
            </Text>
          </View>
          {p.presentToday > 0 && (
            <View className="flex-row items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
              <Text className="text-[10px] font-bold text-green-700">
                {p.presentToday} present today
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [router]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-slate-50">
      {/* Search Header */}
      <View className="px-4 pt-4 pb-2 bg-white border-b border-slate-100 flex-row gap-2 items-center">
        <View className="flex-1 flex-row items-center bg-slate-100 px-3 h-10 rounded-xl">
          <Search size={16} color="#94A3B8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search projects..."
            placeholderTextColor="#94A3B8"
            className="flex-1 ml-2 text-sm text-foreground text-base h-full"
          />
        </View>
        <TouchableOpacity
          onPress={openAddModal}
          className="bg-primary h-10 w-10 rounded-xl items-center justify-center active:bg-primary-600"
        >
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="bg-white border-b border-slate-100 py-2.5 px-4 gap-2 flex-row items-center"
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
                ? "bg-primary border-primary"
                : "bg-white border-slate-200"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                filterTab === tab.id ? "text-white" : "text-slate-600"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Projects List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#1E3A5F" />
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
          keyExtractor={(p) => p.id}
          contentContainerClassName="px-4 py-4 pb-32"
          refreshing={isLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            <View className="py-12 items-center">
              <Text className="text-sm text-muted-foreground text-center">
                No projects found. Tap '+' to create your first site.
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      {/* Add Project Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={closeModal}>
        <View className="flex-1 justify-end bg-black/50">
          <View
            style={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
            className="bg-white rounded-t-3xl p-6 gap-4 border-t border-border max-h-[85%]"
          >
            {/* Header */}
            <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                  <HardHat size={16} color="#1E3A5F" />
                </View>
                <Text className="text-lg font-bold text-foreground">Add Project</Text>
              </View>
              <TouchableOpacity onPress={closeModal} className="p-1 rounded-full bg-slate-100">
                <X size={18} color="#64748B" />
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
                <Text className="text-sm font-medium text-slate-700">Project / Site Name</Text>
                <TextInput
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    validateField("name", val);
                  }}
                  placeholder="e.g. Royal Heights Block A"
                  placeholderTextColor="#94A3B8"
                  className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                />
                {errors.name && <Text className="text-xs text-red-500">{errors.name}</Text>}
              </View>

              {/* Client & Location */}
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Client Name</Text>
                  <TextInput
                    value={client}
                    onChangeText={setClient}
                    placeholder="e.g. Raj Builders"
                    placeholderTextColor="#94A3B8"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
                </View>
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Site Location</Text>
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="e.g. Sector 62, Noida"
                    placeholderTextColor="#94A3B8"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
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
                  <Text className="text-sm font-medium text-slate-700">Contract Value (₹)</Text>
                  <TextInput
                    value={contractValue}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/[^0-9]/g, "");
                      setContractValue(cleaned);
                      validateField("contractValue", cleaned);
                    }}
                    placeholder="e.g. 500000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
                  {errors.contractValue && <Text className="text-xs text-red-500">{errors.contractValue}</Text>}
                </View>
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Status</Text>
                  <View className="h-11 border border-slate-200 rounded-xl justify-center bg-slate-50 px-3">
                    <Text className="text-base text-slate-800 capitalize">{status}</Text>
                  </View>
                </View>
              </View>

              {/* Status Select Grid */}
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Select Status</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(["planning", "active", "on_hold", "completed"] as const).map((st) => (
                    <TouchableOpacity
                      key={st}
                      onPress={() => setStatus(st)}
                      className={`py-2 px-3 border rounded-xl flex-1 min-w-[100px] items-center ${
                        status === st
                          ? "bg-primary border-primary"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold capitalize ${
                          status === st ? "text-white" : "text-slate-600"
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
            <View className="flex-row gap-3 pt-3 border-t border-slate-100">
              <TouchableOpacity
                onPress={closeModal}
                className="flex-1 h-12 rounded-xl border border-slate-200 justify-center items-center bg-white"
              >
                <Text className="text-base font-semibold text-slate-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={createMutation.isPending}
                className={`flex-1 h-12 rounded-xl bg-primary justify-center items-center active:bg-primary-600 ${
                  createMutation.isPending ? "opacity-50" : ""
                }`}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">Creating...</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Toast visible={toastVisible} message={toastMessage} onHide={() => setToastVisible(false)} />
    </SafeAreaView>
  );
}
