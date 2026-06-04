"use client";

import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

import {
  AIAssistantMessage,
  AIAssistantMode,
  AIAssistantRiskLevel,
  AIAssistantSession,
  createAIAssistantSession,
  sendAIAssistantMessage,
} from "@/lib/api";
import type { RegistryPatient } from "@/lib/crm-data";

type PanelRole = "USER" | "ASSISTANT";

interface PanelMessage {
  id: string;
  role: PanelRole;
  content: string;
  riskLevel: AIAssistantRiskLevel;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AssistantModeConfig {
  mode: AIAssistantMode;
  label: string;
  title: string;
  icon: LucideIcon;
}

interface QuickPrompt {
  label: string;
  prompt: string;
  icon: LucideIcon;
}

interface AIAssistantPanelProps {
  patient: RegistryPatient;
  note: string;
}

const assistantModes: AssistantModeConfig[] = [
  {
    mode: "CLINICAL_COPILOT",
    label: "Klinik",
    title: "Clinical co-pilot",
    icon: Stethoscope,
  },
  {
    mode: "RCA_COACH",
    label: "RCA",
    title: "Blameless RCA",
    icon: ClipboardCheck,
  },
  {
    mode: "DIGITAL_TWIN",
    label: "Twin",
    title: "Chronic risk model",
    icon: Activity,
  },
  {
    mode: "PATIENT_COMMUNICATION",
    label: "Bemor",
    title: "Patient explanation",
    icon: MessageCircle,
  },
];

const quickPrompts: Record<AIAssistantMode, QuickPrompt[]> = {
  CLINICAL_COPILOT: [
    {
      label: "Safety check",
      prompt:
        "Check this encounter for urgent safety risks, missing mandatory fields, medication concerns, follow-up gaps, and escalation needs.",
      icon: ShieldAlert,
    },
    {
      label: "Discharge plan",
      prompt:
        "Review discharge readiness. Check medications, red flags, patronage nurse handoff, regional family doctor Active Call, and patient contact route.",
      icon: CheckCircle2,
    },
  ],
  RCA_COACH: [
    {
      label: "RCA draft",
      prompt:
        "Create a blameless root-cause analysis draft. Identify system contributors, recurrence prevention actions, owner, due date, and evidence of completion.",
      icon: ClipboardCheck,
    },
    {
      label: "Hidden risk",
      prompt:
        "Look for hidden process risks that staff may avoid reporting because of punishment fear. Write non-punitive follow-up questions.",
      icon: ShieldAlert,
    },
  ],
  DIGITAL_TWIN: [
    {
      label: "Risk forecast",
      prompt:
        "Summarize chronic-disease risk signals from the selected patient context and current note. Propose monitoring thresholds and next review timing.",
      icon: Activity,
    },
    {
      label: "Care plan",
      prompt:
        "Create an individualized chronic-care plan with lifestyle, medication review, labs, specialist referral triggers, and patronage monitoring.",
      icon: CheckCircle2,
    },
  ],
  PERINATAL_REVIEW: [
    {
      label: "Perinatal risk",
      prompt:
        "Review perinatal danger signs, red-yellow-green zone, escalation route, follow-up interval, and rural/offline data capture needs.",
      icon: Activity,
    },
    {
      label: "Mother-baby",
      prompt:
        "Draft a mother and baby monitoring checklist with danger symptoms, responsible clinician, next contact, and district-level registry update.",
      icon: CheckCircle2,
    },
  ],
  PATIENT_COMMUNICATION: [
    {
      label: "Plain language",
      prompt:
        "Rewrite the plan in simple patient-friendly language. Include what happened, why it matters, what to do next, and when to seek urgent help.",
      icon: MessageCircle,
    },
    {
      label: "Complaint reply",
      prompt:
        "Draft a respectful response to an anonymous complaint. Avoid blame, acknowledge concern, describe next steps, and preserve confidentiality.",
      icon: ShieldAlert,
    },
  ],
};

const riskStyles: Record<AIAssistantRiskLevel, string> = {
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-900",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-900",
  HIGH: "border-red-200 bg-red-50 text-red-900",
  CRITICAL: "border-red-300 bg-red-100 text-red-950",
};

const statusStyles: Record<NonNullable<AIAssistantSession["safety_status"]>, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-clinical-slate",
  ADVISORY: "border-blue-200 bg-blue-50 text-clinical-blue",
  ESCALATED: "border-red-200 bg-red-50 text-red-900",
  CLOSED: "border-slate-200 bg-slate-100 text-clinical-slate",
};

function nowIso() {
  return new Date().toISOString();
}

function messageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function welcomeMessage(patient: RegistryPatient, mode: AIAssistantMode): PanelMessage {
  const modeLabel = assistantModes.find((item) => item.mode === mode)?.title ?? "Clinical co-pilot";
  return {
    id: messageId("welcome"),
    role: "ASSISTANT",
    content: `${modeLabel} tayyor. ${patient.fullName} profili, risk zonasi, D-ro'yxat va qabul yozuvi kontekst sifatida yuboriladi.`,
    riskLevel: patient.riskZone === "RED" ? "HIGH" : "LOW",
    metadata: { provider: "frontend", mode },
    createdAt: nowIso(),
  };
}

function fromApiMessage(message: AIAssistantMessage): PanelMessage {
  return {
    id: `api-${message.id}`,
    role: message.role === "USER" ? "USER" : "ASSISTANT",
    content: message.content,
    riskLevel: message.risk_level,
    metadata: message.metadata,
    createdAt: message.created_at,
  };
}

function readableError(error: unknown) {
  if (!(error instanceof Error)) {
    return "AI endpointga ulanishda xatolik yuz berdi.";
  }

  try {
    const parsed = JSON.parse(error.message) as Record<string, unknown>;
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
    const details = Object.values(parsed).flatMap((value) => {
      if (Array.isArray(value)) {
        return value.map((item) => String(item));
      }
      return [String(value)];
    });
    if (details.length) {
      return details.join(" ");
    }
  } catch {
    return error.message;
  }

  return error.message;
}

function arrayMetadata(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter(Boolean).slice(0, 4);
}

function providerLine(metadata: Record<string, unknown>) {
  const provider = typeof metadata.provider === "string" ? metadata.provider : "";
  const model = typeof metadata.model === "string" ? metadata.model : "";
  const fallbackReason = typeof metadata.fallback_reason === "string" ? metadata.fallback_reason : "";
  if (provider === "openai") {
    return model ? `OpenAI ${model}` : "OpenAI";
  }
  if (provider === "local") {
    return fallbackReason ? `Local fallback: ${fallbackReason}` : "Local fallback";
  }
  return provider || "AID assistant";
}

export function AIAssistantPanel({ patient, note }: AIAssistantPanelProps) {
  const [activeMode, setActiveMode] = useState<AIAssistantMode>("CLINICAL_COPILOT");
  const [session, setSession] = useState<AIAssistantSession | null>(null);
  const [messages, setMessages] = useState<PanelMessage[]>(() => [welcomeMessage(patient, "CLINICAL_COPILOT")]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "ASSISTANT"),
    [messages],
  );
  const currentRisk = latestAssistantMessage?.riskLevel ?? "LOW";
  const currentStatus = session?.safety_status ?? "DRAFT";
  const activeModeConfig = assistantModes.find((item) => item.mode === activeMode) ?? assistantModes[0];
  const actions = arrayMetadata(latestAssistantMessage?.metadata.follow_up_actions);
  const references = arrayMetadata(latestAssistantMessage?.metadata.protocol_references);

  useEffect(() => {
    setSession(null);
    setError("");
    setDraft("");
    setMessages([welcomeMessage(patient, activeMode)]);
  }, [patient.id, activeMode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const buildContextSnapshot = () => ({
    source: "doctor_crm_workspace",
    captured_at: nowIso(),
    frontend_patient: {
      id: patient.id,
      medical_card: patient.medicalCard,
      full_name: patient.fullName,
      age: patient.age,
      territory: patient.territory,
      risk_zone: patient.riskZone,
      health_group: patient.healthGroup,
      cardiovascular_risk: patient.cardiovascularRisk,
      diabetes_risk: patient.diabetesRisk,
      oncology_survey: patient.oncologySurvey,
      d_list: patient.dList,
      disability: patient.disability,
      clinical_diagnosis: patient.clinicalDiagnosis,
      tags: patient.tags,
      last_visit: patient.lastVisit,
      next_visit: patient.nextVisit,
      assigned_doctor: patient.assignedDoctor,
      patronage_nurse: patient.patronageNurse,
    },
    clinical_note: note.trim(),
  });

  const buildMessageContent = (prompt: string) =>
    [
      `Assistant mode: ${activeMode}`,
      `Patient: ${patient.fullName}`,
      `Medical card: ${patient.medicalCard}`,
      `Age: ${patient.age}`,
      `Risk zone: ${patient.riskZone}`,
      `Health group: ${patient.healthGroup}`,
      `Diagnosis: ${patient.clinicalDiagnosis}`,
      `D-list: ${patient.dList}`,
      `Tags: ${patient.tags.join(", ") || "None"}`,
      `Last visit: ${patient.lastVisit}`,
      `Next visit: ${patient.nextVisit}`,
      "",
      "Current clinical note:",
      note.trim() || "Not entered.",
      "",
      "Clinician request:",
      prompt.trim(),
    ].join("\n");

  const ensureSession = async () => {
    if (session && session.mode === activeMode) {
      return session;
    }

    const nextSession = await createAIAssistantSession({
      mode: activeMode,
      title: `${activeModeConfig.title}: ${patient.fullName}`,
      context_snapshot: buildContextSnapshot(),
    });
    setSession(nextSession);
    return nextSession;
  };

  const sendPrompt = async (prompt: string) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isSending) {
      return;
    }

    const userMessage: PanelMessage = {
      id: messageId("user"),
      role: "USER",
      content: cleanPrompt,
      riskLevel: "LOW",
      metadata: {},
      createdAt: nowIso(),
    };
    const pendingMessage: PanelMessage = {
      id: messageId("pending"),
      role: "ASSISTANT",
      content: "Tahlil qilinmoqda...",
      riskLevel: currentRisk,
      metadata: { provider: "pending" },
      createdAt: nowIso(),
    };

    setDraft("");
    setError("");
    setIsSending(true);
    setMessages((current) => [...current, userMessage, pendingMessage]);

    try {
      const activeSession = await ensureSession();
      const response = await sendAIAssistantMessage(activeSession.id, buildMessageContent(cleanPrompt), {
        mode: activeMode,
        frontend_patient_id: patient.id,
        medical_card: patient.medicalCard,
        risk_zone: patient.riskZone,
        clinical_diagnosis: patient.clinicalDiagnosis,
        clinical_note_present: Boolean(note.trim()),
      });
      setSession(response.session);
      setMessages((current) => [
        ...current.filter((message) => message.id !== pendingMessage.id),
        fromApiMessage(response.assistant_message),
      ]);
    } catch (requestError) {
      const detail = readableError(requestError);
      setError(detail);
      setMessages((current) => [
        ...current.filter((message) => message.id !== pendingMessage.id),
        {
          id: messageId("error"),
          role: "ASSISTANT",
          content: `AI yordamchi javob bermadi. ${detail}`,
          riskLevel: "MEDIUM",
          metadata: { provider: "frontend", error: detail },
          createdAt: nowIso(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendPrompt(draft);
  };

  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="border-b border-clinical-line px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-clinical-ink text-white">
                <Bot className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-clinical-ink">AI klinik yordamchi</h3>
                <p className="truncate text-xs text-clinical-slate">Yakuniy qaror emas, klinik nazorat signali.</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${riskStyles[currentRisk]}`}>
              {currentRisk}
            </span>
            <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${statusStyles[currentStatus]}`}>
              {currentStatus}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 rounded-md border border-clinical-line bg-slate-50 p-1">
          {assistantModes.map((item) => {
            const Icon = item.icon;
            const active = activeMode === item.mode;
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => setActiveMode(item.mode)}
                className={`flex h-8 min-w-0 items-center justify-center gap-1 rounded-sm px-1 text-[11px] font-semibold transition ${
                  active ? "bg-white text-clinical-blue shadow-sm" : "text-clinical-slate hover:bg-white"
                }`}
                title={item.title}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          {quickPrompts[activeMode].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => void sendPrompt(item.prompt)}
                disabled={isSending}
                className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border border-clinical-line bg-white px-2 text-xs font-semibold text-clinical-ink hover:border-clinical-blue hover:text-clinical-blue disabled:cursor-not-allowed disabled:opacity-60"
                title={item.prompt}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div ref={scrollRef} className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {messages.map((message) => {
            const assistant = message.role === "ASSISTANT";
            return (
              <article
                key={message.id}
                className={`rounded-md border px-3 py-2 text-sm ${
                  assistant
                    ? "border-clinical-line bg-slate-50 text-clinical-ink"
                    : "ml-6 border-blue-200 bg-blue-50 text-clinical-ink"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase text-clinical-slate">
                    {assistant ? <Sparkles className="h-3.5 w-3.5" /> : <Stethoscope className="h-3.5 w-3.5" />}
                    <span className="truncate">{assistant ? providerLine(message.metadata) : "Clinician"}</span>
                  </span>
                  {assistant ? (
                    <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${riskStyles[message.riskLevel]}`}>
                      {message.riskLevel}
                    </span>
                  ) : null}
                </div>
                <p className="whitespace-pre-line leading-5">{message.content}</p>
              </article>
            );
          })}
        </div>

        {actions.length || references.length ? (
          <div className="space-y-2 rounded-md border border-clinical-line bg-white p-3">
            {actions.length ? (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase text-clinical-slate">Keyingi amallar</p>
                <div className="space-y-1">
                  {actions.map((action) => (
                    <div key={action} className="flex gap-2 text-xs text-clinical-ink">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clinical-green" />
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {references.length ? (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase text-clinical-slate">Protokol</p>
                <div className="space-y-1">
                  {references.map((reference) => (
                    <div key={reference} className="flex gap-2 text-xs text-clinical-ink">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clinical-amber" />
                      <span>{reference}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </div>
        ) : null}

        <form onSubmit={submitPrompt} className="space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-clinical-line px-3 py-2 text-sm text-clinical-ink placeholder:text-slate-400 focus:border-clinical-blue"
            placeholder="AI uchun klinik savol yoki tahlil topshirigi"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setSession(null);
                setError("");
                setMessages([welcomeMessage(patient, activeMode)]);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-clinical-line bg-white px-3 text-xs font-semibold text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
              title="Yangi sessiya"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Yangi
            </button>
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-clinical-blue px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              title="Yuborish"
            >
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Yuborish
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
