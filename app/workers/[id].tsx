import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Phone,
  Trash2,
  HardHat,
  Plus,
  Pencil,
  ChevronRight,
  X,
  CreditCard,
  Calendar,
  DollarSign,
  Info,
} from "lucide-react-native";
import { getWorkerDetailStats } from "@/lib/stats.functions";
import { deleteWorker, updateWorker, type WorkerInput } from "@/lib/workers.functions";
import { listPayments, recordPayment } from "@/lib/payments.functions";
import { formatCurrency, toLocalISODate } from "@/lib/format";
import { handleApiError } from "@/lib/errors";


type WorkerStatus = "active" | "inactive";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Record Payment form state
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(toLocalISODate(new Date()));
  const [note, setNote] = useState("");

  // Edit Worker form state
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [workerType, setWorkerType] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<WorkerStatus>("active");
  const [joiningDate, setJoiningDate] = useState("");

  // Year & Month select overlays
  const [showMonthSelect, setShowMonthSelect] = useState(false);
  const [showYearSelect, setShowYearSelect] = useState(false);

  // Queries
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useQuery({
    queryKey: ["worker-stats", id, year, month],
    queryFn: () => getWorkerDetailStats({ worker_id: id!, year, month }),
    enabled: !!id,
    staleTime: 1000 * 60 * 1, // 1 minute stale time for worker monthly summary details
  });

  const { data: payments = [], isLoading: loadingPayments, refetch: refetchPayments } = useQuery({
    queryKey: ["payments", id],
    queryFn: () => listPayments({ worker_id: id! }),
    enabled: !!id,
    staleTime: 1000 * 60 * 2, // 2 minutes stale time for payments history list
  });

  // Mutations
  const recordPaymentMutation = useMutation({
    mutationFn: (data: {
      worker_id: string;
      amount: number;
      paid_on: string;
      note?: string | null;
    }) => recordPayment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments", id] });
      qc.invalidateQueries({ queryKey: ["worker-stats", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      Alert.alert("Success", "Payment recorded successfully");
      setShowPaymentModal(false);
      setAmount("");
      setNote("");
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorker({ id: id! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      Alert.alert("Success", "Worker deleted");
      router.back();
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  const editMutation = useMutation({
    mutationFn: (data: { id: string } & WorkerInput) => updateWorker(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["worker-stats", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      Alert.alert("Success", "Worker profile updated");
      setShowEditModal(false);
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  const isLoading = loadingStats || loadingPayments;

  if (isLoading && !stats) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center">
        <ActivityIndicator size="large" color="#1E3A5F" />
      </SafeAreaView>
    );
  }

  if (!stats) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center px-6">
        <Text className="text-base text-muted-foreground text-center">
          Worker details not found or loading failed.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-primary px-6 py-2.5 rounded-xl"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { worker: w } = stats;

  function handleDelete() {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete worker ${w.full_name}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() }
      ]
    );
  }

  function handleOpenEdit() {
    setFullName(w.full_name);
    setMobile(w.mobile ?? "");
    setWorkerType(w.worker_type ?? "");
    setDailyWage(String(w.daily_wage));
    setJoiningDate(w.joining_date);
    setAddress(w.address ?? "");
    setStatus(w.status);
    setShowEditModal(true);
  }

  function handleSaveEdit() {
    if (!fullName.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    const wageNum = Number(dailyWage);
    if (isNaN(wageNum) || wageNum < 0) {
      Alert.alert("Error", "Daily wage must be a positive number");
      return;
    }

    editMutation.mutate({
      id: id!,
      full_name: fullName.trim(),
      mobile: mobile.trim() || null,
      worker_type: workerType.trim() || null,
      joining_date: joiningDate || w.joining_date,
      daily_wage: wageNum,
      status,
      address: address.trim() || null,
    });
  }

  function handleRecordPayment() {
    const amtNum = Number(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    recordPaymentMutation.mutate({
      worker_id: id!,
      amount: amtNum,
      paid_on: paidOn || toLocalISODate(new Date()),
      note: note.trim() || null,
    });
  }

  function handleCall() {
    if (w.mobile) {
      Linking.openURL(`tel:${w.mobile}`).catch(() => {
        Alert.alert("Error", "Unable to open phone dialer");
      });
    }
  }

  function formatLedgerDate(dateStr: string) {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    } catch {
      return dateStr;
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Header Bar */}
      <View className="px-4 py-3 bg-white border-b border-slate-100 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="p-1 rounded-full bg-slate-100">
          <ArrowLeft size={20} color="#64748B" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-slate-800">Worker Profile</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={handleOpenEdit} className="p-2 rounded-full bg-slate-100 active:bg-slate-200">
            <Pencil size={16} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} className="p-2 rounded-full bg-red-50 active:bg-red-100">
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerClassName="px-4 py-5 gap-5 pb-12">
        {/* Profile Card */}
        <View className="bg-white border border-border rounded-2xl p-5 shadow-xs gap-4">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center gap-2 flex-wrap mb-1">
                <Text className="text-xl font-bold text-slate-800">{w.full_name}</Text>
                {w.status === "inactive" ? (
                  <View className="bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-bold text-red-700 uppercase">Inactive</Text>
                  </View>
                ) : (
                  <View className="bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-bold text-green-700 uppercase">Active</Text>
                  </View>
                )}
              </View>
              <Text className="text-sm text-slate-500 font-medium">
                {w.worker_type || "Contract Worker"} · {formatCurrency(w.daily_wage)}/day
              </Text>
              {w.joining_date && (
                <Text className="text-xs text-muted-foreground mt-1.5">
                  Joined: {new Date(w.joining_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </Text>
              )}
            </View>
            {w.mobile && (
              <TouchableOpacity
                onPress={handleCall}
                className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center active:bg-primary/20"
              >
                <Phone size={18} color="#1E3A5F" />
              </TouchableOpacity>
            )}
          </View>
          {w.address && (
            <View className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex-row gap-2">
              <Info size={14} color="#64748B" className="mt-0.5" />
              <Text className="text-xs text-slate-600 flex-1">{w.address}</Text>
            </View>
          )}
        </View>

        {/* Assigned Projects */}
        <View className="gap-2">
          <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
            Assigned Projects
          </Text>
          <View className="bg-white border border-border rounded-2xl overflow-hidden shadow-xs">
            {stats.assignments.length === 0 ? (
              <Text className="p-4 text-sm text-muted-foreground text-center">
                Not assigned to any active project.
              </Text>
            ) : (
              stats.assignments.map((a: any) => (
                <TouchableOpacity
                  key={a.project_id}
                  onPress={() => router.push(`/projects/${a.project_id}` as any)}
                  className="p-4 border-b border-slate-50 flex-row justify-between items-center active:bg-slate-50"
                >
                  <View className="flex-row items-center gap-3">
                    <HardHat size={16} color="#1E3A5F" />
                    <View>
                      <Text className="text-sm font-semibold text-slate-800">
                        {a.projects?.name ?? "Project"}
                      </Text>
                      <Text className="text-[10px] text-muted-foreground mt-0.5">
                        Assigned on {new Date(a.assigned_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" />
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* Month Filter Picker */}
        <View className="flex-row items-center justify-between">
          <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
            Attendance Statistics
          </Text>
          <View className="flex-row gap-2">
            {/* Month Dropdown Button */}
            <TouchableOpacity
              onPress={() => setShowMonthSelect(true)}
              className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex-row items-center gap-1"
            >
              <Text className="text-xs font-semibold text-slate-700">
                {MONTHS[month - 1]}
              </Text>
              <Calendar size={12} color="#64748B" />
            </TouchableOpacity>

            {/* Year Dropdown Button */}
            <TouchableOpacity
              onPress={() => setShowYearSelect(true)}
              className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex-row items-center gap-1"
            >
              <Text className="text-xs font-semibold text-slate-700">{year}</Text>
              <Calendar size={12} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="gap-3">
          <View className="flex-row gap-3">
            <StatCard label="Full Days" value={String(stats.counts.full)} className="flex-1" />
            <StatCard label="Half Days" value={String(stats.counts.half)} className="flex-1" />
          </View>
          <View className="flex-row gap-3">
            <StatCard label="Overtime Days" value={String(stats.counts.overtime)} className="flex-1" />
            <StatCard label="Absent Days" value={String(stats.counts.absent)} className="flex-1" />
          </View>
          <View className="flex-row gap-3">
            <StatCard label="Present Days" value={String(stats.presentDays)} className="flex-1" />
            <StatCard label="Daily Wage" value={formatCurrency(w.daily_wage)} className="flex-1" />
          </View>
        </View>

        {/* Financial Summary */}
        <View className="gap-2">
          <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
            Financial Summary
          </Text>
          <View className="gap-3">
            <View className="flex-row gap-3">
              <StatCard
                label="Month Earnings"
                value={formatCurrency(stats.monthEarnings)}
                className="flex-1 animate-pulse"
              />
              <StatCard
                label="Month Paid"
                value={formatCurrency(stats.monthPaid)}
                className="flex-1"
              />
            </View>
            <View className="flex-row gap-3">
              <StatCard
                label="Lifetime Earnings"
                value={formatCurrency(stats.lifetimeEarnings)}
                className="flex-1"
              />
              <StatCard
                label="Total Paid"
                value={formatCurrency(stats.lifetimePaid)}
                className="flex-1"
              />
            </View>
            {stats.lifetimeBalance < 0 ? (
              <StatCard
                label="Advance Taken (Balance)"
                value={formatCurrency(Math.abs(stats.lifetimeBalance))}
                highlight
                isAdvance
              />
            ) : (
              <StatCard
                label="Pending Balance"
                value={formatCurrency(stats.lifetimeBalance)}
                highlight
              />
            )}
          </View>
        </View>

        {/* Payment History & Ledger */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
              Payment History & Ledger
            </Text>
            <TouchableOpacity
              onPress={() => setShowPaymentModal(true)}
              className="bg-primary flex-row items-center gap-1 px-3 py-1.5 rounded-xl active:bg-primary-600"
            >
              <Plus size={12} color="#FFFFFF" />
              <Text className="text-xs font-semibold text-white">Record Payment</Text>
            </TouchableOpacity>
          </View>

          <View className="bg-white border border-border rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
            {payments.length === 0 ? (
              <Text className="p-5 text-sm text-muted-foreground text-center">
                No payment history recorded yet.
              </Text>
            ) : (
              payments.map((p) => (
                <View key={p.id} className="p-4 flex-row justify-between items-center bg-white">
                  <View className="flex-1 pr-4">
                    <Text className="text-sm font-semibold text-slate-800">
                      {formatLedgerDate(p.paid_on)}
                    </Text>
                    {p.note && (
                      <Text className="text-xs text-slate-400 italic mt-0.5">
                        {p.note}
                      </Text>
                    )}
                  </View>
                  <Text className="text-base font-bold text-success font-mono">
                    {formatCurrency(p.amount)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
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
                  className={`py-3 px-4 rounded-xl ${
                    month === idx + 1 ? "bg-primary/5" : ""
                  }`}
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
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
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

      {/* Record Payment Bottom Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 gap-4 border-t border-border">
            {/* Header */}
            <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-lg bg-green-100 items-center justify-center">
                  <CreditCard size={16} color="#16A34A" />
                </View>
                <Text className="text-lg font-bold text-slate-800">Record Payment</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                className="p-1 rounded-full bg-slate-100"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View className="gap-4">
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Amount Paid (₹)</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Enter amount"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                />
              </View>

              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Date Paid</Text>
                <TextInput
                  value={paidOn}
                  onChangeText={setPaidOn}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                  className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                />
              </View>

              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Note / Details</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Cash payment, weekly advance..."
                  placeholderTextColor="#94A3B8"
                  className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                />
              </View>
            </View>

            {/* Footer */}
            <View className="flex-row gap-3 pt-3 border-t border-slate-100">
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                className="flex-1 h-12 rounded-xl border border-slate-200 justify-center items-center bg-white"
              >
                <Text className="text-base font-semibold text-slate-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRecordPayment}
                disabled={recordPaymentMutation.isPending}
                className={`flex-1 h-12 rounded-xl bg-primary justify-center items-center active:bg-primary-600 ${
                  recordPaymentMutation.isPending ? "opacity-50" : ""
                }`}
              >
                {recordPaymentMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">Record Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Worker Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 gap-4 border-t border-border max-h-[85%]">
            {/* Header */}
            <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                  <Pencil size={16} color="#1E3A5F" />
                </View>
                <Text className="text-lg font-bold text-foreground">Edit Worker Profile</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                className="p-1 rounded-full bg-slate-100"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView
              contentContainerClassName="gap-4 pb-6"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Full Name</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full name"
                  placeholderTextColor="#94A3B8"
                  className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Mobile</Text>
                  <TextInput
                    value={mobile}
                    onChangeText={setMobile}
                    placeholder="Mobile number"
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

            {/* Footer */}
            <View className="flex-row gap-3 pt-3 border-t border-slate-100">
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                className="flex-1 h-12 rounded-xl border border-slate-200 justify-center items-center bg-white"
              >
                <Text className="text-base font-semibold text-slate-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={editMutation.isPending}
                className={`flex-1 h-12 rounded-xl bg-primary justify-center items-center active:bg-primary-600 ${
                  editMutation.isPending ? "opacity-50" : ""
                }`}
              >
                {editMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  highlight,
  isAdvance,
  className = "",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  isAdvance?: boolean;
  className?: string;
}) {
  const containerClass = highlight
    ? isAdvance
      ? "bg-amber-500 border-amber-600"
      : "bg-primary border-primary"
    : "bg-white border-border";

  const textLabelClass = highlight
    ? isAdvance
      ? "text-amber-50"
      : "text-primary-foreground/80"
    : "text-muted-foreground";

  const textValueClass = highlight
    ? isAdvance
      ? "text-white"
      : "text-white"
    : "text-slate-800";

  return (
    <View className={`p-4 rounded-2xl border shadow-sm ${containerClass} ${className}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${textLabelClass}`}>
        {label}
      </Text>
      <Text className={`text-base font-bold mt-1 font-mono ${textValueClass}`}>
        {value}
      </Text>
    </View>
  );
}
