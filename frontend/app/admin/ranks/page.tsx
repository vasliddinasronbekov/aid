"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, BarChart3, CheckCircle2, Search, ShieldAlert, TrendingDown, UserRound } from "lucide-react";

import { listAIErrorLogs, listMedicalRecords } from "@/lib/api";
import type { AIErrorLog, MedicalRecord } from "@/lib/api";
import { buildDoctorRankings, rankClasses, safetyZoneClasses, type DoctorRanking } from "@/lib/admin-insights";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Request failed");
}

function scoreWidth(score: number) {
  return `${Math.max(4, Math.min(100, Math.round((score / 120) * 100)))}%`;
}

export default function AdminRanksPage() {
  const [logs, setLogs] = useState<AIErrorLog[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;

    setLoading(true);
    Promise.allSettled([listAIErrorLogs(""), listMedicalRecords("")])
      .then(([logResult, recordResult]) => {
        if (!active) {
          return;
        }
        const errors: string[] = [];
        if (logResult.status === "fulfilled") {
          setLogs(logResult.value.results);
        } else {
          errors.push(`AI logs: ${errorMessage(logResult.reason)}`);
          setLogs([]);
        }
        if (recordResult.status === "fulfilled") {
          setRecords(recordResult.value.results);
        } else {
          errors.push(`Medical records: ${errorMessage(recordResult.reason)}`);
          setRecords([]);
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

  const rankings = useMemo(() => buildDoctorRankings(logs, records), [logs, records]);
  const filteredRankings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rankings.filter((ranking) => !normalizedQuery || ranking.doctorId.toLowerCase().includes(normalizedQuery));
  }, [query, rankings]);
  const averageScore = rankings.length ? Math.round(rankings.reduce((sum, ranking) => sum + ranking.score, 0) / rankings.length) : 0;
  const totalDeduction = rankings.reduce((sum, ranking) => sum + ranking.deduction, 0);
  const totalBonus = rankings.reduce((sum, ranking) => sum + ranking.bonus, 0);
  const criticalReviewDoctors = rankings.filter((ranking) => ranking.rankLabel === "Critical review").length;
  const positiveBalanceDoctors = rankings.filter((ranking) => ranking.clearRecords > ranking.safetyEvents).length;
  const topRiskDoctors = rankings
    .filter((ranking) => ranking.safetyEvents > 0)
    .sort((a, b) => b.deduction - a.deduction)
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-md border border-clinical-line bg-white px-4 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-clinical-ink">Doctor ranks</h2>
          <p className="mt-1 text-sm text-clinical-slate">Clinical performance score from AI safety events and clean reviewed records.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-md border border-clinical-line px-3 py-2 text-sm text-clinical-slate">
          <Award className="h-4 w-4 text-clinical-blue" />
          {loading ? "Scoring" : `${rankings.length} doctors`}
        </span>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Average score</span>
            <BarChart3 className="h-5 w-5 text-clinical-blue" />
          </div>
          <strong className={`mt-3 block text-3xl ${rankClasses(averageScore)}`}>{averageScore}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Critical review</span>
            <ShieldAlert className="h-5 w-5 text-clinical-red" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{criticalReviewDoctors}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Total deduction</span>
            <TrendingDown className="h-5 w-5 text-clinical-red" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{totalDeduction}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Clean bonus</span>
            <CheckCircle2 className="h-5 w-5 text-clinical-green" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{totalBonus}</strong>
        </div>
        <div className="rounded-md border border-clinical-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-clinical-slate">Positive balance</span>
            <UserRound className="h-5 w-5 text-clinical-cyan" />
          </div>
          <strong className="mt-3 block text-3xl text-clinical-ink">{positiveBalanceDoctors}</strong>
        </div>
      </section>

      {loadError ? <div className="rounded-md border border-clinical-line bg-white px-4 py-3 text-sm text-clinical-red shadow-sm">{loadError}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-md border border-clinical-line bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-clinical-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative lg:w-96">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-clinical-slate" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 w-full rounded-md border border-clinical-line bg-white pl-9 pr-3 text-sm text-clinical-ink outline-none focus:border-clinical-blue"
                placeholder="Search doctor"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-clinical-line text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-clinical-slate">
                <tr>
                  <th className="px-4 py-3 font-semibold">Doctor</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Records</th>
                  <th className="px-4 py-3 font-semibold">AI safety</th>
                  <th className="px-4 py-3 font-semibold">Balance</th>
                  <th className="px-4 py-3 font-semibold">Top issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-line bg-white">
                {filteredRankings.map((ranking: DoctorRanking, index) => (
                  <tr key={ranking.doctorId} className="align-top">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-clinical-line bg-slate-50 px-2 py-1 text-xs font-semibold text-clinical-slate">
                          #{index + 1}
                        </span>
                        <span className="font-semibold text-clinical-ink">{ranking.doctorId}</span>
                      </div>
                      <p className="mt-1 text-xs text-clinical-slate">{ranking.rankLabel}</p>
                    </td>
                    <td className="px-4 py-3">
                      <strong className={`text-lg ${rankClasses(ranking.score)}`}>{ranking.score}</strong>
                      <div className="mt-2 h-2 w-32 rounded-sm bg-slate-100">
                        <div className="h-2 rounded-sm bg-clinical-blue" style={{ width: scoreWidth(ranking.score) }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-clinical-slate">
                      <p>{ranking.totalRecords} total</p>
                      <p className="mt-1 text-xs">
                        {ranking.clearRecords} clear · {ranking.pendingRecords} pending
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid w-32 grid-cols-3 gap-1 text-center text-[11px] font-semibold">
                        <span className={`rounded-sm py-1 ${safetyZoneClasses("RED")}`}>{ranking.redEvents}</span>
                        <span className={`rounded-sm py-1 ${safetyZoneClasses("YELLOW")}`}>{ranking.yellowEvents}</span>
                        <span className={`rounded-sm py-1 ${safetyZoneClasses("GREEN")}`}>{ranking.greenEvents}</span>
                      </div>
                      <p className="mt-1 text-xs text-clinical-slate">{ranking.safetyEvents} events</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-clinical-green">+{ranking.bonus}</p>
                      <p className="mt-1 text-clinical-red">-{ranking.deduction}</p>
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      {ranking.topIssues.length ? (
                        ranking.topIssues.map((issue) => (
                          <p key={issue.label} className="text-sm text-clinical-slate">
                            {issue.label} · {issue.count}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-clinical-slate">No AI safety issues</p>
                      )}
                      <p className="mt-1 text-xs text-clinical-slate">{ranking.lastEventAt}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredRankings.length ? (
              <div className="px-4 py-8 text-sm text-clinical-slate">{loading ? "Loading ranks" : "No ranked doctors match this view."}</div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
              <TrendingDown className="h-5 w-5 text-clinical-red" />
              <h2 className="text-sm font-semibold text-clinical-ink">Highest deductions</h2>
            </div>
            <div className="divide-y divide-clinical-line">
              {topRiskDoctors.map((ranking) => (
                <article key={ranking.doctorId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-clinical-ink">{ranking.doctorId}</span>
                    <span className="text-sm font-semibold text-clinical-red">-{ranking.deduction}</span>
                  </div>
                  <p className="mt-1 text-xs text-clinical-slate">
                    {ranking.redEvents} red · {ranking.yellowEvents} yellow · score {ranking.score}
                  </p>
                </article>
              ))}
              {!topRiskDoctors.length ? <div className="px-4 py-6 text-sm text-clinical-slate">No safety deductions yet.</div> : null}
            </div>
          </section>

          <section className="rounded-md border border-clinical-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-clinical-line px-4 py-3">
              <Award className="h-5 w-5 text-clinical-blue" />
              <h2 className="text-sm font-semibold text-clinical-ink">Top doctors</h2>
            </div>
            <div className="divide-y divide-clinical-line">
              {rankings.slice(0, 6).map((ranking, index) => (
                <article key={ranking.doctorId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-clinical-ink">
                      #{index + 1} {ranking.doctorId}
                    </span>
                    <span className={`text-sm font-semibold ${rankClasses(ranking.score)}`}>{ranking.score}</span>
                  </div>
                  <p className="mt-1 text-xs text-clinical-slate">
                    +{ranking.bonus} clean · {ranking.safetyEvents} AI events
                  </p>
                </article>
              ))}
              {!rankings.length ? <div className="px-4 py-6 text-sm text-clinical-slate">No ranked doctors yet.</div> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
