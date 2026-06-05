"use client";

import { CheckCircle2, Loader2, MessageSquareText, Phone, Search, ShieldCheck, Star, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { listPublicFeedbackDoctors, submitFeedback } from "@/lib/api";
import type { FeedbackPayload, PublicFeedbackDoctor } from "@/lib/api";

const categories = [
  { label: "Complaint", value: "COMPLAINT" },
  { label: "Safety", value: "SAFETY" },
  { label: "Suggestion", value: "SUGGESTION" },
  { label: "Praise", value: "PRAISE" },
  { label: "Staff conduct", value: "STAFF_CONDUCT" },
  { label: "Patient rights", value: "PATIENT_RIGHTS" },
] as const;

function severityFor(category: FeedbackPayload["category"], rating: number): FeedbackPayload["severity"] {
  if (category === "SAFETY" || rating <= 1) {
    return "CRITICAL";
  }
  if (category === "COMPLAINT" || category === "PATIENT_RIGHTS" || category === "STAFF_CONDUCT" || rating <= 2) {
    return "HIGH";
  }
  if (rating === 3 || category === "SUGGESTION") {
    return "MEDIUM";
  }
  return "LOW";
}

export default function DoctorFeedbackPage() {
  const [sessionId, setSessionId] = useState("");
  const [doctors, setDoctors] = useState<PublicFeedbackDoctor[]>([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<FeedbackPayload["category"]>("COMPLAINT");
  const [comment, setComment] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  useEffect(() => {
    let active = true;

    setLoadingDoctors(true);
    listPublicFeedbackDoctors()
      .then((items) => {
        if (active) {
          setDoctors(items);
        }
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Doctor list is not available.");
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
  }, []);

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
  const canSubmit = selectedDoctor && phoneNumber.trim() && rating > 0 && comment.trim() && sessionId && status !== "sending";

  const handleSubmit = async () => {
    if (!selectedDoctor || !canSubmit) {
      return;
    }
    setStatus("sending");
    setErrorMessage("");
    try {
      await submitFeedback({
        target_type: "DOCTOR",
        target_staff_profile: selectedDoctor.id,
        department: selectedDoctor.department_names[0] || "Doctor feedback",
        room_qr_id: `doctor-${selectedDoctor.id}`,
        anonymous_session_id: sessionId,
        phone_number: phoneNumber,
        category,
        severity: severityFor(category, rating),
        language: "uz-Latn",
        rating,
        comment,
      });
      setStatus("sent");
    } catch (error) {
      setStatus("idle");
      setErrorMessage(error instanceof Error ? error.message : "Feedback submission failed.");
    }
  };

  if (status === "sent") {
    return (
      <main className="min-h-screen bg-clinical-wash px-4 py-6">
        <section className="mx-auto max-w-lg rounded-md border border-clinical-line bg-white px-5 py-10 text-center shadow-clinical">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-emerald-50 text-clinical-green">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-clinical-ink">Feedback submitted</h1>
          <p className="mt-2 text-sm text-clinical-slate">The head doctor panel received this feedback.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-clinical-wash px-4 py-5">
      <section className="mx-auto max-w-3xl rounded-md border border-clinical-line bg-white shadow-clinical">
        <div className="border-b border-clinical-line px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-clinical-blue text-white">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-clinical-ink">Doctor feedback</h1>
              <p className="text-sm text-clinical-slate">Anonymous message with phone verification data for governance.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 px-5 py-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-md border border-clinical-line">
            <div className="border-b border-clinical-line p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-clinical-slate" />
                <input
                  value={doctorSearch}
                  onChange={(event) => setDoctorSearch(event.target.value)}
                  className="h-9 w-full rounded-md border border-clinical-line bg-white pl-9 pr-3 text-sm text-clinical-ink outline-none focus:border-clinical-blue"
                  placeholder="Search doctor"
                />
              </div>
            </div>
            <div className="max-h-[480px] divide-y divide-clinical-line overflow-y-auto">
              {filteredDoctors.map((doctor) => {
                const selected = doctor.id === selectedDoctorId;
                return (
                  <button
                    key={doctor.id}
                    type="button"
                    onClick={() => setSelectedDoctorId(doctor.id)}
                    className={`block w-full px-3 py-3 text-left ${selected ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${selected ? "bg-clinical-blue text-white" : "bg-slate-100 text-clinical-slate"}`}>
                        <Stethoscope className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-clinical-ink">{doctor.display_name}</h2>
                        <p className="mt-1 text-xs text-clinical-slate">{doctor.primary_hospital_name || doctor.organization_name}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-clinical-slate">{doctor.department_names.join(", ") || doctor.role}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {!filteredDoctors.length ? (
                <div className="px-3 py-8 text-sm text-clinical-slate">{loadingDoctors ? "Loading doctors" : "No doctors found."}</div>
              ) : null}
            </div>
          </section>

          <section className="space-y-5">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-clinical-ink">
                <Phone className="h-4 w-4 text-clinical-blue" />
                Phone number
              </span>
              <input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                type="tel"
                className="h-11 w-full rounded-md border border-clinical-line bg-white px-3 text-base text-clinical-ink outline-none focus:border-clinical-blue"
                placeholder="+998901234567"
              />
            </label>

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
                      className={`flex aspect-square items-center justify-center rounded-md border ${
                        active ? "border-clinical-amber bg-amber-50 text-clinical-amber" : "border-clinical-line bg-white text-slate-300 hover:border-clinical-blue"
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
                      category === item.value ? "border-clinical-blue bg-blue-50 text-clinical-blue" : "border-clinical-line bg-white text-clinical-slate"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-clinical-ink">Feedback</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={5}
                className="w-full rounded-md border border-clinical-line bg-white px-3 py-3 text-base text-clinical-ink outline-none focus:border-clinical-blue"
                placeholder="Write your complaint, safety concern, suggestion, or praise"
              />
            </label>

            <div className="rounded-md border border-clinical-line bg-slate-50 px-3 py-3">
              <div className="flex items-start gap-2 text-sm text-clinical-slate">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-clinical-green" />
                <span>{selectedDoctor ? `${selectedDoctor.display_name} · session ${sessionId.slice(0, 8)}` : `Session ${sessionId.slice(0, 8) || "creating"}`}</span>
              </div>
            </div>

            {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-clinical-blue px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {status === "sending" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Submit feedback
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}
