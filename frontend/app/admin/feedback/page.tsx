"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, MessageSquareText, Phone, Radio, Search, ShieldAlert, Star, UserRound } from "lucide-react";

import { RealtimeMessage, useWebSockets } from "@/hooks/useWebSockets";
import { listFeedback, notificationsUrl, updateFeedback } from "@/lib/api";
import type { AnonymousFeedback } from "@/lib/api";

type StatusFilter = "ALL" | AnonymousFeedback["status"];
type SeverityFilter = "ALL" | AnonymousFeedback["severity"];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Request failed");
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

function severityClasses(severity: AnonymousFeedback["severity"]) {
  if (severity === "CRITICAL" || severity === "HIGH") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (severity === "MEDIUM") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function statusClasses(status: AnonymousFeedback["status"]) {
  if (status === "NEW") {
    return "border-blue-200 bg-blue-50 text-clinical-blue";
  }
  if (status === "IN_REVIEW" || status === "TRIAGED") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (status === "RESOLVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  return "border-clinical-line bg-slate-50 text-clinical-slate";
}

function ratingStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => index < rating);
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<AnonymousFeedback[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [liveEvents, setLiveEvents] = useState<{ id: string; title: string; detail: string; createdAt: string }[]>([]);
  const { status: socketStatus, lastMessage } = useWebSockets<RealtimeMessage>({
    url: notificationsUrl("head_physicians"),
  });

  useEffect(() => {
    let active = true;

    setLoading(true);
    listFeedback("")
      .then((response) => {
        if (!active) {
          return;
        }
        setFeedback(response.results);
        setSelectedId((current) => (response.results.some((item) => item.id === current) ? current : response.results[0]?.id ?? null));
        setLoadError("");
      })
      .catch((error) => {
        if (active) {
          setLoadError(errorMessage(error));
        }
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
    if (!lastMessage || lastMessage.type !== "feedback_submitted") {
      return;
    }
    const payload = lastMessage.payload as {
      id?: number;
      target_staff_name?: string;
      target_doctor_label?: string;
      contact_phone_number?: string;
      rating?: number;
      category?: string;
      severity?: string;
      created_at?: string;
    };
    setLiveEvents((current) => [
      {
        id: `feedback-${payload.id ?? Date.now()}`,
        title: payload.target_staff_name || payload.target_doctor_label || "New feedback",
        detail: `${payload.category ?? "GENERAL"} · ${payload.severity ?? "LOW"} · ${payload.contact_phone_number || "phone attached"}`,
        createdAt: formatDateTime(payload.created_at || new Date().toISOString()),
      },
      ...current,
    ]);
  }, [lastMessage]);

  const filteredFeedback = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return feedback.filter((item) => {
      const text = [
        item.target_staff_name,
        item.target_doctor_label,
        item.contact_phone_number,
        item.category,
        item.severity,
        item.status,
        item.comment,
        item.department,
        item.room_qr_id,
      ]
        .join(" ")
        .toLowerCase();
      return (
        (statusFilter === "ALL" || item.status === statusFilter) &&
        (severityFilter === "ALL" || item.severity === severityFilter) &&
        (!normalizedQuery || text.includes(normalizedQuery))
      );
    });
  }, [feedback, query, severityFilter, statusFilter]);

  const selectedFeedback = feedback.find((item) => item.id === selectedId) ?? feedback[0];
  const newCount = feedback.filter((item) => item.status === "NEW").length;
  const highRiskCount = feedback.filter((item) => ["HIGH", "CRITICAL"].includes(item.severity)).length;
  const doctorFeedbackCount = feedback.filter((item) => item.target_type === "DOCTOR").length;
  const followUpCount = feedback.filter((item) => item.requires_follow_up).length;
  const visiblePhoneCount = feedback.filter((item) => item.contact_phone_number).length;

  const setFeedbackStatus = async (item: AnonymousFeedback, status: AnonymousFeedback["status"]) => {
    setBusyAction(`${item.id}-${status}`);
    setActionMessage("");
    try {
      const updated = await updateFeedback(item.id, { status });
      setFeedback((current) => current.map((currentItem) => (currentItem.id === updated.id ? updated : currentItem)));
      setActionMessage(`${item.target_staff_name || "Feedback"} marked ${status.toLowerCase()}.`);
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
          <h2 className="text-xl font-semibold text-clinical-ink">Anonymous feedback</h2>
          <p className="mt-1 text-sm text-clinical-slate">Doctor feedback inbox with visible phone number for head-doctor verification.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-md border border-clinical-line px-3 py-2 text-sm text-clinical-slate">
          <Radio className="h-4 w-4 text-clinical-cyan" />
          {socketStatus}
        </span>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">New</span>
            <Clock className="h-5 w-5 text-clinical-blue" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{newCount}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">High risk</span>
            <AlertTriangle className="h-5 w-5 text-clinical-red" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{highRiskCount}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Doctor feedback</span>
            <UserRound className="h-5 w-5 text-clinical-cyan" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{doctorFeedbackCount}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Follow-up</span>
            <ShieldAlert className="h-5 w-5 text-clinical-amber" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{followUpCount}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Phones visible</span>
            <Phone className="h-5 w-5 text-clinical-green" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{visiblePhoneCount}</strong>
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
                placeholder="Search doctor, phone, comment"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["ALL", "NEW", "IN_REVIEW", "RESOLVED", "DISMISSED"] as StatusFilter[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                    statusFilter === status ? "border-clinical-blue bg-blue-50 text-clinical-blue" : "border-clinical-line text-clinical-slate hover:border-clinical-blue"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div className="border-b border-clinical-line px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as SeverityFilter[]).map((severity) => (
                <button
                  key={severity}
                  type="button"
                  onClick={() => setSeverityFilter(severity)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                    severityFilter === severity ? "border-clinical-blue bg-blue-50 text-clinical-blue" : "border-clinical-line text-clinical-slate hover:border-clinical-blue"
                  }`}
                >
                  {severity}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-clinical-line">
            {filteredFeedback.map((item) => (
              <article key={item.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_160px_170px] lg:items-center">
                <button type="button" onClick={() => setSelectedId(item.id)} className="min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${severityClasses(item.severity)}`}>{item.severity}</span>
                    <h3 className="text-sm font-semibold text-clinical-ink">{item.target_staff_name || item.target_doctor_label || item.department || "Anonymous feedback"}</h3>
                    {item.requires_follow_up ? <span className="text-xs font-semibold text-clinical-red">follow-up</span> : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-clinical-slate">{item.comment || "No comment"}</p>
                  <p className="mt-1 text-xs text-clinical-slate">
                    {item.contact_phone_number || "No phone"} · {item.category} · {formatDateTime(item.created_at)}
                  </p>
                </button>
                <span className={`rounded-md border px-2 py-1 text-center text-xs font-semibold ${statusClasses(item.status)}`}>{item.status}</span>
                <div className="flex flex-wrap justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => void setFeedbackStatus(item, "IN_REVIEW")}
                    disabled={busyAction === `${item.id}-IN_REVIEW`}
                    className="rounded-md border border-clinical-line px-2 py-1 text-xs font-semibold text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue disabled:opacity-40"
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => void setFeedbackStatus(item, "RESOLVED")}
                    disabled={busyAction === `${item.id}-RESOLVED`}
                    className="rounded-md border border-clinical-line px-2 py-1 text-xs font-semibold text-clinical-slate hover:border-clinical-green hover:text-clinical-green disabled:opacity-40"
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    onClick={() => void setFeedbackStatus(item, "DISMISSED")}
                    disabled={busyAction === `${item.id}-DISMISSED`}
                    className="rounded-md border border-clinical-line px-2 py-1 text-xs font-semibold text-clinical-slate hover:border-clinical-red hover:text-clinical-red disabled:opacity-40"
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            ))}
            {!filteredFeedback.length ? <div className="px-4 py-8 text-sm text-clinical-slate">{loading ? "Loading feedback" : "No feedback matches this view."}</div> : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
              <MessageSquareText className="h-5 w-5 text-clinical-blue" />
              <h2 className="text-sm font-semibold text-clinical-ink">Selected feedback</h2>
            </div>
            {selectedFeedback ? (
              <div className="space-y-3 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${severityClasses(selectedFeedback.severity)}`}>{selectedFeedback.severity}</span>
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClasses(selectedFeedback.status)}`}>{selectedFeedback.status}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-clinical-ink">
                    {selectedFeedback.target_staff_name || selectedFeedback.target_doctor_label || selectedFeedback.department || "Anonymous feedback"}
                  </h3>
                </div>
                <div className="rounded-md border border-clinical-line bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-clinical-slate">Comment</p>
                  <p className="mt-1 text-sm text-clinical-ink">{selectedFeedback.comment || "No comment"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-clinical-line px-3 py-2">
                    <span className="block text-[11px] text-clinical-slate">Phone</span>
                    <strong className="mt-1 block text-clinical-ink">{selectedFeedback.contact_phone_number || "Not provided"}</strong>
                  </div>
                  <div className="rounded-md border border-clinical-line px-3 py-2">
                    <span className="block text-[11px] text-clinical-slate">Verified</span>
                    <strong className="mt-1 block text-clinical-ink">{selectedFeedback.phone_verified ? "OTP" : "Phone only"}</strong>
                  </div>
                  <div className="rounded-md border border-clinical-line px-3 py-2">
                    <span className="block text-[11px] text-clinical-slate">Category</span>
                    <strong className="mt-1 block text-clinical-ink">{selectedFeedback.category}</strong>
                  </div>
                  <div className="rounded-md border border-clinical-line px-3 py-2">
                    <span className="block text-[11px] text-clinical-slate">Rating</span>
                    <span className="mt-1 flex gap-0.5 text-clinical-amber">
                      {ratingStars(selectedFeedback.rating).map((active, index) => (
                        <Star key={index} className={`h-4 w-4 ${active ? "fill-current" : "text-slate-300"}`} />
                      ))}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-clinical-slate">Session {selectedFeedback.anonymous_session_id.slice(0, 8)} · {formatDateTime(selectedFeedback.created_at)}</p>
              </div>
            ) : (
              <div className="p-4 text-sm text-clinical-slate">No selected feedback.</div>
            )}
          </section>

          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
              <Radio className="h-5 w-5 text-clinical-cyan" />
              <h2 className="text-sm font-semibold text-clinical-ink">Realtime feedback</h2>
            </div>
            <div className="divide-y divide-clinical-line">
              {liveEvents.slice(0, 8).map((event) => (
                <article key={event.id} className="px-4 py-3">
                  <h3 className="text-sm font-semibold text-clinical-ink">{event.title}</h3>
                  <p className="mt-1 text-sm text-clinical-slate">{event.detail}</p>
                  <p className="mt-1 text-xs text-clinical-slate">{event.createdAt}</p>
                </article>
              ))}
              {!liveEvents.length ? <div className="px-4 py-6 text-sm text-clinical-slate">Waiting for new feedback events.</div> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
