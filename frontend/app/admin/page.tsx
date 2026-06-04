"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  Radio,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";

import { listAIErrorLogs, listFeedbackSummary, listRCAErrorSummary, notificationsUrl, updateAIErrorLog } from "@/lib/api";
import type { AIErrorLog, FeedbackSummary, RCAErrorSummary } from "@/lib/api";
import { RealtimeMessage, useWebSockets } from "@/hooks/useWebSockets";
import { useAuthGate } from "@/hooks/useAuth";

interface FeedItem {
  id: string;
  type: "ai" | "call" | "feedback";
  title: string;
  detail: string;
  severity: "critical" | "warning" | "ok";
  time: string;
}

type SafetyCaseStatus = "Yangi" | "Ko'rildi" | "RCA ochildi" | "Managerga biriktirildi";
type SafetyDataSource = "api" | "realtime";

interface SafetyCase {
  id: string;
  patient: string;
  doctor: string;
  signal: string;
  evidence: string;
  protocol: string;
  severity: "critical" | "warning";
  status: SafetyCaseStatus;
  owner: string;
  createdAt: string;
}

interface FeedbackRoomSummary {
  department: string;
  room: string;
  average: number;
  count: number;
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

function formatSafetyTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function safetyCaseFromAIErrorLog(log: AIErrorLog): SafetyCase {
  return {
    id: `log-${log.id}`,
    patient: log.patient_name,
    doctor: log.doctor_id || "Unknown doctor",
    signal: safetyErrorLabel(log.error_type),
    evidence: log.rca_description,
    protocol: log.protocol_reference || "AID-SAFETY-REVIEW",
    severity: normalizeSafetySeverity(log.severity),
    status: log.reviewed_by_admin ? "Ko'rildi" : "Yangi",
    owner: "Head physician",
    createdAt: formatSafetyTime(log.created_at),
  };
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

export default function AdminCommandCenterPage() {
  const { user, loading: authLoading, signOut } = useAuthGate({
    allowedRoles: ["SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HEAD_PHYSICIAN", "COMPLIANCE_OFFICER", "AUDITOR"],
  });
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [safetyCases, setSafetyCases] = useState<SafetyCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [roomAverages, setRoomAverages] = useState<FeedbackRoomSummary[]>([]);
  const [rcaCategories, setRcaCategories] = useState<{ label: string; count: number; color: string }[]>([]);
  const [safetyDataSource, setSafetyDataSource] = useState<SafetyDataSource>("api");
  const [safetyLoading, setSafetyLoading] = useState(true);
  const [safetyLoadError, setSafetyLoadError] = useState("");
  const { status: socketStatus, lastMessage } = useWebSockets<RealtimeMessage>({
    url: notificationsUrl("head_physicians"),
  });

  const updateSafetyCase = (caseId: string, status: SafetyCaseStatus) => {
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
    if (caseId.startsWith("log-") && status === "Ko'rildi") {
      const logId = Number(caseId.replace("log-", ""));
      if (Number.isFinite(logId)) {
        updateAIErrorLog(logId, { reviewed_by_admin: true }).catch((error) => {
          setSafetyLoadError(error instanceof Error ? error.message : "AI error log update failed.");
        });
      }
    }
  };

  useEffect(() => {
    let active = true;

    setSafetyLoading(true);
    Promise.all([listAIErrorLogs(), listFeedbackSummary(), listRCAErrorSummary()])
      .then(([errorLogResponse, feedbackResponse, rcaResponse]) => {
        if (!active) {
          return;
        }
        const cases = errorLogResponse.results
          .filter((log) => log.severity === "HIGH" || log.severity === "CRITICAL")
          .map(safetyCaseFromAIErrorLog);
        setSafetyCases(cases);
        setSelectedCaseId((current) => (cases.some((item) => item.id === current) ? current : cases[0]?.id ?? ""));
        setRoomAverages(feedbackResponse.map(feedbackSummaryToRoom));
        setRcaCategories(
          rcaResponse.map((item, index) => ({
            label: rcaCategoryLabel(item.error_type),
            count: item.total,
            color: rcaCategoryColor(index),
          })),
        );
        setSafetyDataSource("api");
        setSafetyLoadError("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setSafetyCases([]);
        setSelectedCaseId("");
        setRoomAverages([]);
        setRcaCategories([]);
        setSafetyDataSource("api");
        setSafetyLoadError(error instanceof Error ? error.message : "AI error log API is not available.");
      })
      .finally(() => {
        if (active) {
          setSafetyLoading(false);
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

    const now = new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());

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
          patient: payload.patient_name ?? "Critical AI review",
          doctor: payload.doctor_id ?? "Unknown doctor",
          signal: firstError?.severity === "CRITICAL" ? "Critical clinical safety signal" : "High clinical safety signal",
          evidence: firstError?.rca_description ?? "Safety protocol deviation detected.",
          protocol: firstError?.protocol_reference || "AID-SAFETY-REVIEW",
          severity: normalizeSafetySeverity(firstError?.severity),
          status: "Yangi",
          owner: "Head physician",
          createdAt: now,
        },
        ...current,
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
  const safetySourceLabel = safetyDataSource === "api" ? "Backend AI error logs" : "Realtime escalation stream";

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
              <p className="text-sm text-clinical-slate">Head physician and manager portal</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-md border border-clinical-line bg-white px-3 py-2 text-sm text-clinical-slate">
            <Radio className="h-4 w-4 text-clinical-cyan" />
            {socketStatus}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex w-fit items-center gap-2 rounded-md border border-clinical-line bg-white px-3 py-2 text-sm font-semibold text-clinical-slate"
          >
            {user?.display_name || user?.username || "Account"}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-clinical-slate">Open safety cases</span>
                <ClipboardList className="h-5 w-5 text-clinical-blue" />
              </div>
              <strong className="mt-3 block text-3xl text-clinical-ink">{openSafetyCases}</strong>
            </div>
            <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-clinical-slate">Critical</span>
                <AlertTriangle className="h-5 w-5 text-clinical-red" />
              </div>
              <strong className="mt-3 block text-3xl text-clinical-ink">{criticalSafetyCases}</strong>
            </div>
            <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-clinical-slate">Realtime events</span>
                <Activity className="h-5 w-5 text-clinical-cyan" />
              </div>
              <strong className="mt-3 block text-3xl text-clinical-ink">{feed.length}</strong>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-clinical-line bg-white px-4 py-3 text-sm text-clinical-slate shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2">
              <Radio className="h-4 w-4 text-clinical-cyan" />
              {safetyLoading ? "Safety inbox sinxronlanmoqda" : safetySourceLabel}
            </span>
            {safetyLoadError ? (
              <span className="text-xs text-clinical-slate">Backend sync cheklangan, lokal holat saqlab turildi.</span>
            ) : null}
          </div>

          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
              <ShieldAlert className="h-5 w-5 text-clinical-red" />
              <h2 className="text-sm font-semibold text-clinical-ink">Safety escalation inbox</h2>
            </div>
            <div className="divide-y divide-clinical-line">
              {safetyCases.length ? safetyCases.map((item) => (
                <article key={item.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_130px_180px] lg:items-center">
                  <button type="button" onClick={() => setSelectedCaseId(item.id)} className="min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${severityClasses(item.severity)}`}>
                        {item.severity}
                      </span>
                      <h3 className="text-sm font-semibold text-clinical-ink">{item.patient}</h3>
                    </div>
                    <p className="mt-1 text-sm text-clinical-slate">{item.signal}</p>
                    <p className="mt-1 text-xs text-clinical-slate">{item.doctor} · {item.protocol}</p>
                  </button>
                  <span className="rounded-md border border-clinical-line bg-slate-50 px-2 py-1 text-center text-xs font-semibold text-clinical-slate">
                    {item.status}
                  </span>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => updateSafetyCase(item.id, "Ko'rildi")}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-green hover:text-clinical-green"
                      title="Acknowledge"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSafetyCase(item.id, "RCA ochildi")}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                      title="Open RCA"
                    >
                      <ClipboardList className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSafetyCase(item.id, "Managerga biriktirildi")}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-amber hover:text-clinical-amber"
                      title="Assign manager"
                    >
                      <Bell className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              )) : (
                <div className="px-4 py-8 text-sm text-clinical-slate">
                  Ochiq high/critical AI safety case yo'q.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
              <Bell className="h-5 w-5 text-clinical-blue" />
              <h2 className="text-sm font-semibold text-clinical-ink">Live activity</h2>
            </div>
            <div className="divide-y divide-clinical-line">
              {feed.slice(0, 12).map((item) => (
                <article key={item.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[36px_1fr_auto] sm:items-center">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-md border ${severityClasses(item.severity)}`}>
                    {item.type === "ai" ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : item.type === "feedback" ? (
                      <MessageSquareText className="h-4 w-4" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-clinical-ink">{item.title}</h3>
                    <p className="text-sm text-clinical-slate">{item.detail}</p>
                  </div>
                  <time className="text-sm text-clinical-slate">{item.time}</time>
                </article>
              ))}
            </div>
          </section>
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
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
              <BarChart3 className="h-5 w-5 text-clinical-blue" />
              <h2 className="text-sm font-semibold text-clinical-ink">Feedback by room</h2>
            </div>
            <div className="space-y-3 p-4">
              {roomAverages.map((room) => (
                <div key={`${room.department}-${room.room}`}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-clinical-ink">
                      {room.department} {room.room}
                    </span>
                    <span className="text-clinical-slate">{room.average.toFixed(1)}</span>
                  </div>
                  <div className="h-2 rounded-sm bg-slate-100">
                    <div className="h-2 rounded-sm bg-clinical-blue" style={{ width: `${(room.average / 5) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-clinical-green" />
              <h2 className="text-sm font-semibold text-clinical-ink">RCA categories</h2>
            </div>
            <div className="space-y-3 p-4">
              {rcaCategories.map((category) => (
                <div key={category.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-clinical-ink">{category.label}</span>
                    <span className="text-clinical-slate">{category.count}</span>
                  </div>
                  <div className="h-2 rounded-sm bg-slate-100">
                    <div
                      className={`h-2 rounded-sm ${category.color}`}
                      style={{ width: `${Math.min(100, (category.count / 14) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
