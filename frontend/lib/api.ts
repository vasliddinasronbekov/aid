export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000/api";

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, "") ?? "ws://localhost:8000";

export type TriageStatus = "RED" | "YELLOW" | "GREEN";

export interface Patient {
  id: number;
  patient_identifier: string;
  first_name: string;
  last_name: string;
  display_name: string;
  date_of_birth: string | null;
  phone_number: string;
  region_code: string;
  district: string;
  department: string;
  triage_status: TriageStatus;
  chronic_biomarkers: Record<string, unknown>;
  severe_chronic_tags: string[];
  has_severe_chronic_risk: boolean;
}

export interface MedicalRecordPayload {
  patient: number;
  doctor_id: string;
  diagnosis: string;
  prescriptions: string;
  clinical_notes: string;
  imaging_safety_metadata?: Record<string, unknown>;
  record_type?: "CONSULTATION" | "IMAGING" | "DISCHARGE" | "FOLLOW_UP";
}

export interface FeedbackPayload {
  target_type: "ROOM" | "DOCTOR" | "DEPARTMENT" | "HOSPITAL";
  target_staff_profile?: number;
  department: string;
  room_qr_id: string;
  anonymous_session_id: string;
  phone_verification_challenge: string;
  phone_verification_token: string;
  category: "GENERAL" | "COMPLAINT" | "SUGGESTION" | "PRAISE" | "SAFETY" | "STAFF_CONDUCT" | "WAIT_TIME" | "CLEANLINESS" | "PATIENT_RIGHTS";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  language: string;
  rating: number;
  comment: string;
}

export interface PhoneVerificationRequestPayload {
  phone_number: string;
  target_type: FeedbackPayload["target_type"];
  room_qr_id?: string;
  target_staff_profile?: number;
}

export interface PhoneVerificationRequestResponse {
  challenge_id: string;
  phone_last4: string;
  expires_at: string;
  delivery_channel: string;
  delivery_status: string;
  debug_verification_code?: string;
}

export interface PhoneVerificationVerifyResponse {
  challenge_id: string;
  verification_token: string;
  verified_at: string;
}

export type AIAssistantMode =
  | "CLINICAL_COPILOT"
  | "RCA_COACH"
  | "DIGITAL_TWIN"
  | "PERINATAL_REVIEW"
  | "PATIENT_COMMUNICATION";

export type AIAssistantSafetyStatus = "DRAFT" | "ADVISORY" | "ESCALATED" | "CLOSED";
export type AIAssistantRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AIAssistantRole = "SYSTEM" | "USER" | "ASSISTANT" | "TOOL" | "SAFETY";

export interface AIAssistantMessage {
  id: number;
  session: number;
  role: AIAssistantRole;
  content: string;
  risk_level: AIAssistantRiskLevel;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AIAssistantSession {
  id: number;
  public_id: string;
  organization: number | null;
  hospital: number | null;
  patient: number | null;
  patient_name: string;
  medical_record: number | null;
  staff_profile: number | null;
  staff_name: string;
  created_by: number | null;
  created_by_name: string;
  mode: AIAssistantMode;
  safety_status: AIAssistantSafetyStatus;
  title: string;
  context_snapshot: Record<string, unknown>;
  closed_at: string | null;
  messages: AIAssistantMessage[];
  created_at: string;
  updated_at: string;
}

export interface CreateAIAssistantSessionPayload {
  patient?: number;
  medical_record?: number;
  mode?: AIAssistantMode;
  title?: string;
  context_snapshot?: Record<string, unknown>;
}

export interface AIAssistantMessageResponse {
  session: AIAssistantSession;
  user_message: AIAssistantMessage;
  assistant_message: AIAssistantMessage;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AIErrorLog {
  id: number;
  organization: number | null;
  hospital: number | null;
  medical_record: number;
  patient_name: string;
  doctor_id: string;
  medical_record_created_at: string;
  medical_record_ai_review_status: "PENDING" | "CLEAR" | "NEEDS_REVIEW" | "CRITICAL";
  error_type: "ENTRY_OMISSION" | "PRESCRIPTION_MISMATCH" | "ETHICAL_DEVIATION" | "IMAGING_SAFETY" | "DIGITAL_TWIN_RISK";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  rca_description: string;
  protocol_reference: string;
  reviewed_by_admin: boolean;
  created_at: string;
}

function cookieValue(name: string) {
  if (typeof document === "undefined") {
    return "";
  }
  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));
  return cookie ? decodeURIComponent(cookie.slice(encodedName.length)) : "";
}

let csrfCookieRequest: Promise<void> | null = null;

async function ensureCsrfCookie() {
  if (typeof document === "undefined" || cookieValue("csrftoken")) {
    return;
  }

  csrfCookieRequest ??= fetch(`${API_BASE_URL}/csrf/`, {
    credentials: "include",
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`CSRF setup failed with ${response.status}`);
    }
  });

  try {
    await csrfCookieRequest;
  } finally {
    csrfCookieRequest = null;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const unsafeMethod = !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (unsafeMethod) {
    await ensureCsrfCookie();
    const token = cookieValue("csrftoken");
    if (token && !headers.has("X-CSRFToken")) {
      headers.set("X-CSRFToken", token);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: init?.credentials ?? "include",
    headers,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function createMedicalRecord(payload: MedicalRecordPayload) {
  return apiFetch("/medical-records/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitFeedback(payload: FeedbackPayload) {
  return apiFetch("/feedback/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function requestFeedbackPhoneVerification(payload: PhoneVerificationRequestPayload) {
  return apiFetch<PhoneVerificationRequestResponse>("/feedback/request-phone-verification/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyFeedbackPhone(challengeId: string, code: string) {
  return apiFetch<PhoneVerificationVerifyResponse>("/feedback/verify-phone/", {
    method: "POST",
    body: JSON.stringify({ challenge_id: challengeId, code }),
  });
}

export function createAIAssistantSession(payload: CreateAIAssistantSessionPayload) {
  return apiFetch<AIAssistantSession>("/ai-assistant-sessions/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listAIAssistantMessages(sessionId: number) {
  return apiFetch<AIAssistantMessage[]>(`/ai-assistant-sessions/${sessionId}/messages/`);
}

export function sendAIAssistantMessage(sessionId: number, content: string, metadata: Record<string, unknown> = {}) {
  return apiFetch<AIAssistantMessageResponse>(`/ai-assistant-sessions/${sessionId}/messages/`, {
    method: "POST",
    body: JSON.stringify({ content, metadata }),
  });
}

export function closeAIAssistantSession(sessionId: number) {
  return apiFetch<AIAssistantSession>(`/ai-assistant-sessions/${sessionId}/close/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function listAIErrorLogs(query = "reviewed_by_admin=false") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<AIErrorLog>>(`/ai-error-logs/${suffix}`);
}

export function updateAIErrorLog(logId: number, payload: Partial<Pick<AIErrorLog, "reviewed_by_admin">>) {
  return apiFetch<AIErrorLog>(`/ai-error-logs/${logId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function notificationsUrl(audience: "head_physicians" | "regional_doctor", scopeId?: string) {
  const encodedScope = scopeId ? `/${encodeURIComponent(scopeId)}` : "";
  return `${WS_BASE_URL}/ws/notifications/${audience}${encodedScope}/`;
}
