"use client";

import { CheckCircle2, Loader2, MessageSquareText, Phone, Search, ShieldCheck, Star, Stethoscope } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { listPublicFeedbackDoctors, submitFeedback } from "@/lib/api";
import type { FeedbackPayload, PublicFeedbackDoctor } from "@/lib/api";

type FeedbackTarget = Extract<FeedbackPayload["target_type"], "ROOM" | "DOCTOR">;

function parseQrId(qrId: string) {
  const normalized = qrId.replace(/_/g, "-");
  const parts = normalized.split("-").filter(Boolean);
  if (parts[0]?.toLowerCase() === "doctor" && Number.isFinite(Number(parts[1]))) {
    return {
      targetType: "DOCTOR" as const,
      targetStaffProfile: Number(parts[1]),
      department: "Doctor feedback",
      room: `Doctor #${parts[1]}`,
    };
  }
  const room = parts.at(-1) ?? normalized;
  const department = parts.length > 1 ? parts.slice(0, -1).join(" ") : "General";
  return {
    targetType: "ROOM" as const,
    targetStaffProfile: undefined,
    department: department.replace(/\b\w/g, (char) => char.toUpperCase()),
    room,
  };
}

const categories = [
  { label: "Complaint", value: "COMPLAINT" },
  { label: "Suggestion", value: "SUGGESTION" },
  { label: "Safety", value: "SAFETY" },
  { label: "Praise", value: "PRAISE" },
] as const;

function targetSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9:-]+/g, "-").replace(/^-+|-+$/g, "") || "manual";
}

export default function PatientFeedbackPage() {
  const params = useParams<{ qrId: string }>();
  const qrId = decodeURIComponent(params.qrId);
  const roomContext = useMemo(() => parseQrId(qrId), [qrId]);

  const [anonymousSessionId, setAnonymousSessionId] = useState("");
  const [targetType, setTargetType] = useState<FeedbackTarget>(roomContext.targetType);
  const [doctors, setDoctors] = useState<PublicFeedbackDoctor[]>([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [doctorLoadError, setDoctorLoadError] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<(typeof categories)[number]["value"]>("COMPLAINT");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "queued">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = crypto.randomUUID();
    setAnonymousSessionId(token);
  }, []);

  useEffect(() => {
    setTargetType(roomContext.targetType);
  }, [roomContext.targetType]);

  useEffect(() => {
    let active = true;

    setLoadingDoctors(true);
    listPublicFeedbackDoctors()
      .then((items) => {
        if (!active) {
          return;
        }
        setDoctors(items);
        setDoctorLoadError("");
        if (roomContext.targetType === "DOCTOR" && roomContext.targetStaffProfile) {
          const matchedDoctor = items.find((doctor) => doctor.staff_profile_id === roomContext.targetStaffProfile);
          if (matchedDoctor) {
            setSelectedDoctorId(matchedDoctor.id);
          }
        }
      })
      .catch((error) => {
        if (active) {
          setDoctorLoadError(error instanceof Error ? error.message : "Doctor list is not available.");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingDoctors(false);
        }
      });

    return () => {
      active = false;
    };
  }, [roomContext.targetStaffProfile, roomContext.targetType]);

  const filteredDoctors = useMemo(() => {
    const query = doctorSearch.trim().toLowerCase();
    if (!query) {
      return doctors;
    }
    return doctors.filter((doctor) =>
      [doctor.display_name, doctor.primary_hospital_name, doctor.organization_name, doctor.department_names.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [doctorSearch, doctors]);

  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId);
  const typedDoctorName = doctorSearch.trim();
  const fallbackStaffProfileId = roomContext.targetType === "DOCTOR" ? roomContext.targetStaffProfile : undefined;
  const selectedStaffProfileId = selectedDoctor
    ? selectedDoctor.staff_profile_id ?? undefined
    : typedDoctorName
      ? undefined
      : fallbackStaffProfileId;
  const doctorLabel = selectedDoctor?.doctor_label || (selectedStaffProfileId ? "" : typedDoctorName);
  const doctorDisplayName = selectedDoctor?.display_name || doctorLabel || (selectedStaffProfileId ? roomContext.room : "");
  const hasDoctorTarget = targetType !== "DOCTOR" || Boolean(selectedStaffProfileId || doctorLabel);
  const canSubmit =
    Boolean(rating && anonymousSessionId && phoneNumber.trim() && comment.trim() && hasDoctorTarget) && status !== "sending";

  const handleSubmit = async () => {
    const normalizedPhone = phoneNumber.trim();
    const normalizedComment = comment.trim();
    const phoneDigits = normalizedPhone.replace(/\D/g, "");
    if (!canSubmit || !normalizedPhone || !normalizedComment) {
      return;
    }
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      setErrorMessage("Enter a valid phone number.");
      return;
    }

    const severity: FeedbackPayload["severity"] =
      category === "SAFETY" || rating <= 2 ? "HIGH" : rating === 3 ? "MEDIUM" : "LOW";

    setStatus("sending");
    const payload = {
      target_type: targetType,
      target_staff_profile: targetType === "DOCTOR" ? selectedStaffProfileId : undefined,
      target_doctor_label: targetType === "DOCTOR" && !selectedStaffProfileId ? doctorLabel : undefined,
      department: targetType === "DOCTOR" ? selectedDoctor?.department_names[0] || "Doctor feedback" : roomContext.department,
      room_qr_id: targetType === "DOCTOR" ? `doctor-${targetSlug(selectedDoctor?.id || doctorLabel || String(selectedStaffProfileId ?? ""))}` : qrId,
      anonymous_session_id: anonymousSessionId,
      phone_number: normalizedPhone,
      category,
      severity,
      language: "en",
      rating,
      comment: normalizedComment,
    };

    try {
      await submitFeedback(payload);
      setStatus("sent");
    } catch {
      window.localStorage.setItem(`anonymous-feedback:${anonymousSessionId}`, JSON.stringify(payload));
      setStatus("queued");
    }
  };

  const submitted = status === "sent" || status === "queued";
  const contextLabel =
    targetType === "DOCTOR" ? doctorDisplayName || "Doctor feedback" : `${roomContext.department}, room ${roomContext.room}`;

  return (
    <main className="min-h-screen bg-clinical-wash px-4 py-5">
      <section className="mx-auto max-w-xl rounded-md border border-clinical-line bg-white shadow-clinical">
        <div className="border-b border-clinical-line px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-clinical-blue text-white">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-clinical-ink">Patient feedback</h1>
              <p className="text-sm text-clinical-slate">{contextLabel}</p>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-emerald-50 text-clinical-green">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-clinical-ink">
              {status === "sent" ? "Submitted" : "Queued"}
            </h2>
            <p className="mt-2 text-sm text-clinical-slate">
              {status === "sent" ? "Thank you for your feedback." : "Your feedback will sync from this device."}
            </p>
          </div>
        ) : (
          <div className="space-y-6 px-5 py-6">
            <div>
              <span className="mb-2 block text-sm font-medium text-clinical-ink">Target</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Room", value: "ROOM" as const },
                  { label: "Doctor", value: "DOCTOR" as const },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTargetType(item.value)}
                    className={`h-10 rounded-md border px-3 text-sm font-medium ${
                      targetType === item.value
                        ? "border-clinical-blue bg-blue-50 text-clinical-blue"
                        : "border-clinical-line bg-white text-clinical-slate"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {targetType === "DOCTOR" ? (
              <div className="rounded-md border border-clinical-line">
                <div className="border-b border-clinical-line p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-clinical-slate" />
                    <input
                      value={doctorSearch}
                      onChange={(event) => {
                        setDoctorSearch(event.target.value);
                        setSelectedDoctorId(null);
                      }}
                      className="h-9 w-full rounded-md border border-clinical-line bg-white pl-9 pr-3 text-sm text-clinical-ink outline-none focus:border-clinical-blue"
                      placeholder="Search or type doctor name"
                    />
                  </div>
                </div>
                <div className="max-h-56 divide-y divide-clinical-line overflow-y-auto">
                  {filteredDoctors.slice(0, 12).map((doctor) => {
                    const selected = doctor.id === selectedDoctorId;
                    return (
                      <button
                        key={doctor.id}
                        type="button"
                        onClick={() => setSelectedDoctorId(doctor.id)}
                        className={`block w-full px-3 py-3 text-left ${selected ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                              selected ? "bg-clinical-blue text-white" : "bg-slate-100 text-clinical-slate"
                            }`}
                          >
                            <Stethoscope className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-sm font-semibold text-clinical-ink">{doctor.display_name}</h2>
                            <p className="mt-1 text-xs text-clinical-slate">{doctor.primary_hospital_name || doctor.organization_name}</p>
                            <p className="mt-1 line-clamp-1 text-xs text-clinical-slate">
                              {doctor.department_names.join(", ") || doctor.role}
                              {doctor.source === "medical_record" ? ` · ${doctor.record_count ?? 1} records` : ""}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {!filteredDoctors.length ? (
                    <div className="px-3 py-6 text-sm text-clinical-slate">{loadingDoctors ? "Loading doctors" : "No matching doctors."}</div>
                  ) : null}
                </div>
                {doctorLoadError ? <p className="border-t border-clinical-line px-3 py-2 text-xs text-red-700">{doctorLoadError}</p> : null}
              </div>
            ) : null}

            <div className="rounded-md border border-clinical-line bg-slate-50 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-clinical-ink">
                <Phone className="h-4 w-4 text-clinical-blue" />
                Phone number
              </div>
              <input
                value={phoneNumber}
                onChange={(event) => {
                  setPhoneNumber(event.target.value);
                  setErrorMessage("");
                }}
                type="tel"
                className="h-11 w-full rounded-md border border-clinical-line bg-white px-3 text-base text-clinical-ink focus:border-clinical-blue"
                placeholder="+998901234567"
              />
              {errorMessage ? <p className="mt-2 text-xs text-red-700">{errorMessage}</p> : null}
            </div>

            <div>
              <span className="mb-3 block text-sm font-medium text-clinical-ink">Rating</span>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = value <= rating;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} star rating`}
                      onClick={() => setRating(value)}
                      className={`flex aspect-square items-center justify-center rounded-md border transition ${
                        active
                          ? "border-clinical-amber bg-amber-50 text-clinical-amber"
                          : "border-clinical-line bg-white text-slate-300 hover:border-clinical-blue"
                      }`}
                    >
                      <Star className={`h-7 w-7 ${active ? "fill-current" : ""}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-clinical-ink">Category</span>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(item.value)}
                    className={`h-10 rounded-md border px-3 text-sm font-medium ${
                      category === item.value
                        ? "border-clinical-blue bg-blue-50 text-clinical-blue"
                        : "border-clinical-line bg-white text-clinical-slate"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-clinical-ink">Comment</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={5}
                className="w-full rounded-md border border-clinical-line bg-white px-3 py-3 text-base text-clinical-ink shadow-sm focus:border-clinical-blue"
                placeholder="Share a complaint, concern, or thanks"
              />
            </label>

            <div className="rounded-md border border-clinical-line bg-slate-50 px-3 py-3">
              <div className="flex items-start gap-2 text-sm text-clinical-slate">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-clinical-green" />
                <span>
                  {targetType === "DOCTOR" && doctorDisplayName
                    ? `${doctorDisplayName} · session ${anonymousSessionId.slice(0, 8)}`
                    : `Session ${anonymousSessionId.slice(0, 8) || "creating"}`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-clinical-blue px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {status === "sending" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Submit
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
