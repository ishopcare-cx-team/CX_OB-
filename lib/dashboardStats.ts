import { CLOSED_STATUSES, STATUS_ORDER, type Ticket } from "@/lib/sheetData";
import { NO_PART, PART_SEP } from "@/lib/requester";

export interface Filters {
  from: string | null; // "YYYY-MM-DD"
  to: string | null; // "YYYY-MM-DD"
  type: string; // "all" | 문의유형
  agent: string; // "all" | 담당자
  status: string; // "all" | 처리상태
  team: string; // "all" | 팀 | "팀 › 파트" | "팀 › (파트 없음)"
  keyword: string; // "all" | 키워드
  search: string;
}

export const DEFAULT_FILTERS: Filters = {
  from: null,
  to: null,
  type: "all",
  agent: "all",
  status: "all",
  team: "all",
  keyword: "all",
  search: "",
};

export function applyFilters(tickets: Ticket[], f: Filters): Ticket[] {
  const q = f.search.trim().toLowerCase();
  return tickets.filter((t) => {
    if (f.from && (!t.dateKey || t.dateKey < f.from)) return false;
    if (f.to && (!t.dateKey || t.dateKey > f.to)) return false;
    if (f.type !== "all" && t.type !== f.type) return false;
    if (f.agent !== "all" && t.agent !== f.agent) return false;
    if (f.status !== "all" && t.status !== f.status) return false;
    if (f.team !== "all" && !matchesTeam(t, f.team)) return false;
    if (f.keyword !== "all" && !t.keywords.includes(f.keyword)) return false;
    if (q) {
      const hay =
        `${t.requester} ${t.orderNo} ${t.detail} ${t.note} ${t.agent}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// 필터 값이 "팀 › 파트" 면 그 파트만, 팀 이름이면 팀 전체
function matchesTeam(t: Ticket, value: string): boolean {
  const [team, part] = value.split(PART_SEP);
  if (part === undefined) return t.team === team;
  return t.team === team && (part === NO_PART ? !t.part : t.part === part);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export interface Summary {
  total: number;
  closedCount: number;
  openCount: number;
  completionRate: number | null;
  avgResponseSec: number | null;
  medianResponseSec: number | null;
  avgResolutionSec: number | null;
  medianResolutionSec: number | null;
}

export function computeSummary(tickets: Ticket[]): Summary {
  const total = tickets.length;
  const closedCount = tickets.filter((t) =>
    CLOSED_STATUSES.includes(t.status)
  ).length;
  const responseValues = tickets
    .map((t) => t.responseSec)
    .filter((v): v is number => v != null);
  const resolutionValues = tickets
    .map((t) => t.resolutionSec)
    .filter((v): v is number => v != null);

  return {
    total,
    closedCount,
    openCount: total - closedCount,
    completionRate: total ? closedCount / total : null,
    avgResponseSec: average(responseValues),
    medianResponseSec: median(responseValues),
    avgResolutionSec: average(resolutionValues),
    medianResolutionSec: median(resolutionValues),
  };
}

export interface CountBucket {
  key: string;
  count: number;
}

export function groupByType(tickets: Ticket[]): CountBucket[] {
  const m = new Map<string, number>();
  for (const t of tickets) m.set(t.type, (m.get(t.type) ?? 0) + 1);
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function groupByStatus(tickets: Ticket[]): CountBucket[] {
  const m = new Map<string, number>();
  for (const t of tickets) m.set(t.status, (m.get(t.status) ?? 0) + 1);
  const ordered = STATUS_ORDER.filter((s) => m.has(s)).map((key) => ({
    key,
    count: m.get(key)!,
  }));
  const rest = [...m.entries()]
    .filter(([k]) => !STATUS_ORDER.includes(k))
    .map(([key, count]) => ({ key, count }));
  return [...ordered, ...rest];
}

export interface AgentStat {
  agent: string;
  count: number;
  avgResponseSec: number | null;
  avgResolutionSec: number | null;
  completionRate: number | null;
}

export function groupByAgent(tickets: Ticket[]): AgentStat[] {
  const byAgent = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const list = byAgent.get(t.agent) ?? [];
    list.push(t);
    byAgent.set(t.agent, list);
  }
  return [...byAgent.entries()]
    .map(([agent, list]) => {
      const s = computeSummary(list);
      return {
        agent,
        count: list.length,
        avgResponseSec: s.avgResponseSec,
        avgResolutionSec: s.avgResolutionSec,
        completionRate: s.completionRate,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD (day/week 시작일) 또는 YYYY-MM (month)
  count: number;
}

export function dailyTrend(tickets: Ticket[]): TrendPoint[] {
  const m = new Map<string, number>();
  for (const t of tickets) {
    if (!t.dateKey) continue;
    m.set(t.dateKey, (m.get(t.dateKey) ?? 0) + 1);
  }
  const keys = [...m.keys()].sort();
  if (keys.length === 0) return [];

  // 데이터 없는 날짜도 0건으로 채워서 끊기지 않는 추이선을 만든다
  const points: TrendPoint[] = [];
  const cursor = new Date(`${keys[0]}T00:00:00Z`);
  const end = new Date(`${keys[keys.length - 1]}T00:00:00Z`);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    points.push({ date: key, count: m.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

export interface TypeStat {
  type: string;
  count: number;
  avgResponseSec: number | null;
  avgResolutionSec: number | null;
  completionRate: number | null;
}

export function groupByTypeStats(tickets: Ticket[]): TypeStat[] {
  const byType = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const list = byType.get(t.type) ?? [];
    list.push(t);
    byType.set(t.type, list);
  }
  return [...byType.entries()]
    .map(([type, list]) => {
      const s = computeSummary(list);
      return {
        type,
        count: list.length,
        avgResponseSec: s.avgResponseSec,
        avgResolutionSec: s.avgResolutionSec,
        completionRate: s.completionRate,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export interface TypeStatusCross {
  type: string;
  total: number;
  counts: Record<string, number>;
}

// 문의유형 × 처리상태 교차표 (문의유형 탭의 상태 분포 파악용)
export function crossTabTypeStatus(tickets: Ticket[]): TypeStatusCross[] {
  const byType = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const list = byType.get(t.type) ?? [];
    list.push(t);
    byType.set(t.type, list);
  }
  return [...byType.entries()]
    .map(([type, list]) => {
      const counts: Record<string, number> = {};
      for (const t of list) counts[t.status] = (counts[t.status] ?? 0) + 1;
      return { type, total: list.length, counts };
    })
    .sort((a, b) => b.total - a.total);
}

export type Granularity = "day" | "week" | "month";

// 일별 추이(dailyTrend 결과)를 주간/월간 단위로 묶는다. day는 그대로 반환.
export function aggregateTrend(
  points: TrendPoint[],
  granularity: Granularity
): TrendPoint[] {
  if (granularity === "day") return points;
  const m = new Map<string, number>();
  for (const p of points) {
    let key: string;
    if (granularity === "month") {
      key = p.date.slice(0, 7); // YYYY-MM
    } else {
      const d = new Date(`${p.date}T00:00:00Z`);
      const dow = d.getUTCDay(); // 0=일
      const diffToMonday = (dow + 6) % 7;
      d.setUTCDate(d.getUTCDate() - diffToMonday);
      key = d.toISOString().slice(0, 10); // 그 주의 월요일
    }
    m.set(key, (m.get(key) ?? 0) + p.count);
  }
  return [...m.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function countBy(keys: string[]): CountBucket[] {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

// team: 팀 단위로 묶음 / part: 팀 › 파트 단위로 나눔 (IS팀 -> Front·Delivery·Internet)
export type TeamLevel = "team" | "part";

export interface TeamStat {
  team: string; // 팀 또는 "팀 › 파트" — 그대로 Filters.team 값으로 쓸 수 있다
  count: number;
  requesterCount: number;
  types: Record<string, number>;
  topKeywords: CountBucket[];
}

// 요청팀(또는 팀 › 파트)별 건수 · 문의유형 분포 · 요청자 수 · 주요 키워드
export function groupByTeam(tickets: Ticket[], level: TeamLevel = "team"): TeamStat[] {
  // 파트로 나눌 때, 파트가 있는 팀의 파트 없는 요청은 "팀 › (파트 없음)" 으로 따로 센다
  const teamsWithParts = new Set(tickets.filter((t) => t.part).map((t) => t.team));
  const byTeam = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const k =
      level === "team"
        ? t.team
        : t.part || !teamsWithParts.has(t.team)
          ? t.teamPart
          : `${t.team}${PART_SEP}${NO_PART}`;
    const list = byTeam.get(k) ?? [];
    list.push(t);
    byTeam.set(k, list);
  }
  return [...byTeam.entries()]
    .map(([team, list]) => {
      const types: Record<string, number> = {};
      for (const t of list) types[t.type] = (types[t.type] ?? 0) + 1;
      return {
        team,
        count: list.length,
        requesterCount: new Set(list.map((t) => t.requesterName)).size,
        types,
        topKeywords: countBy(list.flatMap((t) => t.keywords)),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export interface RequesterStat {
  name: string;
  team: string;
  count: number;
  topType: string | null;
  topKeywords: CountBucket[];
  lastDate: string | null;
}

// 요청자(이름+팀)별 건수 — 같은 이름이 다른 팀으로 바뀐 경우 따로 센다
export function groupByRequester(tickets: Ticket[]): RequesterStat[] {
  const byKey = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const k = `${t.requesterName} | ${t.teamPart}`;
    const list = byKey.get(k) ?? [];
    list.push(t);
    byKey.set(k, list);
  }
  return [...byKey.values()]
    .map((list) => ({
      name: list[0].requesterName,
      team: list[0].teamPart,
      count: list.length,
      topType: countBy(list.map((t) => t.type))[0]?.key ?? null,
      topKeywords: countBy(list.flatMap((t) => t.keywords)),
      lastDate: list.reduce<string | null>(
        (acc, t) => (t.dateKey && (!acc || t.dateKey > acc) ? t.dateKey : acc),
        null
      ),
    }))
    .sort((a, b) => b.count - a.count);
}

// 키워드별 요청 건수 (한 요청에 여러 키워드가 걸릴 수 있어 합계가 총 요청보다 크다)
export function groupByKeyword(tickets: Ticket[]): CountBucket[] {
  return countBy(tickets.flatMap((t) => t.keywords));
}
