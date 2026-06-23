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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import { DatePickerField } from "@/components/DatePickerField";
import { Toast } from "@/components/Toast";
import { useIsDark } from "@/hooks/use-is-dark";
import { PressableScale } from "@/components/PressableScale";

type WorkerStatus = "active" | "inactive";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const isDark = useIsDark();
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

  // Validation & Toasts
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
    } else if (fieldName === "amount") {
      const amtNum = Number(value);
      if (value.trim() === "") {
        err = "This field is required.";
      } else if (isNaN(amtNum) || amtNum <= 0) {
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
      setToastMessage("Payment recorded successfully");
      setToastVisible(true);
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
      setToastMessage("Worker updated successfully");
      setToastVisible(true);
      setShowEditModal(false);
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  const isLoading = loadingStats || loadingPayments;

  if (isLoading && !stats) {
    return (
      <SafeAreaView className={`flex-1 justify-center items-center ${isDark ? "bg-[#0F172A]" : "bg-slate-50"}`}>
        <ActivityIndicator size="large" color={isDark ? "#B8CAD9" : "#173B6C"} />
      </SafeAreaView>
    );
  }

  if (!stats) {
    return (
      <SafeAreaView className={`flex-1 justify-center items-center px-6 ${isDark ? "bg-[#0F172A]" : "bg-slate-50"}`}>
        <Text className={`text-base text-center ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
          Worker details not found or loading failed.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className={`mt-4 px-6 py-2.5 rounded-[14px] ${isDark ? "bg-slate-800" : "bg-[#173B6C]"}`}
        >
          <Text className={`font-semibold ${isDark ? "text-[#B8CAD9]" : "text-white"}`}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { worker: w } = stats;

  function handleDelete() {
    Alert.alert(
      `Delete ${w.full_name}?`,
      "This action cannot be undone.",
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
    setErrors({});
    setShowEditModal(true);
  }

  function handleSaveEdit() {
    const isNameValid = validateField("fullName", fullName);
    const isMobileValid = validateField("mobile", mobile);
    const isWageValid = validateField("dailyWage", dailyWage);

    if (!isNameValid || !isMobileValid || !isWageValid) {
      return;
    }

    const wageNum = Number(dailyWage);
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
    const isAmountValid = validateField("amount", amount);

    if (!isAmountValid) {
      return;
    }

    const amtNum = Number(amount);
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
    <SafeAreaView edges={["top", "left", "right"]} className={`flex-1 ${isDark ? "bg-[#0F172A]" : "bg-[#F8FAFC]"}`}>
      {/* Header Bar */}
      <View className={`px-4 py-3 border-b flex-row items-center justify-between ${
        isDark ? "bg-[#0F172A] border-slate-800" : "bg-white border-slate-100"
      }`}>
        <TouchableOpacity
          onPress={() => router.back()}
          className={`p-1 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
        >
          <ArrowLeft size={20} color={isDark ? "#B8CAD9" : "#64748B"} />
        </TouchableOpacity>
        <Text className={`text-lg font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
          Worker Profile
        </Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={handleOpenEdit}
            className={`p-2 rounded-full ${isDark ? "bg-slate-800 active:bg-slate-700" : "bg-slate-100 active:bg-slate-200"}`}
          >
            <Pencil size={16} color={isDark ? "#B8CAD9" : "#64748B"} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            className={`p-2 rounded-full ${isDark ? "bg-red-950/40 active:bg-red-900/40" : "bg-red-50 active:bg-red-100"}`}
          >
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerClassName="px-4 py-5 gap-5 pb-12">
        {/* Profile Card */}
        <View className={`border p-5 shadow-xs gap-4 rounded-[16px] ${
          isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
        }`}>
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center gap-2 flex-wrap mb-1">
                <Text className={`text-xl font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                  {w.full_name}
                </Text>
                {w.status === "inactive" ? (
                  <View className={`px-2 py-0.5 rounded-full border ${
                    isDark ? "bg-red-950/40 border-red-800/40" : "bg-red-50 border-red-200"
                  }`}>
                    <Text className={`text-[10px] font-bold uppercase ${isDark ? "text-red-400" : "text-red-700"}`}>
                      Inactive
                    </Text>
                  </View>
                ) : (
                  <View className={`px-2 py-0.5 rounded-full border ${
                    isDark ? "bg-green-950/40 border-green-800/40" : "bg-green-50 border-green-200"
                  }`}>
                    <Text className={`text-[10px] font-bold uppercase ${isDark ? "text-green-400" : "text-green-700"}`}>
                      Active
                    </Text>
                  </View>
                )}
              </View>
              <Text className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {w.worker_type || "Contract Worker"} · {formatCurrency(w.daily_wage)}/day
              </Text>
              {w.joining_date && (
                <Text className={`text-xs mt-1.5 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                  Joined: {new Date(w.joining_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </Text>
              )}
            </View>
            {w.mobile && (
              <PressableScale
                onPress={handleCall}
                className={`w-10 h-10 rounded-[14px] items-center justify-center ${
                  isDark ? "bg-slate-800" : "bg-[#173B6C]/10"
                }`}
              >
                <Phone size={18} color={isDark ? "#B8CAD9" : "#173B6C"} />
              </PressableScale>
            )}
          </View>
          {w.address && (
            <View className={`p-3 rounded-[14px] border flex-row gap-2 ${
              isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-slate-55 border-slate-100"
            }`}>
              <Info size={14} color={isDark ? "#94A3B8" : "#64748B"} className="mt-0.5" />
              <Text className={`text-xs flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                {w.address}
              </Text>
            </View>
          )}
        </View>

        {/* Assigned Projects */}
        <View className="gap-2">
          <Text className={`text-xs uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
            Assigned Projects
          </Text>
          <View className={`border overflow-hidden shadow-xs rounded-[16px] ${
            isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
          }`}>
            {stats.assignments.length === 0 ? (
              <Text className={`p-4 text-sm text-center ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                Not assigned to any active project.
              </Text>
            ) : (
              stats.assignments.map((a: any) => (
                <TouchableOpacity
                  key={a.project_id}
                  onPress={() => router.push(`/projects/${a.project_id}` as any)}
                  className={`p-4 border-b flex-row justify-between items-center ${
                    isDark ? "border-slate-800 active:bg-slate-800" : "border-slate-50 active:bg-slate-50"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <HardHat size={16} color={isDark ? "#B8CAD9" : "#173B6C"} />
                    <View>
                      <Text className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                        {a.projects?.name ?? "Project"}
                      </Text>
                      <Text className={`text-[10px] mt-0.5 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                        Assigned on {new Date(a.assigned_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color={isDark ? "#64748B" : "#94A3B8"} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* Month Filter Picker */}
        <View className="flex-row items-center justify-between">
          <Text className={`text-xs uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
            Attendance Statistics
          </Text>
          <View className="flex-row gap-2">
            {/* Month Dropdown Button */}
            <TouchableOpacity
              onPress={() => setShowMonthSelect(true)}
              className={`px-3 py-1.5 rounded-[12px] flex-row items-center gap-1 border ${
                isDark ? "bg-slate-800 border-slate-700 active:bg-slate-750" : "bg-white border-slate-200 active:bg-slate-50"
              }`}
            >
              <Text className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                {MONTHS[month - 1]}
              </Text>
              <Calendar size={12} color={isDark ? "#94A3B8" : "#64748B"} />
            </TouchableOpacity>

            {/* Year Dropdown Button */}
            <TouchableOpacity
              onPress={() => setShowYearSelect(true)}
              className={`px-3 py-1.5 rounded-[12px] flex-row items-center gap-1 border ${
                isDark ? "bg-slate-800 border-slate-700 active:bg-slate-750" : "bg-white border-slate-200 active:bg-slate-50"
              }`}
            >
              <Text className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                {year}
              </Text>
              <Calendar size={12} color={isDark ? "#94A3B8" : "#64748B"} />
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
          <Text className={`text-xs uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
            Financial Summary
          </Text>
          <View className="gap-3">
            <View className="flex-row gap-3">
              <StatCard
                label="Month Earnings"
                value={formatCurrency(stats.monthEarnings)}
                className="flex-1"
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
            <Text className={`text-xs uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
              Payment History & Ledger
            </Text>
            <PressableScale
              onPress={() => setShowPaymentModal(true)}
              className={`flex-row items-center gap-1 px-3 py-1.5 rounded-[12px] ${
                isDark ? "bg-[#B8CAD9]" : "bg-[#173B6C] active:bg-[#122c52]"
              }`}
            >
              <Plus size={12} color={isDark ? "#0F172A" : "#FFFFFF"} />
              <Text className={`text-xs font-semibold ${isDark ? "text-slate-900" : "text-white"}`}>
                Record Payment
              </Text>
            </PressableScale>
          </View>

          <View className={`border overflow-hidden shadow-xs rounded-[16px] divide-y ${
            isDark ? "bg-[#1E293B] border-slate-800 divide-slate-800" : "bg-white border-slate-200 divide-slate-100"
          }`}>
            {payments.length === 0 ? (
              <Text className={`p-5 text-sm text-center ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                No payment history recorded yet.
              </Text>
            ) : (
              payments.map((p) => (
                <View key={p.id} className={`p-4 flex-row justify-between items-center ${isDark ? "bg-[#1E293B]" : "bg-white"}`}>
                  <View className="flex-1 pr-4">
                    <Text className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {formatLedgerDate(p.paid_on)}
                    </Text>
                    {p.note && (
                      <Text className={`text-xs italic mt-0.5 ${isDark ? "text-slate-400" : "text-slate-400"}`}>
                        {p.note}
                      </Text>
                    )}
                  </View>
                  <Text className={`text-base font-bold font-mono ${isDark ? "text-emerald-400" : "text-green-600"}`}>
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
          className="flex-1 bg-black/60 justify-center items-center"
        >
          <View className={`w-[80%] p-4 gap-3 max-h-[70%] rounded-[16px] border ${
            isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
          }`}>
            <Text className={`text-base font-bold pb-2 border-b ${
              isDark ? "text-slate-100 border-slate-800" : "text-slate-800 border-slate-100"
            }`}>
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
                    month === idx + 1 ? (isDark ? "bg-slate-800" : "bg-primary/5") : ""
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      month === idx + 1
                        ? isDark ? "text-[#B8CAD9] text-base" : "text-[#173B6C] text-base"
                        : isDark ? "text-slate-400 text-sm" : "text-slate-700 text-sm"
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
          className="flex-1 bg-black/60 justify-center items-center"
        >
          <View className={`w-[80%] p-4 gap-3 rounded-[16px] border ${
            isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
          }`}>
            <Text className={`text-base font-bold pb-2 border-b ${
              isDark ? "text-slate-100 border-slate-800" : "text-slate-800 border-slate-100"
            }`}>
              Select Year
            </Text>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <TouchableOpacity
                key={y}
                onPress={() => {
                  setYear(y);
                  setShowYearSelect(false);
                }}
                className={`py-3 px-4 rounded-xl ${
                  year === y ? (isDark ? "bg-slate-800" : "bg-primary/5") : ""
                }`}
              >
                <Text
                  className={`font-semibold ${
                    year === y
                      ? isDark ? "text-[#B8CAD9] text-base" : "text-[#173B6C] text-base"
                      : isDark ? "text-slate-400 text-sm" : "text-slate-700 text-sm"
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
        <View className="flex-1 justify-end bg-black/60">
          <View
            style={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
            className={`rounded-t-3xl p-6 gap-4 border-t ${
              isDark ? "bg-[#0F172A] border-slate-800" : "bg-white border-border"
            }`}
          >
            {/* Header */}
            <View className={`flex-row justify-between items-center pb-2 border-b ${
              isDark ? "border-slate-800" : "border-slate-100"
            }`}>
              <View className="flex-row items-center gap-2">
                <View className={`w-8 h-8 rounded-lg items-center justify-center ${
                  isDark ? "bg-slate-800" : "bg-green-100"
                }`}>
                  <CreditCard size={16} color={isDark ? "#B8CAD9" : "#16A34A"} />
                </View>
                <Text className={`text-lg font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                  Record Payment
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                className={`p-1 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
              >
                <X size={18} color={isDark ? "#94A3B8" : "#64748B"} />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View className="gap-4">
              <View className="gap-1.5">
                <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Amount Paid (₹)
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/[^0-9]/g, "");
                    setAmount(cleaned);
                    validateField("amount", cleaned);
                  }}
                  placeholder="Enter amount"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  keyboardType="number-pad"
                  className={`h-11 px-3 border rounded-[14px] text-base ${
                    isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                  }`}
                />
                {errors.amount && <Text className="text-xs text-red-500">{errors.amount}</Text>}
              </View>

              <DatePickerField
                value={paidOn}
                onChange={(d) => setPaidOn(d)}
                label="Date Paid"
              />

              <View className="gap-1.5">
                <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Note / Details
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Cash payment, weekly advance..."
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  className={`h-11 px-3 border rounded-[14px] text-base ${
                    isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                  }`}
                />
              </View>
            </View>

            {/* Footer */}
            <View className={`flex-row gap-3 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                className={`flex-1 h-12 rounded-[14px] border justify-center items-center ${
                  isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 active:bg-slate-50"
                }`}
              >
                <Text className={`text-base font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRecordPayment}
                disabled={recordPaymentMutation.isPending}
                className={`flex-1 h-12 rounded-[14px] justify-center items-center ${
                  isDark ? "bg-[#B8CAD9]" : "bg-[#173B6C] active:bg-[#122c52]"
                } ${recordPaymentMutation.isPending ? "opacity-50" : ""}`}
              >
                {recordPaymentMutation.isPending ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color={isDark ? "#0F172A" : "#FFFFFF"} />
                    <Text className={`text-base font-semibold ${isDark ? "text-slate-900" : "text-white"}`}>
                      Recording...
                    </Text>
                  </View>
                ) : (
                  <Text className={`text-base font-semibold ${isDark ? "text-slate-900" : "text-white"}`}>
                    Record Payment
                  </Text>
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
                  isDark ? "bg-slate-800" : "bg-[#173B6C]/10"
                }`}>
                  <Pencil size={16} color={isDark ? "#B8CAD9" : "#173B6C"} />
                </View>
                <Text className={`text-lg font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                  Edit Worker Profile
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                className={`p-1 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
              >
                <X size={18} color={isDark ? "#94A3B8" : "#64748B"} />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView
              contentContainerClassName="gap-4 pb-6"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="gap-1.5">
                <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Full Name
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={(val) => {
                    setFullName(val);
                    validateField("fullName", val);
                  }}
                  placeholder="Full name"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  className={`h-11 px-3 border rounded-[14px] text-base ${
                    isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                  }`}
                />
                {errors.fullName && <Text className="text-xs text-red-500">{errors.fullName}</Text>}
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Mobile
                  </Text>
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
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Type / Skill
                  </Text>
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

              <View className="gap-1.5">
                <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Address
                </Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Address details"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  multiline
                  numberOfLines={2}
                  className={`px-3 py-2 border rounded-[14px] text-base min-h-[60px] ${
                    isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-850"
                  }`}
                />
              </View>

              <View className="gap-1.5">
                <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Status
                </Text>
                <View className={`flex-row rounded-[14px] p-1 ${
                  isDark ? "bg-slate-800" : "bg-slate-100"
                }`}>
                  <TouchableOpacity
                    onPress={() => setStatus("active")}
                    className={`flex-1 py-2 rounded-lg items-center ${
                      status === "active"
                        ? isDark ? "bg-slate-700" : "bg-white"
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
                          ? isDark ? "text-slate-200" : "text-slate-800"
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
                        ? isDark ? "bg-slate-700" : "bg-white"
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

            {/* Footer */}
            <View className={`flex-row gap-3 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                className={`flex-1 h-12 rounded-[14px] border justify-center items-center ${
                  isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 active:bg-slate-50"
                }`}
              >
                <Text className={`text-base font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={editMutation.isPending}
                className={`flex-1 h-12 rounded-[14px] justify-center items-center ${
                  isDark ? "bg-[#B8CAD9]" : "bg-[#173B6C] active:bg-[#122c52]"
                } ${editMutation.isPending ? "opacity-50" : ""}`}
              >
                {editMutation.isPending ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color={isDark ? "#0F172A" : "#FFFFFF"} />
                    <Text className={`text-base font-semibold ${isDark ? "text-slate-900" : "text-white"}`}>
                      Saving...
                    </Text>
                  </View>
                ) : (
                  <Text className={`text-base font-semibold ${isDark ? "text-slate-900" : "text-white"}`}>
                    Save Changes
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
  const isDark = useIsDark();

  let containerClass = "";
  let textLabelClass = "";
  let textValueClass = "";

  if (highlight) {
    if (isAdvance) {
      if (isDark) {
        containerClass = "bg-amber-950/60 border-amber-800/50";
        textLabelClass = "text-amber-400/80";
        textValueClass = "text-amber-200";
      } else {
        containerClass = "bg-amber-500 border-amber-600";
        textLabelClass = "text-amber-50";
        textValueClass = "text-white";
      }
    } else {
      if (isDark) {
        containerClass = "bg-slate-800 border-slate-700";
        textLabelClass = "text-slate-400";
        textValueClass = "text-slate-100";
      } else {
        containerClass = "bg-[#173B6C] border-[#173B6C]";
        textLabelClass = "text-slate-200/80";
        textValueClass = "text-white";
      }
    }
  } else {
    if (isDark) {
      containerClass = "bg-[#1E293B] border-slate-800";
      textLabelClass = "text-slate-400";
      textValueClass = "text-slate-200";
    } else {
      containerClass = "bg-white border-slate-200";
      textLabelClass = "text-slate-500";
      textValueClass = "text-slate-800";
    }
  }

  return (
    <View className={`p-4 rounded-[16px] border shadow-xs ${containerClass} ${className}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${textLabelClass}`}>
        {label}
      </Text>
      <Text className={`text-base font-bold mt-1 font-mono ${textValueClass}`}>
        {value}
      </Text>
    </View>
  );
}
