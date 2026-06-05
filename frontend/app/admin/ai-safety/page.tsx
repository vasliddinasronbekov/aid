"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lightbulb,
  Pill,
  Radio,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { RealtimeMessage, useWebSockets } from "@/hooks/useWebSockets";
import {
  createClinicalTask,
  escalateAIErrorLog,
  listAIErrorLogs,
  listClinicalTasks,
  listMedicalRecords,
  notificationsUrl,
  updateAIErrorLog,
} from "@/lib/api";
import type { AIErrorLog, ClinicalTask, MedicalRecord } from "@/lib/api";
import {
  formatDateTime,
  safetyDeduction,
  safetyErrorLabel,
  safetyZoneClasses,
  safetyZoneFromSeverity,
  type SafetyZone,
} from "@/lib/admin-insights";

type ZoneFilter = "ALL" | SafetyZone;
type SafetyCaseStatus = "Yangi" | "Ko'rildi" | "RCA ochildi" | "Managerga biriktirildi";

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
  errorType: AIErrorLog["error_type"];
  severity: AIErrorLog["severity"];
  zone: SafetyZone;
  status: SafetyCaseStatus;
  owner: string;
  createdAt: string;
  deduction: number;
}

interface FeedItem {
  id: string;
  title: string;
  detail: string;
  zone: SafetyZone;
  time: string;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Request failed");
}

function dueInHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
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

function safetyCaseFromLog(log: AIErrorLog, records: MedicalRecord[], tasks: ClinicalTask[]): SafetyCase {
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
    errorType: log.error_type,
    severity: log.severity,
    zone: safetyZoneFromSeverity(log.severity),
    status,
    owner: status === "Managerga biriktirildi" ? "Care manager" : "Head physician",
    createdAt: formatDateTime(log.created_at),
    deduction: safetyDeduction(log.severity),
  };
}

function taskPriority(caseItem: SafetyCase): ClinicalTask["priority"] {
  if (caseItem.severity === "CRITICAL") {
    return "CRITICAL";
  }
  if (caseItem.severity === "HIGH") {
    return "URGENT";
  }
  return "SOON";
}

function shortcomingLabel(caseItem: Pick<SafetyCase, "severity" | "zone">) {
  if (caseItem.zone === "RED") {
    return caseItem.severity === "CRITICAL" ? "Critical shortcoming" : "Warning shortcoming";
  }
  if (caseItem.zone === "YELLOW") {
    return "Moderate warning";
  }
  return "Tiny shortcoming";
}

function concernSummary(caseItem: Pick<SafetyCase, "errorType" | "severity">) {
  const severePrefix = caseItem.severity === "CRITICAL" || caseItem.severity === "HIGH" ? "High patient-safety impact" : "Documentation and quality impact";
  const summaries: Record<AIErrorLog["error_type"], string> = {
    ENTRY_OMISSION: `${severePrefix}: required clinical fields, vitals, follow-up plan, or rationale may be missing.`,
    PRESCRIPTION_MISMATCH: `${severePrefix}: medication choice, dose, allergy check, duplication, or contraindication needs review.`,
    ETHICAL_DEVIATION: `${severePrefix}: consent, privacy, or patient-rights documentation may be incomplete.`,
    IMAGING_SAFETY: `${severePrefix}: CT/MRT/contrast/radiation safety documentation needs confirmation.`,
    DIGITAL_TWIN_RISK: `${severePrefix}: chronic-risk model or biomarker trend suggests the plan may be incomplete.`,
  };
  return summaries[caseItem.errorType];
}

function recommendedActions(caseItem: SafetyCase, record?: MedicalRecord) {
  const actions: Record<AIErrorLog["error_type"], string[]> = {
    ENTRY_OMISSION: [
      "Ask the doctor to complete the missing clinical fields and sign an amended record.",
      "Compare the note with vitals, complaints, diagnosis, and follow-up requirements.",
      "If the patient is red/yellow zone, create an urgent care-manager task before closing the case.",
    ],
    PRESCRIPTION_MISMATCH: [
      "Re-check dose, frequency, duration, patient age/weight, allergies, and contraindications before dispensing.",
      "Request a medication-review task and document the corrected regimen.",
      "If wrong-dose risk is plausible, notify the head doctor and pharmacy lead immediately.",
    ],
    ETHICAL_DEVIATION: [
      "Verify consent, patient-rights note, and privacy-sensitive documentation.",
      "Ask the doctor to document why the action was clinically necessary.",
      "Escalate repeated events to compliance review.",
    ],
    IMAGING_SAFETY: [
      "Confirm CT/MRT indication, pregnancy/contrast/radiation safety checks, and consent.",
      "Make sure imaging metadata is attached before approving the record.",
      "If the patient is pregnant or high risk, require head-doctor signoff.",
    ],
    DIGITAL_TWIN_RISK: [
      "Review chronic biomarkers and compare the care plan with the AI risk trend.",
      "Create a follow-up task for the responsible doctor or patronage nurse.",
      "Update the patient risk zone if the model suggests deterioration.",
    ],
  };
  if (record?.patient_triage_status === "RED") {
    return ["Treat as same-day review because the patient is in the red zone.", ...actions[caseItem.errorType]];
  }
  return actions[caseItem.errorType];
}

function compactText(value?: string | null) {
  return value && value.trim() ? value : "Not entered";
}

function metadataRows(record?: MedicalRecord) {
  if (!record) {
    return [];
  }
  return Object.entries(record.imaging_safety_metadata || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
}

export default function AdminAISafetyPage() {
  const [cases, setCases] = useState<SafetyCase[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>("ALL");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const { status: socketStatus, lastMessage } = useWebSockets<RealtimeMessage>({
    url: notificationsUrl("head_physicians"),
  });

  useEffect(() => {
    let active = true;

    setLoading(true);
    Promise.allSettled([listAIErrorLogs(""), listMedicalRecords(""), listClinicalTasks()])
      .then(([logResult, recordResult, taskResult]) => {
        if (!active) {
          return;
        }
        if (logResult.status !== "fulfilled") {
          setCases([]);
          setLoadError(`AI safety logs: ${errorMessage(logResult.reason)}`);
          return;
        }
        const records = recordResult.status === "fulfilled" ? recordResult.value.results : [];
        const nextTasks = taskResult.status === "fulfilled" ? taskResult.value.results : [];
        const nextCases = logResult.value.results
          .map((log) => safetyCaseFromLog(log, records, nextTasks))
          .sort((a, b) => b.deduction - a.deduction);
        setMedicalRecords(records);
        setCases(nextCases);
        setSelectedCaseId((current) => (nextCases.some((item) => item.id === current) ? current : nextCases[0]?.id ?? ""));
        setLoadError(recordResult.status === "rejected" ? `Medical records: ${errorMessage(recordResult.reason)}` : "");
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
    if (!lastMessage || lastMessage.type !== "critical_ai_error") {
      return;
    }
    const payload = lastMessage.payload as {
      patient_name?: string;
      doctor_id?: string;
      medical_record_id?: number;
      patient_id?: number;
      errors?: {
        id?: number;
        error_type?: AIErrorLog["error_type"];
        rca_description: string;
        severity: AIErrorLog["severity"];
        protocol_reference?: string;
      }[];
    };
    const firstError = payload.errors?.[0];
    const zone = safetyZoneFromSeverity(firstError?.severity ?? "HIGH");
    const caseId = typeof firstError?.id === "number" ? `log-${firstError.id}` : `case-${Date.now()}`;
    const now = formatDateTime(new Date().toISOString());

    setFeed((current) => [
      {
        id: `feed-${Date.now()}`,
        title: payload.patient_name ?? "AI safety escalation",
        detail: firstError?.rca_description ?? "Safety protocol deviation detected.",
        zone,
        time: now,
      },
      ...current,
    ]);
    setCases((current) => [
      {
        id: caseId,
        logId: firstError?.id,
        medicalRecordId: payload.medical_record_id,
        patientId: payload.patient_id,
        patient: payload.patient_name ?? "AI safety escalation",
        doctor: payload.doctor_id ?? "Unknown doctor",
        signal: firstError?.severity === "CRITICAL" ? "Critical clinical safety signal" : "High clinical safety signal",
        evidence: firstError?.rca_description ?? "Safety protocol deviation detected.",
        protocol: firstError?.protocol_reference || "AID-SAFETY-REVIEW",
        errorType: firstError?.error_type ?? "ENTRY_OMISSION",
        severity: firstError?.severity ?? "HIGH",
        zone,
        status: "Yangi",
        owner: "Head physician",
        createdAt: now,
        deduction: safetyDeduction(firstError?.severity ?? "HIGH"),
      },
      ...current.filter((item) => item.id !== caseId),
    ]);
    setSelectedCaseId(caseId);
  }, [lastMessage]);

  const recordById = useMemo(() => new Map(medicalRecords.map((record) => [record.id, record])), [medicalRecords]);
  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cases.filter((item) => {
      const record = item.medicalRecordId ? recordById.get(item.medicalRecordId) : undefined;
      const text = [
        item.patient,
        item.doctor,
        item.signal,
        item.evidence,
        item.protocol,
        record?.diagnosis,
        record?.prescriptions,
        record?.clinical_notes,
      ]
        .join(" ")
        .toLowerCase();
      return (zoneFilter === "ALL" || item.zone === zoneFilter) && (!normalizedQuery || text.includes(normalizedQuery));
    });
  }, [cases, query, recordById, zoneFilter]);

  const selectedCase = cases.find((item) => item.id === selectedCaseId) ?? cases[0];
  const selectedRecord = selectedCase?.medicalRecordId ? recordById.get(selectedCase.medicalRecordId) : undefined;
  const selectedActions = selectedCase ? recommendedActions(selectedCase, selectedRecord) : [];
  const selectedMetadataRows = metadataRows(selectedRecord);
  const redCases = cases.filter((item) => item.zone === "RED").length;
  const yellowCases = cases.filter((item) => item.zone === "YELLOW").length;
  const greenCases = cases.filter((item) => item.zone === "GREEN").length;
  const openCases = cases.filter((item) => item.status !== "Ko'rildi").length;
  const totalDeduction = cases.reduce((sum, item) => sum + item.deduction, 0);
  const doctorIssueCounts = useMemo(() => {
    const counts = new Map<string, { doctor: string; total: number; red: number; yellow: number; green: number }>();
    cases.forEach((item) => {
      const current = counts.get(item.doctor) ?? { doctor: item.doctor, total: 0, red: 0, yellow: 0, green: 0 };
      current.total += 1;
      if (item.zone === "RED") {
        current.red += 1;
      } else if (item.zone === "YELLOW") {
        current.yellow += 1;
      } else {
        current.green += 1;
      }
      counts.set(item.doctor, current);
    });
    return [...counts.values()].sort((a, b) => b.red - a.red || b.total - a.total).slice(0, 8);
  }, [cases]);

  const setCaseStatus = (caseId: string, status: SafetyCaseStatus) => {
    setCases((current) =>
      current.map((caseItem) =>
        caseItem.id === caseId
          ? {
              ...caseItem,
              status,
              owner: status === "Managerga biriktirildi" ? "Care manager" : "Head physician",
            }
          : caseItem,
      ),
    );
  };

  const handleSafetyAction = async (caseItem: SafetyCase, status: SafetyCaseStatus) => {
    const actionId = `${caseItem.id}-${status}`;
    setBusyAction(actionId);
    setActionMessage("");
    try {
      if (status === "Ko'rildi") {
        if (caseItem.logId) {
          await updateAIErrorLog(caseItem.logId, { reviewed_by_admin: true });
        }
        setCaseStatus(caseItem.id, status);
        setActionMessage(`${caseItem.patient}: reviewed.`);
        return;
      }

      if (!caseItem.patientId) {
        throw new Error("Patient link is missing. Reload after the AI log is synced with its medical record.");
      }

      const workflow = status === "RCA ochildi" ? "root_cause_analysis" : "manager_assignment";
      const record = caseItem.medicalRecordId ? recordById.get(caseItem.medicalRecordId) : undefined;
      const actions = recommendedActions(caseItem, record);
      await createClinicalTask({
        patient: caseItem.patientId,
        task_type: status === "RCA ochildi" ? "CARE_PLAN" : "ADMIN",
        priority: taskPriority(caseItem),
        title: status === "RCA ochildi" ? `RCA review: ${caseItem.signal}` : `Manager follow-up: ${caseItem.signal}`,
        description: [
          `AI detected: ${caseItem.evidence}`,
          `AI analysis: ${concernSummary(caseItem)}`,
          `Doctor: ${caseItem.doctor}`,
          `Protocol: ${caseItem.protocol}`,
          `Rank deduction: ${caseItem.deduction}`,
          `Recommended actions: ${actions.join(" | ")}`,
        ].join("\n"),
        due_at: dueInHours(caseItem.zone === "RED" ? 4 : 24),
        metadata: {
          source: "admin_ai_safety",
          source_ai_error_log_id: caseItem.logId ?? null,
          source_medical_record_id: caseItem.medicalRecordId ?? null,
          workflow,
        },
      });
      setCaseStatus(caseItem.id, status);
      setActionMessage(`${caseItem.patient}: backend task created.`);
    } catch (error) {
      setActionMessage(errorMessage(error));
    } finally {
      setBusyAction("");
    }
  };

  const handleBroadcast = async (caseItem: SafetyCase) => {
    if (!caseItem.logId) {
      setActionMessage("This realtime case does not have a backend AI log id yet.");
      return;
    }
    setBusyAction(`${caseItem.id}-broadcast`);
    setActionMessage("");
    try {
      await escalateAIErrorLog(caseItem.logId);
      setActionMessage(`${caseItem.patient}: sent to head doctor notifications.`);
    } catch (error) {
      setActionMessage(errorMessage(error));
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-md border border-clinical-line bg-white px-4 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-clinical-ink">AI safety</h2>
          <p className="mt-1 text-sm text-clinical-slate">Doctor shortcomings detected from clinical records and routed to governance.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-md border border-clinical-line px-3 py-2 text-sm text-clinical-slate">
          <Radio className="h-4 w-4 text-clinical-cyan" />
          {socketStatus}
        </span>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Open safety</span>
            <Bot className="h-5 w-5 text-clinical-blue" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{openCases}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Red</span>
            <AlertTriangle className="h-5 w-5 text-clinical-red" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{redCases}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Yellow</span>
            <ShieldAlert className="h-5 w-5 text-clinical-amber" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{yellowCases}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Green</span>
            <CheckCircle2 className="h-5 w-5 text-clinical-green" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{greenCases}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Rank deducted</span>
            <UserRound className="h-5 w-5 text-clinical-red" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{totalDeduction}</strong>
        </div>
      </section>

      {actionMessage || loadError ? (
        <div className="rounded-md border border-clinical-line bg-white px-4 py-3 text-sm text-clinical-slate shadow-sm">
          {actionMessage || loadError}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-md border border-clinical-line bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-clinical-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative lg:w-96">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-clinical-slate" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 w-full rounded-md border border-clinical-line bg-white pl-9 pr-3 text-sm text-clinical-ink outline-none focus:border-clinical-blue"
                placeholder="Search doctor, patient, shortcoming"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["ALL", "RED", "YELLOW", "GREEN"] as ZoneFilter[]).map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setZoneFilter(zone)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                    zoneFilter === zone ? "border-clinical-blue bg-blue-50 text-clinical-blue" : "border-clinical-line text-clinical-slate hover:border-clinical-blue"
                  }`}
                >
                  {zone}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-clinical-line">
            {filteredCases.map((item) => {
              const record = item.medicalRecordId ? recordById.get(item.medicalRecordId) : undefined;
              return (
                <article key={item.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_120px_220px] lg:items-center">
                  <button type="button" onClick={() => setSelectedCaseId(item.id)} className="min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${safetyZoneClasses(item.zone)}`}>{item.zone}</span>
                      <span className="rounded-md border border-clinical-line bg-slate-50 px-2 py-1 text-xs font-semibold text-clinical-slate">
                        {shortcomingLabel(item)}
                      </span>
                      <h3 className="text-sm font-semibold text-clinical-ink">{item.signal}</h3>
                      <span className="text-xs text-clinical-slate">-{item.deduction}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-clinical-slate">{item.evidence}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-clinical-slate">
                      Doctor submitted: {compactText(record?.diagnosis)} · Rx: {compactText(record?.prescriptions)}
                    </p>
                    <p className="mt-1 text-xs text-clinical-slate">
                      {item.patient} · {item.doctor} · {item.createdAt}
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
                      title="Assign manager"
                    >
                      <Bell className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBroadcast(item)}
                      disabled={!item.logId || busyAction === `${item.id}-broadcast`}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-red hover:text-clinical-red disabled:opacity-40"
                      title="Send escalation"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
            {!filteredCases.length ? <div className="px-4 py-8 text-sm text-clinical-slate">{loading ? "Loading AI safety" : "No AI safety cases match this view."}</div> : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-clinical-red" />
              <h2 className="text-sm font-semibold text-clinical-ink">Selected shortcoming</h2>
            </div>
            {selectedCase ? (
              <div className="space-y-3 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${safetyZoneClasses(selectedCase.zone)}`}>{selectedCase.zone}</span>
                    <h3 className="text-sm font-semibold text-clinical-ink">{selectedCase.signal}</h3>
                  </div>
                  <p className="mt-1 text-sm text-clinical-slate">{selectedCase.patient}</p>
                </div>
                <div className="rounded-md border border-clinical-line bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-clinical-slate">Evidence</p>
                  <p className="mt-1 text-sm text-clinical-ink">{selectedCase.evidence}</p>
                </div>
                <div className="rounded-md border border-clinical-line p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-clinical-blue" />
                    <p className="text-xs font-semibold uppercase text-clinical-slate">Doctor submitted to platform</p>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div>
                      <span className="text-xs text-clinical-slate">Diagnosis</span>
                      <p className="mt-1 text-clinical-ink">{compactText(selectedRecord?.diagnosis)}</p>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1 text-xs text-clinical-slate">
                        <Pill className="h-3.5 w-3.5" />
                        Prescriptions / regimen
                      </span>
                      <p className="mt-1 text-clinical-ink">{compactText(selectedRecord?.prescriptions)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-clinical-slate">Clinical notes</span>
                      <p className="mt-1 text-clinical-ink">{compactText(selectedRecord?.clinical_notes)}</p>
                    </div>
                    {selectedMetadataRows.length ? (
                      <div>
                        <span className="text-xs text-clinical-slate">CT/MRT/imaging metadata</span>
                        <div className="mt-1 space-y-1">
                          {selectedMetadataRows.map((row) => (
                            <p key={row} className="text-xs text-clinical-slate">{row}</p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-md border border-clinical-line p-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-clinical-red" />
                    <p className="text-xs font-semibold uppercase text-clinical-slate">AI analysis</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-clinical-ink">{shortcomingLabel(selectedCase)}</p>
                  <p className="mt-1 text-sm text-clinical-slate">{concernSummary(selectedCase)}</p>
                  <p className="mt-2 text-xs text-clinical-slate">
                    Protocol: {selectedCase.protocol} · AI status: {selectedRecord?.ai_review_status || "PENDING"}
                  </p>
                </div>
                <div className="rounded-md border border-clinical-line p-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-clinical-amber" />
                    <p className="text-xs font-semibold uppercase text-clinical-slate">What to do</p>
                  </div>
                  <ul className="mt-2 space-y-2 text-sm text-clinical-slate">
                    {selectedActions.map((action) => (
                      <li key={action} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-clinical-blue" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-clinical-line px-3 py-2">
                    <span className="block text-[11px] text-clinical-slate">Doctor</span>
                    <strong className="mt-1 block text-clinical-ink">{selectedCase.doctor}</strong>
                  </div>
                  <div className="rounded-md border border-clinical-line px-3 py-2">
                    <span className="block text-[11px] text-clinical-slate">Deduction</span>
                    <strong className="mt-1 block text-clinical-red">-{selectedCase.deduction}</strong>
                  </div>
                  <div className="rounded-md border border-clinical-line px-3 py-2">
                    <span className="block text-[11px] text-clinical-slate">Owner</span>
                    <strong className="mt-1 block text-clinical-ink">{selectedCase.owner}</strong>
                  </div>
                  <div className="rounded-md border border-clinical-line px-3 py-2">
                    <span className="block text-[11px] text-clinical-slate">Status</span>
                    <strong className="mt-1 block text-clinical-ink">{selectedCase.status}</strong>
                  </div>
                </div>
                {selectedCase.patientId ? (
                  <Link
                    href={`/doctor/patient/${selectedCase.patientId}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-clinical-line px-3 py-2 text-sm font-semibold text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Open patient chart
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="p-4 text-sm text-clinical-slate">No selected AI case.</div>
            )}
          </section>

          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
              <UserRound className="h-5 w-5 text-clinical-blue" />
              <h2 className="text-sm font-semibold text-clinical-ink">Doctor issue density</h2>
            </div>
            <div className="divide-y divide-clinical-line">
              {doctorIssueCounts.map((item) => (
                <div key={item.doctor} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-clinical-ink">{item.doctor}</span>
                    <span className="text-xs text-clinical-slate">{item.total}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px] font-semibold">
                    <span className="rounded-sm bg-red-50 py-1 text-red-900">{item.red}</span>
                    <span className="rounded-sm bg-amber-50 py-1 text-amber-900">{item.yellow}</span>
                    <span className="rounded-sm bg-emerald-50 py-1 text-emerald-900">{item.green}</span>
                  </div>
                </div>
              ))}
              {!doctorIssueCounts.length ? <div className="px-4 py-6 text-sm text-clinical-slate">No doctor safety events yet.</div> : null}
            </div>
          </section>

          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
              <Bell className="h-5 w-5 text-clinical-blue" />
              <h2 className="text-sm font-semibold text-clinical-ink">Head doctor stream</h2>
            </div>
            <div className="divide-y divide-clinical-line">
              {feed.slice(0, 8).map((item) => (
                <article key={item.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${safetyZoneClasses(item.zone)}`}>{item.zone}</span>
                    <h3 className="text-sm font-semibold text-clinical-ink">{item.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-clinical-slate">{item.detail}</p>
                  <p className="mt-1 text-xs text-clinical-slate">{item.time}</p>
                </article>
              ))}
              {!feed.length ? <div className="px-4 py-6 text-sm text-clinical-slate">Waiting for realtime AI safety notifications.</div> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
