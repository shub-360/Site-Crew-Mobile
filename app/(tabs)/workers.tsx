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
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { DatePickerField } from "@/components/DatePickerField";
import { Toast } from "@/components/Toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Search,
  Plus,
  Phone,
  Pencil,
  ChevronRight,
  UserPlus,
  X,
  Briefcase,
} from "lucide-react-native";
import { listWorkersWithStats } from "@/lib/stats.functions";
import { createWorker, updateWorker, type WorkerInput } from "@/lib/workers.functions";
import { formatCurrency, toLocalISODate } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import { handleApiError } from "@/lib/errors";
import { useIsDark } from "@/hooks/use-is-dark";
import { PressableScale } from "@/components/PressableScale";

type WorkerStatus = "active" | "inactive";

interface WorkerStats {
  id: string;
  full_name: string;
  mobile: string | null;
  address: string | null;
  worker_type: string | null;
  joining_date: string;
  daily_wage: number;
  status: WorkerStatus;
  assignedProjects: string[];
  monthDays: number;
  monthEarnings: number;
}

export default function WorkersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const isDark = useIsDark();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterTab, setFilterTab] = useState<"all" | "available" | "assigned" | "inactive">("all");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const validateField = (fieldName: string, value: string) => {
    let err = "";
    if (fieldName === "fullName") {
      if (!value.trim()) {
        err = "This field is required.";
      }
    } else if (fieldName === "mobile") {
      if (value.trim() && value.length !== 10) {
        err = "Phone number must contain exactly 10 digits.";
      }
    } else if (fieldName === "dailyWage") {
      const wageNum = Number(value);
      if (value.trim() === "") {
        err = "This field is required.";
      } else if (isNaN(wageNum) || wageNum <= 0) {
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

  // Modal states
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerStats | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [workerType, setWorkerType] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<WorkerStatus>("active");

  const { data: workers = [], isLoading, refetch } = useQuery({
    queryKey: ["workers", "stats"],
    queryFn: () => listWorkersWithStats() as Promise<WorkerStats[]>,
    staleTime: 1000 * 60 * 2, // 2 minutes stale time for workers list
  });

  const createMutation = useMutation({
    mutationFn: (data: WorkerInput) => createWorker(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setToastMessage("Worker added successfully");
      setToastVisible(true);
      closeModal();
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string } & WorkerInput) => updateWorker(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["worker-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setToastMessage("Worker updated successfully");
      setToastVisible(true);
      closeModal();
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  function openAddModal() {
    setFullName("");
    setMobile("");
    setWorkerType("");
    setDailyWage("");
    setJoiningDate(toLocalISODate(new Date()));
    setAddress("");
    setStatus("active");
    setErrors({});
    setModalMode("add");
  }

  function openEditModal(worker: WorkerStats) {
    setSelectedWorker(worker);
    setFullName(worker.full_name);
    setMobile(worker.mobile ?? "");
    setWorkerType(worker.worker_type ?? "");
    setDailyWage(String(worker.daily_wage));
    setJoiningDate(worker.joining_date);
    setAddress(worker.address ?? "");
    setStatus(worker.status);
    setErrors({});
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedWorker(null);
  }

  function handleSave() {
    const isNameValid = validateField("fullName", fullName);
    const isMobileValid = validateField("mobile", mobile);
    const isWageValid = validateField("dailyWage", dailyWage);

    if (!isNameValid || !isMobileValid || !isWageValid) {
      return;
    }

    const wageNum = Number(dailyWage);
    const payload = {
      full_name: fullName.trim(),
      mobile: mobile.trim() || null,
      worker_type: workerType.trim() || null,
      joining_date: joiningDate || toLocalISODate(new Date()),
      daily_wage: wageNum,
      status,
      address: address.trim() || null,
    };

    if (modalMode === "add") {
      createMutation.mutate(payload);
    } else if (modalMode === "edit" && selectedWorker) {
      updateMutation.mutate({ id: selectedWorker.id, ...payload });
    }
  }

  function handleCall(phoneNumber: string) {
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert("Error", "Unable to open phone dialer");
    });
  }

  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const matchesSearch = w.full_name.toLowerCase().includes(debouncedSearch.toLowerCase());
      if (!matchesSearch) return false;

      const isInactive = w.status === "inactive";
      const isAssigned = !isInactive && w.assignedProjects && w.assignedProjects.length > 0;
      const isAvailable = !isInactive && (!w.assignedProjects || w.assignedProjects.length === 0);

      if (filterTab === "inactive") return isInactive;
      if (filterTab === "assigned") return isAssigned;
      if (filterTab === "available") return isAvailable;
      return true;
    });
  }, [workers, debouncedSearch, filterTab]);

  const renderItem = useCallback(({ item: w }: { item: WorkerStats }) => {
    const isInactive = w.status === "inactive";
    const isAssigned =
      !isInactive && w.assignedProjects && w.assignedProjects.length > 0;

    let statusText = "Available";
    let statusBadgeClass = isDark ? "bg-green-950/40 border-green-900/60" : "bg-green-50 border-green-200";
    let statusTextClass = isDark ? "text-green-400" : "text-green-700";
    let dotClass = "bg-green-500";

    if (isInactive) {
      statusText = "Inactive";
      statusBadgeClass = isDark ? "bg-red-950/40 border-red-900/60" : "bg-red-50 border-red-200";
      statusTextClass = isDark ? "text-red-400" : "text-red-700";
      dotClass = "bg-red-500";
    } else if (isAssigned) {
      statusText = "Assigned";
      statusBadgeClass = isDark ? "bg-blue-950/40 border-blue-900/60" : "bg-blue-50 border-blue-200";
      statusTextClass = isDark ? "text-blue-400" : "text-blue-700";
      dotClass = "bg-blue-500";
    }

    return (
      <View className={`border rounded-2xl mb-3 overflow-hidden shadow-xs ${
        isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-100"
      }`}>
        {/* Main Card Nav Area */}
        <PressableScale
          onPress={() => router.push(`/workers/${w.id}` as any)}
          className="p-4 flex-row justify-between items-start"
        >
          <View className="flex-1 pr-6">
            <View className="flex-row items-center gap-2 mb-1 flex-wrap">
              <Text className={`font-bold text-base ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                {w.full_name}
              </Text>
              <View className={`flex-row items-center gap-1 border px-2 py-0.5 rounded-full ${statusBadgeClass}`}>
                <View className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                <Text className={`text-[10px] font-bold uppercase tracking-wider ${statusTextClass}`}>
                  {statusText}
                </Text>
              </View>
            </View>

            <Text className={`text-xs mb-3 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
              {w.worker_type || "Worker"} · {formatCurrency(w.daily_wage)}/day
            </Text>

            {/* Assigned Projects */}
            {w.assignedProjects?.length > 0 ? (
              <View className="flex-row flex-wrap gap-1 mb-3">
                {w.assignedProjects.map((p) => (
                  <View
                    key={p}
                    className={`flex-row items-center gap-1 border rounded-lg px-2 py-0.5 ${
                      isDark ? "bg-slate-800/60 border-slate-700" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <Briefcase size={10} color={isDark ? "#94A3B8" : "#64748B"} />
                    <Text className={`text-[10px] font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      {p}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className={`text-[10px] font-semibold border border-dashed rounded-lg px-2 py-0.5 self-start mb-3 ${
                isDark ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-200"
              }`}>
                No project assigned
              </Text>
            )}

            {/* Earnings Summary */}
            <View className={`flex-row gap-4 border-t pt-2.5 ${isDark ? "border-slate-800" : "border-slate-50"}`}>
              <Text className={`text-xs ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                Worked:{" "}
                <Text className={`font-semibold font-mono ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  {w.monthDays} days
                </Text>
              </Text>
              <Text className={`text-xs ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                Earned:{" "}
                <Text className={`font-semibold font-mono ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                  {formatCurrency(w.monthEarnings)}
                </Text>
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1 self-center">
            <ChevronRight size={18} color={isDark ? "#64748B" : "#94A3B8"} />
          </View>
        </PressableScale>

        {/* Quick actions bar */}
        <View className={`border-t flex-row px-4 py-2 justify-end gap-3 ${
          isDark ? "bg-slate-800/40 border-slate-850" : "bg-slate-50 border-slate-100"
        }`}>
          {w.mobile && (
            <TouchableOpacity
              onPress={() => handleCall(w.mobile!)}
              className={`flex-row items-center gap-1 py-1 px-2.5 rounded-lg border ${
                isDark ? "bg-slate-800 border-slate-700 active:bg-slate-700" : "bg-white border-slate-200 active:bg-slate-50"
              }`}
            >
              <Phone size={12} color={isDark ? "#B8CAD9" : "#173B6C"} />
              <Text className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Call</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => openEditModal(w)}
            className={`flex-row items-center gap-1 py-1 px-2.5 rounded-lg border ${
              isDark ? "bg-slate-800 border-slate-700 active:bg-slate-700" : "bg-white border-slate-200 active:bg-slate-50"
            }`}
          >
            <Pencil size={12} color={isDark ? "#94A3B8" : "#64748B"} />
            <Text className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
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
            placeholder="Search workers..."
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            className={`flex-1 ml-2 text-sm text-base h-full ${isDark ? "text-slate-200" : "text-slate-800"}`}
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
      <View className={`border-b py-2.5 px-4 flex-row gap-2 items-center ${
        isDark ? "bg-[#0F172A] border-slate-800" : "bg-white border-slate-100"
      }`}>
        {(
          [
            { id: "all", label: "All" },
            { id: "available", label: "🟢 Available" },
            { id: "assigned", label: "🔵 Assigned" },
            { id: "inactive", label: "🔴 Inactive" },
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
                    : "text-slate-600"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Workers List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={isDark ? "#B8CAD9" : "#173B6C"} />
        </View>
      ) : (
        <FlatList
          data={filteredWorkers}
          keyExtractor={(w) => w.id}
          contentContainerClassName="px-4 py-4 pb-32"
          refreshing={isLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            <View className="py-12 items-center justify-center gap-2">
              <Text className="text-4xl mb-2">👥</Text>
              <Text className={`text-base font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                No Workers Yet
              </Text>
              <Text className={`text-xs text-center px-6 mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                No workers found matching the filters. Add your first employee.
              </Text>
              <TouchableOpacity
                onPress={openAddModal}
                className={`px-4 py-2.5 rounded-[14px] border ${
                  isDark ? "bg-[#1E293B] border-slate-700 active:bg-slate-800" : "bg-white border-slate-200 active:bg-slate-50"
                }`}
              >
                <Text className={`text-xs font-bold ${isDark ? "text-[#B8CAD9]" : "text-[#173B6C]"}`}>
                  Add Worker
                </Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={modalMode !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
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
                  <UserPlus size={16} color={isDark ? "#B8CAD9" : "#173B6C"} />
                </View>
                <Text className={`text-lg font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                  {modalMode === "add" ? "Add Worker" : "Edit Worker"}
                </Text>
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
              {/* Full Name */}
              <View className="gap-1.5">
                <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Full Name</Text>
                <TextInput
                  value={fullName}
                  onChangeText={(val) => {
                    setFullName(val);
                    validateField("fullName", val);
                  }}
                  placeholder="John Doe"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  className={`h-11 px-3 border rounded-[14px] text-base ${
                    isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                  }`}
                />
                {errors.fullName && <Text className="text-xs text-red-500">{errors.fullName}</Text>}
              </View>

              {/* Mobile & Type */}
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Mobile</Text>
                  <TextInput
                    value={mobile}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/\D/g, "").slice(0, 10);
                      setMobile(cleaned);
                      validateField("mobile", cleaned);
                    }}
                    placeholder="9999999999"
                    placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                    keyboardType="number-pad"
                    className={`h-11 px-3 border rounded-[14px] text-base ${
                      isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                  {errors.mobile && <Text className="text-xs text-red-500">{errors.mobile}</Text>}
                </View>
                <View className="flex-1 gap-1.5">
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Type / Skill</Text>
                  <TextInput
                    value={workerType}
                    onChangeText={setWorkerType}
                    placeholder="Mason, Helper..."
                    placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                    className={`h-11 px-3 border rounded-[14px] text-base ${
                      isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                </View>
              </View>

              {/* Daily Wage & Joining Date */}
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Daily Wage (₹)
                  </Text>
                  <TextInput
                    value={dailyWage}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/[^0-9]/g, "");
                      setDailyWage(cleaned);
                      validateField("dailyWage", cleaned);
                    }}
                    placeholder="500"
                    placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                    keyboardType="number-pad"
                    className={`h-11 px-3 border rounded-[14px] text-base ${
                      isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                  {errors.dailyWage && <Text className="text-xs text-red-500">{errors.dailyWage}</Text>}
                </View>
                <DatePickerField
                  value={joiningDate}
                  onChange={(d) => setJoiningDate(d)}
                  label="Joining Date"
                />
              </View>

              {/* Address */}
              <View className="gap-1.5">
                <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Address</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Address details"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  multiline
                  numberOfLines={2}
                  className={`px-3 py-2 border rounded-[14px] text-base min-h-[60px] ${
                    isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                  }`}
                />
              </View>

              {/* Status Switcher (Active/Inactive) */}
              <View className="gap-1.5">
                <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Status</Text>
                <View className={`flex-row rounded-[14px] p-1 ${
                  isDark ? "bg-slate-800" : "bg-slate-100"
                }`}>
                  <TouchableOpacity
                    onPress={() => setStatus("active")}
                    className={`flex-1 py-2 rounded-lg items-center ${
                      status === "active"
                        ? isDark
                          ? "bg-slate-700"
                          : "bg-white"
                        : ""
                    }`}
                    style={
                      status === "active"
                        ? isDark
                          ? { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }
                          : { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, elevation: 1 }
                        : undefined
                    }
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        status === "active"
                          ? isDark
                            ? "text-slate-200"
                            : "text-slate-800"
                          : "text-slate-500"
                      }`}
                    >
                      Active
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setStatus("inactive")}
                    className={`flex-1 py-2 rounded-lg items-center ${
                      status === "inactive"
                        ? isDark
                          ? "bg-slate-700"
                          : "bg-white"
                        : ""
                    }`}
                    style={
                      status === "inactive"
                        ? isDark
                          ? { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }
                          : { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, elevation: 1 }
                        : undefined
                    }
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        status === "inactive"
                          ? "text-red-500"
                          : "text-slate-500"
                      }`}
                    >
                      Inactive
                    </Text>
                  </TouchableOpacity>
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
                disabled={createMutation.isPending || updateMutation.isPending}
                className={`flex-1 h-12 rounded-[14px] justify-center items-center ${
                  isDark ? "bg-[#B8CAD9]" : "bg-[#173B6C] active:bg-[#122c52]"
                } ${(createMutation.isPending || updateMutation.isPending) ? "opacity-50" : ""}`}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <ActivityIndicator size="small" color={isDark ? "#1E293B" : "#FFFFFF"} />
                ) : (
                  <Text className={`text-base font-semibold ${isDark ? "text-slate-900" : "text-white"}`}>
                    {modalMode === "add" ? "Create Worker" : "Save Changes"}
                  </Text>
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
