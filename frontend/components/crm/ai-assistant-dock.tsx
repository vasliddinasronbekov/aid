"use client";

import {
  Activity,
  Baby,
  Bot,
  ClipboardCheck,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  Stethoscope,
  X,
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
import type { CrmModuleKey } from "@/lib/crm-data";

interface AIAssistantDockProps {
  activeModule: CrmModuleKey;
  pageTitle: string;
  pagePath: string;
  query: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DockMode {
  mode: AIAssistantMode;
  label: string;
  title: string;
  icon: LucideIcon;
}

interface DockMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  riskLevel: AIAssistantRiskLevel;
  metadata: Record<string, unknown>;
}

const dockModes: DockMode[] = [
  { mode: "CLINICAL_COPILOT", label: "Klinik", title: "Clinical co-pilot", icon: Stethoscope },
  { mode: "RCA_COACH", label: "RCA", title: "Blameless RCA", icon: ClipboardCheck },
  { mode: "DIGITAL_TWIN", label: "Twin", title: "Digital Twin", icon: Activity },
  { mode: "PERINATAL_REVIEW", label: "Perinatal", title: "Perinatal review", icon: Baby },
  { mode: "PATIENT_COMMUNICATION", label: "Bemor", title: "Patient communication", icon: MessageCircle },
];

const riskStyles: Record<AIAssistantRiskLevel, string> = {
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-900",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-900",
  HIGH: "border-red-200 bg-red-50 text-red-900",
  CRITICAL: "border-red-300 bg-red-100 text-red-950",
};

function nowIso() {
  return new Date().toISOString();
}

function messageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function welcomeMessage(mode: AIAssistantMode, pageTitle: string): DockMessage {
  const title = dockModes.find((item) => item.mode === mode)?.title ?? "AI Assistant";
  return {
    id: messageId("welcome"),
    role: "ASSISTANT",
    content: `${title} tayyor. Joriy sahifa: ${pageTitle}.`,
    riskLevel: "LOW",
    metadata: { provider: "frontend", mode },
  };
}

function fromApiMessage(message: AIAssistantMessage): DockMessage {
  return {
    id: `api-${message.id}`,
    role: message.role === "USER" ? "USER" : "ASSISTANT",
    content: message.content,
    riskLevel: message.risk_level,
    metadata: message.metadata,
  };
}

function providerLine(metadata: Record<string, unknown>) {
  const provider = typeof metadata.provider === "string" ? metadata.provider : "";
  const model = typeof metadata.model === "string" ? metadata.model : "";
  const fallbackReason = typeof metadata.fallback_reason === "string" ? metadata.fallback_reason : "";
  if (provider === "openai") {
    return model ? `OpenAI ${model}` : "OpenAI";
  }
  if (provider === "local") {
    return fallbackReason ? `Local: ${fallbackReason}` : "Local";
  }
  return provider || "AID";
}

function readableError(error: unknown) {
  if (!(error instanceof Error)) {
    return "AI assistant request failed.";
  }

  try {
    const parsed = JSON.parse(error.message) as Record<string, unknown>;
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
  } catch {
    return error.message;
  }

  return error.message;
}

export function AIAssistantDock({
  activeModule,
  pageTitle,
  pagePath,
  query,
  open,
  onOpenChange,
}: AIAssistantDockProps) {
  const [activeMode, setActiveMode] = useState<AIAssistantMode>("CLINICAL_COPILOT");
  const [session, setSession] = useState<AIAssistantSession | null>(null);
  const [messages, setMessages] = useState<DockMessage[]>(() => [welcomeMessage("CLINICAL_COPILOT", pageTitle)]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeModeConfig = useMemo(
    () => dockModes.find((item) => item.mode === activeMode) ?? dockModes[0],
    [activeMode],
  );
  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "ASSISTANT"),
    [messages],
  );
  const riskLevel = latestAssistant?.riskLevel ?? "LOW";

  useEffect(() => {
    setSession(null);
    setError("");
    setMessages([welcomeMessage(activeMode, pageTitle)]);
  }, [activeMode, pageTitle, pagePath]);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, open]);

  const buildContextSnapshot = () => ({
    source: "crm_global_ai_dock",
    captured_at: nowIso(),
    active_module: activeModule,
    page_title: pageTitle,
    page_path: pagePath,
    search_query: query.trim(),
  });

  const ensureSession = async () => {
    if (session && session.mode === activeMode) {
      return session;
    }
    const nextSession = await createAIAssistantSession({
      mode: activeMode,
      title: `${activeModeConfig.title}: ${pageTitle}`,
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

    const userMessage: DockMessage = {
      id: messageId("user"),
      role: "USER",
      content: cleanPrompt,
      riskLevel: "LOW",
      metadata: {},
    };
    const pendingMessage: DockMessage = {
      id: messageId("pending"),
      role: "ASSISTANT",
      content: "Tahlil qilinmoqda...",
      riskLevel,
      metadata: { provider: "pending" },
    };

    setDraft("");
    setError("");
    setIsSending(true);
    setMessages((current) => [...current, userMessage, pendingMessage]);

    try {
      const activeSession = await ensureSession();
      const content = [
        `Assistant mode: ${activeMode}`,
        `CRM module: ${activeModule}`,
        `Page title: ${pageTitle}`,
        `Path: ${pagePath}`,
        `Search query: ${query.trim() || "None"}`,
        "",
        "User request:",
        cleanPrompt,
      ].join("\n");
      const response = await sendAIAssistantMessage(activeSession.id, content, {
        source: "crm_global_ai_dock",
        active_module: activeModule,
        page_path: pagePath,
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
          content: `AI assistant javob bermadi. ${detail}`,
          riskLevel: "MEDIUM",
          metadata: { provider: "frontend", error: detail },
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
    <>
      {open ? (
        <aside className="fixed bottom-24 right-5 z-50 flex max-h-[calc(100vh-7rem)] w-[min(430px,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border border-clinical-line bg-white/95 shadow-clinical backdrop-blur">
          <div className="border-b border-clinical-line px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-clinical-ink text-white">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-clinical-ink">AI Assistant</h2>
                  <p className="truncate text-xs text-clinical-slate">{pageTitle}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${riskStyles[riskLevel]}`}>
                  {riskLevel}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                  title="Yopish"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-5 gap-1 rounded-md border border-clinical-line bg-slate-50 p-1">
              {dockModes.map((item) => {
                const Icon = item.icon;
                const active = item.mode === activeMode;
                return (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => setActiveMode(item.mode)}
                    className={`flex h-8 min-w-0 items-center justify-center gap-1 rounded-sm px-1 text-[11px] font-semibold ${
                      active ? "bg-white text-clinical-blue shadow-sm" : "text-clinical-slate hover:bg-white"
                    }`}
                    title={item.title}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden truncate sm:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((message) => {
              const assistant = message.role === "ASSISTANT";
              return (
                <article
                  key={message.id}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    assistant
                      ? "border-clinical-line bg-slate-50 text-clinical-ink"
                      : "ml-7 border-blue-200 bg-blue-50 text-clinical-ink"
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

          <form onSubmit={submitPrompt} className="border-t border-clinical-line p-3">
            {error ? (
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {error}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                className="min-h-11 flex-1 resize-none rounded-md border border-clinical-line px-3 py-2 text-sm text-clinical-ink placeholder:text-slate-400 focus:border-clinical-blue"
                placeholder="AI uchun savol"
              />
              <button
                type="submit"
                disabled={isSending || !draft.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-clinical-blue text-white disabled:cursor-not-allowed disabled:opacity-60"
                title="Yuborish"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </aside>
      ) : null}

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-white/70 shadow-clinical transition ${
          open ? "bg-clinical-ink text-white" : "bg-clinical-blue text-white hover:bg-clinical-ink"
        }`}
        title="AI Assistant"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-6 w-6" />}
      </button>
    </>
  );
}
