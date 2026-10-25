"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDurationShort, type TeamMappingStatus, type Ticket } from "@/lib/sheetData";
import {
  DEFAULT_FILTERS,
  applyFilters,
  computeSummary,
  crossTabTypeStatus,
  dailyTrend,
  groupByAgent,
  groupByKeyword,
  groupByRequester,
  groupByStatus,
  groupByTeam,
  groupByType,
  groupByTypeStats,
  type Filters,
  type TeamLevel,
} from "@/lib/dashboardStats";
import { KEYWORDS, PART_SEP } from "@/lib/requester";
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
import { TeamTypeTable } from "@/components/dashboard/TeamTypeTable";
import { RequesterTable } from "@/components/dashboard/RequesterTable";
import type { CheckRequest } from "@/lib/checkRequests";

const POLL_MS = 30_000;

const RESPONSE_COLOR = "#1baf7a";
const RESOLUTION_COLOR = "#eb6834";

const TEAM_PREVIEW = 15;
const REQUESTER_PREVIEW = 20;
const KEYWORD_NAMES = KEYWORDS.map(([k]) => k);

type Tab = "type" | "agent" | "team" | "keyword" | "check";
const TABS: { key: Tab; label: string }[] = [
  { key: "type", label: "문의유형별 분석" },
  { key: "agent", label: "CX 담당자별 처리 현황" },
  { key: "team", label: "요청팀·요청자별 분석" },
  { key: "keyword", label: "키워드별 분석" },
  { key: "check", label: "체크 요청 리스트" },
];

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [teamMapping, setTeamMapping] = useState<TeamMappingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<Tab>("type");
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [teamLevel, setTeamLevel] = useState<TeamLevel>("team");
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [showAllRequesters, setShowAllRequesters] = useState(false);
  const [checkRequests, setCheckRequests] = useState<CheckRequest[]>([]);
  const [checkError, setCheckError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard-data", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `오류 (${res.status})`);
      setTickets(data.tickets);
      setFetchedAt(data.fetchedAt);
      setTeamMapping(data.teamMapping ?? null);
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
  // 요청팀 필터 목록 — 팀 아래에 파트를 들여써서 (Inside Sales / └ Front / └ Delivery …)
  const teamOptions = useMemo(() => {
    const parts = groupByTeam(tickets, "part");
    return groupByTeam(tickets).flatMap(({ team }) => [
      { value: team, label: team },
      ...parts
        .filter((p) => p.team.startsWith(`${team}${PART_SEP}`))
        .map((p) => ({ value: p.team, label: `　└ ${p.team.slice(team.length + PART_SEP.length)}` })),
    ]);
  }, [tickets]);
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
  // 팀·키워드 차트는 자기 필터를 빼고 계산해야 하나를 골라도 나머지 막대가 남는다
  const teamBase = useMemo(
    () => applyFilters(tickets, { ...filters, team: "all" }),
    [tickets, filters]
  );
  const keywordBase = useMemo(
    () => applyFilters(tickets, { ...filters, keyword: "all" }),
    [tickets, filters]
  );
  const teamStats = useMemo(() => groupByTeam(teamBase, teamLevel), [teamBase, teamLevel]);
  const shownTeams = showAllTeams ? teamStats : teamStats.slice(0, TEAM_PREVIEW);
  const requesterStats = useMemo(() => groupByRequester(filtered), [filtered]);
  const keywordData = useMemo(() => groupByKeyword(keywordBase), [keywordBase]);
  const keywordTeamData = useMemo(
    () =>
      groupByTeam(filtered)
        .slice(0, TEAM_PREVIEW)
        .map((t) => ({ key: t.team, count: t.count })),
    [filtered]
  );
  const noKeywordCount = useMemo(
    () => keywordBase.filter((t) => t.keywords.length === 0).length,
    [keywordBase]
  );
  // 같은 항목을 다시 누르면 필터 해제
  const toggleFilter = (key: "team" | "keyword", value: string) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? "all" : value }));
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
            teams={teamOptions}
            keywords={KEYWORD_NAMES}
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
          ) : tab === "team" ? (
            <div className="space-y-4">
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-700">
                    요청팀별 건수 · 문의유형 비율
                  </h2>
                  <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-xs">
                    {(
                      [
                        ["team", "팀"],
                        ["part", "파트까지"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setTeamLevel(key)}
                        className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                          teamLevel === key
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mb-3 text-xs text-gray-500">
                  요청자 표기 &quot;@이름(팀_파트)&quot;를 시트 &apos;요청팀 매핑&apos; 탭 기준으로
                  팀·파트로 나눴습니다 (IS팀 › Front·Delivery·Internet, Operation은 Biz Ops
                  등이 각각 팀). 행을 누르면 그 팀으로 필터되고, 칸 색이 진할수록 그 팀 요청 중
                  해당 문의유형 비중이 큽니다.
                </p>
                {teamMapping && !teamMapping.loaded && (
                  <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    &apos;요청팀 매핑&apos; 탭을 읽지 못해 기본 규칙으로 나눴습니다. 탭 이름·공유
                    설정을 확인해 주세요.
                  </p>
                )}
                {teamMapping && teamMapping.unmapped.length > 0 && (
                  <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    &apos;요청팀 매핑&apos; 탭에 없는 표기{" "}
                    {teamMapping.unmapped.reduce((a, u) => a + u.count, 0)}건 — 기본 규칙으로
                    나눴어요. 탭에 한 줄 추가하면 정확해집니다:{" "}
                    {teamMapping.unmapped
                      .slice(0, 8)
                      .map((u) => `${u.label} (${u.count}건)`)
                      .join(", ")}
                    {teamMapping.unmapped.length > 8 && ` 외 ${teamMapping.unmapped.length - 8}개`}
                  </p>
                )}
                <TeamTypeTable
                  data={shownTeams}
                  total={teamBase.length}
                  types={groupByType(teamBase).map((t) => t.key)}
                  selected={filters.team}
                  onSelect={(team) => toggleFilter("team", team)}
                />
                {teamStats.length > TEAM_PREVIEW && (
                  <button
                    onClick={() => setShowAllTeams((v) => !v)}
                    className="mt-3 text-xs font-medium text-[#2a78d6] hover:underline"
                  >
                    {showAllTeams
                      ? "접기"
                      : `나머지 ${teamStats.length - TEAM_PREVIEW}개 더 보기`}
                  </button>
                )}
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">
                    요청자별 요청 건수
                    {filters.team !== "all" && ` — ${filters.team}`} ({requesterStats.length}
                    명)
                  </h2>
                  {requesterStats.length > REQUESTER_PREVIEW && (
                    <button
                      onClick={() => setShowAllRequesters((v) => !v)}
                      className="text-xs font-medium text-[#2a78d6] hover:underline"
                    >
                      {showAllRequesters
                        ? "접기"
                        : `${requesterStats.length - REQUESTER_PREVIEW}명 더 보기`}
                    </button>
                  )}
                </div>
                <RequesterTable
                  data={
                    showAllRequesters
                      ? requesterStats
                      : requesterStats.slice(0, REQUESTER_PREVIEW)
                  }
                  total={filtered.length}
                />
              </section>
            </div>
          ) : tab === "keyword" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="mb-1 text-sm font-semibold text-gray-700">
                  키워드별 요청 건수
                </h2>
                <p className="mb-3 text-xs text-gray-500">
                  상세내용에 해당 단어가 들어간 요청 수입니다. 비율은 전체 요청 대비이고, 한
                  요청에 키워드가 여러 개 걸릴 수 있어요. 키워드를 누르면 그 키워드로
                  필터됩니다. (어떤 키워드에도 안 걸린 요청 {noKeywordCount.toLocaleString()}
                  건)
                </p>
                <BarChart
                  data={keywordData}
                  total={keywordBase.length}
                  selected={filters.keyword}
                  onSelect={(k) => toggleFilter("keyword", k)}
                />
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="mb-1 text-sm font-semibold text-gray-700">
                  {filters.keyword !== "all"
                    ? `'${filters.keyword}' 요청팀 분포`
                    : "요청팀 분포"}
                </h2>
                <p className="mb-3 text-xs text-gray-500">
                  {filters.keyword !== "all"
                    ? "선택한 키워드가 어느 팀에서 많이 들어오는지 보여줍니다."
                    : "왼쪽에서 키워드를 누르면 그 키워드가 어느 팀에서 많이 들어오는지 보여줍니다."}
                </p>
                <BarChart data={keywordTeamData} total={filtered.length} />
                <h3 className="mt-5 mb-2 text-xs font-semibold text-gray-600">
                  요청자 상위 10명
                </h3>
                <RequesterTable
                  data={requesterStats.slice(0, 10)}
                  total={filtered.length}
                  compact
                />
              </section>
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
