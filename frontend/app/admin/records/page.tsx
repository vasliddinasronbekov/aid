"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarDays,
  FileText,
  HeartPulse,
  ListChecks,
  Route,
  Search,
  Stethoscope,
} from "lucide-react";

import {
  listAdmissions,
  listAppointments,
  listClinicalTasks,
  listDepartments,
  listDiagnosticOrders,
  listFeedbackSummary,
  listHospitals,
  listMedicalRecords,
  listPatients,
  listPatronageVisits,
  listPerinatalRegistry,
  listReferrals,
  listRooms,
} from "@/lib/api";
import type {
  Admission,
  BackendAppointment,
  ClinicalTask,
  Department,
  DiagnosticOrder,
  FeedbackSummary,
  Hospital as HospitalRecord,
  MedicalRecord,
  Patient,
  PatronageVisit,
  PerinatalRegistryEntry,
  Referral,
  Room,
  TriageStatus,
} from "@/lib/api";
import { aiReviewClasses, formatDateTime, recordZoneClasses } from "@/lib/admin-insights";

type ZoneFilter = "ALL" | TriageStatus;

interface PlatformLedgerRow {
  label: string;
  count: number;
  detail: string;
  latest: string;
  risk: "RED" | "YELLOW" | "GREEN";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Request failed");
}

function activeAppointment(appointment: BackendAppointment) {
  return ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"].includes(appointment.status);
}

function openTask(task: ClinicalTask) {
  return !["COMPLETED", "CANCELLED"].includes(task.status);
}

function latestFrom<T>(items: T[], getDate: (item: T) => string | null | undefined, getLabel: (item: T) => string) {
  const latest = items.reduce<T | null>((current, item) => {
    if (!current) {
      return item;
    }
    const currentDate = new Date(getDate(current) || "").getTime();
    const itemDate = new Date(getDate(item) || "").getTime();
    return itemDate > currentDate ? item : current;
  }, null);
  return latest ? `${getLabel(latest)} · ${formatDateTime(getDate(latest))}` : "No data";
}

function ledgerRiskClasses(risk: PlatformLedgerRow["risk"]) {
  return recordZoneClasses(risk);
}

export default function AdminRecordsPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<BackendAppointment[]>([]);
  const [tasks, setTasks] = useState<ClinicalTask[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [perinatalEntries, setPerinatalEntries] = useState<PerinatalRegistryEntry[]>([]);
  const [patronageVisits, setPatronageVisits] = useState<PatronageVisit[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [diagnosticOrders, setDiagnosticOrders] = useState<DiagnosticOrder[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary[]>([]);
  const [hospitals, setHospitals] = useState<HospitalRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>("ALL");

  useEffect(() => {
    let active = true;

    setLoading(true);
    Promise.allSettled([
      listMedicalRecords(""),
      listPatients(),
      listAppointments(),
      listClinicalTasks(),
      listAdmissions(),
      listPerinatalRegistry(),
      listPatronageVisits(),
      listReferrals(),
      listDiagnosticOrders(),
      listFeedbackSummary(),
      listHospitals(),
      listDepartments(),
      listRooms(),
    ])
      .then(
        ([
          recordResult,
          patientResult,
          appointmentResult,
          taskResult,
          admissionResult,
          perinatalResult,
          patronageResult,
          referralResult,
          diagnosticResult,
          feedbackResult,
          hospitalResult,
          departmentResult,
          roomResult,
        ]) => {
        if (!active) {
          return;
        }
        const errors: string[] = [];
        if (recordResult.status === "fulfilled") {
          setRecords(recordResult.value.results);
        } else {
          errors.push(`Records: ${errorMessage(recordResult.reason)}`);
          setRecords([]);
        }
        if (patientResult.status === "fulfilled") {
          setPatients(patientResult.value.results);
        } else {
          errors.push(`Patients: ${errorMessage(patientResult.reason)}`);
          setPatients([]);
        }
        if (appointmentResult.status === "fulfilled") {
          setAppointments(appointmentResult.value.results);
        } else {
          errors.push(`Appointments: ${errorMessage(appointmentResult.reason)}`);
          setAppointments([]);
        }
        if (taskResult.status === "fulfilled") {
          setTasks(taskResult.value.results);
        } else {
          errors.push(`Tasks: ${errorMessage(taskResult.reason)}`);
          setTasks([]);
        }
        if (admissionResult.status === "fulfilled") {
          setAdmissions(admissionResult.value.results);
        } else {
          errors.push(`Admissions: ${errorMessage(admissionResult.reason)}`);
          setAdmissions([]);
        }
        if (perinatalResult.status === "fulfilled") {
          setPerinatalEntries(perinatalResult.value.results);
        } else {
          errors.push(`Perinatal: ${errorMessage(perinatalResult.reason)}`);
          setPerinatalEntries([]);
        }
        if (patronageResult.status === "fulfilled") {
          setPatronageVisits(patronageResult.value.results);
        } else {
          errors.push(`Patronage: ${errorMessage(patronageResult.reason)}`);
          setPatronageVisits([]);
        }
        if (referralResult.status === "fulfilled") {
          setReferrals(referralResult.value.results);
        } else {
          errors.push(`Referrals: ${errorMessage(referralResult.reason)}`);
          setReferrals([]);
        }
        if (diagnosticResult.status === "fulfilled") {
          setDiagnosticOrders(diagnosticResult.value.results);
        } else {
          errors.push(`Diagnostics: ${errorMessage(diagnosticResult.reason)}`);
          setDiagnosticOrders([]);
        }
        if (feedbackResult.status === "fulfilled") {
          setFeedbackSummary(feedbackResult.value);
        } else {
          errors.push(`Feedback: ${errorMessage(feedbackResult.reason)}`);
          setFeedbackSummary([]);
        }
        if (hospitalResult.status === "fulfilled") {
          setHospitals(hospitalResult.value.results);
        } else {
          errors.push(`Hospitals: ${errorMessage(hospitalResult.reason)}`);
          setHospitals([]);
        }
        if (departmentResult.status === "fulfilled") {
          setDepartments(departmentResult.value.results);
        } else {
          errors.push(`Departments: ${errorMessage(departmentResult.reason)}`);
          setDepartments([]);
        }
        if (roomResult.status === "fulfilled") {
          setRooms(roomResult.value.results);
        } else {
          errors.push(`Rooms: ${errorMessage(roomResult.reason)}`);
          setRooms([]);
        }
        setLoadError(errors[0] ?? "");
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

  const patientById = useMemo(() => new Map(patients.map((patient) => [patient.id, patient])), [patients]);
  const activeAppointmentsByPatient = useMemo(() => {
    const counts = new Map<number, number>();
    appointments.filter(activeAppointment).forEach((appointment) => {
      counts.set(appointment.patient, (counts.get(appointment.patient) ?? 0) + 1);
    });
    return counts;
  }, [appointments]);
  const openTasksByPatient = useMemo(() => {
    const counts = new Map<number, number>();
    tasks.filter(openTask).forEach((task) => {
      if (task.patient) {
        counts.set(task.patient, (counts.get(task.patient) ?? 0) + 1);
      }
    });
    return counts;
  }, [tasks]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      const zone = record.patient_triage_status;
      const patient = patientById.get(record.patient);
      const text = [
        record.patient_name,
        patient?.medical_record_number,
        record.doctor_id,
        record.diagnosis,
        record.prescriptions,
        record.clinical_notes,
      ]
        .join(" ")
        .toLowerCase();
      return (zoneFilter === "ALL" || zone === zoneFilter) && (!normalizedQuery || text.includes(normalizedQuery));
    });
  }, [patientById, query, records, zoneFilter]);

  const redRecords = records.filter((record) => record.patient_triage_status === "RED").length;
  const yellowRecords = records.filter((record) => record.patient_triage_status === "YELLOW").length;
  const greenRecords = records.filter((record) => record.patient_triage_status === "GREEN").length;
  const needsReviewRecords = records.filter((record) => ["NEEDS_REVIEW", "CRITICAL"].includes(record.ai_review_status ?? "")).length;
  const clearRecords = records.filter((record) => record.ai_review_status === "CLEAR").length;
  const redPatients = patients.filter((patient) => patient.triage_status === "RED").length;
  const activeAppointments = appointments.filter(activeAppointment).length;
  const openTasks = tasks.filter(openTask).length;
  const waitingAdmissions = admissions.filter((admission) => ["REQUESTED", "WAITLISTED"].includes(admission.status)).length;
  const highRiskPerinatal = perinatalEntries.filter((entry) => ["HIGH", "CRITICAL"].includes(entry.risk_level)).length;
  const offlinePatronage = patronageVisits.filter((visit) => ["OFFLINE_QUEUED", "CONFLICT"].includes(visit.status)).length;
  const openReferrals = referrals.filter((referral) => !["COMPLETED", "CANCELLED"].includes(referral.status)).length;
  const pendingDiagnostics = diagnosticOrders.filter((order) => !["RESULTED", "CANCELLED"].includes(order.status)).length;
  const feedbackCount = feedbackSummary.reduce((total, item) => total + item.total, 0);
  const lowFeedbackTargets = feedbackSummary.filter((item) => (item.avg_rating ?? 5) < 3.5).length;
  const bedCapacity = rooms.reduce((total, room) => total + room.bed_count, 0);
  const totalPlatformEntries =
    patients.length +
    records.length +
    appointments.length +
    tasks.length +
    admissions.length +
    perinatalEntries.length +
    patronageVisits.length +
    referrals.length +
    diagnosticOrders.length +
    feedbackCount +
    hospitals.length +
    departments.length +
    rooms.length;
  const ledgerRows: PlatformLedgerRow[] = [
    {
      label: "Patients",
      count: patients.length,
      detail: `${redPatients} red zone patients`,
      latest: latestFrom(patients, (patient) => patient.updated_at, (patient) => patient.display_name),
      risk: redPatients ? "RED" : patients.some((patient) => patient.triage_status === "YELLOW") ? "YELLOW" : "GREEN",
    },
    {
      label: "Doctor records",
      count: records.length,
      detail: `${needsReviewRecords} AI review flags`,
      latest: latestFrom(records, (record) => record.created_at, (record) => record.patient_name),
      risk: needsReviewRecords ? "RED" : records.some((record) => record.ai_review_status === "PENDING") ? "YELLOW" : "GREEN",
    },
    {
      label: "Appointments",
      count: appointments.length,
      detail: `${activeAppointments} active appointments`,
      latest: latestFrom(appointments, (appointment) => appointment.scheduled_start, (appointment) => appointment.patient_name),
      risk: appointments.some((appointment) => appointment.priority === "CRITICAL") ? "RED" : activeAppointments ? "YELLOW" : "GREEN",
    },
    {
      label: "Clinical tasks",
      count: tasks.length,
      detail: `${openTasks} open tasks`,
      latest: latestFrom(tasks, (task) => task.updated_at, (task) => task.title),
      risk: tasks.some((task) => openTask(task) && task.priority === "CRITICAL") ? "RED" : openTasks ? "YELLOW" : "GREEN",
    },
    {
      label: "Admissions",
      count: admissions.length,
      detail: `${waitingAdmissions} waiting or requested`,
      latest: latestFrom(admissions, (admission) => admission.requested_at, (admission) => admission.patient_name),
      risk: admissions.some((admission) => admission.priority === "CRITICAL" && !["DISCHARGED", "CANCELLED"].includes(admission.status)) ? "RED" : waitingAdmissions ? "YELLOW" : "GREEN",
    },
    {
      label: "Perinatal registry",
      count: perinatalEntries.length,
      detail: `${highRiskPerinatal} high-risk pregnancies`,
      latest: latestFrom(perinatalEntries, (entry) => entry.updated_at, (entry) => entry.patient_name),
      risk: perinatalEntries.some((entry) => entry.risk_level === "CRITICAL") ? "RED" : highRiskPerinatal ? "YELLOW" : "GREEN",
    },
    {
      label: "Patronage",
      count: patronageVisits.length,
      detail: `${offlinePatronage} offline/conflict visits`,
      latest: latestFrom(patronageVisits, (visit) => visit.scheduled_for, (visit) => visit.patient_name),
      risk: patronageVisits.some((visit) => visit.status === "CONFLICT") ? "RED" : offlinePatronage ? "YELLOW" : "GREEN",
    },
    {
      label: "Referrals",
      count: referrals.length,
      detail: `${openReferrals} not completed`,
      latest: latestFrom(referrals, (referral) => referral.requested_at, (referral) => referral.patient_name),
      risk: referrals.some((referral) => referral.priority === "CRITICAL" && !["COMPLETED", "CANCELLED"].includes(referral.status)) ? "RED" : openReferrals ? "YELLOW" : "GREEN",
    },
    {
      label: "Diagnostics",
      count: diagnosticOrders.length,
      detail: `${pendingDiagnostics} awaiting result`,
      latest: latestFrom(diagnosticOrders, (order) => order.updated_at, (order) => order.name),
      risk: diagnosticOrders.some((order) => order.priority === "STAT" && order.status !== "RESULTED") ? "RED" : pendingDiagnostics ? "YELLOW" : "GREEN",
    },
    {
      label: "Feedback",
      count: feedbackCount,
      detail: `${lowFeedbackTargets} low-rated targets`,
      latest: feedbackSummary.length ? `${feedbackSummary.length} summarized targets` : "No data",
      risk: lowFeedbackTargets ? "YELLOW" : "GREEN",
    },
    {
      label: "Resources",
      count: hospitals.length + departments.length + rooms.length,
      detail: `${hospitals.length} hospitals · ${bedCapacity} beds`,
      latest: latestFrom(rooms, (room) => room.updated_at, (room) => `${room.department_name} ${room.room_number}`),
      risk: rooms.some((room) => !room.is_active) || hospitals.some((hospital) => !hospital.is_active) ? "YELLOW" : "GREEN",
    },
  ];

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-md border border-clinical-line bg-white px-4 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-clinical-ink">All platform records</h2>
          <p className="mt-1 text-sm text-clinical-slate">A real backend ledger for patients, clinical work, hospital flow, outreach, feedback, and resources.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-md border border-clinical-line px-3 py-2 text-sm text-clinical-slate">
          <Activity className="h-4 w-4 text-clinical-cyan" />
          {loading ? "Syncing" : `${totalPlatformEntries} platform entries`}
        </span>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Platform data</span>
            <FileText className="h-5 w-5 text-clinical-blue" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{totalPlatformEntries}</strong>
          <p className="mt-1 text-xs text-clinical-slate">{records.length} doctor records</p>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Patients</span>
            <HeartPulse className="h-5 w-5 text-clinical-red" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{patients.length}</strong>
          <p className="mt-1 text-xs text-clinical-slate">{redPatients} red zone</p>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Care operations</span>
            <CalendarDays className="h-5 w-5 text-clinical-cyan" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{activeAppointments + openTasks}</strong>
          <p className="mt-1 text-xs text-clinical-slate">{waitingAdmissions} admissions waiting</p>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">AI needs review</span>
            <AlertTriangle className="h-5 w-5 text-clinical-red" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{needsReviewRecords}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Outreach risk</span>
            <Stethoscope className="h-5 w-5 text-clinical-amber" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{highRiskPerinatal + offlinePatronage}</strong>
          <p className="mt-1 text-xs text-clinical-slate">{highRiskPerinatal} perinatal · {offlinePatronage} patronage</p>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Feedback/resources</span>
            <Building2 className="h-5 w-5 text-clinical-blue" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{feedbackCount + hospitals.length + rooms.length}</strong>
          <p className="mt-1 text-xs text-clinical-slate">{lowFeedbackTargets} low feedback targets</p>
        </div>
      </section>

      <section className="rounded-md border border-clinical-line bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
          <Route className="h-5 w-5 text-clinical-blue" />
          <h3 className="text-sm font-semibold text-clinical-ink">Platform module ledger</h3>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {ledgerRows.map((row) => (
            <article key={row.label} className="rounded-md border border-clinical-line p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-clinical-ink">{row.label}</h4>
                  <p className="mt-1 text-xs text-clinical-slate">{row.detail}</p>
                </div>
                <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${ledgerRiskClasses(row.risk)}`}>{row.risk}</span>
              </div>
              <strong className="mt-3 block text-2xl text-clinical-ink">{row.count}</strong>
              <p className="mt-1 line-clamp-2 text-xs text-clinical-slate">{row.latest}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-clinical-line bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-clinical-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-clinical-ink">Doctor-entered clinical records</h3>
            <p className="mt-1 text-xs text-clinical-slate">
              {redRecords} red · {yellowRecords} yellow · {greenRecords} green · {clearRecords} AI clear
            </p>
          </div>
          <div className="relative lg:w-96">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-clinical-slate" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-full rounded-md border border-clinical-line bg-white pl-9 pr-3 text-sm text-clinical-ink outline-none focus:border-clinical-blue"
              placeholder="Search patient, doctor, diagnosis"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["ALL", "RED", "YELLOW", "GREEN"] as ZoneFilter[]).map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => setZoneFilter(zone)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                  zoneFilter === zone ? "border-clinical-blue bg-blue-50 text-clinical-blue" : "border-clinical-line text-clinical-slate hover:border-clinical-blue"
                }`}
              >
                {zone}
              </button>
            ))}
          </div>
        </div>

        {loadError ? <div className="border-b border-clinical-line px-4 py-2 text-xs text-clinical-red">{loadError}</div> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-clinical-line text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
              <tr>
                <th className="px-4 py-3 font-semibold">Patient</th>
                <th className="px-4 py-3 font-semibold">Doctor</th>
                <th className="px-4 py-3 font-semibold">Diagnosis</th>
                <th className="px-4 py-3 font-semibold">Prescriptions</th>
                <th className="px-4 py-3 font-semibold">AI</th>
                <th className="px-4 py-3 font-semibold">Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clinical-line bg-white">
              {filteredRecords.map((record) => {
                const patient = patientById.get(record.patient);
                return (
                  <tr key={record.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${recordZoneClasses(record.patient_triage_status)}`}>
                          {record.patient_triage_status}
                        </span>
                        <Link href={`/doctor/patient/${record.patient}`} className="font-semibold text-clinical-ink hover:text-clinical-blue">
                          {record.patient_name}
                        </Link>
                      </div>
                      <p className="mt-1 text-xs text-clinical-slate">
                        {patient?.medical_record_number || record.public_id} · {formatDateTime(record.created_at)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-clinical-slate">{record.doctor_id || "Unknown doctor"}</td>
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="line-clamp-3 text-clinical-ink">{record.diagnosis || "No diagnosis entered"}</p>
                      <p className="mt-1 text-xs text-clinical-slate">{record.record_type}</p>
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-clinical-slate">
                      <p className="line-clamp-3">{record.prescriptions || "No prescription entered"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${aiReviewClasses(record.ai_review_status)}`}>
                        {record.ai_review_status || "PENDING"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-clinical-slate">
                      <p className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {activeAppointmentsByPatient.get(record.patient) ?? 0} active appointments
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1">
                        <ListChecks className="h-3.5 w-3.5" />
                        {openTasksByPatient.get(record.patient) ?? 0} open tasks
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredRecords.length ? <div className="px-4 py-8 text-sm text-clinical-slate">No records match this view.</div> : null}
        </div>
      </section>
    </div>
  );
}
