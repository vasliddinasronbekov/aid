"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Baby,
  Bed,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Printer,
  Route,
  Save,
  ShieldAlert,
  Stethoscope,
  TestTube2,
  UsersRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Appointment,
  AdmissionRow,
  CareTeamMember,
  ClinicalTaskRow,
  DiagnosticOrderRow,
  DuplicateCandidateRow,
  patientProfileFor,
  PatientAllergy,
  PatientEncounter,
  PatientVital,
  PatronageRow,
  PregnantRegistryRow,
  ReferralRow,
  RegistryPatient,
} from "@/lib/crm-data";

type PatientTab =
  | "profile"
  | "care-team"
  | "appointments"
  | "encounters"
  | "tasks"
  | "orders"
  | "referrals"
  | "admissions"
  | "perinatal"
  | "patronage"
  | "duplicates"
  | "vitals"
  | "allergies"
  | "prescriptions"
  | "documents";

const tabs: Array<{ key: PatientTab; label: string }> = [
  { key: "profile", label: "Profil" },
  { key: "care-team", label: "Jamoa" },
  { key: "appointments", label: "Qabullar" },
  { key: "encounters", label: "Ko'riklar" },
  { key: "tasks", label: "Vazifalar" },
  { key: "orders", label: "Buyurtmalar" },
  { key: "referrals", label: "Yo'llanmalar" },
  { key: "admissions", label: "Yotqizish" },
  { key: "perinatal", label: "Perinatal" },
  { key: "patronage", label: "Patronaj" },
  { key: "duplicates", label: "Dublikat" },
  { key: "vitals", label: "Ko'rsatkichlar" },
  { key: "allergies", label: "Allergiyalar" },
  { key: "prescriptions", label: "Retseptlar" },
  { key: "documents", label: "Hujjatlar" },
];

const zoneStyles: Record<RegistryPatient["riskZone"], string> = {
  RED: "border-red-200 bg-red-50 text-red-900",
  YELLOW: "border-amber-200 bg-amber-50 text-amber-900",
  GREEN: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

const appointmentStatusStyles: Record<Appointment["status"], string> = {
  Aktiv: "border-blue-200 bg-blue-50 text-clinical-blue",
  Bajarildi: "border-emerald-200 bg-emerald-50 text-emerald-900",
  "Bekor qilingan": "border-red-200 bg-red-50 text-red-900",
};

const allergyStyles: Record<PatientAllergy["severity"], string> = {
  Past: "border-emerald-200 bg-emerald-50 text-emerald-900",
  "O'rta": "border-amber-200 bg-amber-50 text-amber-900",
  Yuqori: "border-red-200 bg-red-50 text-red-900",
  "Hayot uchun xavfli": "border-red-300 bg-red-100 text-red-950",
};

const priorityStyles = {
  Yuqori: "border-red-200 bg-red-50 text-red-900",
  "O'rta": "border-amber-200 bg-amber-50 text-amber-900",
  Past: "border-emerald-200 bg-emerald-50 text-emerald-900",
  Shoshilinch: "border-red-200 bg-red-50 text-red-900",
  Kritik: "border-red-300 bg-red-100 text-red-950",
  Rejali: "border-emerald-200 bg-emerald-50 text-emerald-900",
} as const;

interface PatientProfileProps {
  patientId: number;
}

export function PatientProfile({ patientId }: PatientProfileProps) {
  const profile = patientProfileFor(patientId);
  const [activeTab, setActiveTab] = useState<PatientTab>("profile");
  const [appointments, setAppointments] = useState<Appointment[]>(profile?.appointments ?? []);
  const [tasks, setTasks] = useState<ClinicalTaskRow[]>(profile?.tasks ?? []);
  const [orders, setOrders] = useState<DiagnosticOrderRow[]>(profile?.diagnosticOrders ?? []);
  const [referrals, setReferrals] = useState<ReferralRow[]>(profile?.referrals ?? []);
  const [admissions, setAdmissions] = useState<AdmissionRow[]>(profile?.admissions ?? []);
  const [perinatalEntries, setPerinatalEntries] = useState<PregnantRegistryRow[]>(profile?.perinatalEntries ?? []);
  const [patronageVisits, setPatronageVisits] = useState<PatronageRow[]>(profile?.patronageVisits ?? []);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidateRow[]>(profile?.duplicateCandidates ?? []);
  const [note, setNote] = useState("");
  const [assessment, setAssessment] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    setAppointments(profile?.appointments ?? []);
    setTasks(profile?.tasks ?? []);
    setOrders(profile?.diagnosticOrders ?? []);
    setReferrals(profile?.referrals ?? []);
    setAdmissions(profile?.admissions ?? []);
    setPerinatalEntries(profile?.perinatalEntries ?? []);
    setPatronageVisits(profile?.patronageVisits ?? []);
    setDuplicateCandidates(profile?.duplicateCandidates ?? []);
  }, [profile?.patient.id]);

  useEffect(() => {
    const saved = globalThis.localStorage?.getItem(`crm-patient-profile-note:${patientId}`);
    if (!saved) {
      setNote("");
      setAssessment("");
      setSaveState("idle");
      return;
    }
    try {
      const parsed = JSON.parse(saved) as { note?: string; assessment?: string };
      setNote(parsed.note ?? "");
      setAssessment(parsed.assessment ?? "");
      setSaveState("idle");
    } catch {
      setNote("");
      setAssessment("");
      setSaveState("idle");
    }
  }, [patientId]);

  const latestVital = useMemo(() => profile?.vitals[0], [profile]);
  const activeAllergies = useMemo(() => profile?.allergies.filter((allergy) => allergy.status === "Faol") ?? [], [profile]);

  if (!profile) {
    return (
      <section className="rounded-md border border-clinical-line bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-clinical-ink">Bemor topilmadi</h2>
        <Link href="/doctor" className="mt-4 inline-flex h-10 items-center rounded-md bg-clinical-blue px-4 text-sm font-semibold text-white">
          Ro'yxatga qaytish
        </Link>
      </section>
    );
  }

  const saveClinicalNote = () => {
    globalThis.localStorage?.setItem(
      `crm-patient-profile-note:${profile.patient.id}`,
      JSON.stringify({ patientId: profile.patient.id, note, assessment, savedAt: new Date().toISOString() }),
    );
    setSaveState("saved");
  };

  const updateAppointment = (appointmentId: number, status: Appointment["status"]) => {
    setAppointments((current) => current.map((appointment) => (appointment.id === appointmentId ? { ...appointment, status } : appointment)));
  };
  const updateTask = (taskId: number, status: ClinicalTaskRow["status"]) => {
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));
  };
  const updateOrder = (orderId: number, status: DiagnosticOrderRow["status"]) => {
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));
  };
  const updateReferral = (referralId: number, status: ReferralRow["status"]) => {
    setReferrals((current) => current.map((referral) => (referral.id === referralId ? { ...referral, status } : referral)));
  };
  const updateAdmission = (admissionId: number, status: AdmissionRow["status"]) => {
    setAdmissions((current) => current.map((admission) => (admission.id === admissionId ? { ...admission, status } : admission)));
  };
  const updatePerinatal = (entryId: number, status: PregnantRegistryRow["status"]) => {
    setPerinatalEntries((current) => current.map((entry) => (entry.id === entryId ? { ...entry, status } : entry)));
  };
  const updatePatronage = (visitId: number, status: PatronageRow["status"], sync: PatronageRow["sync"]) => {
    setPatronageVisits((current) => current.map((visit) => (visit.id === visitId ? { ...visit, status, sync } : visit)));
  };
  const updateDuplicate = (candidateId: number, status: DuplicateCandidateRow["status"]) => {
    setDuplicateCandidates((current) => current.map((candidate) => (candidate.id === candidateId ? { ...candidate, status } : candidate)));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-clinical-line bg-white shadow-sm">
        <div className="flex flex-col gap-4 px-4 py-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold text-clinical-ink">{profile.patient.fullName}</h2>
              <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${zoneStyles[profile.patient.riskZone]}`}>
                {profile.patient.riskZone}
              </span>
            </div>
            <p className="mt-1 text-sm text-clinical-slate">
              {profile.patient.medicalCard}, {profile.patient.territory}, {profile.patient.age} yosh
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:w-[520px]">
            <ProfileMetric label="Telefon" value={profile.patient.phone} />
            <ProfileMetric label="Keyingi ko'rik" value={profile.patient.nextVisit} />
            <ProfileMetric label="Shifokor" value={profile.patient.assignedDoctor} />
            <ProfileMetric label="Patronaj" value={profile.patient.patronageNurse} />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto border-t border-clinical-line px-4 py-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`h-9 shrink-0 rounded-md border px-3 text-sm font-medium ${
                activeTab === tab.key ? "border-clinical-blue bg-blue-50 text-clinical-blue" : "border-clinical-line bg-white text-clinical-slate"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0 space-y-4">
          {activeTab === "profile" ? (
            <ProfileOverview patient={profile.patient} latestVital={latestVital} allergies={activeAllergies} />
          ) : null}
          {activeTab === "care-team" ? <CareTeamPanel members={profile.careTeam} /> : null}
          {activeTab === "appointments" ? (
            <AppointmentsPanel appointments={appointments} onStatusChange={updateAppointment} />
          ) : null}
          {activeTab === "encounters" ? <EncounterPanel encounters={profile.encounters} /> : null}
          {activeTab === "tasks" ? <TasksPanel tasks={tasks} onStatusChange={updateTask} /> : null}
          {activeTab === "orders" ? <OrdersPanel orders={orders} onStatusChange={updateOrder} /> : null}
          {activeTab === "referrals" ? <ReferralsPanel referrals={referrals} onStatusChange={updateReferral} /> : null}
          {activeTab === "admissions" ? <AdmissionsPanel admissions={admissions} onStatusChange={updateAdmission} /> : null}
          {activeTab === "perinatal" ? <PerinatalPanel entries={perinatalEntries} onStatusChange={updatePerinatal} /> : null}
          {activeTab === "patronage" ? <PatronagePanel visits={patronageVisits} onStatusChange={updatePatronage} /> : null}
          {activeTab === "duplicates" ? <DuplicatePanel candidates={duplicateCandidates} onStatusChange={updateDuplicate} /> : null}
          {activeTab === "vitals" ? <VitalsPanel vitals={profile.vitals} /> : null}
          {activeTab === "allergies" ? <AllergyPanel allergies={profile.allergies} /> : null}
          {activeTab === "prescriptions" ? (
            <DataTable
              title="Retseptlar"
              rows={profile.prescriptions}
              columns={["medication", "dose", "duration", "status", "safety"]}
              emptyText="Faol retseptlar yo'q"
            />
          ) : null}
          {activeTab === "documents" ? (
            <DataTable
              title="Hujjatlar"
              rows={profile.documents}
              columns={["title", "type", "owner", "updatedAt", "status"]}
              emptyText="Hujjat biriktirilmagan"
            />
          ) : null}
        </main>

        <aside className="space-y-4">
          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="border-b border-clinical-line px-4 py-3">
              <h3 className="font-semibold text-clinical-ink">Ko'rik yozuvi</h3>
            </div>
            <div className="space-y-3 p-4">
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Shikoyat va ko'rik</span>
                <textarea
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setSaveState("idle");
                  }}
                  rows={4}
                  className="w-full rounded-md border border-clinical-line px-3 py-2 text-sm focus:border-clinical-blue"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Baholash va reja</span>
                <textarea
                  value={assessment}
                  onChange={(event) => {
                    setAssessment(event.target.value);
                    setSaveState("idle");
                  }}
                  rows={4}
                  className="w-full rounded-md border border-clinical-line px-3 py-2 text-sm focus:border-clinical-blue"
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
          </section>

          <section className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-clinical-ink">Xavfsizlik signallari</h3>
            <div className="mt-3 space-y-2">
              {profile.patient.riskZone === "RED" ? (
                <SafetyLine tone="red" text="Qizil zona: ko'rik yakunida reja va keyingi sana majburiy." />
              ) : null}
              {activeAllergies.length > 0 ? (
                <SafetyLine tone="amber" text={`${activeAllergies.length} faol allergiya dori xavfsizligida tekshirilsin.`} />
              ) : (
                <SafetyLine tone="green" text="Faol allergiya qaydi yo'q." />
              )}
              {profile.patient.dList !== "Yo'q" ? <SafetyLine tone="amber" text={`D-ro'yxat: ${profile.patient.dList}`} /> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ProfileOverview({
  patient,
  latestVital,
  allergies,
}: {
  patient: RegistryPatient;
  latestVital?: PatientVital;
  allergies: PatientAllergy[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Sog. guruh" value={patient.healthGroup} icon={HeartPulse} tone="blue" />
        <SummaryCard label="YQTK xavfi" value={patient.cardiovascularRisk} icon={Activity} tone="red" />
        <SummaryCard label="Qand xavfi" value={patient.diabetesRisk} icon={ShieldAlert} tone="amber" />
        <SummaryCard label="Allergiya" value={String(allergies.length)} icon={AlertTriangle} tone={allergies.length ? "red" : "green"} />
      </div>

      <section className="rounded-md border border-clinical-line bg-white shadow-sm">
        <div className="border-b border-clinical-line px-4 py-3">
          <h3 className="font-semibold text-clinical-ink">Bemor ma'lumotlari</h3>
        </div>
        <div className="grid gap-0 divide-y divide-clinical-line md:grid-cols-2 md:divide-x md:divide-y-0">
          <DetailColumn
            rows={[
              ["Hudud", patient.territory],
              ["Manzil", patient.address],
              ["Telefon", patient.phone],
              ["Biriktirilgan shifokor", patient.assignedDoctor],
            ]}
          />
          <DetailColumn
            rows={[
              ["Kl. tashxis", patient.clinicalDiagnosis],
              ["D-ro'yxat", patient.dList],
              ["Nogironlik", patient.disability],
              ["So'nggi ko'rik", patient.lastVisit],
            ]}
          />
        </div>
      </section>

      {latestVital ? (
        <section className="rounded-md border border-clinical-line bg-white shadow-sm">
          <div className="border-b border-clinical-line px-4 py-3">
            <h3 className="font-semibold text-clinical-ink">Oxirgi ko'rsatkichlar</h3>
          </div>
          <div className="grid gap-0 divide-y divide-clinical-line md:grid-cols-5 md:divide-x md:divide-y-0">
            <VitalMetric label="BP" value={latestVital.bp} />
            <VitalMetric label="Puls" value={String(latestVital.pulse)} />
            <VitalMetric label="SpO2" value={`${latestVital.spo2}%`} />
            <VitalMetric label="Harorat" value={`${latestVital.temperature} C`} />
            <VitalMetric label="Glukoza" value={latestVital.glucose} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AppointmentsPanel({
  appointments,
  onStatusChange,
}: {
  appointments: Appointment[];
  onStatusChange: (appointmentId: number, status: Appointment["status"]) => void;
}) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="border-b border-clinical-line px-4 py-3">
        <h3 className="font-semibold text-clinical-ink">Qabullar</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
            <tr>
              <th className="px-3 py-3">Sana</th>
              <th className="px-3 py-3">Bo'lim</th>
              <th className="px-3 py-3">Sabab</th>
              <th className="px-3 py-3">Holat</th>
              <th className="px-3 py-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clinical-line">
            {appointments.map((appointment) => (
              <tr key={appointment.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 font-semibold">
                  {appointment.date} {appointment.time}
                </td>
                <td className="px-3 py-3 text-clinical-slate">{appointment.department}</td>
                <td className="px-3 py-3">{appointment.reason}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${appointmentStatusStyles[appointment.status]}`}>
                    {appointment.status}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onStatusChange(appointment.id, "Aktiv")}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
                      title="Aktiv"
                    >
                      <Activity className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStatusChange(appointment.id, "Bajarildi")}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-green hover:text-clinical-green"
                      title="Bajarildi"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStatusChange(appointment.id, "Bekor qilingan")}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-red hover:text-clinical-red"
                      title="Bekor qilish"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CareTeamPanel({ members }: { members: CareTeamMember[] }) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-clinical-line px-4 py-3">
        <UsersRound className="h-4 w-4 text-clinical-blue" />
        <h3 className="font-semibold text-clinical-ink">Davolash jamoasi</h3>
      </div>
      <div className="divide-y divide-clinical-line">
        {members.map((member) => (
          <div key={member.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_180px_180px_160px] lg:items-center">
            <div>
              <h4 className="font-semibold text-clinical-ink">{member.name}</h4>
              <p className="text-sm text-clinical-slate">{member.phone}</p>
            </div>
            <span className="text-sm font-medium text-clinical-ink">{member.role}</span>
            <span className="text-sm text-clinical-slate">{member.department}</span>
            <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${member.primary ? "border-blue-200 bg-blue-50 text-clinical-blue" : "border-clinical-line bg-white text-clinical-slate"}`}>
              {member.primary ? "Asosiy" : "Qo'shimcha"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TasksPanel({
  tasks,
  onStatusChange,
}: {
  tasks: ClinicalTaskRow[];
  onStatusChange: (taskId: number, status: ClinicalTaskRow["status"]) => void;
}) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-clinical-line px-4 py-3">
        <ClipboardList className="h-4 w-4 text-clinical-blue" />
        <h3 className="font-semibold text-clinical-ink">Vazifalar</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
            <tr>
              <th className="px-3 py-3">Vazifa</th>
              <th className="px-3 py-3">Mas'ul</th>
              <th className="px-3 py-3">Muddat</th>
              <th className="px-3 py-3">Ustuvorlik</th>
              <th className="px-3 py-3">Holat</th>
              <th className="px-3 py-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clinical-line">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-slate-50">
                <td className="px-3 py-3">
                  <strong className="text-clinical-ink">{task.title}</strong>
                  <span className="mt-1 block text-xs text-clinical-slate">{task.type}</span>
                </td>
                <td className="px-3 py-3 text-clinical-slate">{task.owner}</td>
                <td className="px-3 py-3">{task.dueAt}</td>
                <td className="px-3 py-3">
                  <PriorityBadge value={task.priority} />
                </td>
                <td className="px-3 py-3">
                  <StatusBadge value={task.status} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <IconAction title="Jarayonda" onClick={() => onStatusChange(task.id, "Jarayonda")} icon={Activity} />
                    <IconAction title="Bajarildi" onClick={() => onStatusChange(task.id, "Bajarildi")} icon={CheckCircle2} />
                    <IconAction title="Bekor" onClick={() => onStatusChange(task.id, "Bekor")} icon={XCircle} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrdersPanel({
  orders,
  onStatusChange,
}: {
  orders: DiagnosticOrderRow[];
  onStatusChange: (orderId: number, status: DiagnosticOrderRow["status"]) => void;
}) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-clinical-line px-4 py-3">
        <TestTube2 className="h-4 w-4 text-clinical-blue" />
        <h3 className="font-semibold text-clinical-ink">Buyurtmalar</h3>
      </div>
      <div className="divide-y divide-clinical-line">
        {orders.map((order) => (
          <div key={order.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[1fr_150px_150px_150px_170px] xl:items-center">
            <div>
              <h4 className="font-semibold text-clinical-ink">{order.name}</h4>
              <p className="text-sm text-clinical-slate">{order.type}, {order.orderedAt}</p>
            </div>
            <PriorityBadge value={order.priority} />
            <StatusBadge value={order.status} />
            <span className="text-sm text-clinical-slate">{order.result}</span>
            <div className="flex justify-end gap-1">
              <IconAction title="Olingan" onClick={() => onStatusChange(order.id, "Olingan")} icon={Activity} />
              <IconAction title="Natija tayyor" onClick={() => onStatusChange(order.id, "Natija tayyor")} icon={CheckCircle2} />
              <IconAction title="Bekor" onClick={() => onStatusChange(order.id, "Bekor")} icon={XCircle} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReferralsPanel({
  referrals,
  onStatusChange,
}: {
  referrals: ReferralRow[];
  onStatusChange: (referralId: number, status: ReferralRow["status"]) => void;
}) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-clinical-line px-4 py-3">
        <Stethoscope className="h-4 w-4 text-clinical-blue" />
        <h3 className="font-semibold text-clinical-ink">Yo'llanmalar</h3>
      </div>
      <div className="divide-y divide-clinical-line">
        {referrals.map((referral) => (
          <div key={referral.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[1fr_170px_150px_150px_170px] xl:items-center">
            <div>
              <h4 className="font-semibold text-clinical-ink">{referral.target}</h4>
              <p className="text-sm text-clinical-slate">{referral.reason}</p>
            </div>
            <span className="text-sm text-clinical-slate">{referral.type}</span>
            <PriorityBadge value={referral.priority} />
            <StatusBadge value={referral.status} />
            <div className="flex justify-end gap-1">
              <IconAction title="Qabul qilindi" onClick={() => onStatusChange(referral.id, "Qabul qilindi")} icon={Activity} />
              <IconAction title="Bajarildi" onClick={() => onStatusChange(referral.id, "Bajarildi")} icon={CheckCircle2} />
              <IconAction title="Bekor" onClick={() => onStatusChange(referral.id, "Bekor")} icon={XCircle} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdmissionsPanel({
  admissions,
  onStatusChange,
}: {
  admissions: AdmissionRow[];
  onStatusChange: (admissionId: number, status: AdmissionRow["status"]) => void;
}) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-clinical-line px-4 py-3">
        <Bed className="h-4 w-4 text-clinical-blue" />
        <h3 className="font-semibold text-clinical-ink">Yotqizish</h3>
      </div>
      <div className="divide-y divide-clinical-line">
        {admissions.map((admission) => (
          <div key={admission.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[1fr_160px_150px_150px_170px] xl:items-center">
            <div>
              <h4 className="font-semibold text-clinical-ink">{admission.department}</h4>
              <p className="text-sm text-clinical-slate">{admission.reason}</p>
            </div>
            <span className="text-sm text-clinical-slate">{admission.room}</span>
            <PriorityBadge value={admission.priority} />
            <StatusBadge value={admission.status} />
            <div className="flex justify-end gap-1">
              <IconAction title="Navbat" onClick={() => onStatusChange(admission.id, "Navbat")} icon={Activity} />
              <IconAction title="Yotqizildi" onClick={() => onStatusChange(admission.id, "Yotqizildi")} icon={CheckCircle2} />
              <IconAction title="Chiqarildi" onClick={() => onStatusChange(admission.id, "Chiqarildi")} icon={XCircle} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PerinatalPanel({
  entries,
  onStatusChange,
}: {
  entries: PregnantRegistryRow[];
  onStatusChange: (entryId: number, status: PregnantRegistryRow["status"]) => void;
}) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-clinical-line px-4 py-3">
        <Baby className="h-4 w-4 text-clinical-blue" />
        <h3 className="font-semibold text-clinical-ink">Perinatal kuzatuv</h3>
      </div>
      {entries.length ? (
        <div className="divide-y divide-clinical-line">
          {entries.map((entry) => (
            <div key={entry.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[1fr_160px_160px_150px_170px] xl:items-center">
              <div>
                <h4 className="font-semibold text-clinical-ink">{entry.week} hafta {entry.day} kun</h4>
                <p className="text-sm text-clinical-slate">{entry.fetalNote}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {entry.riskFactors.map((factor) => (
                    <span key={factor} className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] text-clinical-slate">
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
              <RiskBadge value={entry.riskZone} />
              <span className="text-sm text-clinical-slate">EDD {entry.edd}</span>
              <StatusBadge value={entry.status} />
              <div className="flex justify-end gap-1">
                <IconAction title="Kuzatuv" onClick={() => onStatusChange(entry.id, "Kuzatuv")} icon={Activity} />
                <IconAction title="Yotqizildi" onClick={() => onStatusChange(entry.id, "Yotqizildi")} icon={Bed} />
                <IconAction title="Yopildi" onClick={() => onStatusChange(entry.id, "Yopildi")} icon={CheckCircle2} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-clinical-slate">Perinatal kuzatuv yozuvi yo'q.</p>
      )}
    </section>
  );
}

function PatronagePanel({
  visits,
  onStatusChange,
}: {
  visits: PatronageRow[];
  onStatusChange: (visitId: number, status: PatronageRow["status"], sync: PatronageRow["sync"]) => void;
}) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-clinical-line px-4 py-3">
        <Route className="h-4 w-4 text-clinical-blue" />
        <h3 className="font-semibold text-clinical-ink">Patronaj sinxronlash</h3>
      </div>
      {visits.length ? (
        <div className="divide-y divide-clinical-line">
          {visits.map((visit) => (
            <div key={visit.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[1fr_150px_150px_150px_170px] xl:items-center">
              <div>
                <h4 className="font-semibold text-clinical-ink">{visit.visitType}</h4>
                <p className="text-sm text-clinical-slate">{visit.notes}</p>
                <p className="mt-1 text-xs text-clinical-slate">{visit.offlineId}, versiya {visit.serverVersion}</p>
              </div>
              <PriorityBadge value={visit.priority} />
              <StatusBadge value={visit.status} />
              <span className="text-sm text-clinical-slate">{visit.sync}</span>
              <div className="flex justify-end gap-1">
                <IconAction title="Sinxronlandi" onClick={() => onStatusChange(visit.id, "Sinxronlandi", "Serverda")} icon={CheckCircle2} />
                <IconAction title="Konflikt" onClick={() => onStatusChange(visit.id, "Konflikt", "Konflikt")} icon={AlertTriangle} />
                <IconAction title="Bajarildi" onClick={() => onStatusChange(visit.id, "Bajarildi", "Serverda")} icon={Activity} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-clinical-slate">Patronaj tashrifi yo'q.</p>
      )}
    </section>
  );
}

function DuplicatePanel({
  candidates,
  onStatusChange,
}: {
  candidates: DuplicateCandidateRow[];
  onStatusChange: (candidateId: number, status: DuplicateCandidateRow["status"]) => void;
}) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="border-b border-clinical-line px-4 py-3">
        <h3 className="font-semibold text-clinical-ink">MPI dublikat nazorati</h3>
      </div>
      {candidates.length ? (
        <div className="divide-y divide-clinical-line">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[1fr_120px_160px_170px] xl:items-center">
              <div>
                <h4 className="font-semibold text-clinical-ink">{candidate.duplicatePatient}</h4>
                <div className="mt-2 flex flex-wrap gap-1">
                  {candidate.reasons.map((reason) => (
                    <span key={reason} className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] text-clinical-slate">
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
              <strong className="text-sm text-clinical-ink">{candidate.score}%</strong>
              <StatusBadge value={candidate.status} />
              <div className="flex justify-end gap-1">
                <IconAction title="Tasdiqlash" onClick={() => onStatusChange(candidate.id, "Tasdiqlandi")} icon={CheckCircle2} />
                <IconAction title="Rad etish" onClick={() => onStatusChange(candidate.id, "Rad etildi")} icon={XCircle} />
                <IconAction title="Birlashtirildi" onClick={() => onStatusChange(candidate.id, "Birlashtirildi")} icon={Activity} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-clinical-slate">Dublikat nomzod topilmagan.</p>
      )}
    </section>
  );
}

function EncounterPanel({ encounters }: { encounters: PatientEncounter[] }) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="border-b border-clinical-line px-4 py-3">
        <h3 className="font-semibold text-clinical-ink">Ko'riklar</h3>
      </div>
      <div className="divide-y divide-clinical-line">
        {encounters.map((encounter) => (
          <article key={encounter.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <p className="font-semibold text-clinical-ink">{encounter.date}</p>
              <p className="text-sm text-clinical-slate">{encounter.type}</p>
              <span className="mt-2 inline-flex rounded-md border border-clinical-line px-2 py-1 text-xs text-clinical-slate">{encounter.status}</span>
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-clinical-ink">{encounter.provider}</h4>
              <p className="mt-2 text-sm text-clinical-slate">{encounter.complaint}</p>
              <p className="mt-2 text-sm text-clinical-ink">{encounter.assessment}</p>
              <p className="mt-1 text-sm text-clinical-slate">{encounter.plan}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function VitalsPanel({ vitals }: { vitals: PatientVital[] }) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="border-b border-clinical-line px-4 py-3">
        <h3 className="font-semibold text-clinical-ink">Ko'rsatkichlar</h3>
      </div>
      <div className="divide-y divide-clinical-line">
        {vitals.map((vital) => (
          <div key={vital.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[180px_repeat(5,minmax(0,1fr))] lg:items-center">
            <div>
              <p className="font-semibold text-clinical-ink">{vital.measuredAt}</p>
              <p className="text-sm text-clinical-slate">{vital.note}</p>
            </div>
            <VitalMetric label="BP" value={vital.bp} />
            <VitalMetric label="Puls" value={String(vital.pulse)} />
            <VitalMetric label="SpO2" value={`${vital.spo2}%`} />
            <VitalMetric label="Harorat" value={`${vital.temperature} C`} />
            <VitalMetric label="Glukoza" value={vital.glucose} />
          </div>
        ))}
      </div>
    </section>
  );
}

function AllergyPanel({ allergies }: { allergies: PatientAllergy[] }) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="border-b border-clinical-line px-4 py-3">
        <h3 className="font-semibold text-clinical-ink">Allergiyalar</h3>
      </div>
      <div className="divide-y divide-clinical-line">
        {allergies.map((allergy) => (
          <div key={allergy.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_180px_160px_120px] lg:items-center">
            <div>
              <h4 className="font-semibold text-clinical-ink">{allergy.allergen}</h4>
              <p className="text-sm text-clinical-slate">{allergy.reaction}</p>
            </div>
            <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${allergyStyles[allergy.severity]}`}>{allergy.severity}</span>
            <span className="text-sm text-clinical-slate">{allergy.onset}</span>
            <span className="text-sm font-semibold text-clinical-ink">{allergy.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DataTable<T extends object>({
  title,
  rows,
  columns,
  emptyText,
}: {
  title: string;
  rows: T[];
  columns: Array<keyof T>;
  emptyText: string;
}) {
  return (
    <section className="rounded-md border border-clinical-line bg-white shadow-sm">
      <div className="border-b border-clinical-line px-4 py-3">
        <h3 className="font-semibold text-clinical-ink">{title}</h3>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
              <tr>
                {columns.map((column) => (
                  <th key={String(column)} className="px-3 py-3">
                    {String(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-clinical-line">
              {rows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  {columns.map((column) => (
                    <td key={String(column)} className="px-3 py-3">
                      {String(row[column] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-clinical-slate">{emptyText}</p>
      )}
    </section>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-clinical-line bg-slate-50 px-3 py-2">
      <span className="block text-[11px] text-clinical-slate">{label}</span>
      <strong className="mt-1 block truncate text-sm text-clinical-ink">{value}</strong>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  tone: "blue" | "green" | "amber" | "red";
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

function DetailColumn({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="divide-y divide-clinical-line">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-2 px-4 py-3 sm:grid-cols-[160px_minmax(0,1fr)]">
          <span className="text-sm text-clinical-slate">{label}</span>
          <strong className="min-w-0 text-sm text-clinical-ink">{value}</strong>
        </div>
      ))}
    </div>
  );
}

function VitalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <span className="block text-[11px] uppercase text-clinical-slate">{label}</span>
      <strong className="mt-1 block truncate text-sm text-clinical-ink">{value}</strong>
    </div>
  );
}

function SafetyLine({ text, tone }: { text: string; tone: "red" | "amber" | "green" }) {
  const cls = {
    red: "border-red-200 bg-red-50 text-red-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${cls}`}>
      {text}
    </div>
  );
}

function PriorityBadge({ value }: { value: keyof typeof priorityStyles }) {
  return <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${priorityStyles[value]}`}>{value}</span>;
}

function RiskBadge({ value }: { value: "Qizil" | "Sariq" | "Yashil" }) {
  const cls = {
    Qizil: "border-red-200 bg-red-50 text-red-900",
    Sariq: "border-amber-200 bg-amber-50 text-amber-900",
    Yashil: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[value];
  return <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${cls}`}>{value}</span>;
}

function StatusBadge({ value }: { value: string }) {
  const cls =
    value === "Bajarildi" || value === "Natija tayyor" || value === "Yotqizildi" || value === "Qabul qilindi"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : value === "Bekor" || value === "Bekor qilingan" || value === "Chiqarildi"
        ? "border-red-200 bg-red-50 text-red-900"
        : value === "Jarayonda" || value === "Navbat" || value === "Rejalashtirildi" || value === "Olingan"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-blue-200 bg-blue-50 text-clinical-blue";
  return <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${cls}`}>{value}</span>;
}

function IconAction({
  title,
  icon: Icon,
  onClick,
}: {
  title: string;
  icon: typeof Activity;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-clinical-line text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
      title={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
