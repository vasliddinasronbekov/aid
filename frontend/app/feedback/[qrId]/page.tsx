"use client";

import { CheckCircle2, Loader2, MessageSquareText, Phone, ShieldCheck, Star } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { requestFeedbackPhoneVerification, submitFeedback, verifyFeedbackPhone } from "@/lib/api";
import type { FeedbackPayload } from "@/lib/api";

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

export default function PatientFeedbackPage() {
  const params = useParams<{ qrId: string }>();
  const qrId = decodeURIComponent(params.qrId);
  const roomContext = useMemo(() => parseQrId(qrId), [qrId]);

  const [anonymousSessionId, setAnonymousSessionId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [debugCode, setDebugCode] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "sending" | "code" | "verified">("idle");
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<(typeof categories)[number]["value"]>("COMPLAINT");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "queued">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = crypto.randomUUID();
    setAnonymousSessionId(token);
  }, []);

  const requestCode = async () => {
    if (!phoneNumber.trim()) {
      return;
    }
    setErrorMessage("");
    setChallengeId("");
    setVerificationToken("");
    setVerificationStatus("sending");
    try {
      const response = await requestFeedbackPhoneVerification({
        phone_number: phoneNumber,
        target_type: roomContext.targetType,
        room_qr_id: roomContext.targetType === "ROOM" ? qrId : undefined,
        target_staff_profile: roomContext.targetStaffProfile,
      });
      setChallengeId(response.challenge_id);
      setDebugCode(response.debug_verification_code ?? "");
      setVerificationStatus("code");
    } catch (error) {
      setVerificationStatus("idle");
      setErrorMessage(error instanceof Error ? error.message : "Unable to send verification code.");
    }
  };

  const verifyCode = async () => {
    if (!challengeId || !verificationCode.trim()) {
      return;
    }
    setErrorMessage("");
    setVerificationStatus("sending");
    try {
      const response = await verifyFeedbackPhone(challengeId, verificationCode);
      setVerificationToken(response.verification_token);
      setVerificationStatus("verified");
    } catch (error) {
      setVerificationStatus("code");
      setErrorMessage(error instanceof Error ? error.message : "Invalid verification code.");
    }
  };

  const handleSubmit = async () => {
    if (!rating || !anonymousSessionId || !challengeId || !verificationToken) {
      return;
    }

    const severity: FeedbackPayload["severity"] =
      category === "SAFETY" || rating <= 2 ? "HIGH" : rating === 3 ? "MEDIUM" : "LOW";

    setStatus("sending");
    const payload = {
      target_type: roomContext.targetType,
      target_staff_profile: roomContext.targetStaffProfile,
      department: roomContext.department,
      room_qr_id: qrId,
      anonymous_session_id: anonymousSessionId,
      phone_verification_challenge: challengeId,
      phone_verification_token: verificationToken,
      category,
      severity,
      language: "en",
      rating,
      comment,
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

  return (
    <main className="min-h-screen bg-clinical-wash px-4 py-5">
      <section className="mx-auto max-w-md rounded-md border border-clinical-line bg-white shadow-clinical">
        <div className="border-b border-clinical-line px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-clinical-blue text-white">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-clinical-ink">Patient feedback</h1>
              <p className="text-sm text-clinical-slate">
                {roomContext.targetType === "DOCTOR" ? roomContext.room : `${roomContext.department}, room ${roomContext.room}`}
              </p>
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
            <div className="rounded-md border border-clinical-line bg-slate-50 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-clinical-ink">
                <Phone className="h-4 w-4 text-clinical-blue" />
                Phone verification
              </div>
              <div className="grid gap-2">
                <input
                  value={phoneNumber}
                  onChange={(event) => {
                    setPhoneNumber(event.target.value);
                    setVerificationToken("");
                  }}
                  type="tel"
                  className="h-11 rounded-md border border-clinical-line bg-white px-3 text-base text-clinical-ink focus:border-clinical-blue"
                  placeholder="+998901234567"
                  disabled={verificationStatus === "verified"}
                />
                {verificationStatus === "code" || (verificationStatus === "sending" && challengeId) ? (
                  <input
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    inputMode="numeric"
                    className="h-11 rounded-md border border-clinical-line bg-white px-3 text-base text-clinical-ink focus:border-clinical-blue"
                    placeholder="Verification code"
                  />
                ) : null}
              </div>
              {debugCode ? <p className="mt-2 text-xs text-clinical-slate">Dev code: {debugCode}</p> : null}
              {errorMessage ? <p className="mt-2 text-xs text-red-700">{errorMessage}</p> : null}
              <div className="mt-3 flex gap-2">
                {verificationStatus === "verified" ? (
                  <span className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-clinical-green">
                    <ShieldCheck className="h-4 w-4" />
                    Verified
                  </span>
                ) : verificationStatus === "code" || (verificationStatus === "sending" && challengeId) ? (
                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={verificationStatus === "sending"}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-clinical-blue px-3 text-sm font-semibold text-white disabled:bg-slate-300"
                  >
                    {verificationStatus === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Verify
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={requestCode}
                    disabled={!phoneNumber.trim() || verificationStatus === "sending"}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-clinical-blue px-3 text-sm font-semibold text-white disabled:bg-slate-300"
                  >
                    {verificationStatus === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                    Send code
                  </button>
                )}
              </div>
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
                <span>Session {anonymousSessionId.slice(0, 8) || "creating"}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!rating || !verificationToken || status === "sending"}
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
