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
      Alert.alert("Success", "Project updated successfully");
      setShowEditModal(false);
    },
    onError: (error: any) => handleApiError(error),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject({ id: id! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      Alert.alert("Success", "Project deleted successfully");
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
      Alert.alert("Success", "Worker assigned successfully");
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
      Alert.alert("Success", "Worker unassigned successfully");
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
      Alert.alert("Success", "Quotation uploaded successfully");
    },
    onError: (error: any) => handleApiError(error),
    onSettled: () => setUploadingQuotation(false),
  });

  const deleteQuotationMutation = useMutation({
    mutationFn: (quotationId: string) => deleteQuotation({ id: quotationId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      Alert.alert("Success", "Quotation version deleted");
    },
    onError: (error: any) => handleApiError(error),
  });

  const addUpdateMutation = useMutation({
    mutationFn: async (payload: { note: string; is_milestone: boolean; photo_path: string | null }) => {
      return addProjectUpdate({ project_id: id!, ...payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      Alert.alert("Success", "Project update added");
      setUpdateNote("");
      setIsMilestone(false);
      setSelectedPhotoUri(null);
      setSelectedPhotoName(null);
      setSelectedPhotoType(null);
      setShowUpdateModal(false);
    },
    onError: (error: any) => handleApiError(error),
    onSettled: () => setUploadingUpdatePhoto(false),
  });

  if (loadingDetail && !detail) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center">
        <ActivityIndicator size="large" color="#1E3A5F" />
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center px-6">
        <Text className="text-base text-muted-foreground text-center">
          Project detail not found or loading failed.
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-primary px-6 py-2.5 rounded-xl">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const p = detail.project;
  const currentQuote = detail.quotations.find((q) => q.is_current);

  function handleOpenEdit() {
    setProjectName(p.name);
    setClient(p.client ?? "");
    setLocation(p.location ?? "");
    setStartDate(p.start_date ?? "");
    setExpectedEnd(p.expected_end ?? "");
    setContractValue(String(p.contract_value ?? 0));
    setStatus(p.status);
    setNotes(p.notes ?? "");
    setProgressPct(p.progress_pct ?? 0);
    setShowEditModal(true);
  }

  function handleSaveEdit() {
    if (!projectName.trim()) {
      Alert.alert("Error", "Project name is required");
      return;
    }
    const valNum = Number(contractValue);
    if (isNaN(valNum) || valNum < 0) {
      Alert.alert("Error", "Please enter a valid contract value");
      return;
    }

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
      "Confirm Delete",
      `Are you sure you want to delete ${p.name}? This will delete all logs, assigned crew relationships, quotations, and update history.`,
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

  function handleDeleteQuotation(qId: string) {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this quotation version?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteQuotationMutation.mutate(qId) }
    ]);
  }

  async function handlePickUpdatePhoto() {
    try {
      const { status: reqStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (reqStatus !== "granted") {
        Alert.alert("Permission Required", "Media library permissions are required to upload site photos");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (!updateNote.trim()) {
      Alert.alert("Error", "Please write an update note");
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
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="px-4 py-3 bg-white border-b border-slate-100 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="p-1 rounded-full bg-slate-100">
          <ArrowLeft size={20} color="#64748B" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-slate-800 flex-1 ml-3 truncate" numberOfLines={1}>
          {p.name}
        </Text>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={handleOpenEdit} className="p-2 rounded-full bg-slate-100 active:bg-slate-200">
            <Pencil size={16} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteProject} className="p-2 rounded-full bg-red-50 active:bg-red-100">
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerClassName="px-4 py-5 gap-5 pb-12">
        {/* Project Card Info */}
        <View className="bg-white border border-border rounded-2xl p-5 shadow-xs gap-4">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                <Text className="text-lg font-bold text-slate-800">{p.name}</Text>
                <View className="bg-primary/5 border border-primary/20 px-2.5 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-primary uppercase">
                    {STATUS_LABEL[p.status as ProjectStatus]}
                  </Text>
                </View>
              </View>
              {p.client && (
                <Text className="text-xs font-semibold text-slate-500">Client: {p.client}</Text>
              )}
            </View>
          </View>

          {/* Location & Dates */}
          <View className="gap-2.5 border-t border-slate-100 pt-3.5">
            {p.location && (
              <View className="flex-row items-center gap-2">
                <MapPin size={14} color="#64748B" />
                <Text className="text-xs text-slate-600">{p.location}</Text>
              </View>
            )}
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color="#64748B" />
              <Text className="text-xs text-slate-600">
                Timeline: {p.start_date ? new Date(p.start_date).toLocaleDateString() : "—"} to{" "}
                {p.expected_end ? new Date(p.expected_end).toLocaleDateString() : "Expected End"}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Banknote size={14} color="#64748B" />
              <Text className="text-xs text-slate-600">
                Contract: <Text className="font-semibold text-slate-800">{formatCurrency(p.contract_value)}</Text>
              </Text>
            </View>
          </View>

          {/* Progress pct */}
          <View className="gap-1.5 border-t border-slate-100 pt-3.5">
            <View className="flex-row justify-between items-center">
              <Text className="text-xs font-semibold text-slate-500">Project Progress</Text>
              <Text className="text-xs font-bold text-slate-800 font-mono">{p.progress_pct}%</Text>
            </View>
            <View className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <View className="h-full bg-primary rounded-full" style={{ width: `${p.progress_pct}%` }} />
            </View>
          </View>

          {/* Notes */}
          {p.notes && (
            <View className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Text className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Internal Notes</Text>
              <Text className="text-xs text-slate-600 leading-normal">{p.notes}</Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        {stats && (
          <View className="flex-row gap-3">
            <View className="flex-1 bg-white border border-border rounded-2xl p-4 shadow-xs items-center">
              <Users size={18} color="#1E3A5F" />
              <Text className="text-lg font-bold text-slate-800 mt-1 font-mono">{stats.assignedCount}</Text>
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Assigned</Text>
            </View>
            <View className="flex-1 bg-white border border-border rounded-2xl p-4 shadow-xs items-center">
              <Text className="text-lg font-bold text-success mt-1 font-mono">{stats.presentToday}</Text>
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Present Today</Text>
            </View>
            <View className="flex-1 bg-white border border-border rounded-2xl p-4 shadow-xs items-center">
              <Text className="text-sm font-bold text-slate-800 mt-2 font-mono truncate max-w-full">
                {formatCurrency(stats.monthCost)}
              </Text>
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">Labour Cost</Text>
            </View>
          </View>
        )}

        {/* Active Workforce / Crew */}
        <View className="gap-2">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
              Workforce / Crew
            </Text>
            <TouchableOpacity
              onPress={() => setShowAssignModal(true)}
              className="bg-primary flex-row items-center gap-1 px-3 py-1.5 rounded-xl active:bg-primary-600"
            >
              <Plus size={12} color="#FFFFFF" />
              <Text className="text-xs font-semibold text-white">Assign Worker</Text>
            </TouchableOpacity>
          </View>

          <View className="bg-white border border-border rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
            {detail.assignments.length === 0 ? (
              <Text className="p-5 text-sm text-muted-foreground text-center">
                No workers assigned to this site yet.
              </Text>
            ) : (
              detail.assignments.map((a: any) => (
                <View key={a.worker_id} className="p-4 flex-row justify-between items-center">
                  <TouchableOpacity
                    onPress={() => router.push(`/workers/${a.worker_id}` as any)}
                    className="flex-1 pr-4"
                  >
                    <Text className="text-sm font-bold text-slate-800">
                      {a.workers?.full_name ?? "Worker"}
                    </Text>
                    <Text className="text-xs text-slate-400 mt-0.5">
                      {a.workers?.worker_type || "Worker"} · {formatCurrency(a.workers?.daily_wage)}/day
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert("Confirm Remove", `Remove ${a.workers?.full_name} from this project?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => unassignMutation.mutate(a.worker_id) }
                      ]);
                    }}
                    className="px-3 py-1 rounded-lg border border-red-200 bg-red-50/50"
                  >
                    <Text className="text-xs font-bold text-red-600">Remove</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Quotations Section */}
        <View className="gap-2">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
              Quotation
            </Text>
            <View className="flex-row gap-2">
              {detail.quotations.length > 1 && (
                <TouchableOpacity
                  onPress={() => setShowHistoryModal(true)}
                  className="border border-slate-200 px-3 py-1.5 rounded-xl flex-row items-center gap-1 bg-white"
                >
                  <History size={12} color="#64748B" />
                  <Text className="text-xs font-semibold text-slate-600">v{detail.quotations.length}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handlePickQuotation}
                disabled={uploadingQuotation}
                className="bg-primary flex-row items-center gap-1 px-3 py-1.5 rounded-xl active:bg-primary-600"
              >
                {uploadingQuotation ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Upload size={12} color="#FFFFFF" />
                    <Text className="text-xs font-semibold text-white">
                      {currentQuote ? "Replace" : "Upload"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View className="bg-white border border-border rounded-2xl p-4 shadow-xs">
            {!currentQuote ? (
              <Text className="text-sm text-muted-foreground text-center py-2">
                No quotation uploaded yet. Upload PDF, Excel, or Image.
              </Text>
            ) : (
              <View className="flex-row justify-between items-center gap-3">
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <FileText size={28} color="#1E3A5F" />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-800 truncate">
                      {currentQuote.file_name}
                    </Text>
                    <Text className="text-[10px] text-muted-foreground mt-0.5">
                      Version {currentQuote.version} · {new Date(currentQuote.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleOpenQuotation(currentQuote.file_path)}
                  className="bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-xl flex-row items-center gap-1 active:bg-slate-200"
                >
                  <Download size={12} color="#1E3A5F" />
                  <Text className="text-xs font-semibold text-primary">Open</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Site Updates & Log */}
        <View className="gap-2">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-xs uppercase font-bold tracking-wider text-muted-foreground font-semibold">
              Site Updates
            </Text>
            <TouchableOpacity
              onPress={() => setShowUpdateModal(true)}
              className="bg-primary flex-row items-center gap-1 px-3 py-1.5 rounded-xl active:bg-primary-600"
            >
              <Plus size={12} color="#FFFFFF" />
              <Text className="text-xs font-semibold text-white">Add Update</Text>
            </TouchableOpacity>
          </View>

          <View className="bg-white border border-border rounded-2xl p-4 shadow-xs gap-4 divide-y divide-slate-100">
            {detail.updates.length === 0 ? (
              <Text className="text-sm text-muted-foreground text-center py-4">
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
        <View className="flex-1 justify-end bg-black/50">
          <View
            style={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
            className="bg-white rounded-t-3xl p-6 gap-4 border-t border-border max-h-[85%]"
          >
            <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                  <Pencil size={16} color="#1E3A5F" />
                </View>
                <Text className="text-lg font-bold text-foreground">Edit Project</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditModal(false)} className="p-1 rounded-full bg-slate-100">
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerClassName="gap-4 pb-6"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Project Name</Text>
                <TextInput
                  value={projectName}
                  onChangeText={setProjectName}
                  placeholder="Project name"
                  placeholderTextColor="#94A3B8"
                  className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Client Name</Text>
                  <TextInput
                    value={client}
                    onChangeText={setClient}
                    placeholder="Client"
                    placeholderTextColor="#94A3B8"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
                </View>
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Location</Text>
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Location"
                    placeholderTextColor="#94A3B8"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Start Date</Text>
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
                </View>
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Expected End</Text>
                  <TextInput
                    value={expectedEnd}
                    onChangeText={setExpectedEnd}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Contract Value (₹)</Text>
                  <TextInput
                    value={contractValue}
                    onChangeText={setContractValue}
                    placeholder="Contract value"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
                </View>
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-medium text-slate-700">Progress Pct (%)</Text>
                  <TextInput
                    value={String(progressPct)}
                    onChangeText={(val) => setProgressPct(Math.min(100, Math.max(0, Number(val) || 0)))}
                    placeholder="e.g. 50"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    className="h-11 px-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800"
                  />
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
                        status === st ? "bg-primary border-primary" : "bg-white border-slate-200"
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

              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Internal Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Internal comments..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-base text-slate-800 min-h-[80px]"
                />
              </View>
            </ScrollView>

            <View className="flex-row gap-3 pt-3 border-t border-slate-100">
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                className="flex-1 h-12 rounded-xl border border-slate-200 justify-center items-center bg-white"
              >
                <Text className="text-base font-semibold text-slate-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={updateMutation.isPending}
                className={`flex-1 h-12 rounded-xl bg-primary justify-center items-center active:bg-primary-600 ${
                  updateMutation.isPending ? "opacity-50" : ""
                }`}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Crew Modal */}
      <Modal visible={showAssignModal} animationType="slide" transparent onRequestClose={() => setShowAssignModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View
            style={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
            className="bg-white rounded-t-3xl p-6 gap-4 border-t border-border max-h-[80%]"
          >
            <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                  <Users size={16} color="#1E3A5F" />
                </View>
                <Text className="text-lg font-bold text-foreground">Assign Worker</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignModal(false)} className="p-1 rounded-full bg-slate-100">
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerClassName="gap-3 pb-6">
              {loadingWorkers ? (
                <ActivityIndicator size="small" color="#1E3A5F" />
              ) : availableWorkersForAssign.length === 0 ? (
                <Text className="text-sm text-muted-foreground text-center py-8">
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
                    className="p-3 border border-slate-150 rounded-xl bg-slate-50 flex-row justify-between items-center active:bg-slate-100"
                  >
                    <View>
                      <Text className="text-sm font-bold text-slate-800">{w.full_name}</Text>
                      <Text className="text-xs text-slate-400 mt-0.5">
                        {w.worker_type || "Worker"} · {formatCurrency(w.daily_wage)}/day
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#94A3B8" />
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
          className="flex-1 bg-black/40 justify-center items-center"
        >
          <View className="bg-white w-[90%] rounded-2xl p-5 gap-3 max-h-[75%]">
            <Text className="text-base font-bold text-slate-800 pb-2 border-b border-slate-100">
              Quotation History
            </Text>
            <ScrollView contentContainerClassName="gap-3">
              {detail.quotations.map((q: any) => (
                <View key={q.id} className="py-2.5 flex-row justify-between items-center gap-2">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-1.5 flex-wrap">
                      <Text className="text-sm font-bold text-slate-800 truncate">
                        Version {q.version} · {q.file_name}
                      </Text>
                      {q.is_current && (
                        <View className="bg-slate-100 px-2 py-0.5 rounded-full">
                          <Text className="text-[9px] font-bold text-slate-500 uppercase">Current</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-[10px] text-muted-foreground mt-0.5">
                      Uploaded {new Date(q.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <View className="flex-row gap-1">
                    <TouchableOpacity
                      onPress={() => handleOpenQuotation(q.file_path)}
                      className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg"
                    >
                      <Text className="text-xs font-semibold text-primary">Open</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteQuotation(q.id)}
                      className="p-1.5 bg-red-50 border border-red-100 rounded-lg"
                    >
                      <Trash2 size={14} color="#EF4444" />
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
        <View className="flex-1 justify-end bg-black/50">
          <View
            style={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
            className="bg-white rounded-t-3xl p-6 gap-4 border-t border-border"
          >
            {/* Header */}
            <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                  <MessageSquare size={16} color="#1E3A5F" />
                </View>
                <Text className="text-lg font-bold text-slate-800">Add Site Update</Text>
              </View>
              <TouchableOpacity onPress={() => setShowUpdateModal(false)} className="p-1 rounded-full bg-slate-100">
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View className="gap-4">
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Update Description</Text>
                <TextInput
                  value={updateNote}
                  onChangeText={setUpdateNote}
                  placeholder="e.g. Plastering work started, Slab pouring completed..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-base text-slate-800 min-h-[80px]"
                />
              </View>

              {/* Site Photo Selection */}
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-slate-700">Site Photo (optional)</Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={handlePickUpdatePhoto}
                    className="border border-slate-200 border-dashed rounded-xl px-4 py-3 flex-row items-center gap-2 bg-slate-50"
                  >
                    <ImageIcon size={16} color="#1E3A5F" />
                    <Text className="text-xs font-semibold text-slate-600">Select Image</Text>
                  </TouchableOpacity>
                  {selectedPhotoUri && (
                    <View className="flex-row items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1.5 flex-1 pr-6 relative">
                      <Text className="text-xs text-slate-600 truncate flex-1" numberOfLines={1}>
                        {selectedPhotoName}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedPhotoUri(null);
                          setSelectedPhotoName(null);
                          setSelectedPhotoType(null);
                        }}
                        className="absolute right-1 p-0.5 rounded-full bg-slate-200"
                      >
                        <X size={10} color="#64748B" />
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
                    isMilestone ? "bg-primary border-primary" : "border-slate-300"
                  }`}
                >
                  {isMilestone && <Text className="text-white text-[10px] font-bold">✓</Text>}
                </View>
                <Text className="text-sm text-slate-700 font-semibold">Mark as Milestone</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View className="flex-row gap-3 pt-3 border-t border-slate-100">
              <TouchableOpacity
                onPress={() => setShowUpdateModal(false)}
                className="flex-1 h-12 rounded-xl border border-slate-200 justify-center items-center bg-white"
              >
                <Text className="text-base font-semibold text-slate-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveUpdate}
                disabled={uploadingUpdatePhoto}
                className={`flex-1 h-12 rounded-xl bg-primary justify-center items-center active:bg-primary-600 ${
                  uploadingUpdatePhoto ? "opacity-50" : ""
                }`}
              >
                {uploadingUpdatePhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">Save Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Single Update Row Component ── */
function UpdateRow({ update }: { update: any }) {
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
    <View className="py-4 flex-row gap-3 bg-white">
      <View className="mt-1 shrink-0">
        {update.is_milestone ? (
          <View className="w-7 h-7 rounded-full bg-primary/10 items-center justify-center">
            <Milestone size={14} color="#1E3A5F" />
          </View>
        ) : (
          <View className="w-7 h-7 rounded-full bg-slate-100 items-center justify-center">
            <MessageSquare size={14} color="#64748B" />
          </View>
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-semibold text-slate-800 leading-normal">
          {update.note}
        </Text>
        <Text className="text-[10px] text-muted-foreground mt-1">
          {new Date(update.created_at).toLocaleString()}
        </Text>
        {update.photo_path && (
          <View className="mt-3.5 border border-slate-100 rounded-xl overflow-hidden bg-slate-50 min-h-[100px] justify-center items-center">
            {loadingPhoto ? (
              <ActivityIndicator size="small" color="#1E3A5F" />
            ) : photoUrl ? (
              <Image source={{ uri: photoUrl }} className="w-full h-44" resizeMode="cover" />
            ) : (
              <Text className="text-xs text-slate-400">Unable to load photo</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
