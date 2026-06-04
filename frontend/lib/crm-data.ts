import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Baby,
  Bed,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  Hospital,
  LayoutDashboard,
  ListChecks,
  NotebookTabs,
  Pill,
  Route,
  Settings,
  Stethoscope,
  UsersRound,
} from "lucide-react";

export type CrmModuleKey =
  | "appointments"
  | "active-appointments"
  | "completed-appointments"
  | "cancelled-appointments"
  | "appointment-calendar"
  | "analytics"
  | "ai-analyzes"
  | "assigned-population"
  | "hospital"
  | "documents"
  | "patients"
  | "my-patients"
  | "prescriptions"
  | "treatment-course"
  | "pregnant-registry"
  | "patronage"
  | "planning"
  | "scheduled"
  | "reception"
  | "admission"
  | "settings";

export interface MenuItem {
  key: CrmModuleKey;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export interface RegistryPatient {
  id: number;
  medicalCard: string;
  fullName: string;
  territory: string;
  age: number;
  healthGroup: "I" | "II" | "III" | "Yo'q";
  cardiovascularRisk: string;
  diabetesRisk: string;
  oncologySurvey: "O'tilgan" | "O'tilmagan";
  dList: string;
  disability: string;
  clinicalDiagnosis: string;
  phone: string;
  address: string;
  lastVisit: string;
  nextVisit: string;
  assignedDoctor: string;
  patronageNurse: string;
  riskZone: "RED" | "YELLOW" | "GREEN";
  tags: string[];
}

export interface Appointment {
  id: number;
  patientId: number;
  date: string;
  time: string;
  patient: string;
  department: string;
  doctor: string;
  status: "Aktiv" | "Bajarildi" | "Bekor qilingan";
  priority: "Yuqori" | "O'rta" | "Past";
  reason: string;
  room: string;
  notes: string;
}

export interface PatientEncounter {
  id: number;
  patientId: number;
  date: string;
  provider: string;
  type: "Ambulator" | "Patronaj" | "Perinatal" | "Shoshilinch";
  status: "Ochiq" | "Imzolangan" | "Bekor qilingan";
  complaint: string;
  assessment: string;
  plan: string;
}

export interface PatientVital {
  id: number;
  patientId: number;
  measuredAt: string;
  bp: string;
  pulse: number;
  spo2: number;
  temperature: number;
  glucose: string;
  weight: string;
  note: string;
}

export interface PatientAllergy {
  id: number;
  patientId: number;
  allergen: string;
  reaction: string;
  severity: "Past" | "O'rta" | "Yuqori" | "Hayot uchun xavfli";
  status: "Faol" | "Faol emas";
  onset: string;
}

export interface PatientDocument {
  id: number;
  patientId: number;
  title: string;
  type: string;
  owner: string;
  updatedAt: string;
  status: string;
}

export interface CareTeamMember {
  id: number;
  patientId: number;
  name: string;
  role: string;
  department: string;
  phone: string;
  primary: boolean;
}

export interface ClinicalTaskRow {
  id: number;
  patientId: number;
  title: string;
  owner: string;
  type: string;
  dueAt: string;
  priority: "Yuqori" | "O'rta" | "Past";
  status: "Ochiq" | "Jarayonda" | "Bajarildi" | "Bekor";
}

export interface ReferralRow {
  id: number;
  patientId: number;
  target: string;
  type: string;
  requestedAt: string;
  priority: "Yuqori" | "O'rta" | "Past";
  status: "So'rov" | "Qabul qilindi" | "Rejalashtirildi" | "Bajarildi" | "Bekor";
  reason: string;
}

export interface DiagnosticOrderRow {
  id: number;
  patientId: number;
  name: string;
  type: "Laboratoriya" | "Tasvirlash" | "EKG" | "Protsedura";
  orderedAt: string;
  priority: "Shoshilinch" | "Yuqori" | "O'rta" | "Past";
  status: "Buyurildi" | "Olingan" | "Jarayonda" | "Natija tayyor" | "Bekor";
  result: string;
}

export interface PatientProfile {
  patient: RegistryPatient;
  appointments: Appointment[];
  encounters: PatientEncounter[];
  vitals: PatientVital[];
  allergies: PatientAllergy[];
  prescriptions: PrescriptionRow[];
  documents: PatientDocument[];
  careTeam: CareTeamMember[];
  tasks: ClinicalTaskRow[];
  referrals: ReferralRow[];
  diagnosticOrders: DiagnosticOrderRow[];
  admissions: AdmissionRow[];
  perinatalEntries: PregnantRegistryRow[];
  patronageVisits: PatronageRow[];
  duplicateCandidates: DuplicateCandidateRow[];
}

export interface HospitalBedRow {
  unit: string;
  beds: number;
  occupied: number;
  waiting: number;
  critical: number;
}

export interface AdmissionRow {
  id: number;
  patientId: number;
  patient: string;
  department: string;
  room: string;
  triage: "Qizil" | "Sariq" | "Yashil";
  requestedAt: string;
  status: "So'rov" | "Navbat" | "Yotqizildi" | "Ko'chirildi" | "Chiqarildi" | "Bekor";
  priority: "Kritik" | "Shoshilinch" | "Rejali";
  reason: string;
  assignedTo: string;
}

export interface DocumentRow {
  title: string;
  patient: string;
  type: string;
  owner: string;
  updatedAt: string;
  status: string;
}

export interface PrescriptionRow {
  patient: string;
  medication: string;
  dose: string;
  duration: string;
  status: string;
  safety: string;
}

export interface TreatmentCourseRow {
  patient: string;
  diagnosis: string;
  startedAt: string;
  progress: number;
  nextAction: string;
}

export interface PregnantRegistryRow {
  id: number;
  patientId: number;
  patient: string;
  week: number;
  day: number;
  riskZone: "Qizil" | "Sariq" | "Yashil";
  bp: string;
  gravida: number;
  para: number;
  edd: string;
  lastScreening: string;
  nextVisit: string;
  status: "Faol" | "Kuzatuv" | "Yotqizildi" | "Tug'ruq" | "Yopildi";
  provider: string;
  riskFactors: string[];
  fetalNote: string;
}

export interface PatronageRow {
  id: number;
  patientId: number;
  patient: string;
  territory: string;
  nurse: string;
  visitType: "Rejali" | "Yuqori xavf" | "Perinatal" | "Chiqarilgandan keyin" | "Surunkali";
  visitDate: string;
  priority: "Yuqori" | "O'rta" | "Past";
  sync: "Serverda" | "Navbatda" | "Konflikt" | "Qayta ko'rish";
  status: "Rejada" | "Offline navbat" | "Sinxronlandi" | "Konflikt" | "Bajarildi" | "Bekor";
  offlineId: string;
  lastSync: string;
  serverVersion: number;
  notes: string;
}

export interface DuplicateCandidateRow {
  id: number;
  primaryPatientId: number;
  duplicatePatientId: number;
  primaryPatient: string;
  duplicatePatient: string;
  score: number;
  reasons: string[];
  status: "Ko'rib chiqiladi" | "Tasdiqlandi" | "Rad etildi" | "Birlashtirildi";
  detectedAt: string;
}

export interface PlanningRow {
  title: string;
  owner: string;
  date: string;
  department: string;
  status: string;
}

export const menuGroups: MenuGroup[] = [
  {
    label: "Qabullar",
    items: [
      { key: "appointments", label: "Qabullar", href: "/doctor/appointments", icon: CalendarDays, badge: "24" },
      { key: "active-appointments", label: "Aktiv", href: "/doctor/active-appointments", icon: Activity, badge: "8" },
      { key: "completed-appointments", label: "Bajarildi", href: "/doctor/completed-appointments", icon: ListChecks },
      { key: "cancelled-appointments", label: "Bekor qilingan", href: "/doctor/cancelled-appointments", icon: ClipboardList },
      { key: "appointment-calendar", label: "Qabullar taqvimi", href: "/doctor/appointment-calendar", icon: CalendarDays },
      { key: "analytics", label: "Tahlil", href: "/doctor/analytics", icon: LayoutDashboard },
    ],
  },
  {
    label: "Aholi va bemorlar",
    items: [
      { key: "assigned-population", label: "Biriktirilgan aholi", href: "/doctor", icon: UsersRound, badge: "12" },
      { key: "patients", label: "Bemorlar", href: "/doctor/patients", icon: Stethoscope },
      { key: "my-patients", label: "Mening bemorlarim", href: "/doctor/my-patients", icon: HeartPulse },
      { key: "pregnant-registry", label: "Homiladorlar", href: "/doctor/pregnant-registry", icon: Baby, badge: "6" },
      { key: "patronage", label: "Patronaj", href: "/doctor/patronage", icon: Route },
    ],
  },
  {
    label: "Kasalxona",
    items: [
      { key: "hospital", label: "Kasalxona", href: "/doctor/hospital", icon: Hospital },
      { key: "reception", label: "Qabulxona bo'limi", href: "/doctor/reception", icon: Home, badge: "5" },
      { key: "admission", label: "Shifoxonaga yotqizish", href: "/doctor/admission", icon: Bed, badge: "3" },
    ],
  },
  {
    label: "Davolash",
    items: [
      { key: "documents", label: "Hujjatlar", href: "/doctor/documents", icon: FileText },
      { key: "prescriptions", label: "Retseptlar", href: "/doctor/prescriptions", icon: Pill },
      { key: "treatment-course", label: "Davolash kursi", href: "/doctor/treatment-course", icon: NotebookTabs },
      { key: "planning", label: "Rejalashtirish", href: "/doctor/planning", icon: CalendarDays },
      { key: "scheduled", label: "Rejalashtirilgan", href: "/doctor/scheduled", icon: ListChecks },
    ],
  },
  {
    label: "Tizim",
    items: [{ key: "settings", label: "Sozlamalar", href: "/doctor/settings", icon: Settings }],
  },
];

export const registryPatients: RegistryPatient[] = [
  {
    id: 1,
    medicalCard: "AT-000001",
    fullName: "MANSUROV ABDULLO MA'RUFOVICH",
    territory: "2- тиббий бригада",
    age: 59,
    healthGroup: "II",
    cardiovascularRisk: "7 %",
    diabetesRisk: "5",
    oncologySurvey: "O'tilmagan",
    dList: "Yo'q",
    disability: "Yo'q",
    clinicalDiagnosis: "I10",
    phone: "+998 90 144-02-11",
    address: "Qo'nji MFY, 4-ko'cha",
    lastVisit: "2026-05-29",
    nextVisit: "2026-06-06",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Karimova Mahfuza",
    riskZone: "YELLOW",
    tags: ["YQTK", "Gipertoniya"],
  },
  {
    id: 2,
    medicalCard: "AT-000002",
    fullName: "НАЗИРОВА ЗАЙНАБ ҒАЙБУЛЛАЕВНА",
    territory: "3- тиббий бригада",
    age: 14,
    healthGroup: "I",
    cardiovascularRisk: "...",
    diabetesRisk: "...",
    oncologySurvey: "O'tilmagan",
    dList: "Yo'q",
    disability: "Yo'q",
    clinicalDiagnosis: "Sog'lom kuzatuv",
    phone: "+998 93 602-12-60",
    address: "Qo'nji MFY, Gulzor ko'chasi",
    lastVisit: "2026-05-12",
    nextVisit: "2026-06-11",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Ergasheva Dilnoza",
    riskZone: "GREEN",
    tags: ["Profilaktika"],
  },
  {
    id: 3,
    medicalCard: "AT-000003",
    fullName: "Буваев Давлат Мухсинович",
    territory: "1- тиббий бригада",
    age: 75,
    healthGroup: "Yo'q",
    cardiovascularRisk: "...",
    diabetesRisk: "...",
    oncologySurvey: "O'tilmagan",
    dList: "Yo'q",
    disability: "Yo'q",
    clinicalDiagnosis: "I25.9",
    phone: "+998 91 532-04-13",
    address: "Qo'nji MFY, Mustaqillik ko'chasi",
    lastVisit: "2026-05-26",
    nextVisit: "2026-06-04",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Olimova Nargiza",
    riskZone: "RED",
    tags: ["75+", "Kardiologiya"],
  },
  {
    id: 4,
    medicalCard: "AT-000004",
    fullName: "TOLANBOYEVA XURSHIDAXON OYBEKOVNA",
    territory: "5-тиббий бригада",
    age: 40,
    healthGroup: "II",
    cardiovascularRisk: "1 %",
    diabetesRisk: "9",
    oncologySurvey: "O'tilmagan",
    dList: "Yo'q",
    disability: "Yo'q",
    clinicalDiagnosis: "E66.9",
    phone: "+998 97 430-10-01",
    address: "Qo'nji MFY, Yangi hayot",
    lastVisit: "2026-05-18",
    nextVisit: "2026-06-17",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Rustamova Mavluda",
    riskZone: "YELLOW",
    tags: ["Metabolik xavf"],
  },
  {
    id: 5,
    medicalCard: "AT-000005",
    fullName: "MAVLYANOVA DILNOZA ISMAILOVNA",
    territory: "2- тиббий бригада",
    age: 37,
    healthGroup: "III",
    cardiovascularRisk: "...",
    diabetesRisk: "...",
    oncologySurvey: "O'tilmagan",
    dList: "N11.9",
    disability: "Yo'q",
    clinicalDiagnosis: "N11.9",
    phone: "+998 94 900-15-35",
    address: "Qo'nji MFY, Bog'bonlar",
    lastVisit: "2026-05-31",
    nextVisit: "2026-06-07",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Karimova Mahfuza",
    riskZone: "YELLOW",
    tags: ["D-ro'yxat"],
  },
  {
    id: 6,
    medicalCard: "AT-000006",
    fullName: "NURALIYEV MUHAMMAD-UMAR-MIRZO NODIRBEK O'G'LI",
    territory: "6-тиббий бригада",
    age: 18,
    healthGroup: "III",
    cardiovascularRisk: "...",
    diabetesRisk: "0-1 \"Yo'q\"",
    oncologySurvey: "O'tilmagan",
    dList: "D50.0, H31.1",
    disability: "II daraja",
    clinicalDiagnosis: "D50.0, H31.1",
    phone: "+998 88 301-22-14",
    address: "Qo'nji MFY, Nurafshon",
    lastVisit: "2026-05-21",
    nextVisit: "2026-06-05",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Ismoilova Shohista",
    riskZone: "RED",
    tags: ["Nogironlik", "Anemiya"],
  },
  {
    id: 7,
    medicalCard: "AT-000007",
    fullName: "РАЙИМОВА ШОХСАНАМ ИЛХОМЖОН ҚИЗИ",
    territory: "6-тиббий бригада",
    age: 29,
    healthGroup: "II",
    cardiovascularRisk: "...",
    diabetesRisk: "...",
    oncologySurvey: "O'tilmagan",
    dList: "Yo'q",
    disability: "Yo'q",
    clinicalDiagnosis: "Z34.9",
    phone: "+998 99 403-40-70",
    address: "Qo'nji MFY, Navbahor",
    lastVisit: "2026-05-27",
    nextVisit: "2026-06-03",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Ismoilova Shohista",
    riskZone: "YELLOW",
    tags: ["Homilador"],
  },
  {
    id: 8,
    medicalCard: "AT-000008",
    fullName: "SIROJIDDINOVA DILBAR DADAJONOVNA",
    territory: "3- тиббий бригада",
    age: 68,
    healthGroup: "III",
    cardiovascularRisk: "13 %",
    diabetesRisk: "20",
    oncologySurvey: "O'tilmagan",
    dList: "E66.9, I10",
    disability: "Yo'q",
    clinicalDiagnosis: "E66.9, I10",
    phone: "+998 91 760-15-22",
    address: "Qo'nji MFY, Yangiobod",
    lastVisit: "2026-05-30",
    nextVisit: "2026-06-04",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Ergasheva Dilnoza",
    riskZone: "RED",
    tags: ["Diabet xavfi", "YQTK"],
  },
  {
    id: 9,
    medicalCard: "AT-000009",
    fullName: "СИРОЖИДДИНОВ ТОЛИБЖОН ҚОДИРОВИЧ",
    territory: "3- тиббий бригада",
    age: 67,
    healthGroup: "II",
    cardiovascularRisk: "18 %",
    diabetesRisk: "10",
    oncologySurvey: "O'tilmagan",
    dList: "N11.1",
    disability: "Yo'q",
    clinicalDiagnosis: "N11.1",
    phone: "+998 91 770-42-84",
    address: "Qo'nji MFY, Yangiobod",
    lastVisit: "2026-05-24",
    nextVisit: "2026-06-08",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Ergasheva Dilnoza",
    riskZone: "RED",
    tags: ["YQTK yuqori", "Buyrak"],
  },
  {
    id: 10,
    medicalCard: "AT-000010",
    fullName: "KARIMOVA MAVLUDAXON GULAMNABIYEVNA",
    territory: "1- тиббий бригада",
    age: 65,
    healthGroup: "III",
    cardiovascularRisk: "9 %",
    diabetesRisk: "9",
    oncologySurvey: "O'tilmagan",
    dList: "D50.9, I10",
    disability: "Yo'q",
    clinicalDiagnosis: "D50.9, I10",
    phone: "+998 90 120-88-34",
    address: "Qo'nji MFY, Bobur",
    lastVisit: "2026-05-19",
    nextVisit: "2026-06-10",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Olimova Nargiza",
    riskZone: "YELLOW",
    tags: ["Anemiya", "Gipertoniya"],
  },
  {
    id: 11,
    medicalCard: "AT-000011",
    fullName: "ABDUXALILOVA GULNORA MAXAMMADJANOVNA",
    territory: "1- тиббий бригада",
    age: 52,
    healthGroup: "II",
    cardiovascularRisk: "2 %",
    diabetesRisk: "9",
    oncologySurvey: "O'tilmagan",
    dList: "D50",
    disability: "Yo'q",
    clinicalDiagnosis: "D50",
    phone: "+998 93 550-91-51",
    address: "Qo'nji MFY, Bobur",
    lastVisit: "2026-05-16",
    nextVisit: "2026-06-13",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Olimova Nargiza",
    riskZone: "GREEN",
    tags: ["Profilaktik nazorat"],
  },
  {
    id: 12,
    medicalCard: "AT-000012",
    fullName: "AXUNOVA SAYYORAXON ABDUXOLIQ QIZI",
    territory: "5-тиббий бригада",
    age: 31,
    healthGroup: "III",
    cardiovascularRisk: "...",
    diabetesRisk: "...",
    oncologySurvey: "O'tilmagan",
    dList: "D50.9",
    disability: "Yo'q",
    clinicalDiagnosis: "D50.9",
    phone: "+998 95 400-55-01",
    address: "Qo'nji MFY, Yangi hayot",
    lastVisit: "2026-05-23",
    nextVisit: "2026-06-12",
    assignedDoctor: "Azimov Xoji Akbar",
    patronageNurse: "Rustamova Mavluda",
    riskZone: "YELLOW",
    tags: ["Anemiya", "D-ro'yxat"],
  },
];

export const appointments: Appointment[] = [
  {
    id: 1,
    patientId: 1,
    date: "2026-06-03",
    time: "08:30",
    patient: "MANSUROV ABDULLO MA'RUFOVICH",
    department: "Oilaviy shifokor",
    doctor: "Azimov Xoji Akbar",
    status: "Aktiv",
    priority: "O'rta",
    reason: "Qon bosimi nazorati",
    room: "101",
    notes: "YQTK xavfi bo'yicha qayta ko'rik.",
  },
  {
    id: 2,
    patientId: 7,
    date: "2026-06-03",
    time: "09:00",
    patient: "РАЙИМОВА ШОХСАНАМ ИЛХОМЖОН ҚИЗИ",
    department: "Homiladorlar",
    doctor: "Azimov Xoji Akbar",
    status: "Aktiv",
    priority: "Yuqori",
    reason: "28-hafta skriningi",
    room: "Perinatal-2",
    notes: "BP va homila harakati qayd etilsin.",
  },
  {
    id: 3,
    patientId: 8,
    date: "2026-06-03",
    time: "09:40",
    patient: "SIROJIDDINOVA DILBAR DADAJONOVNA",
    department: "Terapiya",
    doctor: "Azimov Xoji Akbar",
    status: "Bajarildi",
    priority: "Yuqori",
    reason: "Diabet xavfi",
    room: "104",
    notes: "Glukoza nazorati va ovqatlanish rejasi yangilandi.",
  },
  {
    id: 4,
    patientId: 6,
    date: "2026-06-03",
    time: "10:20",
    patient: "NURALIYEV MUHAMMAD-UMAR-MIRZO NODIRBEK O'G'LI",
    department: "Patronaj",
    doctor: "Azimov Xoji Akbar",
    status: "Aktiv",
    priority: "Yuqori",
    reason: "Anemiya nazorati",
    room: "Uy tashrifi",
    notes: "Nogironlik hujjati va gemoglobin javobi tekshirilsin.",
  },
  {
    id: 5,
    patientId: 12,
    date: "2026-06-03",
    time: "11:10",
    patient: "AXUNOVA SAYYORAXON ABDUXOLIQ QIZI",
    department: "Laboratoriya",
    doctor: "Azimov Xoji Akbar",
    status: "Bekor qilingan",
    priority: "Past",
    reason: "Qayta rejalashtirildi",
    room: "Lab-1",
    notes: "Tahlil sanasi bemor bilan kelishiladi.",
  },
];

export const patientEncounters: PatientEncounter[] = [
  {
    id: 1,
    patientId: 1,
    date: "2026-05-29",
    provider: "Azimov Xoji Akbar",
    type: "Ambulator",
    status: "Imzolangan",
    complaint: "Bosh og'rig'i, bosim ko'tarilishi.",
    assessment: "I10, YQTK xavfi o'rta. Davolashga rioya qilish qoniqarli.",
    plan: "Uyda BP kundaligi, 2026-06-06 qayta ko'rik.",
  },
  {
    id: 2,
    patientId: 3,
    date: "2026-05-26",
    provider: "Azimov Xoji Akbar",
    type: "Ambulator",
    status: "Imzolangan",
    complaint: "Ko'krak sohasida noqulaylik, tez charchash.",
    assessment: "I25.9, yoshga bog'liq yuqori xavf.",
    plan: "Kardiolog konsultatsiyasi va EKG nazorati.",
  },
  {
    id: 3,
    patientId: 6,
    date: "2026-05-21",
    provider: "Azimov Xoji Akbar",
    type: "Patronaj",
    status: "Ochiq",
    complaint: "Holizlik, ko'rish bo'yicha shikoyat.",
    assessment: "D50.0, H31.1. Dinamik kuzatuv zarur.",
    plan: "Gemoglobin nazorati, patronaj tashrifi 2026-06-05.",
  },
  {
    id: 4,
    patientId: 7,
    date: "2026-05-27",
    provider: "Azimov Xoji Akbar",
    type: "Perinatal",
    status: "Imzolangan",
    complaint: "28-hafta reja bo'yicha ko'rik.",
    assessment: "Z34.9, sariq xavf zonasi.",
    plan: "BP nazorati, UTT yo'llanmasi, perinatal skrining.",
  },
  {
    id: 5,
    patientId: 8,
    date: "2026-05-30",
    provider: "Azimov Xoji Akbar",
    type: "Ambulator",
    status: "Imzolangan",
    complaint: "Qandli diabet xavfi, vazn ortishi.",
    assessment: "E66.9, I10. YQTK va diabet xavfi yuqori.",
    plan: "Metformin xavfsizligi tekshirildi, ovqatlanish rejasi, glukoza monitoringi.",
  },
];

export const patientVitals: PatientVital[] = [
  { id: 1, patientId: 1, measuredAt: "2026-06-03 08:35", bp: "146/92", pulse: 82, spo2: 97, temperature: 36.7, glucose: "5.4", weight: "84.2", note: "Qabul oldidan o'lchandi." },
  { id: 2, patientId: 1, measuredAt: "2026-05-29 10:20", bp: "152/96", pulse: 88, spo2: 96, temperature: 36.6, glucose: "5.8", weight: "84.6", note: "Uy BP kundaligi tavsiya qilindi." },
  { id: 3, patientId: 3, measuredAt: "2026-05-26 09:20", bp: "158/94", pulse: 96, spo2: 94, temperature: 36.8, glucose: "6.1", weight: "78.0", note: "EKG yo'llanmasi berildi." },
  { id: 4, patientId: 6, measuredAt: "2026-05-21 14:10", bp: "110/70", pulse: 92, spo2: 98, temperature: 36.5, glucose: "4.9", weight: "62.4", note: "Gemoglobin javobi kutilmoqda." },
  { id: 5, patientId: 7, measuredAt: "2026-06-03 09:05", bp: "132/86", pulse: 84, spo2: 98, temperature: 36.6, glucose: "4.8", weight: "68.1", note: "Perinatal skrining oldidan." },
  { id: 6, patientId: 8, measuredAt: "2026-06-03 09:45", bp: "154/94", pulse: 90, spo2: 96, temperature: 36.7, glucose: "8.8", weight: "91.3", note: "Diabet xavfi yuqori." },
  { id: 7, patientId: 12, measuredAt: "2026-05-23 11:30", bp: "116/74", pulse: 76, spo2: 99, temperature: 36.5, glucose: "4.6", weight: "57.9", note: "Anemiya bo'yicha kuzatuv." },
];

export const patientAllergies: PatientAllergy[] = [
  { id: 1, patientId: 1, allergen: "Penitsillin", reaction: "Toshma", severity: "O'rta", status: "Faol", onset: "2021" },
  { id: 2, patientId: 6, allergen: "Temir preparati: in'eksiya shakli", reaction: "Ko'ngil aynishi", severity: "Past", status: "Faol", onset: "2024" },
  { id: 3, patientId: 7, allergen: "Yod kontrasti", reaction: "Qichishish", severity: "Yuqori", status: "Faol", onset: "2023" },
  { id: 4, patientId: 8, allergen: "Sulfanilamidlar", reaction: "Shish", severity: "Hayot uchun xavfli", status: "Faol", onset: "2020" },
];

export const patientDocuments: PatientDocument[] = [
  { id: 1, patientId: 1, title: "Ambulator karta", type: "Karta", owner: "Azimov Xoji Akbar", updatedAt: "2026-06-03", status: "Imzolangan" },
  { id: 2, patientId: 7, title: "Homiladorlik kuzatuv varaqasi", type: "Perinatal", owner: "Azimov Xoji Akbar", updatedAt: "2026-06-03", status: "Ko'rib chiqiladi" },
  { id: 3, patientId: 6, title: "Nogironlik xulosasi", type: "Xulosa", owner: "Komissiya", updatedAt: "2026-06-02", status: "Arxivda" },
  { id: 4, patientId: 8, title: "Diabet xavfi nazorat varaqasi", type: "Nazorat", owner: "Azimov Xoji Akbar", updatedAt: "2026-06-03", status: "Faol" },
];

export const hospitalBeds: HospitalBedRow[] = [
  { unit: "Qabulxona bo'limi", beds: 18, occupied: 12, waiting: 5, critical: 1 },
  { unit: "Terapiya", beds: 42, occupied: 34, waiting: 3, critical: 2 },
  { unit: "Perinatal", beds: 28, occupied: 21, waiting: 4, critical: 3 },
  { unit: "Kardiologiya", beds: 20, occupied: 17, waiting: 2, critical: 2 },
];

export const admissions: AdmissionRow[] = [
  {
    id: 1,
    patientId: 3,
    patient: "Буваев Давлат Мухсинович",
    department: "Kardiologiya",
    room: "K-204",
    triage: "Qizil",
    requestedAt: "08:42",
    status: "Navbat",
    priority: "Shoshilinch",
    reason: "I25.9, ko'krak sohasida og'riq",
    assignedTo: "Azimov Xoji Akbar",
  },
  {
    id: 2,
    patientId: 7,
    patient: "РАЙИМОВА ШОХСАНАМ ИЛХОМЖОН ҚИЗИ",
    department: "Perinatal",
    room: "P-12",
    triage: "Sariq",
    requestedAt: "09:05",
    status: "Yotqizildi",
    priority: "Rejali",
    reason: "28-hafta perinatal kuzatuv",
    assignedTo: "Perinatal navbatchi",
  },
  {
    id: 3,
    patientId: 8,
    patient: "SIROJIDDINOVA DILBAR DADAJONOVNA",
    department: "Terapiya",
    room: "T-118",
    triage: "Qizil",
    requestedAt: "10:10",
    status: "Yotqizildi",
    priority: "Shoshilinch",
    reason: "E66.9, I10, glukoza yuqori",
    assignedTo: "Terapiya shifokori",
  },
  {
    id: 4,
    patientId: 6,
    patient: "NURALIYEV MUHAMMAD-UMAR-MIRZO NODIRBEK O'G'LI",
    department: "Terapiya",
    room: "T-121",
    triage: "Qizil",
    requestedAt: "11:25",
    status: "So'rov",
    priority: "Kritik",
    reason: "D50.0, II daraja nogironlik, holsizlik",
    assignedTo: "Navbatchi shifokor",
  },
];

export const careTeamMembers: CareTeamMember[] = [
  { id: 1, patientId: 1, name: "Azimov Xoji Akbar", role: "Birlamchi shifokor", department: "Oilaviy shifokor", phone: "+998 71 202-50-00", primary: true },
  { id: 2, patientId: 1, name: "Karimova Mahfuza", role: "Patronaj hamshira", department: "2- тиббий бригада", phone: "+998 90 221-14-19", primary: false },
  { id: 3, patientId: 3, name: "Azimov Xoji Akbar", role: "Birlamchi shifokor", department: "Oilaviy shifokor", phone: "+998 71 202-50-00", primary: true },
  { id: 4, patientId: 3, name: "Kardiologiya navbatchisi", role: "Mutaxassis", department: "Kardiologiya", phone: "+998 71 202-50-21", primary: false },
  { id: 5, patientId: 6, name: "Ismoilova Shohista", role: "Patronaj hamshira", department: "6-тиббий бригада", phone: "+998 99 122-12-45", primary: true },
  { id: 6, patientId: 7, name: "Perinatal navbatchi", role: "Mutaxassis", department: "Perinatal", phone: "+998 71 202-50-31", primary: true },
  { id: 7, patientId: 8, name: "Terapiya shifokori", role: "Mutaxassis", department: "Terapiya", phone: "+998 71 202-50-41", primary: true },
];

export const clinicalTasks: ClinicalTaskRow[] = [
  { id: 1, patientId: 1, title: "Uy BP kundaligini tekshirish", owner: "Karimova Mahfuza", type: "Kuzatuv", dueAt: "2026-06-06 09:00", priority: "O'rta", status: "Ochiq" },
  { id: 2, patientId: 3, title: "Kardiolog EKG xulosasini biriktirish", owner: "Kardiologiya navbatchisi", type: "Hujjat", dueAt: "2026-06-04 15:00", priority: "Yuqori", status: "Jarayonda" },
  { id: 3, patientId: 6, title: "Gemoglobin natijasini ko'rib chiqish", owner: "Azimov Xoji Akbar", type: "Tahlil", dueAt: "2026-06-05 12:00", priority: "Yuqori", status: "Ochiq" },
  { id: 4, patientId: 7, title: "Perinatal skrining kartasini yakunlash", owner: "Perinatal navbatchi", type: "Perinatal", dueAt: "2026-06-03 16:00", priority: "O'rta", status: "Jarayonda" },
  { id: 5, patientId: 8, title: "Glukoza monitoring rejasini tasdiqlash", owner: "Terapiya shifokori", type: "Davolash rejasi", dueAt: "2026-06-03 14:00", priority: "Yuqori", status: "Ochiq" },
];

export const referrals: ReferralRow[] = [
  { id: 1, patientId: 3, target: "Kardiologiya", type: "Mutaxassis", requestedAt: "2026-06-03 08:50", priority: "Yuqori", status: "Qabul qilindi", reason: "I25.9 bo'yicha kardiolog ko'rigi" },
  { id: 2, patientId: 6, target: "Gematologiya", type: "Mutaxassis", requestedAt: "2026-06-03 10:45", priority: "Yuqori", status: "So'rov", reason: "D50.0 anemiya, nogironlik fonida" },
  { id: 3, patientId: 7, target: "Perinatal UTT", type: "Tasvirlash", requestedAt: "2026-06-03 09:15", priority: "O'rta", status: "Rejalashtirildi", reason: "28-hafta skriningi" },
  { id: 4, patientId: 8, target: "Endokrinologiya", type: "Mutaxassis", requestedAt: "2026-06-03 10:05", priority: "Yuqori", status: "So'rov", reason: "Diabet xavfi 20" },
];

export const diagnosticOrders: DiagnosticOrderRow[] = [
  { id: 1, patientId: 1, name: "Lipid profili", type: "Laboratoriya", orderedAt: "2026-06-03 08:40", priority: "O'rta", status: "Buyurildi", result: "Kutilmoqda" },
  { id: 2, patientId: 3, name: "EKG", type: "EKG", orderedAt: "2026-06-03 08:52", priority: "Yuqori", status: "Jarayonda", result: "Navbatchi ko'rmoqda" },
  { id: 3, patientId: 6, name: "Umumiy qon tahlili", type: "Laboratoriya", orderedAt: "2026-06-03 10:50", priority: "Shoshilinch", status: "Olingan", result: "Laboratoriyada" },
  { id: 4, patientId: 7, name: "Perinatal UTT", type: "Tasvirlash", orderedAt: "2026-06-03 09:20", priority: "O'rta", status: "Buyurildi", result: "11:30 ga rejalashtirilgan" },
  { id: 5, patientId: 8, name: "Glukoza va HbA1c", type: "Laboratoriya", orderedAt: "2026-06-03 09:50", priority: "Yuqori", status: "Natija tayyor", result: "Glukoza 8.8, HbA1c 7.2" },
];

export const documents: DocumentRow[] = [
  { title: "Ambulator karta", patient: "MANSUROV ABDULLO MA'RUFOVICH", type: "Karta", owner: "Azimov Xoji Akbar", updatedAt: "2026-06-03", status: "Imzolangan" },
  { title: "Homiladorlik kuzatuv varaqasi", patient: "РАЙИМОВА ШОХСАНАМ ИЛХОМЖОН ҚИЗИ", type: "Perinatal", owner: "Azimov Xoji Akbar", updatedAt: "2026-06-03", status: "Ko'rib chiqiladi" },
  { title: "Nogironlik xulosasi", patient: "NURALIYEV MUHAMMAD-UMAR-MIRZO NODIRBEK O'G'LI", type: "Xulosa", owner: "Komissiya", updatedAt: "2026-06-02", status: "Arxivda" },
];

export const prescriptions: PrescriptionRow[] = [
  { patient: "KARIMOVA MAVLUDAXON GULAMNABIYEVNA", medication: "Amlodipin", dose: "5 mg, kuniga 1 marta", duration: "30 kun", status: "Faol", safety: "Allergiya tekshirildi" },
  { patient: "AXUNOVA SAYYORAXON ABDUXOLIQ QIZI", medication: "Temir preparati", dose: "100 mg", duration: "60 kun", status: "Faol", safety: "D50.9 mos" },
  { patient: "SIROJIDDINOVA DILBAR DADAJONOVNA", medication: "Metformin", dose: "500 mg", duration: "90 kun", status: "Nazorat", safety: "Qand nazorati kerak" },
];

export const treatmentCourses: TreatmentCourseRow[] = [
  { patient: "SIROJIDDINOVA DILBAR DADAJONOVNA", diagnosis: "E66.9, I10", startedAt: "2026-05-10", progress: 68, nextAction: "Qand ko'rsatkichlarini qayta o'lchash" },
  { patient: "NURALIYEV MUHAMMAD-UMAR-MIRZO NODIRBEK O'G'LI", diagnosis: "D50.0, H31.1", startedAt: "2026-05-18", progress: 42, nextAction: "Gemoglobin nazorati" },
  { patient: "MAVLYANOVA DILNOZA ISMAILOVNA", diagnosis: "N11.9", startedAt: "2026-05-22", progress: 55, nextAction: "UZI yo'llanmasi" },
];

export const pregnantRegistry: PregnantRegistryRow[] = [
  {
    id: 1,
    patientId: 7,
    patient: "РАЙИМОВА ШОХСАНАМ ИЛХОМЖОН ҚИЗИ",
    week: 28,
    day: 2,
    riskZone: "Sariq",
    bp: "132/86",
    gravida: 1,
    para: 0,
    edd: "2026-08-24",
    lastScreening: "2026-05-27",
    nextVisit: "2026-06-03",
    status: "Kuzatuv",
    provider: "Perinatal navbatchi",
    riskFactors: ["BP nazorat", "Sariq zona"],
    fetalNote: "Homila harakati qoniqarli, UTT rejalashtirilgan.",
  },
  {
    id: 2,
    patientId: 5,
    patient: "MAVLYANOVA DILNOZA ISMAILOVNA",
    week: 18,
    day: 5,
    riskZone: "Sariq",
    bp: "128/82",
    gravida: 2,
    para: 1,
    edd: "2026-11-02",
    lastScreening: "2026-05-31",
    nextVisit: "2026-06-07",
    status: "Faol",
    provider: "Azimov Xoji Akbar",
    riskFactors: ["N11.9", "D-ro'yxat"],
    fetalNote: "Buyrak kasalligi fonida dinamik kuzatuv.",
  },
  {
    id: 3,
    patientId: 12,
    patient: "AXUNOVA SAYYORAXON ABDUXOLIQ QIZI",
    week: 12,
    day: 1,
    riskZone: "Yashil",
    bp: "116/74",
    gravida: 1,
    para: 0,
    edd: "2026-12-16",
    lastScreening: "2026-05-23",
    nextVisit: "2026-06-12",
    status: "Faol",
    provider: "Azimov Xoji Akbar",
    riskFactors: ["D50.9"],
    fetalNote: "Anemiya profilaktikasi davom etadi.",
  },
  {
    id: 4,
    patientId: 4,
    patient: "TOLANBOYEVA XURSHIDAXON OYBEKOVNA",
    week: 32,
    day: 4,
    riskZone: "Qizil",
    bp: "152/94",
    gravida: 3,
    para: 2,
    edd: "2026-07-26",
    lastScreening: "2026-05-30",
    nextVisit: "2026-06-04",
    status: "Yotqizildi",
    provider: "Perinatal navbatchi",
    riskFactors: ["BP yuqori", "Metabolik xavf", "Qizil zona"],
    fetalNote: "Qizil zona konsiliumi va statsionar kuzatuv.",
  },
];

export const patronageRows: PatronageRow[] = [
  {
    id: 1,
    patientId: 3,
    patient: "Буваев Давлат Мухсинович",
    territory: "1- тиббий бригада",
    nurse: "Olimova Nargiza",
    visitType: "Yuqori xavf",
    visitDate: "2026-06-04",
    priority: "Yuqori",
    sync: "Serverda",
    status: "Sinxronlandi",
    offlineId: "pat-001",
    lastSync: "2026-06-03 18:10",
    serverVersion: 3,
    notes: "Kardiologiya yo'llanmasi va dori qabulini tekshirish.",
  },
  {
    id: 2,
    patientId: 6,
    patient: "NURALIYEV MUHAMMAD-UMAR-MIRZO NODIRBEK O'G'LI",
    territory: "6-тиббий бригада",
    nurse: "Ismoilova Shohista",
    visitType: "Surunkali",
    visitDate: "2026-06-05",
    priority: "Yuqori",
    sync: "Navbatda",
    status: "Offline navbat",
    offlineId: "pat-002",
    lastSync: "Kutilmoqda",
    serverVersion: 1,
    notes: "Gemoglobin javobi va uy sharoiti tekshirilsin.",
  },
  {
    id: 3,
    patientId: 1,
    patient: "MANSUROV ABDULLO MA'RUFOVICH",
    territory: "2- тиббий бригада",
    nurse: "Karimova Mahfuza",
    visitType: "Rejali",
    visitDate: "2026-06-06",
    priority: "O'rta",
    sync: "Serverda",
    status: "Sinxronlandi",
    offlineId: "pat-003",
    lastSync: "2026-06-03 17:40",
    serverVersion: 2,
    notes: "BP kundaligi va dori rioyati nazorati.",
  },
  {
    id: 4,
    patientId: 12,
    patient: "AXUNOVA SAYYORAXON ABDUXOLIQ QIZI",
    territory: "5-тиббий бригада",
    nurse: "Rustamova Mavluda",
    visitType: "Perinatal",
    visitDate: "2026-06-12",
    priority: "Past",
    sync: "Qayta ko'rish",
    status: "Rejada",
    offlineId: "pat-004",
    lastSync: "2026-06-02 16:15",
    serverVersion: 1,
    notes: "Anemiya profilaktikasi va perinatal karta.",
  },
  {
    id: 5,
    patientId: 7,
    patient: "РАЙИМОВА ШОХСАНАМ ИЛХОМЖОН ҚИЗИ",
    territory: "6-тиббий бригада",
    nurse: "Ismoilova Shohista",
    visitType: "Perinatal",
    visitDate: "2026-06-03",
    priority: "O'rta",
    sync: "Konflikt",
    status: "Konflikt",
    offlineId: "pat-005",
    lastSync: "Konflikt: 2026-06-03 19:05",
    serverVersion: 4,
    notes: "Offline BP qiymati serverdagi perinatal ko'rik bilan farq qiladi.",
  },
];

export const duplicateCandidates: DuplicateCandidateRow[] = [
  {
    id: 1,
    primaryPatientId: 9,
    duplicatePatientId: 8,
    primaryPatient: "СИРОЖИДДИНОВ ТОЛИБЖОН ҚОДИРОВИЧ",
    duplicatePatient: "SIROJIDDINOVA DILBAR DADAJONOVNA",
    score: 78,
    reasons: ["Familiya va manzil o'xshash", "Telefon oilaviy guruhga tegishli", "Yangiobod hududi"],
    status: "Ko'rib chiqiladi",
    detectedAt: "2026-06-03 12:20",
  },
  {
    id: 2,
    primaryPatientId: 5,
    duplicatePatientId: 12,
    primaryPatient: "MAVLYANOVA DILNOZA ISMAILOVNA",
    duplicatePatient: "AXUNOVA SAYYORAXON ABDUXOLIQ QIZI",
    score: 61,
    reasons: ["D50.9 va perinatal kuzatuv kesishadi", "Bir xil brigada ko'chirilgan tarix"],
    status: "Ko'rib chiqiladi",
    detectedAt: "2026-06-03 13:05",
  },
  {
    id: 3,
    primaryPatientId: 1,
    duplicatePatientId: 10,
    primaryPatient: "MANSUROV ABDULLO MA'RUFOVICH",
    duplicatePatient: "KARIMOVA MAVLUDAXON GULAMNABIYEVNA",
    score: 42,
    reasons: ["Bir xil telefon egasi bo'lishi mumkin", "Patronaj manzili yaqin"],
    status: "Rad etildi",
    detectedAt: "2026-06-02 15:10",
  },
];

export const planningRows: PlanningRow[] = [
  { title: "YQTK xavfi yuqori bemorlar ko'rigi", owner: "Azimov Xoji Akbar", date: "2026-06-04", department: "Oilaviy shifokor", status: "Rejalashtirilgan" },
  { title: "Perinatal qizil zona konsiliumi", owner: "Bosh shifokor", date: "2026-06-05", department: "Perinatal", status: "Tasdiqlangan" },
  { title: "Patronaj hamshiralar marshruti", owner: "Katta hamshira", date: "2026-06-06", department: "Patronaj", status: "Tayyor" },
  { title: "D-ro'yxat audit tekshiruvi", owner: "Tahlil bo'limi", date: "2026-06-07", department: "Kasalxona", status: "Jarayonda" },
];

export function normalizeText(value: string) {
  return value.toLocaleLowerCase("uz-UZ");
}

export function moduleLabel(module: CrmModuleKey) {
  for (const group of menuGroups) {
    const item = group.items.find((entry) => entry.key === module);
    if (item) {
      return item.label;
    }
  }
  return "Biriktirilgan aholi";
}

export function isCrmModule(value: string): value is CrmModuleKey {
  return menuGroups.some((group) => group.items.some((item) => item.key === value));
}

export function patientById(patientId: number) {
  return registryPatients.find((patient) => patient.id === patientId);
}

export function patientProfileFor(patientId: number): PatientProfile | null {
  const patient = patientById(patientId);
  if (!patient) {
    return null;
  }

  return {
    patient,
    appointments: appointments.filter((appointment) => appointment.patientId === patientId),
    encounters: patientEncounters.filter((encounter) => encounter.patientId === patientId),
    vitals: patientVitals.filter((vital) => vital.patientId === patientId),
    allergies: patientAllergies.filter((allergy) => allergy.patientId === patientId),
    prescriptions: prescriptions.filter((prescription) => prescription.patient === patient.fullName),
    documents: patientDocuments.filter((document) => document.patientId === patientId),
    careTeam: careTeamMembers.filter((member) => member.patientId === patientId),
    tasks: clinicalTasks.filter((task) => task.patientId === patientId),
    referrals: referrals.filter((referral) => referral.patientId === patientId),
    diagnosticOrders: diagnosticOrders.filter((order) => order.patientId === patientId),
    admissions: admissions.filter((admission) => admission.patientId === patientId),
    perinatalEntries: pregnantRegistry.filter((entry) => entry.patientId === patientId),
    patronageVisits: patronageRows.filter((visit) => visit.patientId === patientId),
    duplicateCandidates: duplicateCandidates.filter(
      (candidate) => candidate.primaryPatientId === patientId || candidate.duplicatePatientId === patientId,
    ),
  };
}
