import { useState, useEffect } from "react";
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
  Image,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { DatePickerField } from "@/components/DatePickerField";
import { Toast } from "@/components/Toast";
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
  FileText,
  Upload,
  Download,
  Image as ImageIcon,
  History,
  MessageSquare,
  Milestone,
  Users,
  Banknote,
  MapPin,
  Calendar,
} from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  getProject,
  updateProject,
  deleteProject,
  addProjectUpdate,
  assignWorker,
  unassignWorker,
  getSignedFileUrl,
  type ProjectInput,
} from "@/lib/projects.functions";
import { listWorkers } from "@/lib/workers.functions";
import { getProjectStats } from "@/lib/stats.functions";
import { recordQuotation, deleteQuotation } from "@/lib/quotations.functions";
import { uploadProjectFile } from "@/lib/upload";
import { formatCurrency } from "@/lib/format";
import { handleApiError } from "@/lib/errors";
import { useIsDark } from "@/hooks/use-is-dark";


type ProjectStatus = "planning" | "active" | "on_hold" | "completed";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const isDark = useIsDark();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const validateField = (fieldName: string, value: string) => {
    let err = "";
    if (fieldName === "projectName") {
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
    } else if (fieldName === "updateNote") {
      if (!value.trim()) {
        err = "This field is required.";
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

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Edit Project form state
  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expectedEnd, setExpectedEnd] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [notes, setNotes] = useState("");
  const [progressPct, setProgressPct] = useState(0);

  // Add Update form state
  const [updateNote, setUpdateNote] = useState("");
  const [isMilestone, setIsMilestone] = useState(false);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPhotoName, setSelectedPhotoName] = useState<string | null>(null);
  const [selectedPhotoType, setSelectedPhotoType] = useState<string | null>(null);

  // File Upload state
  const [uploadingQuotation, setUploadingQuotation] = useState(false);
  const [uploadingUpdatePhoto, setUploadingUpdatePhoto] = useState(false);

  // Queries
  const { data: detail, isLoading: loadingDetail, refetch: refetchDetail } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject({ id: id! }),
    enabled: !!id,
    staleTime: 1000 * 60 * 1, // 1 minute stale time for project details
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["project-stats", id],
    queryFn: () => getProjectStats({ id: id! }),
    enabled: !!id,
    staleTime: 1000 * 60 * 1, // 1 minute stale time for project metrics/stats
  });

  const { data: allWorkers = [], isLoading: loadingWorkers } = useQuery({
    queryKey: ["workers"],
    queryFn: () => listWorkers(),
    enabled: showAssignModal,
    staleTime: 1000 * 60 * 5, // 5 minutes stale time for workforce select roster
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: { id: string } & ProjectInput) => updateProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setToastMessage("Project updated successfully");
      setToastVisible(true);
      setShowEditModal(false);
    },
    onError: (error: any) => handleApiError(error),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject({ id: id! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      router.back();
    },
    onError: (error: any) => handleApiError(error),
  });

  const assignMutation = useMutation({
    mutationFn: (workerId: string) => assignWorker({ project_id: id!, worker_id: workerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["project-stats", id] });
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["att-matrix"] });
      setToastMessage("Worker assigned successfully");
      setToastVisible(true);
    },
    onError: (error: any) => handleApiError(error),
  });

  const unassignMutation = useMutation({
    mutationFn: (workerId: string) => unassignWorker({ project_id: id!, worker_id: workerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["project-stats", id] });
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["att-matrix"] });
      setToastMessage("Worker unassigned successfully");
      setToastVisible(true);
    },
    onError: (error: any) => handleApiError(error),
  });

  const uploadQuotationMutation = useMutation({
    mutationFn: async (res: DocumentPicker.DocumentPickerResult) => {
      if (res.canceled) return;
      setUploadingQuotation(true);
      const asset = res.assets[0];
      const meta = await uploadProjectFile(
        asset.uri,
        asset.name,
        asset.mimeType || "application/octet-stream",
        "quotations",
        id!
      );
      await recordQuotation({
        project_id: id!,
        file_path: meta.path,
        file_name: meta.name,
        file_type: meta.type || null,
        file_size: meta.size,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      setToastMessage("Quotation uploaded successfully");
      setToastVisible(true);
    },
    onError: (error: any) => handleApiError(error),
    onSettled: () => setUploadingQuotation(false),
  });

  const deleteQuotationMutation = useMutation({
    mutationFn: (quotationId: string) => deleteQuotation({ id: quotationId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      setToastMessage("Quotation deleted successfully");
      setToastVisible(true);
    },
    onError: (error: any) => handleApiError(error),
  });

  const addUpdateMutation = useMutation({
    mutationFn: (data: { note: string; is_milestone: boolean; photo_path?: string | null }) =>
      addProjectUpdate({ project_id: id!, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      setToastMessage("Update added successfully");
      setToastVisible(true);
      setShowUpdateModal(false);
    },
    onError: (error: any) => handleApiError(error),
  });

  if (loadingDetail && !detail) {
    return (
      <SafeAreaView className={`flex-1 justify-center items-center ${isDark ? "bg-[#0F172A]" : "bg-[#F8FAFC]"}`}>
        <ActivityIndicator size="large" color={isDark ? "#B8CAD9" : "#173B6C"} />
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView className={`flex-1 justify-center items-center px-6 ${isDark ? "bg-[#0F172A]" : "bg-[#F8FAFC]"}`}>
        <Text className={`text-base text-center ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
          Project detail not found or loading failed.
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


  const p = detail.project;
  const currentQuote = detail.quotations.find((q) => q.is_current);

  function handleOpenEdit() {
    if (!p) return;
    setProjectName(p.name);
    setClient(p.client ?? "");
    setLocation(p.location ?? "");
    setStartDate(p.start_date ?? "");
    setExpectedEnd(p.expected_end ?? "");
    setContractValue(String(p.contract_value));
    setStatus(p.status);
    setNotes(p.notes ?? "");
    setProgressPct(p.progress_pct);
    setErrors({});
    setShowEditModal(true);
  }

  function handleOpenUpdateModal() {
    setUpdateNote("");
    setIsMilestone(false);
    setSelectedPhotoUri(null);
    setSelectedPhotoName(null);
    setSelectedPhotoType(null);
    setErrors({});
    setShowUpdateModal(true);
  }

  function handleSaveEdit() {
    const isNameValid = validateField("projectName", projectName);
    const isContractValid = validateField("contractValue", contractValue);

    if (!isNameValid || !isContractValid) {
      return;
    }

    const valNum = Number(contractValue);
    updateMutation.mutate({
      id: id!,
      name: projectName.trim(),
      client: client.trim() || null,
      location: location.trim() || null,
      start_date: startDate || null,
      expected_end: expectedEnd || null,
      contract_value: valNum,
      status,
      progress_pct: progressPct,
      notes: notes.trim() || null,
    });
  }

  function handleDeleteProject() {
    Alert.alert(
      `Delete ${p.name}?`,
      "This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() }
      ]
    );
  }

  async function handlePickQuotation() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv",
          "image/*",
        ],
      });
      if (!res.canceled) {
        uploadQuotationMutation.mutate(res);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  async function handleOpenQuotation(path: string) {
    try {
      const { url } = await getSignedFileUrl({ file_path: path });
      Linking.openURL(url).catch(() => {
        Alert.alert("Error", "Unable to open url");
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  function handleDeleteQuotation(qId: string, qName: string) {
    Alert.alert(
      `Delete ${qName}?`,
      "This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteQuotationMutation.mutate(qId) }
      ]
    );
  }

  async function handlePickUpdatePhoto() {
    try {
      const { status: reqStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (reqStatus !== "granted") {
        Alert.alert("Permission Required", "Media library permissions are required to upload site photos");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setSelectedPhotoUri(asset.uri);
        setSelectedPhotoName(asset.fileName || `site_photo_${Date.now()}.jpg`);
        setSelectedPhotoType(asset.mimeType || "image/jpeg");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  async function handleSaveUpdate() {
    const isNoteValid = validateField("updateNote", updateNote);
    if (!isNoteValid) {
      return;
    }

    setUploadingUpdatePhoto(true);
    try {
      let photo_path: string | null = null;
      if (selectedPhotoUri) {
        const meta = await uploadProjectFile(
          selectedPhotoUri,
          selectedPhotoName || "photo.jpg",
          selectedPhotoType || "image/jpeg",
          "photos",
          id!
        );
        photo_path = meta.path;
      }
      addUpdateMutation.mutate({
        note: updateNote.trim(),
        is_milestone: isMilestone,
        photo_path,
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
      setUploadingUpdatePhoto(false);
    }
  }

  const assignedWorkerIds = new Set(detail.assignments.map((a) => a.worker_id));
  const availableWorkersForAssign = allWorkers.filter((w) => w.status === "active" && !assignedWorkerIds.has(w.id));

  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-[#0F172A]" : "bg-[#F8FAFC]"}`}>
      {/* Top Header */}
      <View className={`px-4 py-3 border-b flex-row items-center justify-between ${
        isDark ? "bg-[#0F172A] border-slate-800" : "bg-white border-slate-100"
      }`}>
        <TouchableOpacity
          onPress={() => router.back()}
          className={`p-1 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
        >
          <ArrowLeft size={20} color={isDark ? "#B8CAD9" : "#64748B"} />
        </TouchableOpacity>
        <Text className={`text-lg font-bold flex-1 ml-3 truncate ${isDark ? "text-slate-200" : "text-slate-800"}`} numberOfLines={1}>
          {p.name}
        </Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={handleOpenEdit}
            className={`p-2 rounded-full ${isDark ? "bg-slate-800 active:bg-slate-700" : "bg-slate-100 active:bg-slate-200"}`}
          >
            <Pencil size={16} color={isDark ? "#B8CAD9" : "#64748B"} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeleteProject}
            className={`p-2 rounded-full ${
              isDark ? "bg-red-950/40 border border-red-900/60 active:bg-red-950" : "bg-red-50 active:bg-red-100"
            }`}
          >
            <Trash2 size={16} color={isDark ? "#F87171" : "#EF4444"} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerClassName="px-4 py-5 gap-5 pb-12">
        {/* Project Card Info */}
        <View className={`border rounded-2xl p-5 shadow-xs gap-4 ${
          isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
        }`}>
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                <Text className={`text-lg font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{p.name}</Text>
                <View className={`border px-2.5 py-0.5 rounded-full ${
                  isDark ? "bg-[#B8CAD9]/10 border-[#B8CAD9]/20" : "bg-[#173B6C]/5 border-[#173B6C]/20"
                }`}>
                  <Text className={`text-[10px] font-bold uppercase ${isDark ? "text-[#B8CAD9]" : "text-primary"}`}>
                    {STATUS_LABEL[p.status as ProjectStatus]}
                  </Text>
                </View>
              </View>
              {p.client && (
                <Text className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Client: {p.client}</Text>
              )}
            </View>
          </View>

          {/* Location & Dates */}
          <View className={`gap-2.5 border-t pt-3.5 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
            {p.location && (
              <View className="flex-row items-center gap-2">
                <MapPin size={14} color={isDark ? "#B8CAD9" : "#64748B"} />
                <Text className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>{p.location}</Text>
              </View>
            )}
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color={isDark ? "#B8CAD9" : "#64748B"} />
              <Text className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Timeline: {p.start_date ? new Date(p.start_date).toLocaleDateString() : "—"} to{" "}
                {p.expected_end ? new Date(p.expected_end).toLocaleDateString() : "Expected End"}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Banknote size={14} color={isDark ? "#B8CAD9" : "#64748B"} />
              <Text className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Contract: <Text className={`font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{formatCurrency(p.contract_value)}</Text>
              </Text>
            </View>
          </View>

          {/* Progress pct */}
          <View className={`gap-1.5 border-t pt-3.5 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
            <View className="flex-row justify-between items-center">
              <Text className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Project Progress</Text>
              <Text className={`text-xs font-bold font-mono ${isDark ? "text-slate-200" : "text-slate-800"}`}>{p.progress_pct}%</Text>
            </View>
            <View className={`h-2.5 w-full rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
              <View
                className={`h-full rounded-full ${isDark ? "bg-[#B8CAD9]" : "bg-[#173B6C]"}`}
                style={{ width: `${p.progress_pct}%` }}
              />
            </View>
          </View>

          {/* Notes */}
          {p.notes && (
            <View className={`p-3 rounded-xl border ${isDark ? "bg-slate-800/60 border-slate-750" : "bg-slate-50 border-slate-100"}`}>
              <Text className={`text-[10px] uppercase font-bold mb-1 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>Internal Notes</Text>
              <Text className={`text-xs leading-normal ${isDark ? "text-slate-300" : "text-slate-600"}`}>{p.notes}</Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        {stats && (
          <View className="flex-row gap-3">
            <View className={`flex-1 border rounded-2xl p-4 shadow-xs items-center ${
              isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
            }`}>
              <Users size={18} color={isDark ? "#B8CAD9" : "#1E3A5F"} />
              <Text className={`text-lg font-bold mt-1 font-mono ${isDark ? "text-slate-200" : "text-slate-800"}`}>{stats.assignedCount}</Text>
              <Text className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${isDark ? "text-slate-450" : "text-slate-400"}`}>Assigned</Text>
            </View>
            <View className={`flex-1 border rounded-2xl p-4 shadow-xs items-center ${
              isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
            }`}>
              <Users size={18} color={isDark ? "#4ade80" : "#16a34a"} />
              <Text className={`text-lg font-bold mt-1 font-mono ${isDark ? "text-green-400" : "text-green-600"}`}>{stats.presentToday}</Text>
              <Text className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${isDark ? "text-slate-450" : "text-slate-400"}`}>Present Today</Text>
            </View>
            <View className={`flex-1 border rounded-2xl p-4 shadow-xs items-center ${
              isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
            }`}>
              <Banknote size={18} color={isDark ? "#B8CAD9" : "#1E3A5F"} />
              <Text className={`text-sm font-bold mt-2 font-mono truncate max-w-full ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                {formatCurrency(stats.monthCost)}
              </Text>
              <Text className={`text-[10px] font-bold uppercase tracking-wider mt-1.5 ${isDark ? "text-slate-450" : "text-slate-400"}`}>Labour Cost</Text>
            </View>
          </View>
        )}

        {/* Active Workforce / Crew */}
        <View className="gap-2">
          <View className="flex-row justify-between items-center mb-1">
            <Text className={`text-xs uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
              Workforce / Crew
            </Text>
            <TouchableOpacity
              onPress={() => setShowAssignModal(true)}
              className={`flex-row items-center gap-1 px-3 py-1.5 rounded-[14px] ${
                isDark ? "bg-slate-800 border border-slate-700 active:bg-slate-700" : "bg-[#173B6C] active:bg-[#122c52]"
              }`}
            >
              <Plus size={12} color={isDark ? "#B8CAD9" : "#FFFFFF"} />
              <Text className={`text-xs font-semibold ${isDark ? "text-[#B8CAD9]" : "text-white"}`}>Assign Worker</Text>
            </TouchableOpacity>
          </View>

          <View className={`border rounded-2xl overflow-hidden shadow-xs divide-y ${
            isDark ? "bg-[#1E293B] border-slate-800 divide-slate-800" : "bg-white border-border divide-slate-100"
          }`}>
            {detail.assignments.length === 0 ? (
              <Text className={`p-5 text-sm text-center ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                No workers assigned to this site yet.
              </Text>
            ) : (
              detail.assignments.map((a: any) => (
                <View key={a.worker_id} className={`p-4 flex-row justify-between items-center ${isDark ? "bg-[#1E293B]" : "bg-white"}`}>
                  <TouchableOpacity
                    onPress={() => router.push(`/workers/${a.worker_id}` as any)}
                    className="flex-1 pr-4"
                  >
                    <Text className={`text-sm font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {a.workers?.full_name ?? "Worker"}
                    </Text>
                    <Text className={`text-xs mt-0.5 ${isDark ? "text-slate-450" : "text-slate-400"}`}>
                      {a.workers?.worker_type || "Worker"} · {formatCurrency(a.workers?.daily_wage)}/day
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        `Remove ${a.workers?.full_name}?`,
                        "This action cannot be undone.",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Remove", style: "destructive", onPress: () => unassignMutation.mutate(a.worker_id) }
                        ]
                      );
                    }}
                    className={`px-3 py-1 rounded-[10px] border ${
                      isDark ? "bg-red-950/40 border-red-900/60 active:bg-red-950" : "bg-red-50 active:bg-red-100"
                    }`}
                  >
                    <Text className={`text-xs font-bold ${isDark ? "text-red-400" : "text-red-655"}`}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Quotations Section */}
        <View className="gap-2">
          <View className="flex-row justify-between items-center mb-1">
            <Text className={`text-xs uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
              Quotation
            </Text>
            <View className="flex-row gap-2">
              {detail.quotations.length > 1 && (
                <TouchableOpacity
                  onPress={() => setShowHistoryModal(true)}
                  className={`border px-3 py-1.5 rounded-[14px] flex-row items-center gap-1 ${
                    isDark ? "bg-slate-850 border-slate-700" : "bg-white border-slate-200"
                  }`}
                >
                  <History size={12} color={isDark ? "#B8CAD9" : "#64748B"} />
                  <Text className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>v{detail.quotations.length}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handlePickQuotation}
                disabled={uploadingQuotation}
                className={`flex-row items-center gap-1 px-3 py-1.5 rounded-[14px] ${
                  isDark ? "bg-slate-800 border border-slate-700 active:bg-slate-700" : "bg-[#173B6C] active:bg-[#122c52]"
                }`}
              >
                {uploadingQuotation ? (
                  <ActivityIndicator size="small" color={isDark ? "#B8CAD9" : "#FFFFFF"} />
                ) : (
                  <>
                    <Upload size={12} color={isDark ? "#B8CAD9" : "#FFFFFF"} />
                    <Text className={`text-xs font-semibold ${isDark ? "text-[#B8CAD9]" : "text-white"}`}>
                      {currentQuote ? "Replace" : "Upload"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View className={`border rounded-2xl p-4 shadow-xs ${
            isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-border"
          }`}>
            {!currentQuote ? (
              <Text className={`text-sm text-center py-2 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                No quotation uploaded yet. Upload PDF, Excel, or Image.
              </Text>
            ) : (
              <View className="flex-row justify-between items-center gap-3">
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <FileText size={28} color={isDark ? "#B8CAD9" : "#1E3A5F"} />
                  <View className="flex-1">
                    <Text className={`text-sm font-bold truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {currentQuote.file_name}
                    </Text>
                    <Text className={`text-[10px] mt-0.5 ${isDark ? "text-slate-450" : "text-muted-foreground"}`}>
                      Version {currentQuote.version} · {new Date(currentQuote.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleOpenQuotation(currentQuote.file_path)}
                  className={`border px-3.5 py-1.5 rounded-[10px] flex-row items-center gap-1 ${
                    isDark ? "bg-slate-800 border-slate-700 active:bg-slate-700" : "bg-slate-100 border-slate-200 active:bg-slate-200"
                  }`}
                >
                  <Download size={12} color={isDark ? "#B8CAD9" : "#1E3A5F"} />
                  <Text className={`text-xs font-semibold ${isDark ? "text-[#B8CAD9]" : "text-primary"}`}>Open</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Site Updates & Log */}
        <View className="gap-2">
          <View className="flex-row justify-between items-center mb-1">
            <Text className={`text-xs uppercase font-bold tracking-wider font-semibold ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
              Site Updates
            </Text>
            <TouchableOpacity
              onPress={() => handleOpenUpdateModal()}
              className={`flex-row items-center gap-1 px-3 py-1.5 rounded-[14px] ${
                isDark ? "bg-slate-800 border border-slate-700 active:bg-slate-700" : "bg-[#173B6C] active:bg-[#122c52]"
              }`}
            >
              <Plus size={12} color={isDark ? "#B8CAD9" : "#FFFFFF"} />
              <Text className={`text-xs font-semibold ${isDark ? "text-[#B8CAD9]" : "text-white"}`}>Add Update</Text>
            </TouchableOpacity>
          </View>

          <View className={`border rounded-2xl p-4 shadow-xs gap-4 divide-y ${
            isDark ? "bg-[#1E293B] border-slate-800 divide-slate-800" : "bg-white border-border divide-slate-100"
          }`}>
            {detail.updates.length === 0 ? (
              <Text className={`text-sm text-center py-4 ${isDark ? "text-slate-450" : "text-muted-foreground"}`}>
                No site updates recorded yet.
              </Text>
            ) : (

              detail.updates.map((up) => <UpdateRow key={up.id} update={up} />)
            )}
          </View>
        </View>
      </ScrollView>

      {/* Edit Project Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
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
              <View className={`flex-row justify-between items-center pb-2 border-b ${
                isDark ? "border-slate-800" : "border-slate-100"
              }`}>
                <View className="flex-row items-center gap-2">
                  <View className={`w-8 h-8 rounded-lg items-center justify-center ${
                    isDark ? "bg-slate-800" : "bg-[#173B6C]/10"
                  }`}>
                    <Pencil size={16} color={isDark ? "#B8CAD9" : "#173B6C"} />
                  </View>
                  <Text className={`text-lg font-bold ${isDark ? "text-slate-100" : "text-foreground"}`}>Edit Project</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowEditModal(false)}
                  className={`p-1 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
                >
                  <X size={18} color={isDark ? "#94A3B8" : "#64748B"} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerClassName="gap-4 pb-6"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View className="gap-1.5">
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Project Name</Text>
                  <TextInput
                    value={projectName}
                    onChangeText={(val) => {
                      setProjectName(val);
                      validateField("projectName", val);
                    }}
                    placeholder="Project name"
                    placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                    className={`h-11 px-3 border rounded-[14px] text-base ${
                      isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                  {errors.projectName && <Text className="text-xs text-red-500">{errors.projectName}</Text>}
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1 gap-1.5">
                    <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Client Name</Text>
                    <TextInput
                      value={client}
                      onChangeText={setClient}
                      placeholder="Client"
                      placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                      className={`h-11 px-3 border rounded-[14px] text-base ${
                        isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                  </View>
                  <View className="flex-1 gap-1.5">
                    <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Location</Text>
                    <TextInput
                      value={location}
                      onChangeText={setLocation}
                      placeholder="Location"
                      placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                      className={`h-11 px-3 border rounded-[14px] text-base ${
                        isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                  </View>
                </View>

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

                <View className="flex-row gap-3">
                  <View className="flex-1 gap-1.5">
                    <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Contract Value (₹)</Text>
                    <TextInput
                      value={contractValue}
                      onChangeText={(val) => {
                        const cleaned = val.replace(/[^0-9]/g, "");
                        setContractValue(cleaned);
                        validateField("contractValue", cleaned);
                      }}
                      placeholder="Contract value"
                      placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                      keyboardType="number-pad"
                      className={`h-11 px-3 border rounded-[14px] text-base ${
                        isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                    {errors.contractValue && <Text className="text-xs text-red-500">{errors.contractValue}</Text>}
                  </View>
                  <View className="flex-1 gap-1.5">
                    <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Progress Pct (%)</Text>
                    <TextInput
                      value={String(progressPct)}
                      onChangeText={(val) => setProgressPct(Math.min(100, Math.max(0, Number(val) || 0)))}
                      placeholder="e.g. 50"
                      placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                      keyboardType="numeric"
                      className={`h-11 px-3 border rounded-[14px] text-base ${
                        isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                  </View>
                </View>

                {/* Status Select Grid */}
                <View className="gap-1.5">
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Select Status</Text>
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
                                : "text-slate-655"
                          }`}
                        >
                          {STATUS_LABEL[st]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="gap-1.5">
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Internal Notes</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Internal comments..."
                    placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                    multiline
                    numberOfLines={3}
                    className={`px-3 py-2 border rounded-[14px] text-base min-h-[80px] ${
                      isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                </View>
              </ScrollView>

              <View className={`flex-row gap-3 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                <TouchableOpacity
                  onPress={() => setShowEditModal(false)}
                  className={`flex-1 h-12 rounded-[14px] border justify-center items-center ${
                    isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 active:bg-slate-50"
                  }`}
                >
                  <Text className={`text-base font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveEdit}
                  disabled={updateMutation.isPending}
                  className={`flex-1 h-12 rounded-[14px] justify-center items-center ${
                    isDark ? "bg-[#B8CAD9]" : "bg-[#173B6C] active:bg-[#122c52]"
                  } ${updateMutation.isPending ? "opacity-50" : ""}`}
                >
                  {updateMutation.isPending ? (
                    <ActivityIndicator size="small" color={isDark ? "#1E293B" : "#FFFFFF"} />
                  ) : (
                    <Text className={`text-base font-semibold ${isDark ? "text-slate-900" : "text-white"}`}>Saving...</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assign Crew Modal */}
      <Modal visible={showAssignModal} animationType="slide" transparent onRequestClose={() => setShowAssignModal(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View
            style={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
            className={`rounded-t-3xl p-6 gap-4 border-t max-h-[80%] ${
              isDark ? "bg-[#0F172A] border-slate-800" : "bg-white border-border"
            }`}
          >
            <View className={`flex-row justify-between items-center pb-2 border-b ${
              isDark ? "border-slate-800" : "border-slate-100"
            }`}>
              <View className="flex-row items-center gap-2">
                <View className={`w-8 h-8 rounded-lg items-center justify-center ${
                  isDark ? "bg-slate-800" : "bg-[#173B6C]/10"
                }`}>
                  <Users size={16} color={isDark ? "#B8CAD9" : "#173B6C"} />
                </View>
                <Text className={`text-lg font-bold ${isDark ? "text-slate-100" : "text-foreground"}`}>Assign Worker</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAssignModal(false)}
                className={`p-1 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
              >
                <X size={18} color={isDark ? "#94A3B8" : "#64748B"} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerClassName="gap-3 pb-6">
              {loadingWorkers ? (
                <ActivityIndicator size="small" color={isDark ? "#B8CAD9" : "#173B6C"} />
              ) : availableWorkersForAssign.length === 0 ? (
                <Text className={`text-sm text-center py-8 ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                  All active workers are already assigned to this project.
                </Text>
              ) : (
                availableWorkersForAssign.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => {
                      setShowAssignModal(false);
                      assignMutation.mutate(w.id);
                    }}
                    className={`p-3 border rounded-xl flex-row justify-between items-center ${
                      isDark ? "bg-slate-800 border-slate-700 active:bg-slate-700" : "bg-slate-50 border-slate-150 active:bg-slate-100"
                    }`}
                  >
                    <View>
                      <Text className={`text-sm font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{w.full_name}</Text>
                      <Text className={`text-xs mt-0.5 ${isDark ? "text-slate-450" : "text-slate-400"}`}>
                        {w.worker_type || "Worker"} · {formatCurrency(w.daily_wage)}/day
                      </Text>
                    </View>
                    <ChevronRight size={16} color={isDark ? "#64748B" : "#94A3B8"} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Quotation History Modal */}
      <Modal visible={showHistoryModal} transparent animationType="fade" onRequestClose={() => setShowHistoryModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowHistoryModal(false)}
          className={`flex-1 justify-center items-center ${isDark ? "bg-black/60" : "bg-black/40"}`}
        >
          <View className={`w-[90%] rounded-2xl p-5 gap-3 max-h-[75%] border ${
            isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-150"
          }`}>
            <Text className={`text-base font-bold pb-2 border-b ${
              isDark ? "text-slate-200 border-slate-800" : "text-slate-800 border-slate-100"
            }`}>
              Quotation History
            </Text>
            <ScrollView contentContainerClassName="gap-3">
              {detail.quotations.map((q: any) => (
                <View key={q.id} className="py-2.5 flex-row justify-between items-center gap-2">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-1.5 flex-wrap">
                      <Text className={`text-sm font-bold truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                        Version {q.version} · {q.file_name}
                      </Text>
                      {q.is_current && (
                        <View className={`px-2 py-0.5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                          <Text className={`text-[9px] font-bold ${isDark ? "text-slate-350" : "text-slate-500"} uppercase`}>Current</Text>
                        </View>
                      )}
                    </View>
                    <Text className={`text-[10px] mt-0.5 ${isDark ? "text-slate-450" : "text-muted-foreground"}`}>
                      Uploaded {new Date(q.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <View className="flex-row gap-1">
                    <TouchableOpacity
                      onPress={() => handleOpenQuotation(q.file_path)}
                      className={`px-2.5 py-1.5 border rounded-lg ${
                        isDark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200"
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${isDark ? "text-[#B8CAD9]" : "text-primary"}`}>Open</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteQuotation(q.id, q.file_name)}
                      className={`p-1.5 border rounded-lg ${
                        isDark ? "bg-red-950/40 border-red-900/60" : "bg-red-50 border-red-100"
                      }`}
                    >
                      <Trash2 size={14} color={isDark ? "#F87171" : "#EF4444"} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Site Update Modal */}
      <Modal visible={showUpdateModal} animationType="slide" transparent onRequestClose={() => setShowUpdateModal(false)}>
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
                    isDark ? "bg-slate-800" : "bg-[#173B6C]/10"
                  }`}>
                    <MessageSquare size={16} color={isDark ? "#B8CAD9" : "#173B6C"} />
                  </View>
                  <Text className={`text-lg font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>Add Site Update</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowUpdateModal(false)}
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
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Update Description</Text>
                  <TextInput
                    value={updateNote}
                    onChangeText={(val) => {
                      setUpdateNote(val);
                      validateField("updateNote", val);
                    }}
                    placeholder="e.g. Plastering work started, Slab pouring completed..."
                    placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                    multiline
                    numberOfLines={3}
                    className={`px-3 py-2 border rounded-[14px] text-base min-h-[80px] ${
                      isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                  {errors.updateNote && <Text className="text-xs text-red-500">{errors.updateNote}</Text>}
                </View>

                {/* Site Photo Selection */}
                <View className="gap-1.5">
                  <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Site Photo (optional)</Text>
                  <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                      onPress={handlePickUpdatePhoto}
                      className={`border border-dashed rounded-xl px-4 py-3 flex-row items-center gap-2 ${
                        isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <ImageIcon size={16} color={isDark ? "#B8CAD9" : "#1E3A5F"} />
                      <Text className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>Select Image</Text>
                    </TouchableOpacity>
                    {selectedPhotoUri && (
                      <View className={`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1.5 flex-1 pr-6 relative ${
                        isDark ? "bg-slate-800" : "bg-slate-100"
                      }`}>
                        <Text className={`text-xs truncate flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`} numberOfLines={1}>
                          {selectedPhotoName}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedPhotoUri(null);
                            setSelectedPhotoName(null);
                            setSelectedPhotoType(null);
                          }}
                          className={`absolute right-1 p-0.5 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
                        >
                          <X size={10} color={isDark ? "#94A3B8" : "#64748B"} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>

                {/* Milestone Checkbox */}
                <TouchableOpacity
                  onPress={() => setIsMilestone(!isMilestone)}
                  className="flex-row items-center gap-2 py-1"
                >
                  <View
                    className={`w-5 h-5 rounded border items-center justify-center ${
                      isMilestone
                        ? isDark
                          ? "bg-[#B8CAD9] border-[#B8CAD9]"
                          : "bg-primary border-primary"
                        : isDark
                          ? "border-slate-700"
                          : "border-slate-300"
                    }`}
                  >
                    {isMilestone && <Text className={`${isDark ? "text-slate-900" : "text-white"} text-[10px] font-bold`}>✓</Text>}
                  </View>
                  <Text className={`text-sm font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Mark as Milestone</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Footer */}
              <View className={`flex-row gap-3 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                <TouchableOpacity
                  onPress={() => setShowUpdateModal(false)}
                  className={`flex-1 h-12 rounded-[14px] border justify-center items-center ${
                    isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 active:bg-slate-50"
                  }`}
                >
                  <Text className={`text-base font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveUpdate}
                  disabled={uploadingUpdatePhoto || addUpdateMutation.isPending}
                  className={`flex-1 h-12 rounded-[14px] justify-center items-center ${
                    isDark ? "bg-[#B8CAD9]" : "bg-[#173B6C] active:bg-[#122c52]"
                  } ${(uploadingUpdatePhoto || addUpdateMutation.isPending) ? "opacity-50" : ""}`}
                >
                  {uploadingUpdatePhoto || addUpdateMutation.isPending ? (
                    <ActivityIndicator size="small" color={isDark ? "#1E293B" : "#FFFFFF"} />
                  ) : (
                    <Text className={`text-base font-semibold ${isDark ? "text-slate-900" : "text-white"}`}>Saving...</Text>
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

/* ── Single Update Row Component ── */
function UpdateRow({ update }: { update: any }) {
  const isDark = useIsDark();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  useEffect(() => {
    async function loadPhoto() {
      if (!update.photo_path) return;
      setLoadingPhoto(true);
      try {
        const { url } = await getSignedFileUrl({ file_path: update.photo_path });
        setPhotoUrl(url);
      } catch (err) {
        console.warn("Failed to load update photo URL", err);
      } finally {
        setLoadingPhoto(false);
      }
    }
    loadPhoto();
  }, [update.photo_path]);

  return (
    <View className={`py-4 flex-row gap-3 ${isDark ? "bg-[#1E293B]" : "bg-white"}`}>
      <View className="mt-1 shrink-0">
        {update.is_milestone ? (
          <View className={`w-7 h-7 rounded-full items-center justify-center ${
            isDark ? "bg-slate-800" : "bg-primary/10"
          }`}>
            <Milestone size={14} color={isDark ? "#B8CAD9" : "#1E3A5F"} />
          </View>
        ) : (
          <View className={`w-7 h-7 rounded-full items-center justify-center ${
            isDark ? "bg-slate-800" : "bg-slate-100"
          }`}>
            <MessageSquare size={14} color={isDark ? "#94A3B8" : "#64748B"} />
          </View>
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text className={`text-sm font-semibold leading-normal ${isDark ? "text-slate-200" : "text-slate-800"}`}>
          {update.note}
        </Text>
        <Text className={`text-[10px] mt-1 ${isDark ? "text-slate-450" : "text-muted-foreground"}`}>
          {new Date(update.created_at).toLocaleString()}
        </Text>
        {update.photo_path && (
          <View className={`mt-3.5 border rounded-xl overflow-hidden min-h-[100px] justify-center items-center ${
            isDark ? "border-slate-800 bg-slate-800/40" : "border-slate-100 bg-slate-50"
          }`}>
            {loadingPhoto ? (
              <ActivityIndicator size="small" color={isDark ? "#B8CAD9" : "#1E3A5F"} />
            ) : photoUrl ? (
              <Image source={{ uri: photoUrl }} className="w-full h-44" resizeMode="cover" />
            ) : (
              <Text className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Unable to load photo</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

