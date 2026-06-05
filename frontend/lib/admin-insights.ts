import type { AIErrorLog, MedicalRecord } from "@/lib/api";

export type SafetyZone = "RED" | "YELLOW" | "GREEN";

export interface DoctorRankingIssue {
  label: string;
  count: number;
}

export interface DoctorRanking {
  doctorId: string;
  score: number;
  rankLabel: "Excellent" | "Stable" | "Needs coaching" | "Critical review";
  totalRecords: number;
  clearRecords: number;
  pendingRecords: number;
  needsReviewRecords: number;
  safetyEvents: number;
  redEvents: number;
  yellowEvents: number;
  greenEvents: number;
  bonus: number;
  deduction: number;
  lastEventAt: string;
  topIssues: DoctorRankingIssue[];
}

export function formatDateTime(value?: string | null) {
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

export function safetyErrorLabel(errorType: AIErrorLog["error_type"]) {
  const labels: Record<AIErrorLog["error_type"], string> = {
    ENTRY_OMISSION: "Clinical entry omission",
    PRESCRIPTION_MISMATCH: "Prescription mismatch",
    ETHICAL_DEVIATION: "Ethical deviation",
    IMAGING_SAFETY: "Imaging safety",
    DIGITAL_TWIN_RISK: "Digital Twin risk",
  };
  return labels[errorType];
}

export function safetyZoneFromSeverity(severity: AIErrorLog["severity"]): SafetyZone {
  if (severity === "CRITICAL" || severity === "HIGH") {
    return "RED";
  }
  if (severity === "MEDIUM") {
    return "YELLOW";
  }
  return "GREEN";
}

export function safetyZoneClasses(zone: SafetyZone) {
  if (zone === "RED") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (zone === "YELLOW") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export function recordZoneClasses(zone?: string) {
  if (zone === "RED") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (zone === "YELLOW") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export function aiReviewClasses(status?: MedicalRecord["ai_review_status"] | AIErrorLog["medical_record_ai_review_status"]) {
  if (status === "CRITICAL") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (status === "NEEDS_REVIEW" || status === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export function safetyDeduction(severity: AIErrorLog["severity"]) {
  if (severity === "CRITICAL") {
    return 15;
  }
  if (severity === "HIGH") {
    return 10;
  }
  if (severity === "MEDIUM") {
    return 4;
  }
  return 1;
}

export function scoreRankLabel(score: number): DoctorRanking["rankLabel"] {
  if (score >= 105) {
    return "Excellent";
  }
  if (score >= 92) {
    return "Stable";
  }
  if (score >= 75) {
    return "Needs coaching";
  }
  return "Critical review";
}

export function rankClasses(score: number) {
  if (score >= 105) {
    return "text-clinical-green";
  }
  if (score >= 92) {
    return "text-clinical-blue";
  }
  if (score >= 75) {
    return "text-clinical-amber";
  }
  return "text-clinical-red";
}

function ensureRanking(map: Map<string, DoctorRanking>, doctorId: string) {
  const existing = map.get(doctorId);
  if (existing) {
    return existing;
  }
  const ranking: DoctorRanking = {
    doctorId,
    score: 100,
    rankLabel: "Stable",
    totalRecords: 0,
    clearRecords: 0,
    pendingRecords: 0,
    needsReviewRecords: 0,
    safetyEvents: 0,
    redEvents: 0,
    yellowEvents: 0,
    greenEvents: 0,
    bonus: 0,
    deduction: 0,
    lastEventAt: "",
    topIssues: [],
  };
  map.set(doctorId, ranking);
  return ranking;
}

export function buildDoctorRankings(logs: AIErrorLog[], records: MedicalRecord[]) {
  const rankings = new Map<string, DoctorRanking>();
  const issuesByDoctor = new Map<string, Map<string, number>>();
  const recordById = new Map(records.map((record) => [record.id, record]));

  records.forEach((record) => {
    const doctorId = record.doctor_id || "Unknown doctor";
    const ranking = ensureRanking(rankings, doctorId);
    ranking.totalRecords += 1;
    if (record.ai_review_status === "CLEAR") {
      ranking.clearRecords += 1;
      ranking.bonus += 2;
    } else if (record.ai_review_status === "PENDING") {
      ranking.pendingRecords += 1;
    } else if (record.ai_review_status === "NEEDS_REVIEW" || record.ai_review_status === "CRITICAL") {
      ranking.needsReviewRecords += 1;
    }
  });

  logs.forEach((log) => {
    const record = recordById.get(log.medical_record);
    const doctorId = record?.doctor_id || log.doctor_id || "Unknown doctor";
    const ranking = ensureRanking(rankings, doctorId);
    const zone = safetyZoneFromSeverity(log.severity);
    const issueLabel = safetyErrorLabel(log.error_type);
    const issueCounts = issuesByDoctor.get(doctorId) ?? new Map<string, number>();

    ranking.safetyEvents += 1;
    ranking.deduction += safetyDeduction(log.severity);
    ranking.lastEventAt = !ranking.lastEventAt || new Date(log.created_at) > new Date(ranking.lastEventAt) ? log.created_at : ranking.lastEventAt;
    if (zone === "RED") {
      ranking.redEvents += 1;
    } else if (zone === "YELLOW") {
      ranking.yellowEvents += 1;
    } else {
      ranking.greenEvents += 1;
    }
    issueCounts.set(issueLabel, (issueCounts.get(issueLabel) ?? 0) + 1);
    issuesByDoctor.set(doctorId, issueCounts);
  });

  return [...rankings.values()]
    .map((ranking) => {
      const score = Math.max(0, Math.min(120, 100 + ranking.bonus - ranking.deduction - ranking.needsReviewRecords * 2));
      const issueCounts = issuesByDoctor.get(ranking.doctorId) ?? new Map<string, number>();
      return {
        ...ranking,
        score,
        rankLabel: scoreRankLabel(score),
        lastEventAt: ranking.lastEventAt ? formatDateTime(ranking.lastEventAt) : "No AI events",
        topIssues: [...issueCounts.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3),
      };
    })
    .sort((a, b) => b.score - a.score);
}
