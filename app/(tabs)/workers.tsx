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
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterTab, setFilterTab] = useState<"all" | "available" | "assigned" | "inactive">("all");

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
      Alert.alert("Success", "Worker added successfully");
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
      Alert.alert("Success", "Worker updated successfully");
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
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedWorker(null);
  }

  function handleSave() {
    if (!fullName.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    const wageNum = Number(dailyWage);
    if (isNaN(wageNum) || wageNum < 0) {
      Alert.alert("Error", "Please enter a valid daily wage");
      return;
    }

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
    const isAvailable =
      !isInactive && (!w.assignedProjects || w.assignedProjects.length === 0);

    let statusText = "Available";
    let statusBadgeClass = "bg-green-50 border-green-200";
    let statusTextClass = "text-green-700";
    let dotClass = "bg-green-500";

    if (isInactive) {
      statusText = "Inactive";
      statusBadgeClass = "bg-red-50 border-red-200";
      statusTextClass = "text-red-700";
      dotClass = "bg-red-500";
    } else if (isAssigned) {
      statusText = "Assigned";
      statusBadgeClass = "bg-blue-50 border-blue-200";
      statusTextClass = "text-blue-700";
      dotClass = "bg-blue-500";
    }

    return (
      <View className="bg-white border border-border rounded-2xl mb-3 overflow-hidden shadow-xs">
        {/* Main Card Nav Area */}
        <TouchableOpacity
          onPress={() => router.push(`/workers/${w.id}` as any)}
          className="p-4 flex-row justify-between items-start"
        >
          <View className="flex-1 pr-6">
            <View className="flex-row items-center gap-2 mb-1 flex-wrap">
              <Text className="font-bold text-slate-800 text-base">
                {w.full_name}
              </Text>
              <View className={`flex-row items-center gap-1 border px-2 py-0.5 rounded-full ${statusBadgeClass}`}>
                <View className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                <Text className={`text-[10px] font-bold uppercase tracking-wider ${statusTextClass}`}>
                  {statusText}
                </Text>
              </View>
            </View>

            <Text className="text-xs text-muted-foreground mb-3">
              {w.worker_type || "Worker"} · {formatCurrency(w.daily_wage)}/day
            </Text>

            {/* Assigned Projects */}
            {w.assignedProjects?.length > 0 ? (
              <View className="flex-row flex-wrap gap-1 mb-3">
                {w.assignedProjects.map((p) => (
                  <View
                    key={p}
                    className="flex-row items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5"
                  >
                    <Briefcase size={10} color="#64748B" />
                    <Text className="text-[10px] font-semibold text-slate-600">
                      {p}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-[10px] font-semibold text-slate-400 border border-dashed border-slate-200 rounded-lg px-2 py-0.5 self-start mb-3">
                No project assigned
              </Text>
            )}

            {/* Earnings Summary */}
            <View className="flex-row gap-4 border-t border-slate-50 pt-2.5">
              <Text className="text-xs text-muted-foreground">
                Worked:{" "}
                <Text className="text-slate-800 font-semibold font-mono">
                  {w.monthDays} days
                </Text>
              </Text>
              <Text className="text-xs text-muted-foreground">
                Earned:{" "}
                <Text className="text-slate-800 font-semibold font-mono">
                  {formatCurrency(w.monthEarnings)}
                </Text>
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1 self-center">
            <ChevronRight size={18} color="#94A3B8" />
          </View>
        </TouchableOpacity>

        {/* Quick actions bar */}
        <View className="bg-slate-50 border-t border-slate-100 flex-row px-4 py-2 justify-end gap-3">
          {w.mobile && (
            <TouchableOpacity
              onPress={() => handleCall(w.mobile!)}
              className="flex-row items-center gap-1 py-1 px-2.5 rounded-lg border border-slate-200 bg-white"
            >
              <Phone size={12} color="#1E3A5F" />
              <Text className="text-xs font-semibold text-slate-700">Call</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => openEditModal(w)}
            className="flex-row items-center gap-1 py-1 px-2.5 rounded-lg border border-slate-200 bg-white"
          >
            <Pencil size={12} color="#64748B" />
            <Text className="text-xs font-semibold text-slate-700">Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
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
            placeholder="Search workers..."
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
      <View className="bg-white border-b border-slate-100 py-2.5 px-4 flex-row gap-2 items-center">
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
      </View>

      {/* Workers List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#1E3A5F" />
        </View>
      ) : (
        <FlatList
          data={filteredWorkers}
          keyExtractor={(w) => w.id}
          contentContainerClassName="px-4 py-4 pb-32"
          refreshing={isLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            <View className="py-12 items-center">
              <Text className="text-sm text-muted-foreground text-center">
                No workers found. Add your first worker.
              </Text>
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
        <View className="flex-1 justify-end bg-black/50">
          <View
            style={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
            className="bg-white rounded-t-3xl p-6 gap-4 border-t border-border max-h-[85%]"
          >
            {/* Header */}
            <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                  <UserPlus size={16} color="#1E3A5F" />
                </View>
                <Text className="text-lg font-bold text-foreground">
                  {modalMode === "add" ? "Add Worker" : "Edit Worker"}
                </Text>
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
              {/* Full Name */}
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Full Name</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="John Doe"
                  placeholderTextColor="#94A3B8"
                  className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                />
              </View>

              {/* Mobile & Type */}
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Mobile</Text>
                  <TextInput
                    value={mobile}
                    onChangeText={setMobile}
                    placeholder="9999999999"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
                </View>
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Type / Skill</Text>
                  <TextInput
                    value={workerType}
                    onChangeText={setWorkerType}
                    placeholder="Mason, Helper..."
                    placeholderTextColor="#94A3B8"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
                </View>
              </View>

              {/* Daily Wage & Joining Date */}
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Daily Wage (₹)</Text>
                  <TextInput
                    value={dailyWage}
                    onChangeText={setDailyWage}
                    placeholder="500"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
                </View>
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Joining Date</Text>
                  <TextInput
                    value={joiningDate}
                    onChangeText={setJoiningDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
                </View>
              </View>

              {/* Address */}
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Address</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Address details"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={2}
                  className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-base text-slate-800 min-h-[60px]"
                />
              </View>

              {/* Status Switcher (Active/Inactive) */}
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Status</Text>
                <View className="flex-row bg-slate-100 rounded-xl p-1">
                  <TouchableOpacity
                    onPress={() => setStatus("active")}
                    className={`flex-1 py-2 rounded-lg items-center ${
                      status === "active" ? "bg-white shadow-sm" : ""
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        status === "active" ? "text-slate-800" : "text-slate-500"
                      }`}
                    >
                      Active
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setStatus("inactive")}
                    className={`flex-1 py-2 rounded-lg items-center ${
                      status === "inactive" ? "bg-white shadow-sm" : ""
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        status === "inactive" ? "text-red-600" : "text-slate-500"
                      }`}
                    >
                      Inactive
                    </Text>
                  </TouchableOpacity>
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
                disabled={createMutation.isPending || updateMutation.isPending}
                className={`flex-1 h-12 rounded-xl bg-primary justify-center items-center active:bg-primary-600 ${
                  (createMutation.isPending || updateMutation.isPending) ? "opacity-50" : ""
                }`}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    {modalMode === "add" ? "Add Worker" : "Save Changes"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
