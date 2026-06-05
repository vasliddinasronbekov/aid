"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bed,
  Bell,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Hospital,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Radio,
  Send,
  ShieldAlert,
  Stethoscope,
  UserRound,
  UsersRound,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RealtimeMessage, useWebSockets } from "@/hooks/useWebSockets";
import { useAuthGate } from "@/hooks/useAuth";
import {
  completeClinicalTask,
  createClinicalTask,
  escalateAIErrorLog,
  listAdmissions,
  listAIErrorLogs,
  listAppointments,
  listClinicalTasks,
  listDepartments,
  listFeedbackSummary,
  listHospitals,
  listMedicalRecords,
  listPatronageVisits,
  listPatients,
  listPerinatalRegistry,
  listRCAErrorSummary,
  listRooms,
  listStaffProfiles,
  notificationsUrl,
  startClinicalTask,
  updateAIErrorLog,
} from "@/lib/api";
import type {
  Admission,
  AIErrorLog,
  BackendAppointment,
  ClinicalTask,
  FeedbackSummary,
  Hospital as HospitalRecord,
  MedicalRecord,
  Patient,
  PatronageVisit,
  PerinatalRegistryEntry,
  RCAErrorSummary,
  Room,
  StaffProfile,
} from "@/lib/api";

type AdminTab = "safety" | "operations" | "feedback" | "resources";
type SafetyCaseStatus = "Yangi" | "Ko'rildi" | "RCA ochildi" | "Managerga biriktirildi";
type SafetyDataSource = "api" | "realtime";

interface FeedItem {
  id: string;
  type: "ai" | "call" | "feedback" | "system";
  title: string;
  detail: string;
  severity: "critical" | "warning" | "ok";
  time: string;
}

interface SafetyCase {
  id: string;
  logId?: number;
  medicalRecordId?: number;
  patientId?: number;
  patient: string;
  doctor: string;
  signal: string;
  evidence: string;
  protocol: string;
  severity: "critical" | "warning";
  status: SafetyCaseStatus;
  owner: string;
  createdAt: string;
  source: SafetyDataSource;
}

interface FeedbackRoomSummary {
  department: string;
  room: string;
  average: number;
  count: number;
}

interface OperationalItem {
  id: string;
  kind: "AI task" | "Admission" | "Perinatal" | "Patronage" | "Appointment";
  title: string;
  detail: string;
  patientId?: number;
  priority: string;
  status: string;
  dueAt: string;
  task?: ClinicalTask;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Request failed");
}

function fulfilledOrNull<T>(result: PromiseSettledResult<T>, label: string, notes: string[]) {
  if (result.status === "fulfilled") {
    return result.value;
  }
  notes.push(`${label}: ${errorMessage(result.reason)}`);
  return null;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function dueInHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function severityClasses(severity: FeedItem["severity"]) {
  if (severity === "critical") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (severity === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function safetySeverityClasses(severity: SafetyCase["severity"]) {
  return severity === "critical" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900";
}

function priorityClasses(priority: string) {
  const normalized = priority.toUpperCase();
  if (["CRITICAL", "HIGH", "URGENT", "STAT"].includes(normalized)) {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (["SOON", "MODERATE", "YELLOW", "WATCHLIST"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-clinical-line bg-slate-50 text-clinical-slate";
}

function normalizeSafetySeverity(severity?: string): SafetyCase["severity"] {
  return severity === "CRITICAL" ? "critical" : "warning";
}

function safetyErrorLabel(errorType: AIErrorLog["error_type"]) {
  const labels: Record<AIErrorLog["error_type"], string> = {
    ENTRY_OMISSION: "Clinical entry omission",
    PRESCRIPTION_MISMATCH: "Prescription mismatch",
    ETHICAL_DEVIATION: "Ethical deviation",
    IMAGING_SAFETY: "Imaging safety",
    DIGITAL_TWIN_RISK: "Digital Twin risk",
  };
  return labels[errorType];
}

function feedbackSummaryToRoom(summary: FeedbackSummary): FeedbackRoomSummary {
  return {
    department: summary.department || summary.target_type,
    room: summary.room_qr_id || (summary.target_staff_profile ? `Doctor ${summary.target_staff_profile}` : "General"),
    average: summary.avg_rating ?? 0,
    count: summary.total,
  };
}

function rcaCategoryLabel(errorType: RCAErrorSummary["error_type"]) {
  return safetyErrorLabel(errorType);
}

function rcaCategoryColor(index: number) {
  return ["bg-clinical-blue", "bg-clinical-cyan", "bg-clinical-amber", "bg-clinical-red"][index % 4];
}

function sourceLogIdFromTask(task: ClinicalTask) {
  const rawValue = task.metadata?.source_ai_error_log_id ?? task.metadata?.ai_error_log_id;
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }
  if (typeof rawValue === "string") {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function statusFromLogAndTasks(log: AIErrorLog, tasks: ClinicalTask[]): SafetyCaseStatus {
  const relatedTasks = tasks.filter((task) => sourceLogIdFromTask(task) === log.id && task.status !== "CANCELLED");
  if (relatedTasks.some((task) => task.metadata?.workflow === "manager_assignment" || task.task_type === "ADMIN")) {
    return "Managerga biriktirildi";
  }
  if (relatedTasks.some((task) => task.metadata?.workflow === "root_cause_analysis" || task.title.toLowerCase().includes("rca"))) {
    return "RCA ochildi";
  }
  return log.reviewed_by_admin ? "Ko'rildi" : "Yangi";
}

function safetyCaseFromAIErrorLog(log: AIErrorLog, records: MedicalRecord[], tasks: ClinicalTask[]): SafetyCase {
  const record = records.find((item) => item.id === log.medical_record);
  const status = statusFromLogAndTasks(log, tasks);
  return {
    id: `log-${log.id}`,
    logId: log.id,
    medicalRecordId: log.medical_record,
    patientId: record?.patient,
    patient: log.patient_name,
    doctor: record?.doctor_id || log.doctor_id || "Unknown doctor",
    signal: safetyErrorLabel(log.error_type),
    evidence: log.rca_description,
    protocol: log.protocol_reference || "AID-SAFETY-REVIEW",
    severity: normalizeSafetySeverity(log.severity),
    status,
    owner: status === "Managerga biriktirildi" ? "Care manager" : "Head physician",
    createdAt: formatDateTime(log.created_at),
    source: "api",
  };
}

function safetyTaskPriority(safetyCase: SafetyCase): ClinicalTask["priority"] {
  return safetyCase.severity === "critical" ? "CRITICAL" : "URGENT";
}

function openTask(task: ClinicalTask) {
  return !["COMPLETED", "CANCELLED"].includes(task.status);
}

function priorityRank(priority: string) {
  const normalized = priority.toUpperCase();
  if (normalized === "CRITICAL" || normalized === "STAT") {
    return 5;
  }
  if (normalized === "URGENT" || normalized === "HIGH") {
    return 4;
  }
  if (normalized === "SOON" || normalized === "MODERATE") {
    return 3;
  }
  if (normalized === "ROUTINE" || normalized === "LOW") {
    return 2;
  }
  return 1;
}

function patientLink(patientId?: number) {
  return patientId ? `/doctor/patient/${patientId}` : undefined;
}

export default function AdminCommandCenterPage() {
  const { user, loading: authLoading, signOut } = useAuthGate({
    allowedRoles: ["SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HEAD_PHYSICIAN", "COMPLIANCE_OFFICER", "AUDITOR"],
  });
  const [activeTab, setActiveTab] = useState<AdminTab>("safety");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [safetyCases, setSafetyCases] = useState<SafetyCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [roomAverages, setRoomAverages] = useState<FeedbackRoomSummary[]>([]);
  const [rcaCategories, setRcaCategories] = useState<{ label: string; count: number; color: string }[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [appointments, setAppointments] = useState<BackendAppointment[]>([]);
  const [clinicalTasks, setClinicalTasks] = useState<ClinicalTask[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [perinatalEntries, setPerinatalEntries] = useState<PerinatalRegistryEntry[]>([]);
  const [patronageVisits, setPatronageVisits] = useState<PatronageVisit[]>([]);
  const [hospitals, setHospitals] = useState<HospitalRecord[]>([]);
  const [departmentsCount, setDepartmentsCount] = useState(0);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [safetyDataSource, setSafetyDataSource] = useState<SafetyDataSource>("api");
  const [loading, setLoading] = useState(true);
  const [loadNotes, setLoadNotes] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const { status: socketStatus, lastMessage } = useWebSockets<RealtimeMessage>({
    url: notificationsUrl("head_physicians"),
  });

  useEffect(() => {
    let active = true;

    setLoading(true);
    Promise.allSettled([
      listAIErrorLogs(""),
      listFeedbackSummary(),
      listRCAErrorSummary(),
      listPatients(),
      listMedicalRecords(),
      listAppointments(),
      listClinicalTasks(),
      listAdmissions(),
      listPerinatalRegistry(),
      listPatronageVisits(),
      listHospitals(),
      listDepartments(),
      listRooms(),
      listStaffProfiles(),
    ])
      .then((results) => {
        if (!active) {
          return;
        }

        const notes: string[] = [];
        const [
          aiResult,
          feedbackResult,
          rcaResult,
          patientsResult,
          recordsResult,
          appointmentsResult,
          tasksResult,
          admissionsResult,
          perinatalResult,
          patronageResult,
          hospitalsResult,
          departmentsResult,
          roomsResult,
          staffResult,
        ] = results;
        const nextRecords = fulfilledOrNull(recordsResult, "Medical records", notes)?.results ?? [];
        const nextTasks = fulfilledOrNull(tasksResult, "Clinical tasks", notes)?.results ?? [];
        const nextCases =
          fulfilledOrNull(aiResult, "AI safety logs", notes)?.results
            .filter((log) => log.severity === "HIGH" || log.severity === "CRITICAL")
            .map((log) => safetyCaseFromAIErrorLog(log, nextRecords, nextTasks)) ?? [];

        setSafetyCases(nextCases);
        setSelectedCaseId((current) => (nextCases.some((item) => item.id === current) ? current : nextCases[0]?.id ?? ""));
        setRoomAverages((fulfilledOrNull(feedbackResult, "Feedback summary", notes) ?? []).map(feedbackSummaryToRoom));
        setRcaCategories(
          (fulfilledOrNull(rcaResult, "RCA summary", notes) ?? []).map((item, index) => ({
            label: rcaCategoryLabel(item.error_type),
            count: item.total,
            color: rcaCategoryColor(index),
          })),
        );
        setPatients(fulfilledOrNull(patientsResult, "Patients", notes)?.results ?? []);
        setMedicalRecords(nextRecords);
        setAppointments(fulfilledOrNull(appointmentsResult, "Appointments", notes)?.results ?? []);
        setClinicalTasks(nextTasks);
        setAdmissions(fulfilledOrNull(admissionsResult, "Admissions", notes)?.results ?? []);
        setPerinatalEntries(fulfilledOrNull(perinatalResult, "Perinatal registry", notes)?.results ?? []);
        setPatronageVisits(fulfilledOrNull(patronageResult, "Patronage visits", notes)?.results ?? []);
        setHospitals(fulfilledOrNull(hospitalsResult, "Hospitals", notes)?.results ?? []);
        setDepartmentsCount(fulfilledOrNull(departmentsResult, "Departments", notes)?.count ?? 0);
        setRooms(fulfilledOrNull(roomsResult, "Rooms", notes)?.results ?? []);
        setStaffProfiles(fulfilledOrNull(staffResult, "Staff profiles", notes)?.results ?? []);
        setSafetyDataSource("api");
        setLoadNotes(notes);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!lastMessage) {
      return;
    }

    const now = formatDateTime(new Date().toISOString());

    if (lastMessage.type === "critical_ai_error") {
      const payload = lastMessage.payload as {
        patient_name?: string;
        doctor_id?: string;
        errors?: { id?: number; rca_description: string; severity: string; protocol_reference?: string }[];
      };
      const firstError = payload.errors?.[0];
      const caseId = typeof firstError?.id === "number" ? `log-${firstError.id}` : `case-${Date.now()}`;
      setSafetyDataSource("realtime");
      setFeed((current) => [
        {
          id: `ai-${Date.now()}`,
          type: "ai",
          title: payload.patient_name ?? "Critical AI review",
          detail: firstError?.rca_description ?? "Safety protocol deviation detected.",
          severity: firstError?.severity === "CRITICAL" ? "critical" : "warning",
          time: now,
        },
        ...current,
      ]);
      setSafetyCases((current) => [
        {
          id: caseId,
          logId: firstError?.id,
          patient: payload.patient_name ?? "Critical AI review",
          doctor: payload.doctor_id ?? "Unknown doctor",
          signal: firstError?.severity === "CRITICAL" ? "Critical clinical safety signal" : "High clinical safety signal",
          evidence: firstError?.rca_description ?? "Safety protocol deviation detected.",
          protocol: firstError?.protocol_reference || "AID-SAFETY-REVIEW",
          severity: normalizeSafetySeverity(firstError?.severity),
          status: "Yangi",
          owner: "Head physician",
          createdAt: now,
          source: "realtime",
        },
        ...current.filter((item) => item.id !== caseId),
      ]);
      setSelectedCaseId(caseId);
    }

    if (lastMessage.type === "active_call_alert") {
      const payload = lastMessage.payload as { patient_name?: string; region_code?: string };
      setFeed((current) => [
        {
          id: `call-${Date.now()}`,
          type: "call",
          title: "Active call",
          detail: `${payload.patient_name ?? "High-risk patient"} routed to ${payload.region_code ?? "regional doctors"}.`,
          severity: "critical",
          time: now,
        },
        ...current,
      ]);
    }

    if (lastMessage.type === "feedback_submitted") {
      const payload = lastMessage.payload as { department?: string; room_qr_id?: string; rating?: number };
      setFeed((current) => [
        {
          id: `feedback-${Date.now()}`,
          type: "feedback",
          title: "Anonymous feedback",
          detail: `${payload.department ?? "Department"} ${payload.room_qr_id ?? ""} received ${payload.rating ?? "-"} stars.`,
          severity: (payload.rating ?? 5) <= 3 ? "warning" : "ok",
          time: now,
        },
        ...current,
      ]);
    }
  }, [lastMessage]);

  const selectedCase = safetyCases.find((item) => item.id === selectedCaseId) ?? safetyCases[0];
  const openSafetyCases = safetyCases.filter((item) => item.status !== "Ko'rildi").length;
  const criticalSafetyCases = safetyCases.filter((item) => item.severity === "critical").length;
  const redPatients = patients.filter((patient) => patient.triage_status === "RED").length;
  const yellowPatients = patients.filter((patient) => patient.triage_status === "YELLOW").length;
  const activeAppointments = appointments.filter((appointment) =>
    ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"].includes(appointment.status),
  ).length;
  const openClinicalTasks = clinicalTasks.filter(openTask).length;
  const criticalTasks = clinicalTasks.filter((task) => openTask(task) && task.priority === "CRITICAL").length;
  const waitingAdmissions = admissions.filter((admission) => ["REQUESTED", "WAITLISTED"].includes(admission.status)).length;
  const admittedPatients = admissions.filter((admission) => admission.status === "ADMITTED").length;
  const highRiskPerinatal = perinatalEntries.filter((entry) => ["HIGH", "CRITICAL"].includes(entry.risk_level)).length;
  const offlinePatronage = patronageVisits.filter((visit) => ["OFFLINE_QUEUED", "CONFLICT"].includes(visit.status)).length;
  const bedCapacity = rooms.reduce((total, room) => total + room.bed_count, 0);
  const occupancyPercent = bedCapacity ? Math.min(100, Math.round((admittedPatients / bedCapacity) * 100)) : 0;
  const lowFeedbackRooms = roomAverages.filter((room) => room.average > 0 && room.average < 3.5).length;
  const safetySourceLabel = safetyDataSource === "api" ? "Backend AI safety logs" : "Realtime escalation stream";
  const maxRcaCount = Math.max(1, ...rcaCategories.map((category) => category.count));

  const operationRows = useMemo<OperationalItem[]>(() => {
    const taskRows = clinicalTasks
      .filter(openTask)
      .map((task) => ({
        id: `task-${task.id}`,
        kind: "AI task" as const,
        title: task.title,
        detail: task.description || task.task_type,
        patientId: task.patient ?? undefined,
        priority: task.priority,
        status: task.status,
        dueAt: formatDateTime(task.due_at || task.created_at),
        task,
      }));
    const admissionRows = admissions
      .filter((admission) => ["REQUESTED", "WAITLISTED", "ADMITTED"].includes(admission.status))
      .map((admission) => ({
        id: `admission-${admission.id}`,
        kind: "Admission" as const,
        title: admission.patient_name,
        detail: admission.reason || admission.department_name || "Hospital admission",
        patientId: admission.patient,
        priority: admission.priority,
        status: admission.status,
        dueAt: formatDateTime(admission.requested_at),
      }));
    const perinatalRows = perinatalEntries
      .filter((entry) => ["HIGH", "CRITICAL"].includes(entry.risk_level) || entry.status === "WATCHLIST")
      .map((entry) => ({
        id: `perinatal-${entry.id}`,
        kind: "Perinatal" as const,
        title: entry.patient_name,
        detail: `${entry.gestational_age_weeks}w ${entry.gestational_age_days}d · ${entry.risk_factors.slice(0, 2).join(", ") || "Risk watch"}`,
        patientId: entry.patient,
        priority: entry.risk_level,
        status: entry.status,
        dueAt: formatDateTime(entry.next_visit_at || entry.updated_at),
      }));
    const patronageRows = patronageVisits
      .filter((visit) => ["OFFLINE_QUEUED", "CONFLICT"].includes(visit.status) || ["URGENT", "CRITICAL"].includes(visit.priority))
      .map((visit) => ({
        id: `patronage-${visit.id}`,
        kind: "Patronage" as const,
        title: visit.patient_name,
        detail: `${visit.visit_type} · ${visit.territory || "Territory not set"}`,
        patientId: visit.patient,
        priority: visit.priority,
        status: visit.status,
        dueAt: formatDateTime(visit.scheduled_for),
      }));
    const appointmentRows = appointments
      .filter((appointment) => ["URGENT", "CRITICAL"].includes(appointment.priority) && appointment.status !== "COMPLETED")
      .map((appointment) => ({
        id: `appointment-${appointment.id}`,
        kind: "Appointment" as const,
        title: appointment.patient_name,
        detail: appointment.reason || appointment.appointment_type,
        patientId: appointment.patient,
        priority: appointment.priority,
        status: appointment.status,
        dueAt: formatDateTime(appointment.scheduled_start),
      }));

    return [...taskRows, ...admissionRows, ...perinatalRows, ...patronageRows, ...appointmentRows]
      .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
      .slice(0, 24);
  }, [admissions, appointments, clinicalTasks, patronageVisits, perinatalEntries]);

  const staffByRole = useMemo(() => {
    return staffProfiles.reduce<Record<string, number>>((accumulator, profile) => {
      accumulator[profile.role] = (accumulator[profile.role] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [staffProfiles]);

  const setSafetyCaseStatus = (caseId: string, status: SafetyCaseStatus) => {
    setSafetyCases((current) =>
      current.map((safetyCase) =>
        safetyCase.id === caseId
          ? {
              ...safetyCase,
              status,
              owner: status === "Managerga biriktirildi" ? "Care manager" : "Head physician",
            }
          : safetyCase,
      ),
    );
  };

  const handleSafetyAction = async (safetyCase: SafetyCase, status: SafetyCaseStatus) => {
    const actionId = `${safetyCase.id}-${status}`;
    setBusyAction(actionId);
    setActionMessage("");
    try {
      if (status === "Ko'rildi") {
        if (safetyCase.logId) {
          await updateAIErrorLog(safetyCase.logId, { reviewed_by_admin: true });
        }
        setSafetyCaseStatus(safetyCase.id, status);
        setActionMessage(`${safetyCase.patient}: AI safety case marked reviewed.`);
        return;
      }

      if (!safetyCase.patientId) {
        throw new Error("Patient link is missing. Reload after the AI log is synced with its medical record.");
      }

      const workflow = status === "RCA ochildi" ? "root_cause_analysis" : "manager_assignment";
      const task = await createClinicalTask({
        patient: safetyCase.patientId,
        task_type: status === "RCA ochildi" ? "CARE_PLAN" : "ADMIN",
        priority: safetyTaskPriority(safetyCase),
        title: status === "RCA ochildi" ? `RCA review: ${safetyCase.signal}` : `Manager follow-up: ${safetyCase.signal}`,
        description: [
          `AI detected: ${safetyCase.evidence}`,
          `Doctor: ${safetyCase.doctor}`,
          `Protocol: ${safetyCase.protocol}`,
        ].join("\n"),
        due_at: dueInHours(safetyCase.severity === "critical" ? 4 : 24),
        metadata: {
          source: "admin_command_center",
          source_ai_error_log_id: safetyCase.logId ?? null,
          source_medical_record_id: safetyCase.medicalRecordId ?? null,
          workflow,
        },
      });
      setClinicalTasks((current) => [task, ...current]);
      setSafetyCaseStatus(safetyCase.id, status);
      setActionMessage(`${safetyCase.patient}: backend task created for ${status.toLowerCase()}.`);
    } catch (error) {
      setActionMessage(errorMessage(error));
    } finally {
      setBusyAction("");
    }
  };

  const handleBroadcastSafetyCase = async (safetyCase: SafetyCase) => {
    if (!safetyCase.logId) {
      setActionMessage("This realtime case does not have a backend AI log id yet.");
      return;
    }
    setBusyAction(`${safetyCase.id}-broadcast`);
    setActionMessage("");
    try {
      await escalateAIErrorLog(safetyCase.logId);
      setActionMessage(`${safetyCase.patient}: escalation sent to the head physician channel.`);
    } catch (error) {
      setActionMessage(errorMessage(error));
    } finally {
      setBusyAction("");
    }
  };

  const handleTaskStart = async (task: ClinicalTask) => {
    setBusyAction(`task-start-${task.id}`);
    setActionMessage("");
    try {
      const updated = await startClinicalTask(task.id);
      setClinicalTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setActionMessage(`${task.title}: task started.`);
    } catch (error) {
      setActionMessage(errorMessage(error));
    } finally {
      setBusyAction("");
    }
  };

  const handleTaskComplete = async (task: ClinicalTask) => {
    setBusyAction(`task-complete-${task.id}`);
    setActionMessage("");
    try {
      const updated = await completeClinicalTask(task.id, "Completed from admin command center.");
      setClinicalTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setActionMessage(`${task.title}: task completed.`);
    } catch (error) {
      setActionMessage(errorMessage(error));
    } finally {
      setBusyAction("");
    }
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-clinical-wash px-4 text-clinical-ink">
        <div className="rounded-md border border-clinical-line bg-white px-5 py-4 text-sm text-clinical-slate shadow-sm">
          Command center loading
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-clinical-wash">
      <header className="border-b border-clinical-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-clinical-ink text-white">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-clinical-ink">Command Center</h1>
              <p className="text-sm text-clinical-slate">Head physician, hospital admin, and manager workspace</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit items-center gap-2 rounded-md border border-clinical-line bg-white px-3 py-2 text-sm text-clinical-slate">
              <Radio className="h-4 w-4 text-clinical-cyan" />
              {socketStatus}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex w-fit items-center gap-2 rounded-md border border-clinical-line bg-white px-3 py-2 text-sm font-semibold text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
            >
              <UserRound className="h-4 w-4" />
              {user?.display_name || user?.username || "Account"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-clinical-slate">Open safety</span>
              <Bot className="h-5 w-5 text-clinical-blue" />
            </div>
            <strong className="mt-3 block text-3xl text-clinical-ink">{openSafetyCases}</strong>
            <p className="mt-1 text-xs text-clinical-slate">{criticalSafetyCases} critical</p>
          </div>
          <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-clinical-slate">Red patients</span>
              <HeartPulse className="h-5 w-5 text-clinical-red" />
            </div>
            <strong className="mt-3 block text-3xl text-clinical-ink">{redPatients}</strong>
            <p className="mt-1 text-xs text-clinical-slate">{yellowPatients} yellow watch</p>
          </div>
          <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-clinical-slate">Open tasks</span>
              <ListChecks className="h-5 w-5 text-clinical-cyan" />
            </div>
            <strong className="mt-3 block text-3xl text-clinical-ink">{openClinicalTasks}</strong>
            <p className="mt-1 text-xs text-clinical-slate">{criticalTasks} critical</p>
          </div>
          <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-clinical-slate">Admissions</span>
              <Bed className="h-5 w-5 text-clinical-amber" />
            </div>
            <strong className="mt-3 block text-3xl text-clinical-ink">{waitingAdmissions}</strong>
            <p className="mt-1 text-xs text-clinical-slate">{occupancyPercent}% bed occupancy</p>
          </div>
          <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-clinical-slate">Perinatal high</span>
              <Stethoscope className="h-5 w-5 text-clinical-red" />
            </div>
            <strong className="mt-3 block text-3xl text-clinical-ink">{highRiskPerinatal}</strong>
            <p className="mt-1 text-xs text-clinical-slate">{offlinePatronage} offline patronage</p>
          </div>
          <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-clinical-slate">Feedback risk</span>
              <MessageSquareText className="h-5 w-5 text-clinical-blue" />
            </div>
            <strong className="mt-3 block text-3xl text-clinical-ink">{lowFeedbackRooms}</strong>
            <p className="mt-1 text-xs text-clinical-slate">{feed.length} realtime events</p>
          </div>
        </section>

        <div className="mt-4 flex flex-col gap-2 rounded-md border border-clinical-line bg-white px-4 py-3 text-sm text-clinical-slate shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <span className="inline-flex items-center gap-2">
            <Radio className="h-4 w-4 text-clinical-cyan" />
            {loading ? "Admin data sinxronlanmoqda" : safetySourceLabel}
          </span>
          {actionMessage ? <span className="font-medium text-clinical-ink">{actionMessage}</span> : null}
          {loadNotes.length ? <span className="text-xs">Some restricted modules are hidden for this role.</span> : null}
        </div>

        <nav className="mt-4 flex flex-wrap gap-2">
          {[
            ["safety", "AI safety", ShieldAlert],
            ["operations", "Operations", LayoutDashboard],
            ["feedback", "Feedback/RCA", BarChart3],
            ["resources", "Resources", Building2],
          ].map(([value, label, Icon]) => (
            <button
              key={value as string}
              type="button"
              onClick={() => setActiveTab(value as AdminTab)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                activeTab === value
                  ? "border-clinical-blue bg-blue-50 text-clinical-blue"
                  : "border-clinical-line bg-white text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label as string}
            </button>
          ))}
        </nav>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <section className="space-y-4">
            {activeTab === "safety" ? (
              <section className="rounded-md border border-clinical-line bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
                  <ShieldAlert className="h-5 w-5 text-clinical-red" />
                  <h2 className="text-sm font-semibold text-clinical-ink">AI doctor-shortcoming inbox</h2>
                </div>
                <div className="divide-y divide-clinical-line">
                  {safetyCases.length ? (
                    safetyCases.map((item) => (
                      <article key={item.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_150px_220px] lg:items-center">
                        <button type="button" onClick={() => setSelectedCaseId(item.id)} className="min-w-0 text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${safetySeverityClasses(item.severity)}`}>
                              {item.severity}
                            </span>
                            <h3 className="text-sm font-semibold text-clinical-ink">{item.patient}</h3>
                          </div>
                          <p className="mt-1 text-sm text-clinical-slate">{item.signal}</p>
                          <p className="mt-1 text-xs text-clinical-slate">
                            {item.doctor} · {item.protocol} · {item.createdAt}
                          </p>
                        </button>
                        <span className="rounded-md border border-clinical-line bg-slate-50 px-2 py-1 text-center text-xs font-semibold text-clinical-slate">
                          {item.status}
                        </span>
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void handleSafetyAction(item, "Ko'rildi")}
                            disabled={busyAction === `${item.id}-Ko'rildi`}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-green hover:text-clinical-green disabled:opacity-40"
                            title="Mark reviewed"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSafetyAction(item, "RCA ochildi")}
                            disabled={!item.patientId || busyAction === `${item.id}-RCA ochildi`}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue disabled:opacity-40"
                            title="Open RCA task"
                          >
                            <ClipboardList className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSafetyAction(item, "Managerga biriktirildi")}
                            disabled={!item.patientId || busyAction === `${item.id}-Managerga biriktirildi`}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-amber hover:text-clinical-amber disabled:opacity-40"
                            title="Assign manager task"
                          >
                            <Bell className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleBroadcastSafetyCase(item)}
                            disabled={!item.logId || busyAction === `${item.id}-broadcast`}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-red hover:text-clinical-red disabled:opacity-40"
                            title="Send escalation"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-sm text-clinical-slate">Ochiq high/critical AI safety case yo'q.</div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "operations" ? (
              <section className="rounded-md border border-clinical-line bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
                  <LayoutDashboard className="h-5 w-5 text-clinical-blue" />
                  <h2 className="text-sm font-semibold text-clinical-ink">Operational command queue</h2>
                </div>
                <div className="divide-y divide-clinical-line">
                  {operationRows.length ? (
                    operationRows.map((item) => {
                      const href = patientLink(item.patientId);
                      return (
                        <article key={item.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[110px_1fr_110px_170px] lg:items-center">
                          <span className="text-xs font-semibold uppercase text-clinical-slate">{item.kind}</span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-clinical-ink">{item.title}</h3>
                              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityClasses(item.priority)}`}>
                                {item.priority}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-clinical-slate">{item.detail}</p>
                            <p className="mt-1 text-xs text-clinical-slate">{item.dueAt}</p>
                          </div>
                          <span className="rounded-md border border-clinical-line bg-slate-50 px-2 py-1 text-center text-xs font-semibold text-clinical-slate">
                            {item.status}
                          </span>
                          <div className="flex flex-wrap justify-end gap-1">
                            {item.task && item.task.status === "OPEN" ? (
                              <button
                                type="button"
                                onClick={() => void handleTaskStart(item.task as ClinicalTask)}
                                disabled={busyAction === `task-start-${item.task.id}`}
                                className="rounded-md border border-clinical-line px-2 py-1 text-xs font-semibold text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue disabled:opacity-40"
                              >
                                Start
                              </button>
                            ) : null}
                            {item.task && item.task.status !== "COMPLETED" ? (
                              <button
                                type="button"
                                onClick={() => void handleTaskComplete(item.task as ClinicalTask)}
                                disabled={busyAction === `task-complete-${item.task.id}`}
                                className="rounded-md border border-clinical-line px-2 py-1 text-xs font-semibold text-clinical-slate hover:border-clinical-green hover:text-clinical-green disabled:opacity-40"
                              >
                                Done
                              </button>
                            ) : null}
                            {href ? (
                              <a
                                href={href}
                                className="rounded-md border border-clinical-line px-2 py-1 text-xs font-semibold text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                              >
                                Chart
                              </a>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="px-4 py-8 text-sm text-clinical-slate">No open operational queue items.</div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "feedback" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-md border border-clinical-line bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
                    <BarChart3 className="h-5 w-5 text-clinical-blue" />
                    <h2 className="text-sm font-semibold text-clinical-ink">Anonymous feedback by room</h2>
                  </div>
                  <div className="space-y-3 p-4">
                    {roomAverages.length ? (
                      roomAverages.map((room) => (
                        <div key={`${room.department}-${room.room}`}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 font-medium text-clinical-ink">
                              {room.department} {room.room}
                            </span>
                            <span className="shrink-0 text-clinical-slate">
                              {room.average.toFixed(1)} · {room.count}
                            </span>
                          </div>
                          <div className="h-2 rounded-sm bg-slate-100">
                            <div className="h-2 rounded-sm bg-clinical-blue" style={{ width: `${(room.average / 5) * 100}%` }} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-clinical-slate">No feedback summary yet.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-md border border-clinical-line bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 text-clinical-green" />
                    <h2 className="text-sm font-semibold text-clinical-ink">RCA categories</h2>
                  </div>
                  <div className="space-y-3 p-4">
                    {rcaCategories.length ? (
                      rcaCategories.map((category) => (
                        <div key={category.label}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-clinical-ink">{category.label}</span>
                            <span className="text-clinical-slate">{category.count}</span>
                          </div>
                          <div className="h-2 rounded-sm bg-slate-100">
                            <div
                              className={`h-2 rounded-sm ${category.color}`}
                              style={{ width: `${Math.max(8, (category.count / maxRcaCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-clinical-slate">No RCA category data yet.</p>
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            {activeTab === "resources" ? (
              <section className="rounded-md border border-clinical-line bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
                  <Building2 className="h-5 w-5 text-clinical-blue" />
                  <h2 className="text-sm font-semibold text-clinical-ink">Organization resources</h2>
                </div>
                <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border border-clinical-line p-3">
                    <span className="text-xs text-clinical-slate">Hospitals</span>
                    <strong className="mt-2 block text-2xl text-clinical-ink">{hospitals.length}</strong>
                  </div>
                  <div className="rounded-md border border-clinical-line p-3">
                    <span className="text-xs text-clinical-slate">Departments</span>
                    <strong className="mt-2 block text-2xl text-clinical-ink">{departmentsCount}</strong>
                  </div>
                  <div className="rounded-md border border-clinical-line p-3">
                    <span className="text-xs text-clinical-slate">Rooms / beds</span>
                    <strong className="mt-2 block text-2xl text-clinical-ink">
                      {rooms.length} / {bedCapacity}
                    </strong>
                  </div>
                  <div className="rounded-md border border-clinical-line p-3">
                    <span className="text-xs text-clinical-slate">Active staff</span>
                    <strong className="mt-2 block text-2xl text-clinical-ink">
                      {staffProfiles.filter((profile) => profile.employment_status === "ACTIVE").length}
                    </strong>
                  </div>
                </div>
                <div className="grid gap-4 px-4 pb-4 lg:grid-cols-2">
                  <div className="rounded-md border border-clinical-line">
                    <div className="border-b border-clinical-line px-3 py-2 text-sm font-semibold text-clinical-ink">Facilities</div>
                    <div className="divide-y divide-clinical-line">
                      {hospitals.slice(0, 8).map((hospital) => (
                        <article key={hospital.id} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
                          <div>
                            <h3 className="text-sm font-semibold text-clinical-ink">{hospital.name}</h3>
                            <p className="text-xs text-clinical-slate">
                              {hospital.facility_type} · {hospital.region_code || hospital.city || "Region not set"}
                            </p>
                          </div>
                          <span className={hospital.is_active ? "text-xs font-semibold text-clinical-green" : "text-xs font-semibold text-clinical-slate"}>
                            {hospital.is_active ? "Active" : "Inactive"}
                          </span>
                        </article>
                      ))}
                      {!hospitals.length ? <div className="px-3 py-6 text-sm text-clinical-slate">No facility access for this role.</div> : null}
                    </div>
                  </div>
                  <div className="rounded-md border border-clinical-line">
                    <div className="border-b border-clinical-line px-3 py-2 text-sm font-semibold text-clinical-ink">Staff roles</div>
                    <div className="space-y-2 p-3">
                      {Object.entries(staffByRole).length ? (
                        Object.entries(staffByRole).map(([role, count]) => (
                          <div key={role} className="flex items-center justify-between rounded-md border border-clinical-line px-3 py-2 text-sm">
                            <span className="font-medium text-clinical-ink">{role}</span>
                            <span className="text-clinical-slate">{count}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-clinical-slate">Staff inventory is available to hospital admins.</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </section>

          <aside className="space-y-4">
            <section className="rounded-md border border-clinical-line bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
                <AlertTriangle className="h-5 w-5 text-clinical-red" />
                <h2 className="text-sm font-semibold text-clinical-ink">Selected safety case</h2>
              </div>
              {selectedCase ? (
                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-clinical-ink">{selectedCase.patient}</h3>
                    <p className="mt-1 text-sm text-clinical-slate">{selectedCase.signal}</p>
                  </div>
                  <div className="rounded-md border border-clinical-line bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase text-clinical-slate">Evidence</p>
                    <p className="mt-1 text-sm text-clinical-ink">{selectedCase.evidence}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md border border-clinical-line px-3 py-2">
                      <span className="block text-[11px] text-clinical-slate">Owner</span>
                      <strong className="mt-1 block text-clinical-ink">{selectedCase.owner}</strong>
                    </div>
                    <div className="rounded-md border border-clinical-line px-3 py-2">
                      <span className="block text-[11px] text-clinical-slate">Status</span>
                      <strong className="mt-1 block text-clinical-ink">{selectedCase.status}</strong>
                    </div>
                    <div className="rounded-md border border-clinical-line px-3 py-2">
                      <span className="block text-[11px] text-clinical-slate">Doctor</span>
                      <strong className="mt-1 block text-clinical-ink">{selectedCase.doctor}</strong>
                    </div>
                    <div className="rounded-md border border-clinical-line px-3 py-2">
                      <span className="block text-[11px] text-clinical-slate">Source</span>
                      <strong className="mt-1 block text-clinical-ink">{selectedCase.source}</strong>
                    </div>
                  </div>
                  {patientLink(selectedCase.patientId) ? (
                    <a
                      href={patientLink(selectedCase.patientId)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-clinical-line px-3 py-2 text-sm font-semibold text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Open patient chart
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="p-4 text-sm text-clinical-slate">No selected AI case.</div>
              )}
            </section>

            <section className="rounded-md border border-clinical-line bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
                <Bell className="h-5 w-5 text-clinical-blue" />
                <h2 className="text-sm font-semibold text-clinical-ink">Live activity</h2>
              </div>
              <div className="divide-y divide-clinical-line">
                {feed.slice(0, 10).length ? (
                  feed.slice(0, 10).map((item) => (
                    <article key={item.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[36px_1fr_auto] sm:items-center">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-md border ${severityClasses(item.severity)}`}>
                        {item.type === "ai" ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : item.type === "feedback" ? (
                          <MessageSquareText className="h-4 w-4" />
                        ) : item.type === "call" ? (
                          <Bell className="h-4 w-4" />
                        ) : (
                          <Activity className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-clinical-ink">{item.title}</h3>
                        <p className="text-sm text-clinical-slate">{item.detail}</p>
                      </div>
                      <time className="text-sm text-clinical-slate">{item.time}</time>
                    </article>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-clinical-slate">Realtime stream is waiting for events.</div>
                )}
              </div>
            </section>

            <section className="rounded-md border border-clinical-line bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
                <Activity className="h-5 w-5 text-clinical-cyan" />
                <h2 className="text-sm font-semibold text-clinical-ink">Platform health</h2>
              </div>
              <div className="grid gap-2 p-4 text-sm">
                <div className="flex items-center justify-between rounded-md border border-clinical-line px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-clinical-slate">
                    <UsersRound className="h-4 w-4" />
                    Patients
                  </span>
                  <strong className="text-clinical-ink">{patients.length}</strong>
                </div>
                <div className="flex items-center justify-between rounded-md border border-clinical-line px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-clinical-slate">
                    <ClipboardList className="h-4 w-4" />
                    Medical records
                  </span>
                  <strong className="text-clinical-ink">{medicalRecords.length}</strong>
                </div>
                <div className="flex items-center justify-between rounded-md border border-clinical-line px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-clinical-slate">
                    <Hospital className="h-4 w-4" />
                    Active appointments
                  </span>
                  <strong className="text-clinical-ink">{activeAppointments}</strong>
                </div>
                <div className="flex items-center justify-between rounded-md border border-clinical-line px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-clinical-slate">
                    <WifiOff className="h-4 w-4" />
                    Patronage offline
                  </span>
                  <strong className="text-clinical-ink">{offlinePatronage}</strong>
                </div>
              </div>
              {loadNotes.length ? (
                <div className="border-t border-clinical-line px-4 py-3 text-xs text-clinical-slate">
                  {loadNotes.slice(0, 2).map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
