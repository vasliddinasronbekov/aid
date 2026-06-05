"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Baby,
  Bed,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  Edit3,
  Eye,
  FileText,
  Filter,
  Hospital,
  Languages,
  MoreHorizontal,
  Plus,
  Printer,
  Radio,
  Route,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  UsersRound,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AIAssistantDock } from "@/components/crm/ai-assistant-dock";
import { RealtimeMessage, useWebSockets } from "@/hooks/useWebSockets";
import { useAuthGate } from "@/hooks/useAuth";
import {
  admitAdmission,
  cancelAppointment,
  cancelAdmission,
  closePerinatalEntry,
  completeAppointment,
  completeClinicalTask,
  completePatronageVisit,
  createAppointment,
  createClinicalTask,
  createMedicalRecord,
  createPatient,
  escalateAIErrorLog,
  listAppointments,
  listClinicalTasks,
  listAIErrorLogs,
  listAdmissions,
  listMedicalRecords,
  listPatronageVisits,
  listPatients,
  listPerinatalRegistry,
  listReferrals,
  listRooms,
  notificationsUrl,
  rescheduleAppointment,
  resolvePatronageConflict,
  startAppointment,
  startClinicalTask,
  syncPatronageVisit,
  transferAdmission,
  updateAIErrorLog,
  updatePerinatalEntry,
  updatePerinatalRisk,
  waitlistAdmission,
  dischargeAdmission,
} from "@/lib/api";
import type {
  Admission,
  AIErrorLog,
  AppointmentPayload,
  BackendAppointment,
  BackendAppointmentPriority,
  BackendAppointmentType,
  ClinicalTask,
  MedicalRecordPayload,
  MedicalRecord,
  PatronageVisit,
  Patient,
  PatientPayload,
  PerinatalRegistryEntry,
  Referral,
  Room,
} from "@/lib/api";
import {
  Appointment,
  AdmissionRow,
  CrmModuleKey,
  DocumentRow,
  duplicateCandidates,
  HospitalBedRow,
  isCrmModule,
  menuGroups,
  moduleLabel,
  normalizeText,
  PrescriptionRow,
  PatronageRow,
  RegistryPatient,
  PregnantRegistryRow,
  TreatmentCourseRow,
  PlanningRow,
  ClinicalTaskRow,
  ReferralRow,
} from "@/lib/crm-data";
import type { FormEvent, ReactNode } from "react";

interface CrmWorkspaceProps {
  module: CrmModuleKey;
  content?: ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
}

type AppointmentFilter = "Barchasi" | "Aktiv" | "Bajarildi" | "Bekor qilingan";
type PatientFilter = "Barchasi" | "II" | "III" | "YQTK" | "D-ro'yxat";

interface AppointmentClinicalInput {
  complaint: string;
  diagnosis: string;
  vitals: string;
  ctFindings: string;
  mrtFindings: string;
  ultrasoundFindings: string;
  laboratoryFindings: string;
  otherAnalysis: string;
  prescriptions: string;
  clinicalNotes: string;
}

interface AppointmentSafetyReview {
  status: "queued" | "submitted" | "sync_failed";
  submittedAt: string;
  hiddenFromDoctor: true;
  backendRecordId?: number;
  fallbackReason?: string;
}

const emptyClinicalInput: AppointmentClinicalInput = {
  complaint: "",
  diagnosis: "",
  vitals: "",
  ctFindings: "",
  mrtFindings: "",
  ultrasoundFindings: "",
  laboratoryFindings: "",
  otherAnalysis: "",
  prescriptions: "",
  clinicalNotes: "",
};

type ClinicAIWarningSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type ClinicAIWarningStatus = "Yangi" | "Head doctorga yuborildi" | "Ko'rildi" | "Vazifa ochildi";

interface ClinicAIWarning {
  id: number;
  backendLogId: number;
  medicalRecordId: number;
  patientId: number | null;
  severity: ClinicAIWarningSeverity;
  patient: string;
  doctor: string;
  department: string;
  signal: string;
  evidence: string;
  recommendedAction: string;
  source: string;
  createdAt: string;
  status: ClinicAIWarningStatus;
  sentAt?: string;
}

interface DoctorActivitySignal {
  id: number;
  time: string;
  doctor: string;
  patient: string;
  action: string;
  module: string;
  aiSignal: string;
  severity: ClinicAIWarningSeverity;
}

interface DoctorShortcomingSummary {
  doctor: string;
  total: number;
  critical: number;
  high: number;
  open: number;
  latestSignal: string;
  latestPatient: string;
  latestAt: string;
  topSource: string;
  latestWarningId: number;
}

const aiWarningSeverityStyles: Record<ClinicAIWarningSeverity, string> = {
  CRITICAL: "border-red-300 bg-red-100 text-red-950",
  HIGH: "border-red-200 bg-red-50 text-red-900",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-900",
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

const aiWarningStatusStyles: Record<ClinicAIWarningStatus, string> = {
  Yangi: "border-blue-200 bg-blue-50 text-clinical-blue",
  "Head doctorga yuborildi": "border-red-200 bg-red-50 text-red-900",
  "Ko'rildi": "border-emerald-200 bg-emerald-50 text-emerald-900",
  "Vazifa ochildi": "border-amber-200 bg-amber-50 text-amber-900",
};

const zoneStyles: Record<RegistryPatient["riskZone"], string> = {
  RED: "border-red-200 bg-red-50 text-red-900",
  YELLOW: "border-amber-200 bg-amber-50 text-amber-900",
  GREEN: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

const priorityStyles = {
  Yuqori: "border-red-200 bg-red-50 text-red-900",
  "O'rta": "border-amber-200 bg-amber-50 text-amber-900",
  Past: "border-emerald-200 bg-emerald-50 text-emerald-900",
  Kritik: "border-red-300 bg-red-100 text-red-950",
  Shoshilinch: "border-red-200 bg-red-50 text-red-900",
  Rejali: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

const appointmentStatusStyles: Record<Appointment["status"], string> = {
  Aktiv: "border-blue-200 bg-blue-50 text-clinical-blue",
  Bajarildi: "border-emerald-200 bg-emerald-50 text-emerald-900",
  "Bekor qilingan": "border-red-200 bg-red-50 text-red-900",
};

const perinatalRiskStyles: Record<PregnantRegistryRow["riskZone"], string> = {
  Qizil: "border-red-200 bg-red-50 text-red-900",
  Sariq: "border-amber-200 bg-amber-50 text-amber-900",
  Yashil: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

const patronageSyncStyles: Record<PatronageRow["sync"], string> = {
  Serverda: "border-emerald-200 bg-emerald-50 text-emerald-900",
  Navbatda: "border-amber-200 bg-amber-50 text-amber-900",
  Konflikt: "border-red-200 bg-red-50 text-red-900",
  "Qayta ko'rish": "border-blue-200 bg-blue-50 text-clinical-blue",
};

function WorkspaceLoading({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-clinical-wash px-4 text-clinical-ink">
      <div className="rounded-md border border-clinical-line bg-white px-5 py-4 text-sm text-clinical-slate shadow-sm">
        {label}
      </div>
    </main>
  );
}

export function CrmWorkspace({ module, content: customContent, headerTitle, headerSubtitle }: CrmWorkspaceProps) {
  const activeModule = isCrmModule(module) ? module : "assigned-population";
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [networkOnline, setNetworkOnline] = useState(true);
  const [assistantDockOpen, setAssistantDockOpen] = useState(false);
  const { user, loading: authLoading, signOut } = useAuthGate();
  const { status: socketStatus } = useWebSockets<RealtimeMessage>({
    url: notificationsUrl("regional_doctor", "andijan-central"),
  });

  const title = headerTitle ?? moduleLabel(activeModule);
  const subtitle = headerSubtitle ?? "Andijon tuman Qo'nji oilaviy shifokorlik punkti";
  const currentUserName = user?.display_name || user?.username || "Staff user";

  if (authLoading) {
    return <WorkspaceLoading label="Clinical workspace loading" />;
  }

  const content = customContent ?? renderModule(activeModule, query, currentUserName);

  return (
    <main className="min-h-screen bg-clinical-wash text-clinical-ink">
      <div className="flex min-h-screen">
        <aside className="hidden w-[280px] shrink-0 border-r border-clinical-line bg-white/95 lg:flex lg:flex-col">
          <div className="flex h-[72px] items-center gap-3 border-b border-clinical-line px-4">
            <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-[#07142a]">
              <Image
                src="/logo.png"
                alt="AID logo"
                fill
                priority
                sizes="64px"
                className="object-contain p-1.5"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-clinical-ink">AID CRM</p>
              <p className="text-xs text-clinical-slate">Clinical workspace</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-5">
            {menuGroups.map((group) => (
              <div key={group.label} className="mb-6">
                <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-normal text-slate-400">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.key === activeModule || (item.href === "/doctor" && pathname === "/doctor");
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm transition ${
                          active
                            ? "bg-clinical-ink text-white shadow-sm"
                            : "text-clinical-slate hover:bg-clinical-wash hover:text-clinical-ink"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.badge ? (
                          <span
                            className={`rounded-sm px-1.5 py-0.5 text-[11px] ${
                              active ? "bg-white/20 text-white" : "bg-slate-100 text-clinical-slate"
                            }`}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-clinical-line p-4">
            <div className="rounded-md border border-clinical-line bg-clinical-wash p-3">
              <div className="relative h-12 w-full overflow-hidden rounded-md bg-[#07142a]">
                <Image
                  src="/logo.png"
                  alt="AID logo"
                  fill
                  sizes="224px"
                  className="object-contain p-1.5"
                />
              </div>
              <p className="mt-3 text-xs font-semibold text-clinical-ink">Support</p>
              <p className="text-xs text-clinical-slate">+998 71 202-50-00</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-clinical-line bg-white/90 shadow-sm shadow-slate-200/60 backdrop-blur-xl">
            <div className="flex min-h-[72px] flex-col gap-3 px-4 py-3 lg:px-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md bg-[#07142a] lg:hidden">
                  <Image
                    src="/logo.png"
                    alt="AID logo"
                    fill
                    priority
                    sizes="40px"
                    className="object-contain p-1"
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold text-clinical-ink">{title}</h1>
                  <p className="truncate text-sm text-clinical-slate">{subtitle}</p>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 xl:justify-end">
                <label className="relative min-w-[260px] flex-1 xl:max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-11 w-full rounded-md border border-transparent bg-clinical-wash pl-9 pr-3 text-sm text-clinical-ink shadow-sm placeholder:text-slate-400 focus:border-clinical-blue focus:bg-white"
                    placeholder="Bemorning to'liq ismini yoki tibbiy karta raqamini kiriting"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setNetworkOnline((value) => !value)}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-transparent bg-clinical-wash px-3 text-sm text-clinical-slate shadow-sm"
                >
                  {networkOnline ? <Wifi className="h-4 w-4 text-clinical-green" /> : <WifiOff className="h-4 w-4 text-clinical-red" />}
                  {networkOnline ? "Online" : "Offline"}
                </button>
                <span className="hidden h-10 items-center gap-2 rounded-md border border-transparent bg-clinical-wash px-3 text-sm text-clinical-slate shadow-sm md:inline-flex">
                  <Radio className="h-4 w-4 text-clinical-cyan" />
                  {socketStatus === "open" ? "Aloqa faol" : "Aloqa yopiq"}
                </span>
                <button
                  type="button"
                  onClick={() => setAssistantDockOpen(true)}
                  className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold shadow-sm transition ${
                    assistantDockOpen
                      ? "bg-clinical-ink text-white"
                      : "border border-blue-100 bg-blue-50 text-clinical-blue hover:border-clinical-blue"
                  }`}
                  title="AI Assistant"
                >
                  <Bot className="h-4 w-4" />
                  <span className="hidden sm:inline">AI Assistant</span>
                </button>
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-md border border-transparent bg-clinical-wash text-clinical-slate shadow-sm hover:text-clinical-ink">
                  <Bell className="h-4 w-4" />
                </button>
                <span className="hidden h-10 items-center gap-2 rounded-md border border-transparent bg-clinical-wash px-3 text-sm text-clinical-slate shadow-sm lg:inline-flex">
                  <Languages className="h-4 w-4" />
                  O'zbekcha
                </span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex min-w-0 items-center gap-2 rounded-md border border-transparent bg-clinical-wash px-3 py-2 text-left shadow-sm hover:bg-white"
                  title="Logout"
                >
                  <UserRound className="h-4 w-4 shrink-0 text-clinical-blue" />
                  <span className="hidden min-w-0 xl:block">
                    <span className="block truncate text-xs font-semibold text-clinical-ink">
                      {currentUserName}
                    </span>
                    <span className="block truncate text-[11px] text-clinical-slate">{user?.staff_profile?.role || "Account"}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto border-t border-clinical-line bg-white/80 px-4 py-2 lg:hidden">
              {menuGroups.flatMap((group) => group.items).map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`shrink-0 rounded-md px-3 py-2 text-sm ${
                    item.key === activeModule ? "bg-clinical-ink text-white" : "bg-clinical-wash text-clinical-slate"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </header>

          <div className="px-4 py-5 lg:px-5">{content}</div>
        </section>
      </div>
      <AIAssistantDock
        activeModule={activeModule}
        pageTitle={title}
        pagePath={pathname}
        query={query}
        open={assistantDockOpen}
        onOpenChange={setAssistantDockOpen}
      />
    </main>
  );
}

function renderModule(module: CrmModuleKey, query: string, currentUserName = "Clinical user") {
  if (
    module === "appointments" ||
    module === "active-appointments" ||
    module === "completed-appointments" ||
    module === "cancelled-appointments" ||
    module === "appointment-calendar"
  ) {
    return <AppointmentsView module={module} query={query} />;
  }
  if (module === "analytics") {
    return <AnalyticsView />;
  }
  if (module === "ai-analyzes") {
    return <AIAnalyzesView />;
  }
  if (module === "hospital" || module === "reception" || module === "admission") {
    return <HospitalView module={module} />;
  }
  if (module === "documents") {
    return <DocumentsView query={query} />;
  }
  if (module === "prescriptions") {
    return <PrescriptionsView query={query} currentUserName={currentUserName} />;
  }
  if (module === "treatment-course") {
    return <TreatmentCourseView query={query} />;
  }
  if (module === "pregnant-registry") {
    return <PregnantRegistryView query={query} />;
  }
  if (module === "patronage") {
    return <PatronageView query={query} />;
  }
  if (module === "planning" || module === "scheduled") {
    return <PlanningView module={module} query={query} />;
  }
  if (module === "settings") {
    return <SettingsView />;
  }
  return <PatientRegistryView query={query} module={module} currentUserName={currentUserName} />;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-clinical-blue",
    green: "bg-emerald-50 text-clinical-green",
    amber: "bg-amber-50 text-clinical-amber",
    red: "bg-red-50 text-clinical-red",
  }[tone];

  return (
    <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-clinical-slate">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <strong className="mt-3 block text-2xl text-clinical-ink">{value}</strong>
    </div>
  );
}

function formatBackendDate(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function ageFromDateOfBirth(value?: string | null) {
  if (!value) {
    return 0;
  }
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) {
    return 0;
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return Math.max(age, 0);
}

function biomarkerText(patient: Patient, key: string, fallback = "") {
  const value = patient.chronic_biomarkers?.[key];
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return fallback;
}

function registryPatientFromBackend(patient: Patient): RegistryPatient {
  const healthGroup = biomarkerText(patient, "health_group", "Yo'q");
  const normalizedHealthGroup =
    healthGroup === "I" || healthGroup === "II" || healthGroup === "III" || healthGroup === "Yo'q" ? healthGroup : "Yo'q";
  const diagnosis =
    biomarkerText(patient, "primary_diagnosis") ||
    patient.severe_chronic_tags.join(", ") ||
    patient.department ||
    "Klinik tashxis kiritilmagan";

  return {
    id: patient.id,
    medicalCard: patient.medical_record_number || patient.patient_identifier,
    fullName: patient.display_name,
    territory: patient.district || patient.region_code,
    age: ageFromDateOfBirth(patient.date_of_birth),
    healthGroup: normalizedHealthGroup,
    cardiovascularRisk: biomarkerText(patient, "cardiovascular_risk", ""),
    diabetesRisk: biomarkerText(patient, "diabetes_risk", ""),
    oncologySurvey: biomarkerText(patient, "oncology_survey") === "done" ? "O'tilgan" : "O'tilmagan",
    dList: biomarkerText(patient, "d_list", "Yo'q"),
    disability: biomarkerText(patient, "disability", "Yo'q"),
    clinicalDiagnosis: diagnosis,
    phone: patient.phone_number,
    address: patient.address_line,
    lastVisit: formatBackendDate(patient.updated_at),
    nextVisit: biomarkerText(patient, "next_visit_at", ""),
    assignedDoctor: patient.department_name || patient.department || "Belgilanmagan",
    patronageNurse: biomarkerText(patient, "patronage_nurse", "Belgilanmagan"),
    riskZone: patient.triage_status,
    tags: [patient.triage_status, ...patient.severe_chronic_tags].filter(Boolean),
  };
}

function splitPatientName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || fullName.trim();
  const lastName = parts.join(" ") || "-";
  return { firstName, lastName };
}

function patientPayloadFromDraft(draft: {
  fullName: string;
  age: string;
  phone: string;
  territory: string;
  clinicalDiagnosis: string;
  riskZone: RegistryPatient["riskZone"];
  healthGroup: RegistryPatient["healthGroup"];
}): PatientPayload {
  const { firstName, lastName } = splitPatientName(draft.fullName);
  const age = Number.parseInt(draft.age, 10);
  const birthYear = Number.isFinite(age) && age > 0 ? new Date().getFullYear() - age : null;
  return {
    first_name: firstName,
    last_name: lastName,
    date_of_birth: birthYear ? `${birthYear}-01-01` : null,
    phone_number: draft.phone.trim(),
    region_code: draft.territory.trim() || "andijan-central",
    district: draft.territory.trim(),
    department: "Primary care",
    triage_status: draft.riskZone,
    chronic_biomarkers: {
      health_group: draft.healthGroup,
      primary_diagnosis: draft.clinicalDiagnosis.trim(),
      d_list: draft.clinicalDiagnosis.trim() || "Yo'q",
    },
  };
}

function PatientRegistryView({
  query,
  module,
  currentUserName,
}: {
  query: string;
  module: CrmModuleKey;
  currentUserName: string;
}) {
  const [patients, setPatients] = useState<RegistryPatient[]>([]);
  const [filter, setFilter] = useState<PatientFilter>("Barchasi");
  const [selectedPatientId, setSelectedPatientId] = useState(0);
  const [note, setNote] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [duplicateRows, setDuplicateRows] = useState<typeof duplicateCandidates>([]);
  const [patientLoading, setPatientLoading] = useState(true);
  const [patientError, setPatientError] = useState("");
  const [patientCreateOpen, setPatientCreateOpen] = useState(false);
  const [patientDraft, setPatientDraft] = useState({
    fullName: "",
    age: "35",
    phone: "",
    territory: "1- тиббий бригада",
    clinicalDiagnosis: "",
    riskZone: "YELLOW" as RegistryPatient["riskZone"],
    healthGroup: "II" as RegistryPatient["healthGroup"],
  });

  const filteredPatients = useMemo(() => {
    const search = normalizeText(query.trim());
    return patients.filter((patient) => {
      const matchesSearch =
        !search ||
        normalizeText(patient.fullName).includes(search) ||
        normalizeText(patient.medicalCard).includes(search) ||
        normalizeText(patient.territory).includes(search) ||
        normalizeText(patient.clinicalDiagnosis).includes(search);

      const matchesFilter =
        filter === "Barchasi" ||
        patient.healthGroup === filter ||
        (filter === "YQTK" && patient.cardiovascularRisk !== "..." && Number.parseInt(patient.cardiovascularRisk, 10) >= 10) ||
        (filter === "D-ro'yxat" && patient.dList !== "Yo'q");

      return matchesSearch && matchesFilter;
    });
  }, [query, filter, patients]);

  useEffect(() => {
    let active = true;

    setPatientLoading(true);
    listPatients()
      .then((response) => {
        if (!active) {
          return;
        }
        const mappedPatients = response.results.map(registryPatientFromBackend);
        setPatients(mappedPatients);
        setSelectedPatientId((current) => (mappedPatients.some((patient) => patient.id === current) ? current : mappedPatients[0]?.id ?? 0));
        setPatientError("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setPatients([]);
        setSelectedPatientId(0);
        setPatientError(error instanceof Error ? error.message : "Patients API is not available.");
      })
      .finally(() => {
        if (active) {
          setPatientLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedPatient =
    filteredPatients.find((patient) => patient.id === selectedPatientId) ??
    patients.find((patient) => patient.id === selectedPatientId) ??
    filteredPatients[0] ??
    patients[0];

  const pageTitle =
    module === "patients" ? "Bemorlar" : module === "my-patients" ? "Mening bemorlarim" : "Biriktirilgan aholi";

  const saveClinicalNote = async () => {
    if (!selectedPatient || !note.trim()) {
      return;
    }
    setSaveState("idle");
    try {
      await createMedicalRecord({
        patient: selectedPatient.id,
        doctor_id: currentUserName,
        diagnosis: selectedPatient.clinicalDiagnosis,
        prescriptions: "",
        clinical_notes: note.trim(),
        record_type: "FOLLOW_UP",
        imaging_safety_metadata: {
          source: "patient_registry_note",
          patient_snapshot: {
            medical_card: selectedPatient.medicalCard,
            risk_zone: selectedPatient.riskZone,
          },
        },
      });
      setSaveState("saved");
      setPatientError("");
    } catch (error) {
      setPatientError(error instanceof Error ? error.message : "Clinical note could not be saved.");
    }
  };

  const selectedDuplicates = selectedPatient
    ? duplicateRows.filter((candidate) => candidate.primaryPatientId === selectedPatient.id || candidate.duplicatePatientId === selectedPatient.id)
    : [];
  const updateDuplicateStatus = (candidateId: number, statusValue: (typeof duplicateCandidates)[number]["status"]) => {
    setDuplicateRows((current) => current.map((candidate) => (candidate.id === candidateId ? { ...candidate, status: statusValue } : candidate)));
  };

  const addPatient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fullName = patientDraft.fullName.trim();
    if (!fullName) {
      return;
    }
    try {
      const createdPatient = await createPatient(patientPayloadFromDraft(patientDraft));
      const patient = registryPatientFromBackend(createdPatient);
      setPatients((current) => [patient, ...current]);
      setSelectedPatientId(patient.id);
      setFilter("Barchasi");
      setPatientCreateOpen(false);
      setPatientDraft({
        fullName: "",
        age: "35",
        phone: "",
        territory: "1- тиббий бригада",
        clinicalDiagnosis: "",
        riskZone: "YELLOW",
        healthGroup: "II",
      });
      setPatientError("");
    } catch (error) {
      setPatientError(error instanceof Error ? error.message : "Patient could not be created.");
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label="Biriktirilgan aholi" value={String(patients.length)} icon={UsersRound} />
          <StatCard label="Yuqori xavf" value={String(patients.filter((patient) => patient.riskZone === "RED").length)} icon={AlertTriangle} tone="red" />
          <StatCard label="D-ro'yxat" value={String(patients.filter((patient) => patient.dList !== "Yo'q").length)} icon={ClipboardCheck} tone="amber" />
          <StatCard label="Bugun yangilangan" value={String(patients.filter((patient) => patient.lastVisit === formatBackendDate(new Date().toISOString())).length)} icon={CalendarDays} tone="green" />
        </div>

        <section className="rounded-md border border-clinical-line bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-clinical-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-clinical-ink">{pageTitle}</h2>
              <p className="text-sm text-clinical-slate">Qo'nji OSHP, tibbiy brigadalar bo'yicha ro'yxat</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["Barchasi", "II", "III", "YQTK", "D-ro'yxat"] as PatientFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm ${
                    filter === item
                      ? "border-clinical-blue bg-blue-50 text-clinical-blue"
                      : "border-clinical-line bg-white text-clinical-slate hover:border-clinical-blue"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {item}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPatientCreateOpen((open) => !open)}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-clinical-blue px-3 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Bemor
              </button>
            </div>
          </div>

          {patientError ? (
            <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
              {patientError}
            </div>
          ) : null}

          {patientCreateOpen ? (
            <form onSubmit={addPatient} className="grid gap-3 border-b border-clinical-line bg-slate-50 px-4 py-4 lg:grid-cols-6">
              <label className="block lg:col-span-2">
                <span className="mb-1 block text-sm text-clinical-slate">Bemor ism-sharifi</span>
                <input
                  value={patientDraft.fullName}
                  onChange={(event) => setPatientDraft((current) => ({ ...current, fullName: event.target.value }))}
                  className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                  placeholder="To'liq ism"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Yosh</span>
                <input
                  value={patientDraft.age}
                  onChange={(event) => setPatientDraft((current) => ({ ...current, age: event.target.value }))}
                  inputMode="numeric"
                  className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Telefon</span>
                <input
                  value={patientDraft.phone}
                  onChange={(event) => setPatientDraft((current) => ({ ...current, phone: event.target.value }))}
                  className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                  placeholder="+998"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Xavf</span>
                <select
                  value={patientDraft.riskZone}
                  onChange={(event) => setPatientDraft((current) => ({ ...current, riskZone: event.target.value as RegistryPatient["riskZone"] }))}
                  className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                >
                  {(["RED", "YELLOW", "GREEN"] as RegistryPatient["riskZone"][]).map((zone) => (
                    <option key={zone}>{zone}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Guruh</span>
                <select
                  value={patientDraft.healthGroup}
                  onChange={(event) => setPatientDraft((current) => ({ ...current, healthGroup: event.target.value as RegistryPatient["healthGroup"] }))}
                  className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                >
                  {(["I", "II", "III", "Yo'q"] as RegistryPatient["healthGroup"][]).map((group) => (
                    <option key={group}>{group}</option>
                  ))}
                </select>
              </label>
              <label className="block lg:col-span-2">
                <span className="mb-1 block text-sm text-clinical-slate">Hudud</span>
                <input
                  value={patientDraft.territory}
                  onChange={(event) => setPatientDraft((current) => ({ ...current, territory: event.target.value }))}
                  className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                />
              </label>
              <label className="block lg:col-span-3">
                <span className="mb-1 block text-sm text-clinical-slate">Klinik tashxis</span>
                <input
                  value={patientDraft.clinicalDiagnosis}
                  onChange={(event) => setPatientDraft((current) => ({ ...current, clinicalDiagnosis: event.target.value }))}
                  className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                  placeholder="ICD / tashxis"
                />
              </label>
              <div className="flex items-end gap-2">
                <button type="submit" className="h-10 rounded-md bg-clinical-blue px-3 text-sm font-semibold text-white">
                  Saqlash
                </button>
                <button
                  type="button"
                  onClick={() => setPatientCreateOpen(false)}
                  className="h-10 rounded-md border border-clinical-line bg-white px-3 text-sm font-semibold text-clinical-slate"
                >
                  Bekor
                </button>
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-clinical-slate">
                <tr>
                  <th className="w-12 px-4 py-3">№</th>
                  <th className="px-3 py-3">Tibbiy karta</th>
                  <th className="px-3 py-3">Bemorning ism-sharifi</th>
                  <th className="px-3 py-3">Hudud</th>
                  <th className="px-3 py-3">Yosh</th>
                  <th className="px-3 py-3">Sog. gur.</th>
                  <th className="px-3 py-3">YQTK xavfi</th>
                  <th className="px-3 py-3">Qandli diabet xavfi</th>
                  <th className="px-3 py-3">Onkogematologik so'rovnoma</th>
                  <th className="px-3 py-3">D-ro'yxat</th>
                  <th className="px-3 py-3">Nogironlik</th>
                  <th className="px-3 py-3">Kl. tashxis</th>
                  <th className="px-3 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-line">
                {patientLoading ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-clinical-slate">
                      Backend bemorlar ro'yxati yuklanmoqda.
                    </td>
                  </tr>
                ) : filteredPatients.length ? (
                  filteredPatients.map((patient, index) => {
                    const active = patient.id === selectedPatient?.id;
                  return (
                    <tr key={patient.id} className={active ? "bg-blue-50/70" : "bg-white hover:bg-slate-50"}>
                      <td className="px-4 py-3 text-clinical-slate">{index + 1}</td>
                      <td className="px-3 py-3 font-medium text-clinical-ink">{patient.medicalCard}</td>
                      <td className="max-w-[280px] px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedPatientId(patient.id)}
                          className="block truncate text-left font-semibold text-clinical-ink hover:text-clinical-blue"
                        >
                          {patient.fullName}
                        </button>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {patient.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] text-clinical-slate">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-clinical-slate">{patient.territory}</td>
                      <td className="px-3 py-3">{patient.age} yosh</td>
                      <td className="px-3 py-3">{patient.healthGroup}</td>
                      <td className="px-3 py-3">{patient.cardiovascularRisk}</td>
                      <td className="px-3 py-3">{patient.diabetesRisk}</td>
                      <td className="px-3 py-3">{patient.oncologySurvey}</td>
                      <td className="px-3 py-3">{patient.dList}</td>
                      <td className="px-3 py-3">{patient.disability}</td>
                      <td className="px-3 py-3">{patient.clinicalDiagnosis}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedPatientId(patient.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                            title="Tez ko'rish"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <Link
                            href={`/doctor/patient/${patient.id}`}
                            className="flex h-8 items-center gap-1 rounded-md border border-clinical-line px-2 text-xs font-semibold text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                            title="Profil"
                          >
                            <FileText className="h-4 w-4" />
                            Profil
                          </Link>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                            title="Tahrirlash"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                            title="Boshqa"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })
                ) : (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-clinical-slate">
                      Backendda bemor topilmadi. Yangi bemor qo'shish uchun Bemor tugmasini bosing.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <aside className="space-y-4">
        <section className="rounded-md border border-clinical-line bg-white shadow-sm">
          {selectedPatient ? (
            <>
              <div className="border-b border-clinical-line px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-clinical-ink">{selectedPatient.fullName}</h2>
                    <p className="mt-1 text-sm text-clinical-slate">{selectedPatient.medicalCard}</p>
                  </div>
                  <span className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${zoneStyles[selectedPatient.riskZone]}`}>
                    {selectedPatient.riskZone}
                  </span>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Info label="Hudud" value={selectedPatient.territory} />
                  <Info label="Yosh" value={`${selectedPatient.age} yosh`} />
                  <Info label="Telefon" value={selectedPatient.phone} />
                  <Info label="Keyingi ko'rik" value={selectedPatient.nextVisit} />
                  <Info label="Shifokor" value={selectedPatient.assignedDoctor} />
                  <Info label="Patronaj" value={selectedPatient.patronageNurse} />
                </div>

                <div className="rounded-md border border-clinical-line bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-clinical-slate">Kl. tashxis</p>
                  <p className="mt-1 text-sm font-medium text-clinical-ink">{selectedPatient.clinicalDiagnosis}</p>
                  <p className="mt-2 text-sm text-clinical-slate">{selectedPatient.address}</p>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-clinical-ink">Qabul yozuvi</span>
                  <textarea
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setSaveState("idle");
                    }}
                    rows={4}
                    className="w-full rounded-md border border-clinical-line px-3 py-3 text-sm focus:border-clinical-blue"
                    placeholder="Shikoyat, ko'rik, reja"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-clinical-line bg-white text-sm font-semibold text-clinical-ink">
                    <Printer className="h-4 w-4" />
                    Chop etish
                  </button>
                  <button
                    type="button"
                    onClick={saveClinicalNote}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-clinical-blue text-sm font-semibold text-white"
                  >
                    <Save className="h-4 w-4" />
                    {saveState === "saved" ? "Saqlandi" : "Saqlash"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 text-sm text-clinical-slate">
              Backenddan bemor tanlang yoki yangi bemor yarating.
            </div>
          )}
        </section>

        <section className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-clinical-ink">MPI dublikat nazorati</h3>
          <div className="mt-3 space-y-3">
            {selectedDuplicates.length ? (
              selectedDuplicates.map((candidate) => (
                <div key={candidate.id} className="rounded-md border border-clinical-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-clinical-ink">
                        {candidate.primaryPatientId === selectedPatient?.id ? candidate.duplicatePatient : candidate.primaryPatient}
                      </p>
                      <p className="mt-1 text-xs text-clinical-slate">{candidate.reasons.slice(0, 2).join(", ")}</p>
                    </div>
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                      {candidate.score}%
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="rounded-md border border-clinical-line px-2 py-1 text-xs text-clinical-slate">{candidate.status}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => updateDuplicateStatus(candidate.id, "Tasdiqlandi")}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-green hover:text-clinical-green"
                        title="Tasdiqlash"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDuplicateStatus(candidate.id, "Rad etildi")}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-red hover:text-clinical-red"
                        title="Rad etish"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-clinical-slate">Dublikat nomzod topilmagan.</p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-clinical-line bg-white px-3 py-2">
      <span className="block text-[11px] text-clinical-slate">{label}</span>
      <strong className="mt-1 block truncate text-sm text-clinical-ink">{value}</strong>
    </div>
  );
}

function addMinutes(time: string, minutesToAdd: number) {
  const [hours = "0", minutes = "0"] = time.split(":");
  const date = new Date(2026, 5, 3, Number(hours), Number(minutes));
  date.setMinutes(date.getMinutes() + minutesToAdd);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function backendStatusToAppointmentStatus(status: BackendAppointment["status"]): Appointment["status"] {
  if (status === "COMPLETED") {
    return "Bajarildi";
  }
  if (status === "CANCELLED" || status === "NO_SHOW") {
    return "Bekor qilingan";
  }
  return "Aktiv";
}

function backendPriorityToAppointmentPriority(priority: BackendAppointmentPriority): Appointment["priority"] {
  if (priority === "URGENT" || priority === "CRITICAL") {
    return "Yuqori";
  }
  if (priority === "SOON") {
    return "O'rta";
  }
  return "Past";
}

function appointmentPriorityToBackend(priority: Appointment["priority"]): BackendAppointmentPriority {
  if (priority === "Yuqori") {
    return "URGENT";
  }
  if (priority === "O'rta") {
    return "SOON";
  }
  return "ROUTINE";
}

function appointmentTypeFromDepartment(department: string): BackendAppointmentType {
  const normalized = normalizeText(department);
  if (normalized.includes("homilador")) {
    return "PERINATAL";
  }
  if (normalized.includes("laboratoriya")) {
    return "LAB";
  }
  if (normalized.includes("patronaj")) {
    return "PATRONAGE";
  }
  if (normalized.includes("mrt") || normalized.includes("kt") || normalized.includes("imaging")) {
    return "IMAGING";
  }
  return "PRIMARY_CARE";
}

function departmentFromAppointmentType(type: BackendAppointmentType, departmentName: string) {
  if (departmentName) {
    return departmentName;
  }
  const labels: Record<BackendAppointmentType, string> = {
    PRIMARY_CARE: "Primary care",
    FOLLOW_UP: "Follow up",
    PATRONAGE: "Patronaj",
    PERINATAL: "Homiladorlar",
    LAB: "Laboratoriya",
    IMAGING: "Tasvirlash",
    SPECIALIST: "Mutaxassis",
    EMERGENCY: "Shoshilinch",
  };
  return labels[type];
}

function localDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function scheduledDateTime(date: string, time: string) {
  return `${date}T${time}:00+05:00`;
}

function addMinutesToScheduledDateTime(date: string, time: string, minutesToAdd: number) {
  const value = new Date(scheduledDateTime(date, time));
  value.setMinutes(value.getMinutes() + minutesToAdd);
  return value.toISOString();
}

function appointmentFromBackend(appointment: BackendAppointment): Appointment {
  const scheduled = new Date(appointment.scheduled_start);
  const validDate = !Number.isNaN(scheduled.getTime());
  return {
    id: appointment.id,
    patientId: appointment.patient,
    date: validDate ? scheduled.toISOString().slice(0, 10) : appointment.scheduled_start.slice(0, 10),
    time: validDate
      ? `${String(scheduled.getHours()).padStart(2, "0")}:${String(scheduled.getMinutes()).padStart(2, "0")}`
      : appointment.scheduled_start.slice(11, 16),
    patient: appointment.patient_name,
    department: departmentFromAppointmentType(appointment.appointment_type, appointment.department_name),
    doctor: appointment.provider_name || appointment.created_by_name,
    status: backendStatusToAppointmentStatus(appointment.status),
    priority: backendPriorityToAppointmentPriority(appointment.priority),
    reason: appointment.reason,
    room: appointment.room_label || "",
    notes: appointment.notes,
  };
}

function appointmentPayloadFromDraft(
  patient: RegistryPatient,
  draft: {
    date: string;
    time: string;
    department: string;
    reason: string;
    priority: Appointment["priority"];
  },
): AppointmentPayload {
  return {
    patient: patient.id,
    appointment_type: appointmentTypeFromDepartment(draft.department),
    status: "IN_PROGRESS",
    priority: appointmentPriorityToBackend(draft.priority),
    scheduled_start: scheduledDateTime(draft.date, draft.time),
    scheduled_end: addMinutesToScheduledDateTime(draft.date, draft.time, 30),
    reason: draft.reason.trim(),
    notes: "",
  };
}

const clinicalFieldLabels: Array<{ key: keyof AppointmentClinicalInput; label: string }> = [
  { key: "complaint", label: "Shikoyat" },
  { key: "diagnosis", label: "Tashxis" },
  { key: "vitals", label: "Vital belgilar" },
  { key: "ctFindings", label: "KT (CT)" },
  { key: "mrtFindings", label: "MRT" },
  { key: "ultrasoundFindings", label: "UTT / USG" },
  { key: "laboratoryFindings", label: "Laboratoriya" },
  { key: "otherAnalysis", label: "Boshqa analizlar" },
  { key: "prescriptions", label: "Dori-darmon" },
  { key: "clinicalNotes", label: "Qabul yozuvi" },
];

const safetyReviewStatusStyles = {
  queued: "border-slate-200 bg-slate-50 text-clinical-slate",
  submitted: "border-emerald-200 bg-emerald-50 text-emerald-900",
  sync_failed: "border-amber-200 bg-amber-50 text-amber-900",
};

function filledClinicalRows(input?: AppointmentClinicalInput) {
  if (!input) {
    return [];
  }
  return clinicalFieldLabels
    .map((field) => ({ ...field, value: input[field.key].trim() }))
    .filter((field) => Boolean(field.value));
}

function appointmentTextContainsPregnancy(text: string) {
  const normalized = normalizeText(text);
  return normalized.includes("homilador") || normalized.includes("preg") || normalized.includes("gravid");
}

function buildMedicalRecordPayload(
  patient: RegistryPatient,
  appointment: Appointment,
  clinical: AppointmentClinicalInput,
): MedicalRecordPayload {
  const clinicalRows = filledClinicalRows(clinical);
  const hasImaging = Boolean(
    clinical.ctFindings.trim() || clinical.mrtFindings.trim() || clinical.ultrasoundFindings.trim(),
  );
  const freeText = [
    appointment.department,
    appointment.reason,
    patient.clinicalDiagnosis,
    ...clinicalRows.map((row) => row.value),
  ].join("\n");
  const pregnancyContext = appointmentTextContainsPregnancy(freeText);
  const clinicalNotes = [
    `Qabul: ${appointment.date} ${appointment.time}`,
    `Bo'lim: ${appointment.department}`,
    `Ustuvorlik: ${appointment.priority}`,
    `Sabab: ${appointment.reason}`,
    `Bemor xavf zonasi: ${patient.riskZone}`,
    ...clinicalRows.map((row) => `${row.label}: ${row.value}`),
  ].join("\n");

  return {
    patient: patient.id,
    doctor_id: appointment.doctor,
    diagnosis: clinical.diagnosis.trim() || patient.clinicalDiagnosis || appointment.reason,
    prescriptions: clinical.prescriptions.trim(),
    clinical_notes: clinicalNotes,
    record_type: hasImaging ? "IMAGING" : "CONSULTATION",
    imaging_safety_metadata: {
      source: "doctor_qabul",
      local_appointment_id: appointment.id,
      room: appointment.room,
      consent_confirmed: false,
      modality: [
        clinical.ctFindings.trim() ? "CT" : "",
        clinical.mrtFindings.trim() ? "MRT" : "",
        clinical.ultrasoundFindings.trim() ? "USG" : "",
      ]
        .filter(Boolean)
        .join(", "),
      notes: [
        clinical.ctFindings.trim() ? `CT: ${clinical.ctFindings.trim()}` : "",
        clinical.mrtFindings.trim() ? `MRT: ${clinical.mrtFindings.trim()}` : "",
        clinical.ultrasoundFindings.trim() ? `USG: ${clinical.ultrasoundFindings.trim()}` : "",
        pregnancyContext ? "pregnancy_context: possible pregnant patient" : "",
      ]
        .filter(Boolean)
        .join("\n"),
      patient_snapshot: {
        medical_card: patient.medicalCard,
        risk_zone: patient.riskZone,
        health_group: patient.healthGroup,
        age: patient.age,
        territory: patient.territory,
      },
    },
  };
}

type AdmissionDashboardRow = AdmissionRow & {
  backendStatus: Admission["status"];
  departmentId: number | null;
  roomId: number | null;
};

function formatBackendDateTime(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16).replace("T", " ");
  }
  const day = date.toISOString().slice(0, 10);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${day} ${time}`;
}

function triageLabel(status: Patient["triage_status"]): AdmissionRow["triage"] {
  if (status === "RED") {
    return "Qizil";
  }
  if (status === "YELLOW") {
    return "Sariq";
  }
  return "Yashil";
}

function admissionStatusLabel(status: Admission["status"]): AdmissionRow["status"] {
  const labels: Record<Admission["status"], AdmissionRow["status"]> = {
    REQUESTED: "So'rov",
    WAITLISTED: "Navbat",
    ADMITTED: "Yotqizildi",
    TRANSFERRED: "Ko'chirildi",
    DISCHARGED: "Chiqarildi",
    CANCELLED: "Bekor",
  };
  return labels[status];
}

function admissionPriorityLabel(priority: Admission["priority"]): AdmissionRow["priority"] {
  if (priority === "CRITICAL") {
    return "Kritik";
  }
  if (priority === "URGENT") {
    return "Shoshilinch";
  }
  return "Rejali";
}

function admissionRowFromBackend(admission: Admission): AdmissionDashboardRow {
  return {
    id: admission.id,
    patientId: admission.patient,
    patient: admission.patient_name,
    department: admission.department_name || admission.hospital_name || "Belgilanmagan",
    room: admission.room_label || "Xona belgilanmagan",
    triage: triageLabel(admission.patient_triage_status),
    requestedAt: formatBackendDateTime(admission.requested_at),
    status: admissionStatusLabel(admission.status),
    priority: admissionPriorityLabel(admission.priority),
    reason: admission.reason || "Sabab kiritilmagan",
    assignedTo: admission.admitting_provider_name || admission.requested_by_name || "Belgilanmagan",
    backendStatus: admission.status,
    departmentId: admission.department_ref,
    roomId: admission.room,
  };
}

function hospitalBedsFromBackend(rooms: Room[], admissions: AdmissionDashboardRow[]): HospitalBedRow[] {
  const rows = new Map<string, HospitalBedRow>();
  const ensureRow = (unit: string) => {
    const key = unit || "Belgilanmagan";
    if (!rows.has(key)) {
      rows.set(key, { unit: key, beds: 0, occupied: 0, waiting: 0, critical: 0 });
    }
    return rows.get(key)!;
  };

  rooms
    .filter((room) => room.is_active)
    .forEach((room) => {
      const row = ensureRow(room.department_name || room.hospital_name || "Belgilanmagan");
      row.beds += room.bed_count;
    });

  admissions.forEach((admission) => {
    const row = ensureRow(admission.department);
    if (admission.backendStatus === "ADMITTED" || admission.backendStatus === "TRANSFERRED") {
      row.occupied += 1;
    }
    if (admission.backendStatus === "REQUESTED" || admission.backendStatus === "WAITLISTED") {
      row.waiting += 1;
    }
    if (admission.priority === "Kritik" || admission.triage === "Qizil") {
      row.critical += 1;
    }
    if (!row.beds) {
      row.beds = Math.max(row.occupied + row.waiting, 1);
    }
  });

  return Array.from(rows.values()).sort((left, right) => left.unit.localeCompare(right.unit));
}

function medicalRecordSafetyLabel(status?: MedicalRecord["ai_review_status"]) {
  const labels: Record<NonNullable<MedicalRecord["ai_review_status"]>, string> = {
    PENDING: "AI orqa nazoratda",
    CLEAR: "Xavfsiz",
    NEEDS_REVIEW: "Bosh shifokor ko'radi",
    CRITICAL: "Kritik signal yuborilgan",
  };
  return status ? labels[status] : "AI tekshiruv kutilmoqda";
}

function medicalRecordDocumentRow(record: MedicalRecord): DocumentRow {
  const typeLabels: Record<MedicalRecord["record_type"], string> = {
    CONSULTATION: "Qabul yozuvi",
    IMAGING: "KT/MRT/UTT xulosasi",
    DISCHARGE: "Chiqarish xulosasi",
    FOLLOW_UP: "Kuzatuv yozuvi",
  };
  return {
    title: record.diagnosis || typeLabels[record.record_type],
    patient: record.patient_name,
    type: typeLabels[record.record_type],
    owner: record.doctor_id || "Belgilanmagan",
    updatedAt: formatBackendDateTime(record.updated_at),
    status: record.discharge_status === "DISCHARGED" ? "Yopilgan" : medicalRecordSafetyLabel(record.ai_review_status),
  };
}

function prescriptionRowFromRecord(record: MedicalRecord): PrescriptionRow | null {
  const prescription = record.prescriptions.trim();
  if (!prescription) {
    return null;
  }
  const [firstLine, ...rest] = prescription.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return {
    patient: record.patient_name,
    medication: firstLine || "Retsept",
    dose: rest.join("; ") || record.diagnosis || "Doza yozuvi kiritilmagan",
    duration: formatBackendDate(record.created_at),
    status: record.discharge_status === "DISCHARGED" ? "Yakunlangan" : "Faol",
    safety: medicalRecordSafetyLabel(record.ai_review_status),
  };
}

function taskPriorityLabel(priority: ClinicalTask["priority"]): ClinicalTaskRow["priority"] {
  if (priority === "CRITICAL" || priority === "URGENT") {
    return "Yuqori";
  }
  if (priority === "SOON") {
    return "O'rta";
  }
  return "Past";
}

function clinicalTaskStatusLabel(status: ClinicalTask["status"]): ClinicalTaskRow["status"] {
  const labels: Record<ClinicalTask["status"], ClinicalTaskRow["status"]> = {
    OPEN: "Ochiq",
    IN_PROGRESS: "Jarayonda",
    BLOCKED: "Ochiq",
    COMPLETED: "Bajarildi",
    CANCELLED: "Bekor",
  };
  return labels[status];
}

function clinicalTaskRowFromBackend(task: ClinicalTask): ClinicalTaskRow {
  return {
    id: task.id,
    patientId: task.patient ?? 0,
    title: task.title,
    owner: task.assigned_to_name || task.created_by_name || "Belgilanmagan",
    type: task.task_type.replaceAll("_", " "),
    dueAt: formatBackendDateTime(task.due_at) || formatBackendDateTime(task.created_at),
    priority: taskPriorityLabel(task.priority),
    status: clinicalTaskStatusLabel(task.status),
  };
}

function referralPriorityLabel(priority: Referral["priority"]): ReferralRow["priority"] {
  if (priority === "CRITICAL" || priority === "URGENT") {
    return "Yuqori";
  }
  if (priority === "SOON") {
    return "O'rta";
  }
  return "Past";
}

function referralStatusLabel(status: Referral["status"]): ReferralRow["status"] {
  const labels: Record<Referral["status"], ReferralRow["status"]> = {
    DRAFT: "So'rov",
    REQUESTED: "So'rov",
    ACCEPTED: "Qabul qilindi",
    SCHEDULED: "Rejalashtirildi",
    COMPLETED: "Bajarildi",
    CANCELLED: "Bekor",
  };
  return labels[status];
}

function referralRowFromBackend(referral: Referral): ReferralRow {
  return {
    id: referral.id,
    patientId: referral.patient,
    target: referral.target_department_name || referral.target_hospital_name || referral.referral_type.replaceAll("_", " "),
    type: referral.referral_type.replaceAll("_", " "),
    requestedAt: formatBackendDateTime(referral.requested_at),
    priority: referralPriorityLabel(referral.priority),
    status: referralStatusLabel(referral.status),
    reason: referral.reason || referral.clinical_summary || "Sabab kiritilmagan",
  };
}

function treatmentCourseRowsFromBackend(records: MedicalRecord[], tasks: ClinicalTask[]): TreatmentCourseRow[] {
  const groups = new Map<number, MedicalRecord[]>();
  records.forEach((record) => {
    const list = groups.get(record.patient) ?? [];
    list.push(record);
    groups.set(record.patient, list);
  });

  return Array.from(groups.entries())
    .map(([patientId, patientRecords]) => {
      const latest = [...patientRecords].sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
      const patientTasks = tasks.filter((task) => task.patient === patientId);
      const actionableTasks = patientTasks.filter((task) => task.status !== "CANCELLED");
      const completedTasks = actionableTasks.filter((task) => task.status === "COMPLETED");
      const progress = actionableTasks.length
        ? Math.round((completedTasks.length / actionableTasks.length) * 100)
        : latest.discharge_status === "DISCHARGED"
          ? 100
          : latest.ai_review_status === "CLEAR"
            ? 60
            : 25;
      const nextTask = [...patientTasks]
        .filter((task) => task.status === "OPEN" || task.status === "IN_PROGRESS" || task.status === "BLOCKED")
        .sort((left, right) => String(left.due_at ?? left.created_at).localeCompare(String(right.due_at ?? right.created_at)))[0];

      return {
        patient: latest.patient_name,
        diagnosis: latest.diagnosis || "Tashxis kiritilmagan",
        startedAt: formatBackendDate(latest.created_at),
        progress,
        nextAction: nextTask
          ? `${nextTask.title} (${formatBackendDateTime(nextTask.due_at) || "muddat belgilanmagan"})`
          : latest.discharge_status === "DISCHARGED"
            ? "Kurs yopilgan, discharge xulosasi mavjud"
            : "Keyingi klinik vazifa belgilanmagan",
      };
    })
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function perinatalRiskZone(risk: PerinatalRegistryEntry["risk_level"]): PregnantRegistryRow["riskZone"] {
  if (risk === "CRITICAL" || risk === "HIGH") {
    return "Qizil";
  }
  if (risk === "MODERATE") {
    return "Sariq";
  }
  return "Yashil";
}

function perinatalStatusLabel(status: PerinatalRegistryEntry["status"]): PregnantRegistryRow["status"] {
  const labels: Record<PerinatalRegistryEntry["status"], PregnantRegistryRow["status"]> = {
    ACTIVE: "Faol",
    WATCHLIST: "Kuzatuv",
    HOSPITALIZED: "Yotqizildi",
    DELIVERED: "Tug'ruq",
    CLOSED: "Yopildi",
  };
  return labels[status];
}

function perinatalRowFromBackend(entry: PerinatalRegistryEntry): PregnantRegistryRow {
  return {
    id: entry.id,
    patientId: entry.patient,
    patient: entry.patient_name,
    week: entry.gestational_age_weeks,
    day: entry.gestational_age_days,
    riskZone: perinatalRiskZone(entry.risk_level),
    bp: entry.latest_systolic_bp && entry.latest_diastolic_bp ? `${entry.latest_systolic_bp}/${entry.latest_diastolic_bp}` : "Kiritilmagan",
    gravida: entry.gravida,
    para: entry.para,
    edd: formatBackendDate(entry.estimated_due_date),
    lastScreening: formatBackendDate(entry.updated_at),
    nextVisit: formatBackendDate(entry.next_visit_at),
    status: perinatalStatusLabel(entry.status),
    provider: entry.assigned_provider_name || entry.department_name || "Belgilanmagan",
    riskFactors: entry.risk_factors,
    fetalNote: entry.fetal_notes || entry.enrollment_reason || "Fetal yozuv kiritilmagan",
  };
}

function patronageVisitTypeLabel(type: PatronageVisit["visit_type"]): PatronageRow["visitType"] {
  const labels: Record<PatronageVisit["visit_type"], PatronageRow["visitType"]> = {
    ROUTINE: "Rejali",
    HIGH_RISK: "Yuqori xavf",
    POST_DISCHARGE: "Chiqarilgandan keyin",
    PERINATAL: "Perinatal",
    CHRONIC: "Surunkali",
    NEWBORN: "Yuqori xavf",
  };
  return labels[type];
}

function patronageStatusLabel(status: PatronageVisit["status"]): PatronageRow["status"] {
  const labels: Record<PatronageVisit["status"], PatronageRow["status"]> = {
    PLANNED: "Rejada",
    OFFLINE_QUEUED: "Offline navbat",
    SYNCED: "Sinxronlandi",
    CONFLICT: "Konflikt",
    COMPLETED: "Bajarildi",
    CANCELLED: "Bekor",
  };
  return labels[status];
}

function patronageSyncLabel(status: PatronageVisit["status"]): PatronageRow["sync"] {
  if (status === "OFFLINE_QUEUED") {
    return "Navbatda";
  }
  if (status === "CONFLICT") {
    return "Konflikt";
  }
  if (status === "CANCELLED") {
    return "Qayta ko'rish";
  }
  return "Serverda";
}

function patronageRowFromBackend(visit: PatronageVisit): PatronageRow {
  return {
    id: visit.id,
    patientId: visit.patient,
    patient: visit.patient_name,
    territory: visit.territory || visit.hospital_name || "Hudud belgilanmagan",
    nurse: visit.assigned_to_name || visit.created_by_name || "Belgilanmagan",
    visitType: patronageVisitTypeLabel(visit.visit_type),
    visitDate: formatBackendDateTime(visit.scheduled_for),
    priority: taskPriorityLabel(visit.priority),
    sync: patronageSyncLabel(visit.status),
    status: patronageStatusLabel(visit.status),
    offlineId: visit.client_reference || visit.idempotency_key || visit.public_id,
    lastSync: formatBackendDateTime(visit.synced_at) || formatBackendDateTime(visit.updated_at),
    serverVersion: visit.server_version,
    notes: visit.notes || visit.conflict_reason || "Izoh kiritilmagan",
  };
}

function planningRowsFromBackend(
  appointmentsList: BackendAppointment[],
  tasks: ClinicalTask[],
  patronageVisits: PatronageVisit[],
): PlanningRow[] {
  const appointmentRows: PlanningRow[] = appointmentsList.map((appointment) => ({
    title: `Qabul: ${appointment.patient_name}`,
    owner: appointment.provider_name || appointment.created_by_name || "Belgilanmagan",
    date: formatBackendDateTime(appointment.scheduled_start),
    department: departmentFromAppointmentType(appointment.appointment_type, appointment.department_name),
    status: backendStatusToAppointmentStatus(appointment.status),
  }));
  const taskRows: PlanningRow[] = tasks.map((task) => ({
    title: task.title,
    owner: task.assigned_to_name || task.created_by_name || "Belgilanmagan",
    date: formatBackendDateTime(task.due_at) || formatBackendDateTime(task.created_at),
    department: task.department_name || task.task_type.replaceAll("_", " "),
    status: clinicalTaskStatusLabel(task.status),
  }));
  const patronageRowsFromBackend: PlanningRow[] = patronageVisits.map((visit) => ({
    title: `Patronaj: ${visit.patient_name}`,
    owner: visit.assigned_to_name || visit.created_by_name || "Belgilanmagan",
    date: formatBackendDateTime(visit.scheduled_for),
    department: visit.territory || visit.visit_type.replaceAll("_", " "),
    status: patronageStatusLabel(visit.status),
  }));

  return [...appointmentRows, ...taskRows, ...patronageRowsFromBackend]
    .filter((row) => row.date)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 24);
}

function biomarkerNumber(patient: Patient, key: string) {
  const value = patient.chronic_biomarkers?.[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace("%", ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function percentage(count: number, total: number) {
  return total ? Math.round((count / total) * 100) : 0;
}

function aiErrorTypeLabel(errorType: AIErrorLog["error_type"]) {
  const labels: Record<AIErrorLog["error_type"], string> = {
    ENTRY_OMISSION: "Klinik yozuvda muhim maydon yetishmayapti",
    PRESCRIPTION_MISMATCH: "Dori xavfsizligi mos kelmasligi",
    ETHICAL_DEVIATION: "Etik yoki protokol og'ishi",
    IMAGING_SAFETY: "KT/MRT/UTT xavfsizlik signali",
    DIGITAL_TWIN_RISK: "Digital Twin yuqori xavf signali",
  };
  return labels[errorType];
}

function medicalRecordTypeLabel(type: MedicalRecord["record_type"]) {
  const labels: Record<MedicalRecord["record_type"], string> = {
    CONSULTATION: "Qabul yozuvi",
    IMAGING: "Tasvirlash yozuvi",
    DISCHARGE: "Chiqarish xulosasi",
    FOLLOW_UP: "Kuzatuv yozuvi",
  };
  return labels[type];
}

function taskSourceLogId(task: ClinicalTask) {
  const value = task.metadata?.source_ai_error_log_id;
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function aiWarningStatusFromLog(log: AIErrorLog, tasks: ClinicalTask[]): ClinicAIWarningStatus {
  if (tasks.some((task) => taskSourceLogId(task) === log.id && task.status !== "CANCELLED")) {
    return "Vazifa ochildi";
  }
  if (log.reviewed_by_admin) {
    return "Ko'rildi";
  }
  if (log.severity === "HIGH" || log.severity === "CRITICAL") {
    return "Head doctorga yuborildi";
  }
  return "Yangi";
}

function recommendedActionForAIError(log: AIErrorLog) {
  if (log.severity === "CRITICAL") {
    return "Bosh shifokor tezkor ko'rigi, RCA yozuvi va mas'ul klinik vazifa ochish.";
  }
  if (log.severity === "HIGH") {
    return "Head doctor ko'rib chiqishi, shifokor yozuvini tekshirish va muddatli vazifa ochish.";
  }
  if (log.error_type === "PRESCRIPTION_MISMATCH") {
    return "Dori ro'yxati va bemor risk omillarini qayta solishtirish.";
  }
  return "Klinik yozuvni audit qilib, yetishmayotgan ma'lumotni to'ldirish.";
}

function aiWarningFromLog(log: AIErrorLog, records: MedicalRecord[], tasks: ClinicalTask[]): ClinicAIWarning {
  const record = records.find((item) => item.id === log.medical_record);
  return {
    id: log.id,
    backendLogId: log.id,
    medicalRecordId: log.medical_record,
    patientId: record?.patient ?? null,
    severity: log.severity,
    patient: log.patient_name,
    doctor: log.doctor_id || "Belgilanmagan shifokor",
    department: record?.department_ref ? `Bo'lim #${record.department_ref}` : "AI safety",
    signal: aiErrorTypeLabel(log.error_type),
    evidence: log.rca_description || "AI safety review tafsiloti kiritilmagan.",
    recommendedAction: recommendedActionForAIError(log),
    source: `${medicalRecordTypeLabel(record?.record_type ?? "CONSULTATION")} #${log.medical_record}`,
    createdAt: formatBackendDateTime(log.created_at),
    status: aiWarningStatusFromLog(log, tasks),
    sentAt: log.reviewed_by_admin ? undefined : formatBackendDateTime(log.created_at),
  };
}

function warningSeverityFromRecord(record: MedicalRecord): ClinicAIWarningSeverity {
  if (record.ai_review_status === "CRITICAL") {
    return "CRITICAL";
  }
  if (record.ai_review_status === "NEEDS_REVIEW") {
    return "HIGH";
  }
  if (record.ai_review_status === "PENDING") {
    return "MEDIUM";
  }
  return "LOW";
}

function warningSeverityFromAppointment(appointment: BackendAppointment): ClinicAIWarningSeverity {
  if (appointment.priority === "CRITICAL") {
    return "CRITICAL";
  }
  if (appointment.priority === "URGENT") {
    return "HIGH";
  }
  if (appointment.priority === "SOON") {
    return "MEDIUM";
  }
  return "LOW";
}

function warningSeverityFromPerinatal(entry: PerinatalRegistryEntry): ClinicAIWarningSeverity {
  if (entry.risk_level === "CRITICAL") {
    return "CRITICAL";
  }
  if (entry.risk_level === "HIGH") {
    return "HIGH";
  }
  if (entry.risk_level === "MODERATE") {
    return "MEDIUM";
  }
  return "LOW";
}

function warningSeverityFromPatronage(visit: PatronageVisit): ClinicAIWarningSeverity {
  if (visit.status === "CONFLICT" || visit.priority === "CRITICAL") {
    return "HIGH";
  }
  if (visit.status === "OFFLINE_QUEUED" || visit.priority === "URGENT") {
    return "MEDIUM";
  }
  return "LOW";
}

function warningSeverityFromTask(task: ClinicalTask): ClinicAIWarningSeverity {
  const priority = taskPriorityLabel(task.priority);
  if (priority === "Yuqori") {
    return "HIGH";
  }
  if (priority === "O'rta") {
    return "MEDIUM";
  }
  return "LOW";
}

function activitySignalsFromBackend(
  logs: AIErrorLog[],
  records: MedicalRecord[],
  appointmentsList: BackendAppointment[],
  tasks: ClinicalTask[],
  patronageVisits: PatronageVisit[],
  perinatalEntries: PerinatalRegistryEntry[],
): DoctorActivitySignal[] {
  let nextId = 1;
  const rows: DoctorActivitySignal[] = [
    ...logs.map((log) => ({
      id: nextId++,
      time: formatBackendDateTime(log.created_at),
      doctor: log.doctor_id || "AI safety",
      patient: log.patient_name,
      action: aiErrorTypeLabel(log.error_type),
      module: "AI analyzes",
      aiSignal: log.rca_description || "AI safety review signali.",
      severity: log.severity,
    })),
    ...records.map((record) => ({
      id: nextId++,
      time: formatBackendDateTime(record.created_at),
      doctor: record.doctor_id || "Belgilanmagan",
      patient: record.patient_name,
      action: `${medicalRecordTypeLabel(record.record_type)}: ${record.diagnosis || "Tashxis kiritilmagan"}`,
      module: "Tibbiy yozuv",
      aiSignal: medicalRecordSafetyLabel(record.ai_review_status),
      severity: warningSeverityFromRecord(record),
    })),
    ...appointmentsList.map((appointment) => ({
      id: nextId++,
      time: formatBackendDateTime(appointment.updated_at || appointment.created_at),
      doctor: appointment.provider_name || appointment.created_by_name || "Belgilanmagan",
      patient: appointment.patient_name,
      action: `${departmentFromAppointmentType(appointment.appointment_type, appointment.department_name)}: ${backendStatusToAppointmentStatus(appointment.status)}`,
      module: "Qabullar",
      aiSignal: appointment.priority === "CRITICAL" ? "Kritik ustuvor qabul bosh shifokor nazoratida." : appointment.reason || "Qabul oqimi kuzatuvda.",
      severity: warningSeverityFromAppointment(appointment),
    })),
    ...tasks.map((task) => ({
      id: nextId++,
      time: formatBackendDateTime(task.updated_at),
      doctor: task.assigned_to_name || task.created_by_name || "Belgilanmagan",
      patient: task.patient_name || "Bemor biriktirilmagan",
      action: `${task.title}: ${clinicalTaskStatusLabel(task.status)}`,
      module: "Klinik vazifa",
      aiSignal: task.description || "Vazifa oqimi nazoratda.",
      severity: warningSeverityFromTask(task),
    })),
    ...patronageVisits.map((visit) => ({
      id: nextId++,
      time: formatBackendDateTime(visit.updated_at),
      doctor: visit.assigned_to_name || visit.created_by_name || "Patronaj",
      patient: visit.patient_name,
      action: `${patronageVisitTypeLabel(visit.visit_type)}: ${patronageStatusLabel(visit.status)}`,
      module: "Patronaj",
      aiSignal: visit.conflict_reason || visit.notes || "Patronaj sinxron holati nazoratda.",
      severity: warningSeverityFromPatronage(visit),
    })),
    ...perinatalEntries.map((entry) => ({
      id: nextId++,
      time: formatBackendDateTime(entry.updated_at),
      doctor: entry.assigned_provider_name || entry.department_name || "Perinatal",
      patient: entry.patient_name,
      action: `Perinatal ${perinatalStatusLabel(entry.status)}: ${entry.gestational_age_weeks}w ${entry.gestational_age_days}d`,
      module: "Perinatal",
      aiSignal: entry.fetal_notes || entry.enrollment_reason || "Perinatal xavf zonasi nazoratda.",
      severity: warningSeverityFromPerinatal(entry),
    })),
  ];

  return rows
    .filter((row) => row.time)
    .sort((left, right) => right.time.localeCompare(left.time))
    .slice(0, 40);
}

function taskPriorityFromWarning(severity: ClinicAIWarningSeverity): ClinicalTask["priority"] {
  if (severity === "CRITICAL") {
    return "CRITICAL";
  }
  if (severity === "HIGH") {
    return "URGENT";
  }
  if (severity === "MEDIUM") {
    return "SOON";
  }
  return "ROUTINE";
}

function dueAtFromSeverity(severity: ClinicAIWarningSeverity) {
  const date = new Date();
  date.setHours(date.getHours() + (severity === "CRITICAL" ? 2 : severity === "HIGH" ? 8 : 24));
  return date.toISOString();
}

function doctorShortcomingSummaries(warnings: ClinicAIWarning[]): DoctorShortcomingSummary[] {
  const grouped = new Map<string, ClinicAIWarning[]>();
  warnings.forEach((warning) => {
    const key = warning.doctor || "Belgilanmagan shifokor";
    grouped.set(key, [...(grouped.get(key) ?? []), warning]);
  });

  return Array.from(grouped.entries())
    .map(([doctor, doctorWarnings]) => {
      const sorted = [...doctorWarnings].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const latest = sorted[0];
      const sourceCounts = doctorWarnings.reduce<Record<string, number>>((counts, warning) => {
        counts[warning.signal] = (counts[warning.signal] ?? 0) + 1;
        return counts;
      }, {});
      const topSource =
        Object.entries(sourceCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? latest.signal;

      return {
        doctor,
        total: doctorWarnings.length,
        critical: doctorWarnings.filter((warning) => warning.severity === "CRITICAL").length,
        high: doctorWarnings.filter((warning) => warning.severity === "HIGH").length,
        open: doctorWarnings.filter((warning) => warning.status !== "Ko'rildi").length,
        latestSignal: latest.signal,
        latestPatient: latest.patient,
        latestAt: latest.createdAt,
        topSource,
        latestWarningId: latest.id,
      };
    })
    .sort((left, right) => right.critical - left.critical || right.high - left.high || right.open - left.open || right.total - left.total);
}

function SafetyReviewBadge({ review }: { review?: AppointmentSafetyReview }) {
  if (!review) {
    return (
      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-clinical-slate">
        Kutilmoqda
      </span>
    );
  }

  const label = review.status === "queued" ? "Navbatda" : review.status === "sync_failed" ? "Sync xato" : "Orqa nazorat";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${safetyReviewStatusStyles[review.status]}`}>
      <ShieldCheck className="h-3 w-3" />
      {label}
    </span>
  );
}

function AppointmentsView({ module, query }: { module: CrmModuleKey; query: string }) {
  const appointmentFormRef = useRef<HTMLFormElement | null>(null);
  const initialFilter: AppointmentFilter =
    module === "active-appointments"
      ? "Aktiv"
      : module === "completed-appointments"
        ? "Bajarildi"
        : module === "cancelled-appointments"
          ? "Bekor qilingan"
          : "Barchasi";
  const [filter, setFilter] = useState<AppointmentFilter>(initialFilter);
  const [items, setItems] = useState<Appointment[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [availablePatients, setAvailablePatients] = useState<RegistryPatient[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [draft, setDraft] = useState({
    patientId: 0,
    date: localDateInputValue(),
    time: "12:30",
    department: "Oilaviy shifokor",
    reason: "",
    priority: "O'rta" as Appointment["priority"],
    ...emptyClinicalInput,
  });
  const [clinicalIntakes, setClinicalIntakes] = useState<Record<number, AppointmentClinicalInput>>({});
  const [safetyReviews, setSafetyReviews] = useState<Record<number, AppointmentSafetyReview>>({});
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(true);
  const [appointmentFormMessage, setAppointmentFormMessage] = useState("");
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);

  useEffect(() => {
    let active = true;

    setAppointmentsLoading(true);
    Promise.all([listPatients(), listAppointments()])
      .then(([patientResponse, appointmentResponse]) => {
        if (!active) {
          return;
        }
        const mappedPatients = patientResponse.results.map(registryPatientFromBackend);
        const mappedAppointments = appointmentResponse.results.map(appointmentFromBackend);
        setAvailablePatients(mappedPatients);
        setItems(mappedAppointments);
        setSelectedId((current) =>
          mappedAppointments.some((appointment) => appointment.id === current) ? current : mappedAppointments[0]?.id ?? 0,
        );
        setDraft((current) => ({
          ...current,
          patientId: mappedPatients.some((patient) => patient.id === current.patientId)
            ? current.patientId
            : mappedPatients[0]?.id ?? 0,
        }));
        setAppointmentFormMessage("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setAvailablePatients([]);
        setItems([]);
        setSelectedId(0);
        setAppointmentFormMessage(error instanceof Error ? error.message : "Appointments API is not available.");
      })
      .finally(() => {
        if (active) {
          setAppointmentsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const search = normalizeText(query);
    return (
      (filter === "Barchasi" || item.status === filter) &&
      (!search || normalizeText(`${item.patient} ${item.department} ${item.doctor} ${item.reason}`).includes(search))
    );
  }), [filter, items, query]);

  const selected = items.find((item) => item.id === selectedId) ?? filtered[0] ?? items[0];
  const selectedClinicalRows = filledClinicalRows(selected ? clinicalIntakes[selected.id] : undefined);
  const selectedSafetyReview = selected ? safetyReviews[selected.id] : undefined;
  const appointmentLoadPercent = items.length ? Math.round((items.filter((item) => item.status === "Aktiv").length / items.length) * 100) : 0;
  const calendarDate = draft.date || localDateInputValue();

  const setStatus = async (appointmentId: number, statusValue: Appointment["status"]) => {
    try {
      const response =
        statusValue === "Bajarildi"
          ? await completeAppointment(appointmentId)
          : statusValue === "Bekor qilingan"
            ? await cancelAppointment(appointmentId, "Cancelled from CRM")
            : await startAppointment(appointmentId);
      const appointment = appointmentFromBackend(response.appointment);
      setItems((current) => current.map((item) => (item.id === appointmentId ? appointment : item)));
      setSelectedId(appointment.id);
      setAppointmentFormMessage("");
    } catch (error) {
      setAppointmentFormMessage(error instanceof Error ? error.message : "Appointment status could not be updated.");
    }
  };

  const rescheduleSelected = async () => {
    if (!selected) {
      return;
    }
    try {
      const response = await rescheduleAppointment(
        selected.id,
        scheduledDateTime(selected.date, addMinutes(selected.time, 30)),
        addMinutesToScheduledDateTime(selected.date, addMinutes(selected.time, 30), 30),
      );
      const appointment = appointmentFromBackend(response.appointment);
      setItems((current) => current.map((item) => (item.id === selected.id ? appointment : item)));
      setSelectedId(appointment.id);
      setAppointmentFormMessage("");
    } catch (error) {
      setAppointmentFormMessage(error instanceof Error ? error.message : "Appointment could not be rescheduled.");
    }
  };

  const addAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppointmentFormMessage("");
    if (isSubmittingAppointment) {
      return;
    }
    const patient = availablePatients.find((entry) => entry.id === Number(draft.patientId));
    if (!patient || !draft.reason.trim()) {
      setAppointmentFormOpen(true);
      setAppointmentFormMessage("Qabul yaratish uchun bemor va sabab maydonlari to'ldirilishi kerak.");
      return;
    }
    const clinical: AppointmentClinicalInput = {
      complaint: draft.complaint,
      diagnosis: draft.diagnosis,
      vitals: draft.vitals,
      ctFindings: draft.ctFindings,
      mrtFindings: draft.mrtFindings,
      ultrasoundFindings: draft.ultrasoundFindings,
      laboratoryFindings: draft.laboratoryFindings,
      otherAnalysis: draft.otherAnalysis,
      prescriptions: draft.prescriptions,
      clinicalNotes: draft.clinicalNotes,
    };
    const submittedAt = new Date().toISOString();

    setIsSubmittingAppointment(true);
    let createdAppointment: Appointment | null = null;
    try {
      const backendAppointment = await createAppointment(appointmentPayloadFromDraft(patient, draft));
      const appointment = appointmentFromBackend(backendAppointment);
      createdAppointment = appointment;
      setItems((current) => [appointment, ...current.filter((item) => item.id !== appointment.id)]);
      setClinicalIntakes((current) => ({ ...current, [appointment.id]: clinical }));
      setSafetyReviews((current) => ({
        ...current,
        [appointment.id]: {
          status: "queued",
          submittedAt,
          hiddenFromDoctor: true,
        },
      }));
      setSelectedId(appointment.id);
      setFilter("Barchasi");
      setDraft((current) => ({ ...current, patientId: patient.id, reason: "", ...emptyClinicalInput }));
      setAppointmentFormMessage("Qabul backendda saqlandi. Xavfsizlik nazoratiga yuborilmoqda.");
      const record = await createMedicalRecord(buildMedicalRecordPayload(patient, appointment, clinical));
      setSafetyReviews((current) => ({
        ...current,
        [appointment.id]: {
          status: "submitted",
          submittedAt,
          hiddenFromDoctor: true,
          backendRecordId: record.id,
        },
      }));
      setAppointmentFormMessage("Qabul saqlandi. Xavfli signal bo'lsa, u faqat bosh shifokor va manager paneliga yuboriladi.");
    } catch (error) {
      setSafetyReviews((current) => ({
        ...current,
        ...(createdAppointment
          ? {
              [createdAppointment.id]: {
                status: "sync_failed" as const,
                submittedAt,
                hiddenFromDoctor: true as const,
                fallbackReason: error instanceof Error ? error.message : "Backend medical-record sync failed.",
              },
            }
          : {}),
      }));
      setAppointmentFormMessage(error instanceof Error ? error.message : "Qabul backendga saqlanmadi yoki safety sync bajarilmadi.");
    } finally {
      setIsSubmittingAppointment(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Aktiv" value={String(items.filter((item) => item.status === "Aktiv").length)} icon={Activity} />
        <StatCard label="Bajarildi" value={String(items.filter((item) => item.status === "Bajarildi").length)} icon={CheckCircle2} tone="green" />
        <StatCard label="Bekor qilingan" value={String(items.filter((item) => item.status === "Bekor qilingan").length)} icon={XCircle} tone="red" />
        <StatCard label="Bugungi yuklama" value={`${appointmentLoadPercent} %`} icon={Clock3} tone="amber" />
      </div>

      <section className="rounded-md border border-clinical-line bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinical-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-clinical-ink">Qabullar</h2>
            <p className="text-sm text-clinical-slate">Aktiv, bajarilgan va bekor qilingan qabullar</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["Barchasi", "Aktiv", "Bajarildi", "Bekor qilingan"] as AppointmentFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`h-9 rounded-md border px-3 text-sm ${
                  filter === item ? "border-clinical-blue bg-blue-50 text-clinical-blue" : "border-clinical-line text-clinical-slate"
                }`}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAppointmentFormOpen(true);
                setAppointmentFormMessage("Yangi qabul formasi ochildi.");
                globalThis.setTimeout(() => appointmentFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-clinical-blue px-3 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Qabul
            </button>
          </div>
        </div>
        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
                <tr>
                  <th className="px-3 py-3">Vaqt</th>
                  <th className="px-3 py-3">Bemor</th>
                  <th className="px-3 py-3">Bo'lim</th>
                  <th className="px-3 py-3">Shifokor</th>
                  <th className="px-3 py-3">Sabab</th>
                  <th className="px-3 py-3">Ustuvorlik</th>
                  <th className="px-3 py-3">Holat</th>
                  <th className="px-3 py-3">Nazorat</th>
                  <th className="px-3 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-line">
                {appointmentsLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-clinical-slate">
                      Backend qabullar ro'yxati yuklanmoqda.
                    </td>
                  </tr>
                ) : filtered.length ? (
                  filtered.map((item) => (
                  <tr key={item.id} className={item.id === selected?.id ? "bg-blue-50/70" : "hover:bg-slate-50"}>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => setSelectedId(item.id)} className="font-semibold text-clinical-ink hover:text-clinical-blue">
                        {item.time}
                      </button>
                      <span className="mt-1 block text-xs text-clinical-slate">{item.date}</span>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/doctor/patient/${item.patientId}`} className="font-semibold text-clinical-ink hover:text-clinical-blue">
                        {item.patient}
                      </Link>
                      <span className="mt-1 block text-xs text-clinical-slate">{item.room}</span>
                    </td>
                    <td className="px-3 py-3 text-clinical-slate">{item.department}</td>
                    <td className="px-3 py-3 text-clinical-slate">{item.doctor}</td>
                    <td className="px-3 py-3">{item.reason}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityStyles[item.priority]}`}>{item.priority}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${appointmentStatusStyles[item.status]}`}>{item.status}</span>
                    </td>
                    <td className="px-3 py-3">
                      <SafetyReviewBadge review={safetyReviews[item.id]} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                          title="Tanlash"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void setStatus(item.id, "Bajarildi")}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-green hover:text-clinical-green"
                          title="Bajarildi"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void setStatus(item.id, "Bekor qilingan")}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-red hover:text-clinical-red"
                          title="Bekor qilish"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-clinical-slate">
                      Backendda qabul topilmadi. Yangi qabul yaratish uchun Qabul tugmasini bosing.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <aside className="space-y-4">
            <form
              ref={appointmentFormRef}
              id="new-appointment-form"
              onSubmit={addAppointment}
              className={`rounded-md border border-clinical-line bg-slate-50 p-4 ${appointmentFormOpen ? "" : "hidden"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-clinical-ink">Yangi qabul</h3>
                <button
                  type="button"
                  onClick={() => setAppointmentFormOpen(false)}
                  className="h-8 rounded-md border border-clinical-line bg-white px-2 text-xs font-semibold text-clinical-slate"
                >
                  Yopish
                </button>
              </div>
              {appointmentFormMessage ? (
                <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-clinical-blue">
                  {appointmentFormMessage}
                </div>
              ) : null}
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-sm text-clinical-slate">Bemor</span>
                  <select
                    value={draft.patientId}
                    onChange={(event) => setDraft((current) => ({ ...current, patientId: Number(event.target.value) }))}
                    disabled={!availablePatients.length}
                    className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                  >
                    {availablePatients.length ? (
                      availablePatients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.fullName}
                        </option>
                      ))
                    ) : (
                      <option value={0}>Backendda bemor yo'q</option>
                    )}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-sm text-clinical-slate">Sana</span>
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                      className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm text-clinical-slate">Vaqt</span>
                    <input
                      type="time"
                      value={draft.time}
                      onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
                      className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-sm text-clinical-slate">Bo'lim</span>
                    <select
                      value={draft.department}
                      onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))}
                      className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                    >
                      {["Oilaviy shifokor", "Terapiya", "Homiladorlar", "Laboratoriya", "Patronaj"].map((department) => (
                        <option key={department}>{department}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm text-clinical-slate">Ustuvorlik</span>
                    <select
                      value={draft.priority}
                      onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as Appointment["priority"] }))}
                      className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                    >
                      {(["Yuqori", "O'rta", "Past"] as Appointment["priority"][]).map((priority) => (
                        <option key={priority}>{priority}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-sm text-clinical-slate">Sabab</span>
                  <input
                    value={draft.reason}
                    onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))}
                    className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                    placeholder="Qabul sababi"
                  />
                </label>
                <div className="border-t border-clinical-line pt-3">
                  <h4 className="text-sm font-semibold text-clinical-ink">Klinik ma'lumotlar</h4>
                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-sm text-clinical-slate">Shikoyat</span>
                      <textarea
                        value={draft.complaint}
                        onChange={(event) => setDraft((current) => ({ ...current, complaint: event.target.value }))}
                        rows={2}
                        className="w-full rounded-md border border-clinical-line bg-white px-3 py-2 text-sm focus:border-clinical-blue"
                        placeholder="Bemor shikoyatlari"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-clinical-slate">Tashxis</span>
                      <input
                        value={draft.diagnosis}
                        onChange={(event) => setDraft((current) => ({ ...current, diagnosis: event.target.value }))}
                        className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                        placeholder="ICD / klinik tashxis"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-clinical-slate">Vital belgilar</span>
                      <input
                        value={draft.vitals}
                        onChange={(event) => setDraft((current) => ({ ...current, vitals: event.target.value }))}
                        className="h-10 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                        placeholder="AQB, puls, SpO2, harorat, glyukoza"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-sm text-clinical-slate">KT (CT)</span>
                        <textarea
                          value={draft.ctFindings}
                          onChange={(event) => setDraft((current) => ({ ...current, ctFindings: event.target.value }))}
                          rows={2}
                          className="w-full rounded-md border border-clinical-line bg-white px-3 py-2 text-sm focus:border-clinical-blue"
                          placeholder="KT natijasi"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-sm text-clinical-slate">MRT</span>
                        <textarea
                          value={draft.mrtFindings}
                          onChange={(event) => setDraft((current) => ({ ...current, mrtFindings: event.target.value }))}
                          rows={2}
                          className="w-full rounded-md border border-clinical-line bg-white px-3 py-2 text-sm focus:border-clinical-blue"
                          placeholder="MRT natijasi"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-sm text-clinical-slate">UTT / USG</span>
                      <textarea
                        value={draft.ultrasoundFindings}
                        onChange={(event) => setDraft((current) => ({ ...current, ultrasoundFindings: event.target.value }))}
                        rows={2}
                        className="w-full rounded-md border border-clinical-line bg-white px-3 py-2 text-sm focus:border-clinical-blue"
                        placeholder="UTT, EKG yoki instrumental tekshiruv"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-clinical-slate">Laboratoriya</span>
                      <textarea
                        value={draft.laboratoryFindings}
                        onChange={(event) => setDraft((current) => ({ ...current, laboratoryFindings: event.target.value }))}
                        rows={2}
                        className="w-full rounded-md border border-clinical-line bg-white px-3 py-2 text-sm focus:border-clinical-blue"
                        placeholder="Qon, siydik, biokimyo, markerlar"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-clinical-slate">Boshqa analizlar</span>
                      <textarea
                        value={draft.otherAnalysis}
                        onChange={(event) => setDraft((current) => ({ ...current, otherAnalysis: event.target.value }))}
                        rows={2}
                        className="w-full rounded-md border border-clinical-line bg-white px-3 py-2 text-sm focus:border-clinical-blue"
                        placeholder="Qo'shimcha tekshiruvlar"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-clinical-slate">Dori-darmon</span>
                      <textarea
                        value={draft.prescriptions}
                        onChange={(event) => setDraft((current) => ({ ...current, prescriptions: event.target.value }))}
                        rows={2}
                        className="w-full rounded-md border border-clinical-line bg-white px-3 py-2 text-sm focus:border-clinical-blue"
                        placeholder="Retsept, doza, davomiylik"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-clinical-slate">Qabul yozuvi</span>
                      <textarea
                        value={draft.clinicalNotes}
                        onChange={(event) => setDraft((current) => ({ ...current, clinicalNotes: event.target.value }))}
                        rows={3}
                        className="w-full rounded-md border border-clinical-line bg-white px-3 py-2 text-sm focus:border-clinical-blue"
                        placeholder="Ko'rik, reja, kuzatuv"
                      />
                    </label>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingAppointment || !availablePatients.length}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-clinical-blue text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Save className="h-4 w-4" />
                  {isSubmittingAppointment ? "Saqlanmoqda..." : availablePatients.length ? "Qabulni saqlash" : "Avval bemor yarating"}
                </button>
              </div>
            </form>

            <div className="rounded-md border border-clinical-line bg-white p-4">
              <h3 className="font-semibold text-clinical-ink">Tanlangan qabul</h3>
              {selected ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <Link href={`/doctor/patient/${selected.patientId}`} className="font-semibold text-clinical-ink hover:text-clinical-blue">
                      {selected.patient}
                    </Link>
                    <p className="mt-1 text-sm text-clinical-slate">
                      {selected.date}, {selected.time}, {selected.room}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Info label="Bo'lim" value={selected.department} />
                    <Info label="Shifokor" value={selected.doctor} />
                    <Info label="Holat" value={selected.status} />
                    <Info label="Ustuvorlik" value={selected.priority} />
                  </div>
                  <div className="rounded-md border border-clinical-line bg-slate-50 p-3 text-sm text-clinical-slate">{selected.notes}</div>
                  {selectedClinicalRows.length ? (
                    <div className="rounded-md border border-clinical-line bg-white p-3">
                      <h4 className="text-sm font-semibold text-clinical-ink">Kiritilgan klinik ma'lumotlar</h4>
                      <div className="mt-3 space-y-2">
                        {selectedClinicalRows.map((row) => (
                          <div key={row.key} className="rounded-md border border-clinical-line bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase text-clinical-slate">{row.label}</p>
                            <p className="mt-1 whitespace-pre-line text-sm text-clinical-ink">{row.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-md border border-clinical-line bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-clinical-ink">Klinik xavfsizlik nazorati</h4>
                      <SafetyReviewBadge review={selectedSafetyReview} />
                    </div>
                    <div className="mt-3 rounded-md border border-clinical-line bg-slate-50 px-3 py-2">
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase text-clinical-slate">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Silent safety routing
                      </div>
                      <p className="text-sm leading-5 text-clinical-slate">
                        Qabul bo'yicha AI xulosasi shifokor ekranida ko'rsatilmaydi. Faqat yuqori yoki kritik xavf signali aniqlansa,
                        bosh shifokor va manager paneliga eskalatsiya yuboriladi.
                      </p>
                      {selectedSafetyReview ? (
                        <p className="mt-2 text-xs text-clinical-slate">
                          Yuborilgan vaqt: {new Date(selectedSafetyReview.submittedAt).toLocaleString("uz-UZ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void setStatus(selected.id, "Aktiv")}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-clinical-line bg-white text-sm font-semibold text-clinical-ink"
                    >
                      <Activity className="h-4 w-4" />
                      Aktiv
                    </button>
                    <button
                      type="button"
                      onClick={() => void rescheduleSelected()}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-clinical-line bg-white text-sm font-semibold text-clinical-ink"
                    >
                      <Clock3 className="h-4 w-4" />
                      Ko'chirish
                    </button>
                    <button
                      type="button"
                      onClick={() => void setStatus(selected.id, "Bajarildi")}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-clinical-green text-sm font-semibold text-white"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Bajarildi
                    </button>
                    <button
                      type="button"
                      onClick={() => void setStatus(selected.id, "Bekor qilingan")}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-clinical-red text-sm font-semibold text-white"
                    >
                      <XCircle className="h-4 w-4" />
                      Bekor
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-md border border-clinical-line bg-slate-50 p-4">
              <h3 className="font-semibold text-clinical-ink">Qabullar taqvimi</h3>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"].map((time) => {
                  const slot = items.find((item) => item.time === time && item.date === calendarDate && item.status === "Aktiv");
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => slot && setSelectedId(slot.id)}
                      className={`rounded-md border px-3 py-3 text-left text-sm ${
                        slot ? "border-blue-200 bg-white hover:border-clinical-blue" : "border-slate-200 bg-slate-100"
                      }`}
                    >
                      <span className="block font-semibold">{time}</span>
                      <span className="truncate text-xs text-clinical-slate">{slot ? slot.patient : "Bo'sh"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function HospitalView({ module }: { module: CrmModuleKey }) {
  const [queue, setQueue] = useState<AdmissionDashboardRow[]>([]);
  const [beds, setBeds] = useState<HospitalBedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const activeAdmissions = queue.filter((row) => row.status === "Yotqizildi" || row.status === "Ko'chirildi");
  const waitingAdmissions = queue.filter((row) => row.status === "So'rov" || row.status === "Navbat");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([listRooms(), listAdmissions()])
      .then(([roomResponse, admissionResponse]) => {
        if (!active) {
          return;
        }
        const mappedAdmissions = admissionResponse.results.map(admissionRowFromBackend);
        setQueue(mappedAdmissions);
        setBeds(hospitalBedsFromBackend(roomResponse.results, mappedAdmissions));
        setMessage("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setQueue([]);
        setBeds([]);
        setMessage(error instanceof Error ? error.message : "Hospital backend data could not be loaded.");
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

  const updateAdmissionStatus = async (row: AdmissionDashboardRow, action: "waitlist" | "admit" | "transfer" | "discharge" | "cancel") => {
    try {
      const admission =
        action === "waitlist"
          ? await waitlistAdmission(row.id)
          : action === "admit"
            ? await admitAdmission(row.id)
            : action === "transfer"
              ? await transferAdmission(row.id, row.roomId ? { room: row.roomId } : row.departmentId ? { department_ref: row.departmentId } : {})
              : action === "discharge"
                ? await dischargeAdmission(row.id, "Discharged from CRM hospital board")
                : await cancelAdmission(row.id, "Cancelled from CRM hospital board");
      const next = admissionRowFromBackend(admission);
      setQueue((current) => {
        const updated = current.map((item) => (item.id === next.id ? next : item));
        setBeds((currentBeds) => {
          const baseRooms = currentBeds.map((bed) => ({ ...bed, occupied: 0, waiting: 0, critical: 0 }));
          if (!baseRooms.length) {
            return hospitalBedsFromBackend([], updated);
          }
          const bedMap = new Map(baseRooms.map((bed) => [bed.unit, bed]));
          updated.forEach((admissionRow) => {
            const bed = bedMap.get(admissionRow.department) ?? {
              unit: admissionRow.department,
              beds: Math.max(1, Number(admissionRow.backendStatus === "ADMITTED" || admissionRow.backendStatus === "TRANSFERRED")),
              occupied: 0,
              waiting: 0,
              critical: 0,
            };
            if (admissionRow.backendStatus === "ADMITTED" || admissionRow.backendStatus === "TRANSFERRED") {
              bed.occupied += 1;
            }
            if (admissionRow.backendStatus === "REQUESTED" || admissionRow.backendStatus === "WAITLISTED") {
              bed.waiting += 1;
            }
            if (admissionRow.priority === "Kritik" || admissionRow.triage === "Qizil") {
              bed.critical += 1;
            }
            bedMap.set(admissionRow.department, bed);
          });
          return Array.from(bedMap.values()).sort((left, right) => left.unit.localeCompare(right.unit));
        });
        return updated;
      });
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admission action failed.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Jami o'rin" value={String(beds.reduce((sum, row) => sum + row.beds, 0))} icon={Bed} />
        <StatCard label="Yotqizilgan" value={String(activeAdmissions.length)} icon={Hospital} tone="amber" />
        <StatCard label="Navbatda" value={String(waitingAdmissions.length)} icon={Clock3} />
        <StatCard label="Kritik" value={String(queue.filter((row) => row.priority === "Kritik" || row.triage === "Qizil").length)} icon={AlertTriangle} tone="red" />
      </div>
      {message ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
          {message}
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-md border border-clinical-line bg-white shadow-sm">
          <div className="border-b border-clinical-line px-4 py-3">
            <h2 className="font-semibold text-clinical-ink">{module === "reception" ? "Qabulxona bo'limi" : module === "admission" ? "Shifoxonaga yotqizish" : "Kasalxona"}</h2>
            <p className="text-sm text-clinical-slate">Bo'limlar kesimida o'rinlar va yuklama</p>
          </div>
          <div className="divide-y divide-clinical-line">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-clinical-slate">Kasalxona o'rinlari backenddan yuklanmoqda.</div>
            ) : beds.length ? (
              beds.map((row) => {
                const percent = row.beds ? Math.min(100, Math.round((row.occupied / row.beds) * 100)) : 0;
                return (
                  <div key={row.unit} className="px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{row.unit}</h3>
                        <p className="text-sm text-clinical-slate">
                          {row.occupied}/{row.beds} band, navbatda {row.waiting}, kritik {row.critical}
                        </p>
                      </div>
                      <span className="text-sm font-semibold">{percent}%</span>
                    </div>
                    <div className="mt-3 h-2 rounded-sm bg-slate-100">
                      <div className="h-2 rounded-sm bg-clinical-blue" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-sm text-clinical-slate">Backendda xona yoki o'rin ma'lumoti topilmadi.</div>
            )}
          </div>
        </section>

        <section className="rounded-md border border-clinical-line bg-white shadow-sm">
          <div className="border-b border-clinical-line px-4 py-3">
            <h2 className="font-semibold text-clinical-ink">Yotqizish navbati</h2>
          </div>
          <div className="divide-y divide-clinical-line">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-clinical-slate">Yotqizish navbati yuklanmoqda.</div>
            ) : queue.length ? (
              queue.map((row) => (
              <div key={row.patient} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/doctor/patient/${row.patientId}`} className="text-sm font-semibold text-clinical-ink hover:text-clinical-blue">
                      {row.patient}
                    </Link>
                    <p className="mt-1 text-sm text-clinical-slate">{row.department}, {row.room}, {row.requestedAt}</p>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityStyles[row.priority]}`}>{row.priority}</span>
                </div>
                <p className="mt-2 text-sm text-clinical-slate">{row.reason}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-md border border-clinical-line px-2 py-1 text-xs font-semibold text-clinical-slate">{row.status}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => void updateAdmissionStatus(row, "waitlist")}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                      title="Navbat"
                    >
                      <Clock3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateAdmissionStatus(row, "admit")}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-green hover:text-clinical-green"
                      title="Yotqizildi"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateAdmissionStatus(row, "transfer")}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                      title="Ko'chirildi"
                    >
                      <Route className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateAdmissionStatus(row, row.backendStatus === "REQUESTED" || row.backendStatus === "WAITLISTED" ? "cancel" : "discharge")}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-red hover:text-clinical-red"
                      title={row.backendStatus === "REQUESTED" || row.backendStatus === "WAITLISTED" ? "Bekor" : "Chiqarildi"}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-clinical-slate">Backendda yotqizish navbati topilmadi.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function DocumentsView({ query }: { query: string }) {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    listMedicalRecords()
      .then((response) => {
        if (!active) {
          return;
        }
        setRows(response.results.map(medicalRecordDocumentRow));
        setMessage("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setRows([]);
        setMessage(error instanceof Error ? error.message : "Medical records could not be loaded.");
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

  const filtered = rows.filter((row) => !query || normalizeText(`${row.title} ${row.patient} ${row.type} ${row.owner}`).includes(normalizeText(query)));
  return (
    <ReadonlyTable
      title="Hujjatlar"
      subtitle="Ambulator karta, xulosa, yo'llanma va shablonlar"
      rows={filtered}
      columns={["title", "patient", "type", "owner", "updatedAt", "status"]}
      loading={loading}
      message={message}
      emptyLabel="Backendda tibbiy hujjat topilmadi."
    />
  );
}

function PrescriptionsView({ query, currentUserName }: { query: string; currentUserName: string }) {
  const [items, setItems] = useState<PrescriptionRow[]>([]);
  const [availablePatients, setAvailablePatients] = useState<RegistryPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({
    patientId: 0,
    medication: "",
    dose: "",
    duration: "",
  });
  const [message, setMessage] = useState("");
  const filtered = items.filter((row) => !query || normalizeText(`${row.patient} ${row.medication}`).includes(normalizeText(query)));

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([listPatients(), listMedicalRecords()])
      .then(([patientResponse, recordResponse]) => {
        if (!active) {
          return;
        }
        const mappedPatients = patientResponse.results.map(registryPatientFromBackend);
        setAvailablePatients(mappedPatients);
        setItems(recordResponse.results.map(prescriptionRowFromRecord).filter((row): row is PrescriptionRow => Boolean(row)));
        setDraft((current) => ({
          ...current,
          patientId: mappedPatients.some((patient) => patient.id === current.patientId)
            ? current.patientId
            : mappedPatients[0]?.id ?? 0,
        }));
        setMessage("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setAvailablePatients([]);
        setItems([]);
        setMessage(error instanceof Error ? error.message : "Prescription backend data could not be loaded.");
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

  const addPrescription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const patient = availablePatients.find((entry) => entry.id === Number(draft.patientId));
    if (!patient || !draft.medication.trim()) {
      setMessage("Bemor va dori nomi majburiy.");
      return;
    }
    try {
      const record = await createMedicalRecord({
        patient: patient.id,
        doctor_id: currentUserName,
        diagnosis: "Retsept",
        prescriptions: [draft.medication.trim(), draft.dose.trim(), draft.duration.trim()].filter(Boolean).join("\n"),
        clinical_notes: "Retsept CRM retseptlar modulidan kiritildi. AI xavfsizlik tekshiruvi shifokor ekraniga ko'rsatilmaydi.",
        record_type: "FOLLOW_UP",
        imaging_safety_metadata: {
          source: "prescriptions_module",
          medication: draft.medication.trim(),
          dose: draft.dose.trim(),
          duration: draft.duration.trim(),
        },
      });
      const row = prescriptionRowFromRecord(record);
      setItems((current) => (row ? [row, ...current] : current));
      setDraft((current) => ({ patientId: current.patientId, medication: "", dose: "", duration: "" }));
      setMessage("Retsept backendda saqlandi va AI dori xavfsizligi nazoratiga yuborildi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retsept backendga saqlanmadi.");
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <ReadonlyTable
        title="Retseptlar"
        subtitle="Faol retseptlar va dori xavfsizligi"
        rows={filtered}
        columns={["patient", "medication", "dose", "duration", "status", "safety"]}
        loading={loading}
        emptyLabel="Backendda retsept yozuvi topilmadi."
      />
      <form onSubmit={addPrescription} className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-clinical-ink">Yangi retsept</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-clinical-slate">Bemor</span>
            <select
              value={draft.patientId}
              onChange={(event) => setDraft((current) => ({ ...current, patientId: Number(event.target.value) }))}
              className="h-10 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
            >
              {availablePatients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-clinical-slate">Dori nomi</span>
            <input
              value={draft.medication}
              onChange={(event) => setDraft((current) => ({ ...current, medication: event.target.value }))}
              className="h-10 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-clinical-slate">Doza</span>
            <input
              value={draft.dose}
              onChange={(event) => setDraft((current) => ({ ...current, dose: event.target.value }))}
              className="h-10 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-clinical-slate">Davomiylik</span>
            <input
              value={draft.duration}
              onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))}
              className="h-10 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
            />
          </label>
          {message ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-clinical-blue">
              {message}
            </div>
          ) : null}
          <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-clinical-blue text-sm font-semibold text-white">
            <Send className="h-4 w-4" />
            Tasdiqlash
          </button>
        </div>
      </form>
    </div>
  );
}

function TreatmentCourseView({ query }: { query: string }) {
  const [rows, setRows] = useState<TreatmentCourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([listMedicalRecords(), listClinicalTasks()])
      .then(([recordResponse, taskResponse]) => {
        if (!active) {
          return;
        }
        setRows(treatmentCourseRowsFromBackend(recordResponse.results, taskResponse.results));
        setMessage("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setRows([]);
        setMessage(error instanceof Error ? error.message : "Treatment course backend data could not be loaded.");
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

  const filtered = rows.filter((row) => !query || normalizeText(`${row.patient} ${row.diagnosis} ${row.nextAction}`).includes(normalizeText(query)));
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="border-b border-clinical-line px-4 py-3">
        <h2 className="font-semibold text-clinical-ink">Davolash kursi</h2>
        <p className="text-sm text-clinical-slate">Kurs, progress va navbatdagi amal</p>
      </div>
      {message ? (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
          {message}
        </div>
      ) : null}
      <div className="divide-y divide-clinical-line">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-clinical-slate">Davolash kurslari backenddan yuklanmoqda.</div>
        ) : filtered.length ? (
          filtered.map((row) => (
          <div key={row.patient} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_180px_1fr] lg:items-center">
            <div>
              <h3 className="font-semibold">{row.patient}</h3>
              <p className="text-sm text-clinical-slate">{row.diagnosis}, {row.startedAt}</p>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-clinical-slate">
                <span>Progress</span>
                <span>{row.progress}%</span>
              </div>
              <div className="h-2 rounded-sm bg-slate-100">
                <div className="h-2 rounded-sm bg-clinical-green" style={{ width: `${row.progress}%` }} />
              </div>
            </div>
            <p className="text-sm text-clinical-ink">{row.nextAction}</p>
          </div>
          ))
        ) : (
          <div className="px-4 py-8 text-center text-sm text-clinical-slate">Backendda davolash kursi uchun tibbiy yozuv topilmadi.</div>
        )}
      </div>
    </section>
  );
}

function PregnantRegistryView({ query }: { query: string }) {
  const [rows, setRows] = useState<PregnantRegistryRow[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const filtered = rows.filter((row) => !query || normalizeText(`${row.patient} ${row.provider} ${row.riskFactors.join(" ")}`).includes(normalizeText(query)));
  const selected = rows.find((row) => row.id === selectedId) ?? filtered[0] ?? rows[0];

  useEffect(() => {
    let active = true;
    setLoading(true);
    listPerinatalRegistry()
      .then((response) => {
        if (!active) {
          return;
        }
        const mappedRows = response.results.map(perinatalRowFromBackend);
        setRows(mappedRows);
        setSelectedId((current) => (mappedRows.some((row) => row.id === current) ? current : mappedRows[0]?.id ?? 0));
        setMessage("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setRows([]);
        setSelectedId(0);
        setMessage(error instanceof Error ? error.message : "Perinatal registry could not be loaded.");
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

  const replaceEntry = (entry: PerinatalRegistryEntry) => {
    const row = perinatalRowFromBackend(entry);
    setRows((current) => current.map((item) => (item.id === row.id ? row : item)));
    setSelectedId(row.id);
  };

  const updateStatus = async (entryId: number, statusValue: PregnantRegistryRow["status"]) => {
    try {
      const entry =
        statusValue === "Yopildi"
          ? await closePerinatalEntry(entryId, "CLOSED", "Closed from CRM perinatal registry")
          : await updatePerinatalEntry(entryId, {
              status: statusValue === "Kuzatuv" ? "WATCHLIST" : statusValue === "Yotqizildi" ? "HOSPITALIZED" : "ACTIVE",
            });
      replaceEntry(entry);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Perinatal status could not be updated.");
    }
  };
  const escalateRisk = async (entryId: number) => {
    const current = rows.find((row) => row.id === entryId);
    const risk_level: PerinatalRegistryEntry["risk_level"] =
      current?.riskZone === "Yashil" ? "MODERATE" : current?.riskZone === "Sariq" ? "HIGH" : "CRITICAL";
    try {
      const entry = await updatePerinatalRisk(entryId, { risk_level });
      replaceEntry(entry);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Perinatal risk could not be escalated.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Perinatal ro'yxat" value={String(rows.length)} icon={Baby} />
        <StatCard label="Qizil zona" value={String(rows.filter((row) => row.riskZone === "Qizil").length)} icon={AlertTriangle} tone="red" />
        <StatCard label="Kuzatuv" value={String(rows.filter((row) => row.status === "Kuzatuv").length)} icon={Activity} tone="amber" />
        <StatCard label="Bugungi ko'rik" value={String(rows.filter((row) => row.nextVisit === formatBackendDate(new Date().toISOString())).length)} icon={CalendarDays} tone="green" />
      </div>
      {message ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-md border border-clinical-line bg-white shadow-sm">
          <div className="border-b border-clinical-line px-4 py-3">
            <h2 className="font-semibold text-clinical-ink">Homiladorlar</h2>
            <p className="text-sm text-clinical-slate">Perinatal xavf zonalari, skrining va navbatdagi ko'riklar</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
                <tr>
                  <th className="px-3 py-3">Bemor</th>
                  <th className="px-3 py-3">Muddat</th>
                  <th className="px-3 py-3">Xavf</th>
                  <th className="px-3 py-3">BP</th>
                  <th className="px-3 py-3">EDD</th>
                  <th className="px-3 py-3">Keyingi ko'rik</th>
                  <th className="px-3 py-3">Holat</th>
                  <th className="px-3 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-line">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-clinical-slate">
                      Perinatal registr backenddan yuklanmoqda.
                    </td>
                  </tr>
                ) : filtered.length ? (
                  filtered.map((row) => (
                  <tr key={row.id} className={row.id === selected?.id ? "bg-blue-50/70" : "hover:bg-slate-50"}>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => setSelectedId(row.id)} className="font-semibold text-clinical-ink hover:text-clinical-blue">
                        {row.patient}
                      </button>
                      <p className="mt-1 text-xs text-clinical-slate">{row.provider}</p>
                    </td>
                    <td className="px-3 py-3">{row.week}w {row.day}d</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${perinatalRiskStyles[row.riskZone]}`}>{row.riskZone}</span>
                    </td>
                    <td className="px-3 py-3">{row.bp}</td>
                    <td className="px-3 py-3 text-clinical-slate">{row.edd}</td>
                    <td className="px-3 py-3">{row.nextVisit}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-md border border-clinical-line px-2 py-1 text-xs font-semibold text-clinical-slate">{row.status}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void escalateRisk(row.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-red hover:text-clinical-red"
                          title="Xavfni oshirish"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateStatus(row.id, "Kuzatuv")}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                          title="Kuzatuv"
                        >
                          <Activity className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateStatus(row.id, "Yopildi")}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-green hover:text-clinical-green"
                          title="Yopish"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-clinical-slate">
                      Backendda perinatal karta topilmadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-md border border-clinical-line bg-white shadow-sm">
          <div className="border-b border-clinical-line px-4 py-3">
            <h3 className="font-semibold text-clinical-ink">Perinatal karta</h3>
          </div>
          {selected ? (
            <div className="space-y-4 p-4">
              <div>
                <Link href={`/doctor/patient/${selected.patientId}`} className="font-semibold text-clinical-ink hover:text-clinical-blue">
                  {selected.patient}
                </Link>
                <p className="mt-1 text-sm text-clinical-slate">G{selected.gravida} P{selected.para}, {selected.week} hafta {selected.day} kun</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Info label="Xavf" value={selected.riskZone} />
                <Info label="BP" value={selected.bp} />
                <Info label="EDD" value={selected.edd} />
                <Info label="Ko'rik" value={selected.nextVisit} />
              </div>
              <div className="rounded-md border border-clinical-line bg-slate-50 p-3">
                <p className="text-sm text-clinical-slate">{selected.fetalNote}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {selected.riskFactors.map((factor) => (
                    <span key={factor} className="rounded-sm bg-white px-1.5 py-0.5 text-[11px] text-clinical-slate">
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function PatronageView({ query }: { query: string }) {
  const [rows, setRows] = useState<PatronageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const filtered = rows.filter((row) => !query || normalizeText(`${row.patient} ${row.territory} ${row.nurse} ${row.visitType}`).includes(normalizeText(query)));

  useEffect(() => {
    let active = true;
    setLoading(true);
    listPatronageVisits()
      .then((response) => {
        if (!active) {
          return;
        }
        setRows(response.results.map(patronageRowFromBackend));
        setMessage("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setRows([]);
        setMessage(error instanceof Error ? error.message : "Patronage visits could not be loaded.");
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

  const replaceVisit = (visit: PatronageVisit) => {
    const row = patronageRowFromBackend(visit);
    setRows((current) => current.map((item) => (item.id === row.id ? row : item)));
  };

  const updateVisit = async (visitId: number, action: "sync" | "resolve" | "complete") => {
    const current = rows.find((row) => row.id === visitId);
    try {
      const visit =
        action === "sync"
          ? await syncPatronageVisit(visitId, { synced_from: "crm_patronage_board" }, current?.serverVersion)
          : action === "resolve"
            ? await resolvePatronageConflict(visitId, "client")
            : await completePatronageVisit(visitId, "Completed from CRM patronage board", { completed_from: "crm" });
      replaceVisit(visit);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Patronage action failed.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Bugungi tashrif" value={String(rows.filter((row) => row.visitDate.startsWith(formatBackendDate(new Date().toISOString()))).length)} icon={Route} />
        <StatCard label="Yuqori ustuvor" value={String(rows.filter((row) => row.priority === "Yuqori").length)} icon={AlertTriangle} tone="red" />
        <StatCard label="Offline navbat" value={String(rows.filter((row) => row.sync === "Navbatda").length)} icon={WifiOff} tone="amber" />
        <StatCard label="Konflikt" value={String(rows.filter((row) => row.sync === "Konflikt").length)} icon={XCircle} tone="red" />
      </div>
      {message ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
          {message}
        </div>
      ) : null}
      <section className="rounded-md border border-clinical-line bg-white shadow-sm">
        <div className="border-b border-clinical-line px-4 py-3">
          <h2 className="font-semibold text-clinical-ink">Patronaj</h2>
          <p className="text-sm text-clinical-slate">Hamshira marshruti, idempotent offline navbat va konflikt nazorati</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
              <tr>
                <th className="px-3 py-3">Bemor</th>
                <th className="px-3 py-3">Tashrif</th>
                <th className="px-3 py-3">Hamshira</th>
                <th className="px-3 py-3">Ustuvorlik</th>
                <th className="px-3 py-3">Sinxron</th>
                <th className="px-3 py-3">Versiya</th>
                <th className="px-3 py-3 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clinical-line">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-clinical-slate">
                    Patronaj tashriflari backenddan yuklanmoqda.
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <Link href={`/doctor/patient/${row.patientId}`} className="font-semibold text-clinical-ink hover:text-clinical-blue">
                      {row.patient}
                    </Link>
                    <p className="mt-1 text-xs text-clinical-slate">{row.territory}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-medium text-clinical-ink">{row.visitDate}</span>
                    <p className="mt-1 text-xs text-clinical-slate">{row.visitType}</p>
                  </td>
                  <td className="px-3 py-3 text-clinical-slate">{row.nurse}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityStyles[row.priority]}`}>{row.priority}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${patronageSyncStyles[row.sync]}`}>{row.sync}</span>
                    <p className="mt-1 text-xs text-clinical-slate">{row.status}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-semibold">{row.serverVersion}</span>
                    <p className="mt-1 text-xs text-clinical-slate">{row.offlineId}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => void updateVisit(row.id, "sync")}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-green hover:text-clinical-green"
                        title="Sinxronlash"
                      >
                        <Wifi className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateVisit(row.id, "resolve")}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-red hover:text-clinical-red"
                        title="Konfliktni yechish"
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateVisit(row.id, "complete")}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                        title="Bajarildi"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-clinical-slate">
                    Backendda patronaj tashrifi topilmadi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PlanningView({ module, query }: { module: CrmModuleKey; query: string }) {
  const [tasks, setTasks] = useState<ClinicalTaskRow[]>([]);
  const [referralRows, setReferralRows] = useState<ReferralRow[]>([]);
  const [planRows, setPlanRows] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([listClinicalTasks(), listReferrals(), listAppointments(), listPatronageVisits()])
      .then(([taskResponse, referralResponse, appointmentResponse, patronageResponse]) => {
        if (!active) {
          return;
        }
        setTasks(taskResponse.results.map(clinicalTaskRowFromBackend));
        setReferralRows(referralResponse.results.map(referralRowFromBackend));
        setPlanRows(planningRowsFromBackend(appointmentResponse.results, taskResponse.results, patronageResponse.results));
        setMessage("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setTasks([]);
        setReferralRows([]);
        setPlanRows([]);
        setMessage(error instanceof Error ? error.message : "Planning backend data could not be loaded.");
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

  const search = normalizeText(query);
  const filteredTasks = tasks.filter((task) => !search || normalizeText(`${task.title} ${task.owner} ${task.type}`).includes(search));
  const filteredReferrals = referralRows.filter((referral) => !search || normalizeText(`${referral.target} ${referral.reason} ${referral.type}`).includes(search));
  const rows = planRows
    .filter((row) => (module === "scheduled" ? row.status !== "Jarayonda" : true))
    .filter((row) => !search || normalizeText(`${row.title} ${row.owner} ${row.department} ${row.status}`).includes(search));

  const updateTaskStatus = async (taskId: number, statusValue: ClinicalTaskRow["status"]) => {
    try {
      const task = statusValue === "Bajarildi" ? await completeClinicalTask(taskId, "Completed from CRM planning board") : await startClinicalTask(taskId);
      const row = clinicalTaskRowFromBackend(task);
      setTasks((current) => current.map((item) => (item.id === row.id ? row : item)));
      setPlanRows((current) => current.map((item) => (item.title === row.title && item.owner === row.owner ? { ...item, status: row.status } : item)));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Clinical task action failed.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Ochiq vazifa" value={String(tasks.filter((task) => task.status === "Ochiq").length)} icon={ClipboardList} />
        <StatCard label="Jarayonda" value={String(tasks.filter((task) => task.status === "Jarayonda").length)} icon={Activity} tone="amber" />
        <StatCard label="Yo'llanma" value={String(referralRows.filter((referral) => referral.status !== "Bajarildi" && referral.status !== "Bekor").length)} icon={Stethoscope} />
        <StatCard label="Yuqori ustuvor" value={String(tasks.filter((task) => task.priority === "Yuqori").length)} icon={AlertTriangle} tone="red" />
      </div>
      {message ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
          {message}
        </div>
      ) : null}

      <section className="rounded-md border border-clinical-line bg-white shadow-sm">
        <div className="border-b border-clinical-line px-4 py-3">
          <h2 className="font-semibold text-clinical-ink">{module === "scheduled" ? "Rejalashtirilgan" : "Rejalashtirish"}</h2>
          <p className="text-sm text-clinical-slate">Bo'lim rejalari, klinik vazifalar va yo'llanmalar</p>
        </div>
        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
                <tr>
                  <th className="px-3 py-3">Vazifa</th>
                  <th className="px-3 py-3">Bemor</th>
                  <th className="px-3 py-3">Mas'ul</th>
                  <th className="px-3 py-3">Muddat</th>
                  <th className="px-3 py-3">Holat</th>
                  <th className="px-3 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-line">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-clinical-slate">
                      Klinik vazifalar backenddan yuklanmoqda.
                    </td>
                  </tr>
                ) : filteredTasks.length ? (
                  filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <strong className="text-clinical-ink">{task.title}</strong>
                        <span className="mt-1 block text-xs text-clinical-slate">{task.type}</span>
                      </td>
                      <td className="px-3 py-3">
                        {task.patientId ? (
                          <Link href={`/doctor/patient/${task.patientId}`} className="font-semibold text-clinical-ink hover:text-clinical-blue">
                            Bemor #{task.patientId}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3 text-clinical-slate">{task.owner}</td>
                      <td className="px-3 py-3">{task.dueAt}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-md border border-clinical-line px-2 py-1 text-xs font-semibold">{task.status}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void updateTaskStatus(task.id, "Jarayonda")}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                            title="Jarayonda"
                          >
                            <Activity className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateTaskStatus(task.id, "Bajarildi")}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-green hover:text-clinical-green"
                            title="Bajarildi"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-clinical-slate">
                      Backendda klinik vazifa topilmadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <div className="rounded-md border border-clinical-line bg-slate-50 p-4">
              <h3 className="font-semibold text-clinical-ink">Yo'llanmalar</h3>
              <div className="mt-3 space-y-3">
                {loading ? (
                  <p className="text-sm text-clinical-slate">Yo'llanmalar yuklanmoqda.</p>
                ) : filteredReferrals.length ? (
                  filteredReferrals.map((referral) => (
                  <div key={referral.id} className="rounded-md border border-clinical-line bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-clinical-ink">{referral.target}</h4>
                        <p className="mt-1 text-xs text-clinical-slate">{referral.reason}</p>
                      </div>
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityStyles[referral.priority]}`}>{referral.priority}</span>
                    </div>
                    <p className="mt-2 text-xs text-clinical-slate">{referral.status}, {referral.requestedAt}</p>
                  </div>
                  ))
                ) : (
                  <p className="text-sm text-clinical-slate">Backendda faol yo'llanma topilmadi.</p>
                )}
              </div>
            </div>

            <ReadonlyTable
              title="Bo'lim rejalari"
              subtitle="Mas'ullar va muddatlar"
              rows={rows}
              columns={["title", "owner", "date", "department", "status"]}
              loading={loading}
              emptyLabel="Backendda reja yozuvi topilmadi."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function AnalyticsView() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointmentRows, setAppointmentRows] = useState<BackendAppointment[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [aiLogs, setAiLogs] = useState<AIErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([listPatients(), listAppointments(), listMedicalRecords(), listAIErrorLogs("")])
      .then((results) => {
        if (!active) {
          return;
        }
        const patientResult = results[0];
        const appointmentResult = results[1];
        const recordResult = results[2];
        const logResult = results[3];
        setPatients(patientResult.status === "fulfilled" ? patientResult.value.results : []);
        setAppointmentRows(appointmentResult.status === "fulfilled" ? appointmentResult.value.results : []);
        setRecords(recordResult.status === "fulfilled" ? recordResult.value.results : []);
        setAiLogs(logResult.status === "fulfilled" ? logResult.value.results : []);
        const rejected = results.find((result) => result.status === "rejected");
        setMessage(rejected?.status === "rejected" ? String(rejected.reason instanceof Error ? rejected.reason.message : rejected.reason) : "");
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

  const red = patients.filter((patient) => patient.triage_status === "RED").length;
  const yellow = patients.filter((patient) => patient.triage_status === "YELLOW").length;
  const green = patients.filter((patient) => patient.triage_status === "GREEN").length;
  const completedAppointments = appointmentRows.filter((appointment) => appointment.status === "COMPLETED").length;
  const appointmentCompletion = percentage(completedAppointments, appointmentRows.length);
  const cardiovascularHigh = patients.filter((patient) => biomarkerNumber(patient, "cardiovascular_risk") >= 10 || patient.severe_chronic_tags.some((tag) => normalizeText(tag).includes("yqtk"))).length;
  const diabetesMarked = patients.filter((patient) => biomarkerNumber(patient, "diabetes_risk") > 0 || patient.severe_chronic_tags.some((tag) => normalizeText(tag).includes("diabet"))).length;
  const criticalRecords = records.filter((record) => record.ai_review_status === "CRITICAL" || record.ai_review_status === "NEEDS_REVIEW").length;
  const analyticsRows: Array<[string, number, string]> = [
    ["YQTK xavfi", percentage(cardiovascularHigh, patients.length), "bg-clinical-red"],
    ["Qandli diabet xavfi", percentage(diabetesMarked, patients.length), "bg-clinical-amber"],
    ["AI ko'rib chiqish signali", percentage(criticalRecords + aiLogs.filter((log) => log.severity === "CRITICAL" || log.severity === "HIGH").length, Math.max(records.length + aiLogs.length, 1)), "bg-clinical-blue"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Qizil zona" value={String(red)} icon={AlertTriangle} tone="red" />
        <StatCard label="Sariq zona" value={String(yellow)} icon={Activity} tone="amber" />
        <StatCard label="Yashil zona" value={String(green)} icon={CheckCircle2} tone="green" />
        <StatCard label="Qabul bajarilishi" value={loading ? "..." : `${appointmentCompletion} %`} icon={ClipboardCheck} />
      </div>
      {message ? (
        <div className="rounded-md border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </div>
      ) : null}
      <section className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-clinical-ink">Tahlil</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {analyticsRows.map(([label, value, color]) => (
            <div key={label} className="rounded-md border border-clinical-line p-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium text-clinical-ink">{label}</span>
                <span className="text-clinical-slate">{value}%</span>
              </div>
              <div className="h-2 rounded-sm bg-slate-100">
                <div className={`h-2 rounded-sm ${color}`} style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AIAnalyzesView() {
  const [warnings, setWarnings] = useState<ClinicAIWarning[]>([]);
  const [activities, setActivities] = useState<DoctorActivitySignal[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [scanState, setScanState] = useState<"idle" | "done">("idle");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const selected = warnings.find((warning) => warning.id === selectedId) ?? warnings[0];
  const headDoctorInbox = warnings.filter((warning) => warning.status === "Head doctorga yuborildi" || warning.status === "Vazifa ochildi");
  const doctorSummaries = useMemo(() => doctorShortcomingSummaries(warnings), [warnings]);
  const criticalCount = warnings.filter((warning) => warning.severity === "CRITICAL").length;
  const openCount = warnings.filter((warning) => warning.status !== "Ko'rildi").length;
  const sentCount = warnings.filter((warning) => warning.status === "Head doctorga yuborildi").length;

  const loadAIAnalyzeData = async (showScanDone = false) => {
    setLoading(true);
    const results = await Promise.allSettled([
      listAIErrorLogs(""),
      listMedicalRecords(),
      listAppointments(),
      listClinicalTasks(),
      listPatronageVisits(),
      listPerinatalRegistry(),
    ]);
    const logResult = results[0];
    const recordResult = results[1];
    const appointmentResult = results[2];
    const taskResult = results[3];
    const patronageResult = results[4];
    const perinatalResult = results[5];
    const logs = logResult.status === "fulfilled" ? logResult.value.results : [];
    const records = recordResult.status === "fulfilled" ? recordResult.value.results : [];
    const appointmentRows = appointmentResult.status === "fulfilled" ? appointmentResult.value.results : [];
    const taskRows = taskResult.status === "fulfilled" ? taskResult.value.results : [];
    const patronageRowsList = patronageResult.status === "fulfilled" ? patronageResult.value.results : [];
    const perinatalRows = perinatalResult.status === "fulfilled" ? perinatalResult.value.results : [];
    const mappedWarnings = logs.map((log) => aiWarningFromLog(log, records, taskRows));
    setWarnings(mappedWarnings);
    setActivities(activitySignalsFromBackend(logs, records, appointmentRows, taskRows, patronageRowsList, perinatalRows));
    setSelectedId((current) => (mappedWarnings.some((warning) => warning.id === current) ? current : mappedWarnings[0]?.id ?? 0));
    const rejected = results.find((result) => result.status === "rejected");
    setMessage(rejected?.status === "rejected" ? String(rejected.reason instanceof Error ? rejected.reason.message : rejected.reason) : "");
    setScanState(showScanDone ? "done" : "idle");
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      listAIErrorLogs(""),
      listMedicalRecords(),
      listAppointments(),
      listClinicalTasks(),
      listPatronageVisits(),
      listPerinatalRegistry(),
    ])
      .then((results) => {
        if (!active) {
          return;
        }
        const logResult = results[0];
        const recordResult = results[1];
        const appointmentResult = results[2];
        const taskResult = results[3];
        const patronageResult = results[4];
        const perinatalResult = results[5];
        const logs = logResult.status === "fulfilled" ? logResult.value.results : [];
        const records = recordResult.status === "fulfilled" ? recordResult.value.results : [];
        const appointmentRows = appointmentResult.status === "fulfilled" ? appointmentResult.value.results : [];
        const taskRows = taskResult.status === "fulfilled" ? taskResult.value.results : [];
        const patronageRowsList = patronageResult.status === "fulfilled" ? patronageResult.value.results : [];
        const perinatalRows = perinatalResult.status === "fulfilled" ? perinatalResult.value.results : [];
        const mappedWarnings = logs.map((log) => aiWarningFromLog(log, records, taskRows));
        setWarnings(mappedWarnings);
        setActivities(activitySignalsFromBackend(logs, records, appointmentRows, taskRows, patronageRowsList, perinatalRows));
        setSelectedId((current) => (mappedWarnings.some((warning) => warning.id === current) ? current : mappedWarnings[0]?.id ?? 0));
        const rejected = results.find((result) => result.status === "rejected");
        setMessage(rejected?.status === "rejected" ? String(rejected.reason instanceof Error ? rejected.reason.message : rejected.reason) : "");
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

  const updateWarning = (warningId: number, patch: Partial<ClinicAIWarning>) => {
    setWarnings((current) => current.map((warning) => (warning.id === warningId ? { ...warning, ...patch } : warning)));
  };

  const acknowledgeWarning = async (warning: ClinicAIWarning) => {
    try {
      await updateAIErrorLog(warning.backendLogId, { reviewed_by_admin: true });
      updateWarning(warning.id, { status: "Ko'rildi" });
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI warning could not be acknowledged.");
    }
  };

  const sendToHeadDoctor = async (warning: ClinicAIWarning) => {
    try {
      await escalateAIErrorLog(warning.backendLogId);
      updateWarning(warning.id, {
        status: "Head doctorga yuborildi",
        sentAt: new Date().toLocaleString("uz-UZ", { hour12: false }),
      });
      setMessage("Doctor shortcoming head doctor inboxiga yuborildi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI warning could not be sent to the head doctor.");
    }
  };

  const openTaskFromWarning = async (warning: ClinicAIWarning) => {
    if (!warning.patientId) {
      setMessage("Bu AI signal uchun bemor ID topilmadi, klinik vazifa ochilmadi.");
      return;
    }
    try {
      const task = await createClinicalTask({
        patient: warning.patientId,
        task_type: "CARE_PLAN",
        status: "OPEN",
        priority: taskPriorityFromWarning(warning.severity),
        title: `AI safety: ${warning.signal}`,
        description: `${warning.evidence}\n\nTavsiya: ${warning.recommendedAction}`,
        due_at: dueAtFromSeverity(warning.severity),
        metadata: {
          source: "ai_analyzes_workspace",
          source_ai_error_log_id: warning.backendLogId,
          source_medical_record_id: warning.medicalRecordId,
        },
      });
      updateWarning(warning.id, { status: "Vazifa ochildi" });
      setActivities((current) => [
        {
          id: Math.max(...current.map((item) => item.id), 0) + 1,
          time: formatBackendDateTime(task.created_at),
          doctor: task.created_by_name || task.assigned_to_name || "AI analyzes",
          patient: task.patient_name || warning.patient,
          action: `${task.title}: ${clinicalTaskStatusLabel(task.status)}`,
          module: "Klinik vazifa",
          aiSignal: task.description,
          severity: warningSeverityFromTask(task),
        },
        ...current,
      ]);
      setMessage("AI signal bo'yicha klinik vazifa backendda ochildi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI warning task could not be created.");
    }
  };

  const runClinicScan = () => {
    void loadAIAnalyzeData(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="AI warnings" value={String(warnings.length)} icon={Bot} />
        <StatCard label="Flagged doctors" value={String(doctorSummaries.length)} icon={Stethoscope} tone="amber" />
        <StatCard label="Critical" value={String(criticalCount)} icon={AlertTriangle} tone="red" />
        <StatCard label="Head doctor inbox" value={String(sentCount)} icon={Bell} />
      </div>

      <section className="rounded-md border border-clinical-line bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinical-line px-4 py-3">
          <div>
            <h2 className="font-semibold text-clinical-ink">AI analyzes</h2>
            <p className="text-sm text-clinical-slate">Doctor shortcomings monitor, head doctor escalation, RCA and continuity control. Ochiq signal: {openCount}</p>
          </div>
          <button
            type="button"
            onClick={runClinicScan}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-clinical-blue px-3 text-sm font-semibold text-white"
          >
            <Sparkles className="h-4 w-4" />
            Refresh AI scan
          </button>
        </div>
        {message ? (
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            {message}
          </div>
        ) : null}
        {scanState === "done" ? (
          <div className="border-b border-clinical-line bg-blue-50 px-4 py-2 text-sm text-clinical-blue">
            Backend AI scan refreshed from live safety logs and clinical activity.
          </div>
        ) : null}

        <section className="border-b border-clinical-line bg-white">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-clinical-ink">Doctor shortcomings register</h3>
              <p className="text-sm text-clinical-slate">Repeated omissions, unsafe orders, imaging consent gaps and continuity failures by doctor</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
                <tr>
                  <th className="px-3 py-3">Doctor</th>
                  <th className="px-3 py-3">Shortcomings</th>
                  <th className="px-3 py-3">High/Critical</th>
                  <th className="px-3 py-3">Latest patient</th>
                  <th className="px-3 py-3">Top pattern</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-line">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-clinical-slate">
                      Doctor shortcomings backenddan yuklanmoqda.
                    </td>
                  </tr>
                ) : doctorSummaries.length ? (
                  doctorSummaries.map((summary) => {
                    const warning = warnings.find((item) => item.id === summary.latestWarningId);
                    return (
                      <tr key={summary.doctor} className="hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedId(summary.latestWarningId)}
                            className="font-semibold text-clinical-ink hover:text-clinical-blue"
                          >
                            {summary.doctor}
                          </button>
                          <p className="mt-1 text-xs text-clinical-slate">{summary.latestAt}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-semibold text-clinical-ink">{summary.total}</span>
                          <p className="mt-1 text-xs text-clinical-slate">Ochiq: {summary.open}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-900">
                            {summary.critical} critical / {summary.high} high
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-clinical-ink">{summary.latestPatient}</p>
                          <p className="mt-1 text-xs text-clinical-slate">{summary.latestSignal}</p>
                        </td>
                        <td className="px-3 py-3 text-clinical-slate">{summary.topSource}</td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedId(summary.latestWarningId)}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                              title="Ko'rish"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => warning && void sendToHeadDoctor(warning)}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-red hover:text-clinical-red"
                              title="Head doctorga yuborish"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-clinical-slate">
                      Backendda doctor shortcoming topilmadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-md border border-clinical-line">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
                  <tr>
                    <th className="px-3 py-3">Risk</th>
                    <th className="px-3 py-3">Patient</th>
                    <th className="px-3 py-3">Doctor</th>
                    <th className="px-3 py-3">Signal</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clinical-line">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-clinical-slate">
                        Backend AI warnings yuklanmoqda.
                      </td>
                    </tr>
                  ) : warnings.length ? (
                    warnings.map((warning) => (
                    <tr key={warning.id} className={warning.id === selected?.id ? "bg-blue-50/70" : "hover:bg-slate-50"}>
                      <td className="px-3 py-3">
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${aiWarningSeverityStyles[warning.severity]}`}>
                          {warning.severity}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(warning.id)}
                          className="text-left font-semibold text-clinical-ink hover:text-clinical-blue"
                        >
                          {warning.patient}
                        </button>
                        <p className="mt-1 text-xs text-clinical-slate">{warning.department}</p>
                      </td>
                      <td className="px-3 py-3 text-clinical-slate">{warning.doctor}</td>
                      <td className="max-w-[360px] px-3 py-3">
                        <p className="line-clamp-2">{warning.signal}</p>
                        <p className="mt-1 text-xs text-clinical-slate">{warning.createdAt}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${aiWarningStatusStyles[warning.status]}`}>
                          {warning.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedId(warning.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                            title="Ko'rish"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void sendToHeadDoctor(warning)}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-red hover:text-clinical-red"
                            title="Head doctorga yuborish"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void acknowledgeWarning(warning)}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-green hover:text-clinical-green"
                            title="Ko'rildi"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void openTaskFromWarning(warning)}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-green hover:text-clinical-green"
                            title="Vazifa ochish"
                          >
                            <ClipboardList className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-clinical-slate">
                        Backendda AI safety warning topilmadi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <section className="rounded-md border border-clinical-line bg-white shadow-sm">
              <div className="border-b border-clinical-line px-4 py-3">
                <h3 className="font-semibold text-clinical-ink">Doctor activity stream</h3>
              </div>
              <div className="divide-y divide-clinical-line">
                {loading ? (
                  <div className="px-4 py-8 text-center text-sm text-clinical-slate">Activity stream backenddan yuklanmoqda.</div>
                ) : activities.length ? (
                  activities.map((activity) => (
                  <div key={activity.id} className="grid gap-3 px-4 py-3 md:grid-cols-[150px_1fr_120px] md:items-center">
                    <div>
                      <p className="text-sm font-semibold text-clinical-ink">{activity.time.slice(11, 16)}</p>
                      <p className="text-xs text-clinical-slate">{activity.module}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-clinical-ink">{activity.action}</p>
                      <p className="mt-1 text-xs text-clinical-slate">{activity.doctor}, {activity.patient}</p>
                      <p className="mt-1 text-sm text-clinical-slate">{activity.aiSignal}</p>
                    </div>
                    <span className={`rounded-md border px-2 py-1 text-center text-xs font-semibold ${aiWarningSeverityStyles[activity.severity]}`}>
                      {activity.severity}
                    </span>
                  </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-clinical-slate">Backendda activity topilmadi.</div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-clinical-ink">Warning details</h3>
                {selected ? (
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${aiWarningSeverityStyles[selected.severity]}`}>
                    {selected.severity}
                  </span>
                ) : null}
              </div>
              {selected ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="font-semibold text-clinical-ink">{selected.signal}</p>
                    <p className="mt-1 text-sm text-clinical-slate">{selected.patient}, {selected.doctor}</p>
                  </div>
                  <div className="rounded-md border border-clinical-line bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase text-clinical-slate">Evidence</p>
                    <p className="mt-1 text-sm text-clinical-ink">{selected.evidence}</p>
                  </div>
                  <div className="rounded-md border border-clinical-line bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase text-clinical-slate">Recommended action</p>
                    <p className="mt-1 text-sm text-clinical-ink">{selected.recommendedAction}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => void sendToHeadDoctor(selected)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-clinical-red text-sm font-semibold text-white"
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => void openTaskFromWarning(selected)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-clinical-blue text-sm font-semibold text-white"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Vazifa
                    </button>
                    <button
                      type="button"
                      onClick={() => void acknowledgeWarning(selected)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-clinical-line bg-white text-sm font-semibold text-clinical-ink"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Review
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-md border border-clinical-line bg-white shadow-sm">
              <div className="border-b border-clinical-line px-4 py-3">
                <h3 className="font-semibold text-clinical-ink">Head doctor inbox</h3>
              </div>
              <div className="divide-y divide-clinical-line">
                {headDoctorInbox.length ? (
                  headDoctorInbox.map((warning) => (
                    <div key={warning.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-clinical-ink">{warning.patient}</p>
                          <p className="mt-1 text-xs text-clinical-slate">{warning.signal}</p>
                        </div>
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${aiWarningStatusStyles[warning.status]}`}>
                          {warning.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-clinical-slate">{warning.sentAt ?? warning.createdAt}</p>
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-4 text-sm text-clinical-slate">Inbox empty.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}

function SettingsView() {
  const settingsCards = [
    { title: "Tashkilot", value: "Andijon tuman Qo'nji oilaviy shifokorlik punkti", icon: Hospital },
    { title: "Xodimlar", value: "Rollar, ruxsatlar va audit", icon: UsersRound },
    { title: "Xavfsizlik", value: "Sessiya, cookie, HSTS, audit dalillari", icon: ShieldCheck },
    { title: "Integratsiya", value: "API, WebSocket, FHIR yo'nalishi", icon: Radio },
    { title: "Til", value: "O'zbekcha, Русский, English", icon: Languages },
    { title: "Eksport", value: "Audit va operatsion hisobotlar", icon: Download },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {settingsCards.map(({ title, value, icon: Icon }) => (
        <section key={title} className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-clinical-blue">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-clinical-ink">{title}</h2>
              <p className="text-sm text-clinical-slate">{value}</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function ReadonlyTable<T extends object>({
  title,
  subtitle,
  rows,
  columns,
  loading = false,
  message = "",
  emptyLabel = "Backendda yozuv topilmadi.",
}: {
  title: string;
  subtitle: string;
  rows: T[];
  columns: Array<keyof T>;
  loading?: boolean;
  message?: string;
  emptyLabel?: string;
}) {
  const [selectedRow, setSelectedRow] = useState<T | null>(null);

  return (
    <section className="min-w-0 rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="border-b border-clinical-line px-4 py-3">
        <h2 className="font-semibold text-clinical-ink">{title}</h2>
        <p className="text-sm text-clinical-slate">{subtitle}</p>
      </div>
      {message ? (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
          {message}
        </div>
      ) : null}
      {selectedRow ? (
        <div className="border-b border-clinical-line bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-clinical-ink">Tanlangan yozuv</p>
            <button
              type="button"
              onClick={() => setSelectedRow(null)}
              className="h-8 rounded-md border border-clinical-line bg-white px-2 text-xs font-semibold text-clinical-slate"
            >
              Yopish
            </button>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {columns.map((column) => (
              <Info key={String(column)} label={String(column)} value={String(selectedRow[column] ?? "")} />
            ))}
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
            <tr>
              {columns.map((column) => (
                <th key={String(column)} className="px-3 py-3">
                  {String(column)}
                </th>
              ))}
              <th className="px-3 py-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clinical-line">
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-clinical-slate">
                  Backenddan yuklanmoqda.
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  {columns.map((column) => (
                    <td key={String(column)} className="px-3 py-3">
                      {String(row[column] ?? "")}
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedRow(row)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                        title="Ko'rish"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-clinical-slate">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
