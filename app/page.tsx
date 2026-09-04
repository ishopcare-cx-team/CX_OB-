"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDurationShort, type Ticket } from "@/lib/sheetData";
import {
  DEFAULT_FILTERS,
  applyFilters,
  computeSummary,
  crossTabTypeStatus,
  dailyTrend,
  groupByAgent,
  groupByStatus,
  groupByType,
  groupByTypeStats,
  type Filters,
} from "@/lib/dashboardStats";
import { StatTile } from "@/components/dashboard/StatTile";
import { StatusBar } from "@/components/dashboard/StatusBar";
import { BarChart } from "@/components/dashboard/BarChart";
import { DurationBarChart } from "@/components/dashboard/DurationBarChart";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { AgentTable } from "@/components/dashboard/AgentTable";
import { TypeStatusTable } from "@/components/dashboard/TypeStatusTable";
import { TicketTable } from "@/components/dashboard/TicketTable";
import { FiltersBar } from "@/components/dashboard/FiltersBar";
import { PendingReviewList } from "@/components/dashboard/PendingReviewList";
import { CheckRequestList } from "@/components/dashboard/CheckRequestList";
import type { CheckRequest } from "@/lib/checkRequests";

const POLL_MS = 30_000;

const RESPONSE_COLOR = "#1baf7a";
const RESOLUTION_COLOR = "#eb6834";

type Tab = "type" | "agent" | "check";
const TABS: { key: Tab; label: string }[] = [
  { key: "type", label: "문의유형별 분석" },
  { key: "agent", label: "CX 담당자별 처리 현황" },
  { key: "check", label: "체크 요청 리스트" },
];

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<Tab>("type");
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [checkRequests, setCheckRequests] = useState<CheckRequest[]>([]);
  const [checkError, setCheckError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard-data", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `오류 (${res.status})`);
      setTickets(data.tickets);
      setFetchedAt(data.fetchedAt);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCheckRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/check-requests", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `오류 (${res.status})`);
      setCheckRequests(data.items);
      setCheckError(null);
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    loadCheckRequests();
    const id = setInterval(loadCheckRequests, POLL_MS);
    return () => clearInterval(id);
  }, [loadCheckRequests]);

  const types = useMemo(
    () => [...new Set(tickets.map((t) => t.type))].sort(),
    [tickets]
  );
  const agents = useMemo(
    () => [...new Set(tickets.map((t) => t.agent))].sort(),
    [tickets]
  );
  const statuses = useMemo(
    () => [...new Set(tickets.map((t) => t.status))],
    [tickets]
  );

  const filtered = useMemo(() => applyFilters(tickets, filters), [tickets, filters]);
  const summary = useMemo(() => computeSummary(filtered), [filtered]);
  const typeData = useMemo(() => groupByType(filtered), [filtered]);
  const statusData = useMemo(() => groupByStatus(filtered), [filtered]);
  const agentData = useMemo(() => groupByAgent(filtered), [filtered]);
  const agentCountData = useMemo(
    () => agentData.map((a) => ({ key: a.agent, count: a.count })),
    [agentData]
  );
  const typeStats = useMemo(() => groupByTypeStats(filtered), [filtered]);
  const typeStatusCross = useMemo(() => crossTabTypeStatus(filtered), [filtered]);
  const trendData = useMemo(() => dailyTrend(filtered), [filtered]);
  const recent = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""))
        .slice(0, 50),
    [filtered]
  );

  // 상태 필터와 무관하게(날짜/유형/담당자/검색만 반영) '확인 중' 건을 뽑아 보여준다.
  const pendingReview = useMemo(() => {
    const base = applyFilters(tickets, { ...filters, status: "all" });
    return base
      .filter((t) => t.status === "확인 중")
      .sort((a, b) => (a.receivedAt ?? "").localeCompare(b.receivedAt ?? ""));
  }, [tickets, filters]);

  return (
    <div className="min-h-dvh bg-[#f9f9f7]">
      <div className="mx-auto max-w-6xl px-5 py-6 text-gray-900">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">CX 아웃바운드 요청 퍼포먼스 대시보드</h1>
            <p className="mt-1 text-sm text-gray-500">
              CX_OB요청_관리_퍼포먼스_트래킹 시트와 {POLL_MS / 1000}초마다 자동으로
              동기화됩니다.
            </p>
          </div>
          <div className="text-right text-xs text-gray-400">
            {loading && tickets.length === 0
              ? "불러오는 중…"
              : fetchedAt
                ? `마지막 갱신 ${new Date(fetchedAt).toLocaleTimeString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}`
                : null}
            {error && (
              <div className="mt-1 text-red-500">
                갱신 실패: {error}
                {tickets.length > 0 && " (이전 데이터 표시 중)"}
              </div>
            )}
          </div>
        </header>

        <div className="mb-6">
          <FiltersBar
            filters={filters}
            onChange={setFilters}
            types={types}
            agents={agents}
            statuses={statuses}
          />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="총 요청" value={`${summary.total.toLocaleString()}건`} />
          <StatTile
            label="완료율"
            value={
              summary.completionRate != null
                ? `${(summary.completionRate * 100).toFixed(1)}%`
                : "-"
            }
            sub={`${summary.closedCount.toLocaleString()}건 완료`}
          />
          <StatTile label="미해결" value={`${summary.openCount.toLocaleString()}건`} />
          <StatTile
            label="평균 응답 속도"
            value={formatDurationShort(summary.avgResponseSec)}
            sub={`중앙값 ${formatDurationShort(summary.medianResponseSec)}`}
          />
          <StatTile
            label="평균 해결 시간"
            value={formatDurationShort(summary.avgResolutionSec)}
            sub={`중앙값 ${formatDurationShort(summary.medianResolutionSec)}`}
          />
          <StatTile label="담당자 수" value={`${agentData.length}명`} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              요청 건수 추이
            </h2>
            <TrendChart dailyData={trendData} />
          </section>
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              처리상태 분포
            </h2>
            <StatusBar data={statusData} />
          </section>
        </div>

        <div className="mb-6">
          <div className="mb-4 flex gap-1 rounded-lg bg-amber-50 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "bg-amber-300 text-amber-950 shadow-sm"
                    : "text-amber-800/70 hover:bg-amber-100 hover:text-amber-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "type" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 bg-white p-4">
                  <h2 className="mb-3 text-sm font-semibold text-gray-700">
                    문의유형별 건수·비율
                  </h2>
                  <BarChart data={typeData} />
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-4">
                  <h2 className="mb-3 text-sm font-semibold text-gray-700">
                    문의유형별 처리상태 분포
                  </h2>
                  <TypeStatusTable data={typeStatusCross} />
                </section>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 bg-white p-4">
                  <h2 className="mb-3 text-sm font-semibold text-gray-700">
                    문의유형별 평균 응답속도
                  </h2>
                  <DurationBarChart
                    data={typeStats.map((t) => ({ key: t.type, seconds: t.avgResponseSec }))}
                    color={RESPONSE_COLOR}
                  />
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-4">
                  <h2 className="mb-3 text-sm font-semibold text-gray-700">
                    문의유형별 평균 해결시간
                  </h2>
                  <DurationBarChart
                    data={typeStats.map((t) => ({ key: t.type, seconds: t.avgResolutionSec }))}
                    color={RESOLUTION_COLOR}
                  />
                </section>
              </div>
            </div>
          ) : tab === "agent" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 bg-white p-4">
                  <h2 className="mb-3 text-sm font-semibold text-gray-700">
                    담당자별 처리 건수·비율
                  </h2>
                  <BarChart data={agentCountData} />
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-4">
                  <h2 className="mb-3 text-sm font-semibold text-gray-700">
                    담당자별 상세 현황
                  </h2>
                  <AgentTable data={agentData} />
                </section>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 bg-white p-4">
                  <h2 className="mb-3 text-sm font-semibold text-gray-700">
                    담당자별 평균 응답속도
                  </h2>
                  <DurationBarChart
                    data={agentData.map((a) => ({ key: a.agent, seconds: a.avgResponseSec }))}
                    color={RESPONSE_COLOR}
                  />
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-4">
                  <h2 className="mb-3 text-sm font-semibold text-gray-700">
                    담당자별 평균 해결시간
                  </h2>
                  <DurationBarChart
                    data={agentData.map((a) => ({ key: a.agent, seconds: a.avgResolutionSec }))}
                    color={RESOLUTION_COLOR}
                  />
                </section>
              </div>
            </div>
          ) : (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="mb-1 text-sm font-semibold text-gray-700">
                체크 요청 리스트 ({checkRequests.length}건)
              </h2>
              <p className="mb-3 text-xs text-gray-500">
                슬랙 워크플로우로 접수된, 불필요 여부 확인이 필요한 OB 요청 목록입니다.
              </p>
              {checkError && (
                <div className="mb-3 text-xs text-red-500">
                  갱신 실패: {checkError}
                  {checkRequests.length > 0 && " (이전 데이터 표시 중)"}
                </div>
              )}
              <CheckRequestList items={checkRequests} />
            </section>
          )}
        </div>

        <section className="mb-6 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">
            확인 중인 요청 ({pendingReview.length}건)
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            처리상태가 &apos;확인 중&apos;인 건의 메시지 링크입니다. 오래된 순으로
            표시됩니다.
          </p>
          <PendingReviewList tickets={pendingReview} />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              최근 요청 ({Math.min(recent.length, showAllRecent ? recent.length : 10)}/
              {recent.length}건 표시)
            </h2>
            {recent.length > 10 && (
              <button
                onClick={() => setShowAllRecent((v) => !v)}
                className="text-xs font-medium text-[#2a78d6] hover:underline"
              >
                {showAllRecent ? "접기" : `${recent.length - 10}건 더 보기`}
              </button>
            )}
          </div>
          <TicketTable tickets={showAllRecent ? recent : recent.slice(0, 10)} />
        </section>
      </div>
    </div>
  );
}
