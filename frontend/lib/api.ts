export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://api.aid-ai.uz/api";

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, "") ?? "ws://api.aid-ai.uz";

export type TriageStatus = "RED" | "YELLOW" | "GREEN";
export type StaffRole =
  | "SYSTEM_ADMIN"
  | "HOSPITAL_ADMIN"
  | "HEAD_PHYSICIAN"
  | "PHYSICIAN"
  | "NURSE"
  | "REGISTRAR"
  | "COMPLIANCE_OFFICER"
  | "RESEARCHER"
  | "AUDITOR"
  | "READ_ONLY";

export interface AuthStaffProfile {
  id: number;
  public_id: string;
  organization: number;
  organization_name: string;
  primary_hospital: number | null;
  primary_hospital_name: string;
  role: StaffRole;
  employment_status: "ACTIVE" | "SUSPENDED" | "TERMINATED";
  license_number: string;
  phone_number: string;
  metadata: Record<string, unknown>;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  is_superuser: boolean;
  staff_profile?: AuthStaffProfile;
}

export interface StaffProfile {
  id: number;
  public_id: string;
  user: number;
  user_username: string;
  user_display_name: string;
  organization: number | null;
  organization_name: string;
  primary_hospital: number | null;
  primary_hospital_name: string;
  departments: number[];
  role: StaffRole;
  employment_status: "ACTIVE" | "SUSPENDED" | "TERMINATED";
  license_number: string;
  phone_number: string;
  last_privacy_training_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email?: string;
  password: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  hospital_name: string;
  region_code: string;
  role: Extract<StaffRole, "HOSPITAL_ADMIN" | "HEAD_PHYSICIAN" | "PHYSICIAN" | "NURSE">;
  phone_number?: string;
  license_number?: string;
}

export interface Patient {
  id: number;
  public_id: string;
  organization: number | null;
  organization_name: string;
  hospital: number | null;
  hospital_name: string;
  department_ref: number | null;
  department_name: string;
  room: number | null;
  room_label: string;
  patient_identifier: string;
  medical_record_number: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  display_name: string;
  date_of_birth: string | null;
  gender: "FEMALE" | "MALE" | "OTHER" | "UNKNOWN";
  phone_number: string;
  address_line: string;
  region_code: string;
  district: string;
  department: string;
  triage_status: TriageStatus;
  chronic_biomarkers: Record<string, unknown>;
  emergency_contact: Record<string, unknown>;
  consent_preferences: Record<string, unknown>;
  severe_chronic_tags: string[];
  has_severe_chronic_risk: boolean;
  last_marker_sync_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientPayload {
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth?: string | null;
  gender?: Patient["gender"];
  phone_number?: string;
  address_line?: string;
  region_code: string;
  district?: string;
  department?: string;
  triage_status?: TriageStatus;
  medical_record_number?: string;
  chronic_biomarkers?: Record<string, unknown>;
  emergency_contact?: Record<string, unknown>;
  consent_preferences?: Record<string, unknown>;
}

export interface Hospital {
  id: number;
  public_id: string;
  organization: number | null;
  organization_name: string;
  code: string;
  name: string;
  facility_type: "PRIMARY_CARE" | "DISTRICT" | "REGIONAL" | "SPECIALTY" | "MOBILE_CLINIC" | string;
  address_line: string;
  city: string;
  region_code: string;
  phone_number: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  public_id: string;
  organization: number | null;
  organization_name: string;
  hospital: number;
  hospital_name: string;
  code: string;
  name: string;
  specialty: string;
  floor: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: number;
  public_id: string;
  organization: number | null;
  hospital: number;
  hospital_name: string;
  department: number;
  department_name: string;
  room_number: string;
  room_qr_id: string;
  care_level: "GENERAL" | "OBSERVATION" | "HIGH_DEPENDENCY" | "ICU" | "MATERNITY" | "PEDIATRIC" | string;
  bed_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BackendAppointmentStatus = "SCHEDULED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type BackendAppointmentPriority = "ROUTINE" | "SOON" | "URGENT" | "CRITICAL";
export type BackendAppointmentType =
  | "PRIMARY_CARE"
  | "FOLLOW_UP"
  | "PATRONAGE"
  | "PERINATAL"
  | "LAB"
  | "IMAGING"
  | "SPECIALIST"
  | "EMERGENCY";

export interface BackendAppointment {
  id: number;
  public_id: string;
  organization: number | null;
  hospital: number | null;
  hospital_name: string;
  department_ref: number | null;
  department_name: string;
  room: number | null;
  room_label: string;
  patient: number;
  patient_name: string;
  patient_triage_status: TriageStatus;
  assigned_provider: number | null;
  provider_name: string;
  created_by: number | null;
  created_by_name: string;
  appointment_type: BackendAppointmentType;
  status: BackendAppointmentStatus;
  priority: BackendAppointmentPriority;
  scheduled_start: string;
  scheduled_end: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string;
  reason: string;
  notes: string;
  external_reference: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentPayload {
  patient: number;
  appointment_type: BackendAppointmentType;
  status?: BackendAppointmentStatus;
  priority: BackendAppointmentPriority;
  scheduled_start: string;
  scheduled_end?: string | null;
  reason: string;
  notes?: string;
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

export interface RCAErrorSummary {
  error_type: AIErrorLog["error_type"];
  severity: AIErrorLog["severity"];
  total: number;
}

export interface FeedbackSummary {
  target_type: FeedbackPayload["target_type"];
  department: string;
  room_qr_id: string;
  target_staff_profile: number | null;
  avg_rating: number | null;
  total: number;
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

export interface MedicalRecord {
  id: number;
  public_id: string;
  organization: number | null;
  hospital: number | null;
  department_ref: number | null;
  patient: number;
  patient_name: string;
  patient_triage_status: TriageStatus;
  attending_provider: number | null;
  doctor_id: string;
  diagnosis: string;
  prescriptions: string;
  clinical_notes: string;
  imaging_safety_metadata: Record<string, unknown>;
  record_type: "CONSULTATION" | "IMAGING" | "DISCHARGE" | "FOLLOW_UP";
  discharge_status: "ACTIVE" | "DISCHARGED";
  active_call_alert_sent_at: string | null;
  created_at: string;
  updated_at: string;
  ai_review_status?: "PENDING" | "CLEAR" | "NEEDS_REVIEW" | "CRITICAL";
  ai_error_logs?: AIErrorLog[];
}

export interface Encounter {
  id: number;
  public_id: string;
  organization: number | null;
  hospital: number | null;
  hospital_name: string;
  department_ref: number | null;
  department_name: string;
  room: number | null;
  room_label: string;
  patient: number;
  patient_name: string;
  appointment: number | null;
  provider: number | null;
  provider_name: string;
  encounter_type: "OUTPATIENT" | "INPATIENT" | "EMERGENCY" | "HOME_VISIT" | "TELEHEALTH" | "PERINATAL";
  status: "OPEN" | "SIGNED" | "AMENDED" | "CANCELLED";
  started_at: string;
  ended_at: string | null;
  chief_complaint: string;
  assessment: string;
  plan: string;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientVitalRecord {
  id: number;
  public_id: string;
  patient: number;
  patient_name: string;
  encounter: number | null;
  organization: number | null;
  hospital: number | null;
  recorded_by: number | null;
  recorded_by_name: string;
  measured_at: string;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: string | null;
  temperature_c: string | null;
  glucose_mmol_l: string | null;
  weight_kg: string | null;
  height_cm: string | null;
  pain_score: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PatientAllergyRecord {
  id: number;
  public_id: string;
  patient: number;
  patient_name: string;
  organization: number | null;
  hospital: number | null;
  recorded_by: number | null;
  recorded_by_name: string;
  allergen: string;
  reaction: string;
  severity: "LOW" | "MODERATE" | "HIGH" | "LIFE_THREATENING";
  status: "ACTIVE" | "INACTIVE" | "ENTERED_IN_ERROR";
  onset_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CareTeamMembership {
  id: number;
  public_id: string;
  patient: number;
  patient_name: string;
  staff_profile: number;
  staff_name: string;
  organization: number | null;
  organization_name: string;
  hospital: number | null;
  hospital_name: string;
  role: "PRIMARY_PHYSICIAN" | "NURSE" | "SPECIALIST" | "CARE_COORDINATOR" | "REGISTRAR" | "SOCIAL_WORKER" | "OTHER";
  starts_at: string;
  ends_at: string | null;
  is_primary: boolean;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ClinicalTask {
  id: number;
  public_id: string;
  organization: number | null;
  hospital: number | null;
  hospital_name: string;
  department_ref: number | null;
  department_name: string;
  patient: number | null;
  patient_name: string;
  encounter: number | null;
  appointment: number | null;
  assigned_to: number | null;
  assigned_to_name: string;
  created_by: number | null;
  created_by_name: string;
  task_type: "FOLLOW_UP" | "MEDICATION_REVIEW" | "LAB_REVIEW" | "IMAGING_REVIEW" | "DISCHARGE_PREP" | "PATRONAGE_VISIT" | "CARE_PLAN" | "ADMIN";
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "ROUTINE" | "SOON" | "URGENT" | "CRITICAL";
  title: string;
  description: string;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  completion_note: string;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClinicalTaskPayload {
  patient: number;
  assigned_to?: number | null;
  task_type: ClinicalTask["task_type"];
  status?: ClinicalTask["status"];
  priority: ClinicalTask["priority"];
  title: string;
  description: string;
  due_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface Referral {
  id: number;
  public_id: string;
  organization: number | null;
  hospital: number | null;
  patient: number;
  patient_name: string;
  encounter: number | null;
  source_department: number | null;
  source_department_name: string;
  target_hospital: number | null;
  target_hospital_name: string;
  target_department: number | null;
  target_department_name: string;
  requested_by: number | null;
  requested_by_name: string;
  assigned_to: number | null;
  assigned_to_name: string;
  referral_type: "SPECIALIST" | "HOSPITAL_TRANSFER" | "IMAGING" | "LAB" | "SOCIAL_SUPPORT" | "EXTERNAL";
  status: "DRAFT" | "REQUESTED" | "ACCEPTED" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  priority: "ROUTINE" | "SOON" | "URGENT" | "CRITICAL";
  reason: string;
  clinical_summary: string;
  requested_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string;
  external_reference: string;
  created_at: string;
  updated_at: string;
}

export interface DiagnosticOrder {
  id: number;
  public_id: string;
  organization: number | null;
  hospital: number | null;
  hospital_name: string;
  department_ref: number | null;
  department_name: string;
  patient: number;
  patient_name: string;
  encounter: number | null;
  ordered_by: number | null;
  ordered_by_name: string;
  order_type: "LAB" | "IMAGING" | "PROCEDURE" | "ECG" | "OTHER";
  status: "ORDERED" | "COLLECTED" | "IN_PROGRESS" | "RESULTED" | "CANCELLED";
  priority: "ROUTINE" | "SOON" | "URGENT" | "STAT";
  code: string;
  name: string;
  indication: string;
  specimen: string;
  scheduled_at: string | null;
  collected_at: string | null;
  resulted_at: string | null;
  result_summary: string;
  result_payload: Record<string, unknown>;
  cancellation_reason: string;
  created_at: string;
  updated_at: string;
}

export interface Admission {
  id: number;
  public_id: string;
  organization: number | null;
  hospital: number | null;
  hospital_name: string;
  patient: number;
  patient_name: string;
  patient_triage_status: TriageStatus;
  encounter: number | null;
  referral: number | null;
  requested_by: number | null;
  requested_by_name: string;
  admitting_provider: number | null;
  admitting_provider_name: string;
  department_ref: number | null;
  department_name: string;
  room: number | null;
  room_label: string;
  source: "RECEPTION" | "EMERGENCY" | "APPOINTMENT" | "REFERRAL" | "TRANSFER";
  status: "REQUESTED" | "WAITLISTED" | "ADMITTED" | "TRANSFERRED" | "DISCHARGED" | "CANCELLED";
  priority: "ROUTINE" | "URGENT" | "CRITICAL";
  reason: string;
  requested_at: string;
  waitlisted_at: string | null;
  admitted_at: string | null;
  transferred_at: string | null;
  discharged_at: string | null;
  cancelled_at: string | null;
  discharge_summary: string;
  cancellation_reason: string;
  triage_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PerinatalRegistryEntry {
  id: number;
  public_id: string;
  patient: number;
  patient_name: string;
  patient_phone: string;
  organization: number | null;
  hospital: number | null;
  hospital_name: string;
  department_ref: number | null;
  department_name: string;
  assigned_provider: number | null;
  assigned_provider_name: string;
  status: "ACTIVE" | "WATCHLIST" | "HOSPITALIZED" | "DELIVERED" | "CLOSED";
  risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  gestational_age_weeks: number;
  gestational_age_days: number;
  gravida: number;
  para: number;
  last_menstrual_period: string | null;
  estimated_due_date: string | null;
  enrollment_reason: string;
  risk_factors: string[];
  latest_systolic_bp: number | null;
  latest_diastolic_bp: number | null;
  latest_glucose_mmol_l: string | null;
  fetal_notes: string;
  next_visit_at: string | null;
  enrolled_at: string;
  closed_at: string | null;
  outcome_notes: string;
  created_at: string;
  updated_at: string;
}

export interface PatronageVisit {
  id: number;
  public_id: string;
  organization: number | null;
  hospital: number | null;
  hospital_name: string;
  patient: number;
  patient_name: string;
  assigned_to: number | null;
  assigned_to_name: string;
  created_by: number | null;
  created_by_name: string;
  visit_type: "ROUTINE" | "HIGH_RISK" | "POST_DISCHARGE" | "PERINATAL" | "CHRONIC" | "NEWBORN";
  status: "PLANNED" | "OFFLINE_QUEUED" | "SYNCED" | "CONFLICT" | "COMPLETED" | "CANCELLED";
  priority: ClinicalTask["priority"];
  territory: string;
  scheduled_for: string;
  visited_at: string | null;
  synced_at: string | null;
  client_reference: string;
  idempotency_key: string;
  client_updated_at: string | null;
  server_version: number;
  payload: Record<string, unknown>;
  conflict_payload: Record<string, unknown>;
  conflict_reason: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PatientDuplicateCandidate {
  id: number;
  public_id: string;
  organization: number | null;
  hospital: number | null;
  hospital_name: string;
  primary_patient: number;
  primary_patient_name: string;
  primary_medical_record_number: string;
  duplicate_patient: number;
  duplicate_patient_name: string;
  duplicate_medical_record_number: string;
  score: string;
  match_reasons: string[];
  status: "NEEDS_REVIEW" | "CONFIRMED" | "DISMISSED" | "MERGED";
  detected_at: string;
  reviewed_by: number | null;
  reviewed_by_name: string;
  reviewed_at: string | null;
  review_note: string;
  created_at: string;
  updated_at: string;
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

let csrfToken = "";
let csrfCookieRequest: Promise<string> | null = null;

async function ensureCsrfCookie(forceRefresh = false) {
  if (typeof document === "undefined") {
    return "";
  }
  const cookieToken = cookieValue("csrftoken");
  if (!forceRefresh && (csrfToken || cookieToken)) {
    return csrfToken || cookieToken;
  }

  csrfCookieRequest ??= fetch(`${API_BASE_URL}/csrf/`, {
    credentials: "include",
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`CSRF setup failed with ${response.status}`);
    }

    const payload = (await response.json().catch(() => ({}))) as { csrfToken?: string; csrf_token?: string };
    const token = payload.csrfToken || payload.csrf_token || cookieValue("csrftoken");
    if (!token) {
      throw new Error("CSRF setup did not return a token.");
    }
    csrfToken = token;
    return token;
  });

  try {
    return await csrfCookieRequest;
  } finally {
    csrfCookieRequest = null;
  }
}

async function apiFetchOnce<T>(path: string, init: RequestInit | undefined, headers: Headers): Promise<T> {
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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const unsafeMethod = !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (unsafeMethod) {
    const token = await ensureCsrfCookie();
    if (token && !headers.has("X-CSRFToken")) {
      headers.set("X-CSRFToken", token);
    }
  }

  try {
    return await apiFetchOnce<T>(path, init, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!unsafeMethod || !message.includes("CSRF")) {
      throw error;
    }
    csrfToken = "";
    const retryHeaders = new Headers(headers);
    const retryToken = await ensureCsrfCookie(true);
    if (retryToken) {
      retryHeaders.set("X-CSRFToken", retryToken);
    }
    return apiFetchOnce<T>(path, init, retryHeaders);
  }
}

export function getCurrentUser() {
  return apiFetch<AuthUser>("/auth/me/");
}

export function loginUser(payload: LoginPayload) {
  return apiFetch<AuthUser>("/auth/login/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function registerUser(payload: RegisterPayload) {
  return apiFetch<AuthUser>("/auth/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logoutUser() {
  return apiFetch<{ status: string }>("/auth/logout/", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function listPatients(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<Patient>>(`/patients/${suffix}`);
}

export function getPatient(patientId: number) {
  return apiFetch<Patient>(`/patients/${patientId}/`);
}

export function createPatient(payload: PatientPayload) {
  return apiFetch<Patient>("/patients/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listHospitals(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<Hospital>>(`/hospitals/${suffix}`);
}

export function listDepartments(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<Department>>(`/departments/${suffix}`);
}

export function listRooms(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<Room>>(`/rooms/${suffix}`);
}

export function listStaffProfiles(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<StaffProfile>>(`/staff-profiles/${suffix}`);
}

export function listAppointments(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<BackendAppointment>>(`/appointments/${suffix}`);
}

export function createAppointment(payload: AppointmentPayload) {
  return apiFetch<BackendAppointment>("/appointments/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeAppointment(appointmentId: number, payload: { assessment?: string; plan?: string } = {}) {
  return apiFetch<{ appointment: BackendAppointment }>(`/appointments/${appointmentId}/complete/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startAppointment(appointmentId: number) {
  return apiFetch<{ appointment: BackendAppointment }>(`/appointments/${appointmentId}/start/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function cancelAppointment(appointmentId: number, cancelReason = "") {
  return apiFetch<{ appointment: BackendAppointment }>(`/appointments/${appointmentId}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ cancel_reason: cancelReason }),
  });
}

export function rescheduleAppointment(appointmentId: number, scheduledStart: string, scheduledEnd?: string | null) {
  return apiFetch<{ appointment: BackendAppointment }>(`/appointments/${appointmentId}/reschedule/`, {
    method: "POST",
    body: JSON.stringify({ scheduled_start: scheduledStart, scheduled_end: scheduledEnd ?? null }),
  });
}

export function createMedicalRecord(payload: MedicalRecordPayload) {
  return apiFetch<MedicalRecord>("/medical-records/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listMedicalRecords(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<MedicalRecord>>(`/medical-records/${suffix}`);
}

export function listEncounters(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<Encounter>>(`/encounters/${suffix}`);
}

export function listPatientVitals(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<PatientVitalRecord>>(`/patient-vitals/${suffix}`);
}

export function listPatientAllergies(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<PatientAllergyRecord>>(`/patient-allergies/${suffix}`);
}

export function listCareTeamMemberships(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<CareTeamMembership>>(`/care-team-memberships/${suffix}`);
}

export function listClinicalTasks(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<ClinicalTask>>(`/clinical-tasks/${suffix}`);
}

export function createClinicalTask(payload: ClinicalTaskPayload) {
  return apiFetch<ClinicalTask>("/clinical-tasks/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startClinicalTask(taskId: number) {
  return apiFetch<ClinicalTask>(`/clinical-tasks/${taskId}/start/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function completeClinicalTask(taskId: number, completionNote = "") {
  return apiFetch<ClinicalTask>(`/clinical-tasks/${taskId}/complete/`, {
    method: "POST",
    body: JSON.stringify({ completion_note: completionNote }),
  });
}

export function cancelClinicalTask(taskId: number, completionNote = "") {
  return apiFetch<ClinicalTask>(`/clinical-tasks/${taskId}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ completion_note: completionNote }),
  });
}

export function listReferrals(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<Referral>>(`/referrals/${suffix}`);
}

export function acceptReferral(referralId: number) {
  return apiFetch<Referral>(`/referrals/${referralId}/accept/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function completeReferral(referralId: number, clinicalSummary = "") {
  return apiFetch<Referral>(`/referrals/${referralId}/complete/`, {
    method: "POST",
    body: JSON.stringify({ clinical_summary: clinicalSummary }),
  });
}

export function cancelReferral(referralId: number, cancellationReason = "") {
  return apiFetch<Referral>(`/referrals/${referralId}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ cancellation_reason: cancellationReason }),
  });
}

export function listDiagnosticOrders(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<DiagnosticOrder>>(`/diagnostic-orders/${suffix}`);
}

export function collectDiagnosticOrder(orderId: number) {
  return apiFetch<DiagnosticOrder>(`/diagnostic-orders/${orderId}/collect/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function resultDiagnosticOrder(orderId: number, resultSummary = "", resultPayload: Record<string, unknown> = {}) {
  return apiFetch<DiagnosticOrder>(`/diagnostic-orders/${orderId}/result/`, {
    method: "POST",
    body: JSON.stringify({ result_summary: resultSummary, result_payload: resultPayload }),
  });
}

export function cancelDiagnosticOrder(orderId: number, cancellationReason = "") {
  return apiFetch<DiagnosticOrder>(`/diagnostic-orders/${orderId}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ cancellation_reason: cancellationReason }),
  });
}

export function listAdmissions(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<Admission>>(`/admissions/${suffix}`);
}

export function waitlistAdmission(admissionId: number) {
  return apiFetch<Admission>(`/admissions/${admissionId}/waitlist/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function admitAdmission(admissionId: number) {
  return apiFetch<Admission>(`/admissions/${admissionId}/admit/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function transferAdmission(admissionId: number, payload: { room?: number; department_ref?: number }) {
  return apiFetch<Admission>(`/admissions/${admissionId}/transfer/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function dischargeAdmission(admissionId: number, dischargeSummary = "") {
  return apiFetch<Admission>(`/admissions/${admissionId}/discharge/`, {
    method: "POST",
    body: JSON.stringify({ discharge_summary: dischargeSummary }),
  });
}

export function cancelAdmission(admissionId: number, cancellationReason = "") {
  return apiFetch<Admission>(`/admissions/${admissionId}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ cancellation_reason: cancellationReason }),
  });
}

export function listPerinatalRegistry(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<PerinatalRegistryEntry>>(`/perinatal-registry/${suffix}`);
}

export function updatePerinatalRisk(entryId: number, payload: Partial<Pick<PerinatalRegistryEntry, "risk_level" | "risk_factors" | "fetal_notes" | "latest_systolic_bp" | "latest_diastolic_bp" | "latest_glucose_mmol_l">>) {
  return apiFetch<PerinatalRegistryEntry>(`/perinatal-registry/${entryId}/update-risk/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePerinatalEntry(entryId: number, payload: Partial<Pick<PerinatalRegistryEntry, "status" | "next_visit_at" | "enrollment_reason" | "outcome_notes">>) {
  return apiFetch<PerinatalRegistryEntry>(`/perinatal-registry/${entryId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function closePerinatalEntry(entryId: number, status: "CLOSED" | "DELIVERED" = "CLOSED", outcomeNotes = "") {
  return apiFetch<PerinatalRegistryEntry>(`/perinatal-registry/${entryId}/close/`, {
    method: "POST",
    body: JSON.stringify({ status, outcome_notes: outcomeNotes }),
  });
}

export function listPatronageVisits(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<PatronageVisit>>(`/patronage-visits/${suffix}`);
}

export function syncPatronageVisit(visitId: number, payload: Record<string, unknown> = {}, serverVersion?: number) {
  return apiFetch<PatronageVisit>(`/patronage-visits/${visitId}/sync/`, {
    method: "POST",
    body: JSON.stringify({ payload, server_version: serverVersion }),
  });
}

export function completePatronageVisit(visitId: number, notes = "", payload: Record<string, unknown> = {}) {
  return apiFetch<PatronageVisit>(`/patronage-visits/${visitId}/complete/`, {
    method: "POST",
    body: JSON.stringify({ notes, payload }),
  });
}

export function cancelPatronageVisit(visitId: number, notes = "") {
  return apiFetch<PatronageVisit>(`/patronage-visits/${visitId}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export function resolvePatronageConflict(visitId: number, strategy: "client" | "server" = "client") {
  return apiFetch<PatronageVisit>(`/patronage-visits/${visitId}/resolve-conflict/`, {
    method: "POST",
    body: JSON.stringify({ strategy }),
  });
}

export function listPatientDuplicateCandidates(query = "") {
  const suffix = query ? `?${query}` : "";
  return apiFetch<PaginatedResponse<PatientDuplicateCandidate>>(`/patient-duplicate-candidates/${suffix}`);
}

export function confirmDuplicateCandidate(candidateId: number, reviewNote = "") {
  return apiFetch<PatientDuplicateCandidate>(`/patient-duplicate-candidates/${candidateId}/confirm/`, {
    method: "POST",
    body: JSON.stringify({ review_note: reviewNote }),
  });
}

export function dismissDuplicateCandidate(candidateId: number, reviewNote = "") {
  return apiFetch<PatientDuplicateCandidate>(`/patient-duplicate-candidates/${candidateId}/dismiss/`, {
    method: "POST",
    body: JSON.stringify({ review_note: reviewNote }),
  });
}

export function markMergedDuplicateCandidate(candidateId: number, reviewNote = "") {
  return apiFetch<PatientDuplicateCandidate>(`/patient-duplicate-candidates/${candidateId}/mark-merged/`, {
    method: "POST",
    body: JSON.stringify({ review_note: reviewNote }),
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

export function escalateAIErrorLog(logId: number) {
  return apiFetch<AIErrorLog>(`/ai-error-logs/${logId}/escalate/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function listRCAErrorSummary() {
  return apiFetch<RCAErrorSummary[]>("/ai-error-logs/rca-summary/");
}

export function listFeedbackSummary() {
  return apiFetch<FeedbackSummary[]>("/feedback/summary/");
}

export function notificationsUrl(audience: "head_physicians" | "regional_doctor", scopeId?: string) {
  const encodedScope = scopeId ? `/${encodeURIComponent(scopeId)}` : "";
  return `${WS_BASE_URL}/ws/notifications/${audience}${encodedScope}/`;
}
