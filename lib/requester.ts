// 요청자 "@이름(팀)" 표기를 이름·팀·파트로 나누고, 상세내용에서 키워드를 뽑는다.
// 슬랙 표시이름이 사람마다 제각각이라(대소문자, 이중 공백, 오타, "_PL" 같은 직책 접미사)
// 원본 시트는 건드리지 않고 여기서 정규화한다. 새 표기 흔들림이 보이면 TEAM_FIXES 에 한 줄 추가.

import { requesterKey, type TeamMapping } from "@/lib/teamMapping";

export const UNKNOWN_TEAM = "(팀 미표기)";

// [찾을 패턴, 바꿀 값] — 순서대로 적용
const TEAM_FIXES: [RegExp, string][] = [
  [/\s+/g, " "],
  [/\(대행$/, ""],
  [/Off+i?l+ine/gi, "Offline"], // Offiline, Offlline
  [/Biz ?planning/gi, "Biz Planning"],
  [/Inside sales/gi, "Inside Sales"],
  [/ Team(?=_|$)/, ""], // "Offline Care Team" -> "Offline Care"
  [/_오가닉$/, "_Organic"],
];

// 팀 이름 끝에 붙는 직책 — 떼고 묶는다 (CO_Manager -> CO, Inside Sales_front_PL -> Inside Sales_Front)
const ROLE_SUFFIX = /^(PL|Manager|Leader|Lead|Supporter|Partner|Partlead|Designer)$/i;
const SUB_TEAM_CASE = /^(front|delivery|internet)$/i;

export function normalizeTeam(raw: string): string {
  let s = raw.trim();
  for (const [re, to] of TEAM_FIXES) s = s.replace(re, to);
  const parts = s
    .split("_")
    .map((p) => p.trim())
    .filter(Boolean);
  while (parts.length > 1 && ROLE_SUFFIX.test(parts[parts.length - 1])) parts.pop();
  return parts
    .map((p) => (SUB_TEAM_CASE.test(p) ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p))
    .join("_");
}

// "@이윤제(Inside Sales_front)"
//   -> { name: "이윤제", label: "Inside Sales_front"(괄호 안 원문), team: "Inside Sales_Front" }
// 팀 표기가 없으면 label·team 은 null — resolveTeams 에서 채운다.
export function parseRequester(raw: string): {
  name: string;
  label: string | null;
  team: string | null;
} {
  const t = raw.trim();
  const m = /^@?\s*(.+?)\s*\((.+)\)\s*$/.exec(t);
  if (m) return { name: m[1], label: m[2], team: normalizeTeam(m[2]) };
  return { name: t.replace(/^@/, "").trim() || "(미기재)", label: null, team: null };
}

// 팀은 첫 단, 그 뒤는 파트 (Inside Sales_Front -> 팀 Inside Sales / 파트 Front).
// 단 Operation 은 "Operation_Biz Ops" 처럼 둘째 단까지가 팀이다 — 이런 예외는 여기에 추가.
const TEAM_DEPTH: Record<string, number> = { Operation: 2 };

export interface TeamInfo {
  team: string; // Inside Sales, Operation_Biz Ops
  part: string; // Front / 미설치 / "" (파트 없음)
  teamPart: string; // 화면 표기 — "Inside Sales › Front", 파트가 없으면 팀 이름 그대로
}

export const PART_SEP = " › ";
export const NO_PART = "(파트 없음)";

export function splitTeam(label: string): { team: string; part: string } {
  const segs = label.split("_");
  const depth = TEAM_DEPTH[segs[0]] ?? 1;
  return { team: segs.slice(0, depth).join("_"), part: segs.slice(depth).join("_") };
}

function mostCommon(counts: Map<string, number> | undefined): string | undefined {
  return counts && [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function tally(map: Map<string, Map<string, number>>, key: string, value: string) {
  const m = map.get(key) ?? new Map<string, number>();
  m.set(value, (m.get(value) ?? 0) + 1);
  map.set(key, m);
}

// 팀 표기가 없거나 "(Inside Sales)" 처럼 파트가 빠진 요청의 소속 — CX팀이 확인한 값 (2026-10-26).
// 평소에는 시트 "요청팀 매핑" 탭의 요청자 예외가 기준이고, 이 목록은 탭을 못 읽을 때만 쓴다.
// 팀·파트가 제대로 적힌 요청에는 적용하지 않는다 (예: "@박정민A(OPS_Partner)" 는 OPS 그대로).
const REQUESTER_TEAMS: Record<string, string> = {
  강지원: "Inside Sales_Delivery",
  김성주: "Inside Sales_Front",
  곽도희: "Inside Sales_Front",
  김봉수: "Operation_Biz Ops_미설치",
  박정민A: "Operation_Biz Ops_미설치",
  유솔미: "CO",
};

const teamInfo = (team: string, part: string): TeamInfo => ({
  team,
  part,
  teamPart: part ? `${team}${PART_SEP}${part}` : team,
});

// 코드 규칙 — 요청마다 [이름, 정규화한 팀 표기(없으면 null)] 를 받아 팀·파트를 정한다.
// 팀 표기가 없거나 파트가 빠진 요청은 REQUESTER_TEAMS → 같은 사람이 다른 요청에서
// 가장 많이 쓴 값 순으로 채운다 (둘 다 없으면 그대로).
function resolveByRules(items: { name: string; label: string | null }[]): TeamInfo[] {
  const labelsByName = new Map<string, Map<string, number>>();
  for (const it of items) if (it.label) tally(labelsByName, it.name, it.label);

  const split = items.map((it) => {
    const known = REQUESTER_TEAMS[it.name] && splitTeam(REQUESTER_TEAMS[it.name]);
    const own = it.label ? splitTeam(it.label) : null;
    if (known && (!own || (own.team === known.team && !own.part))) return known;
    return splitTeam(it.label ?? mostCommon(labelsByName.get(it.name)) ?? UNKNOWN_TEAM);
  });
  const partsByNameTeam = new Map<string, Map<string, number>>();
  split.forEach((s, i) => {
    if (s.part) tally(partsByNameTeam, `${items[i].name} | ${s.team}`, s.part);
  });

  return split.map(({ team, part }, i) =>
    teamInfo(team, part || mostCommon(partsByNameTeam.get(`${items[i].name} | ${team}`)) || "")
  );
}

export interface UnmappedLabel {
  label: string; // 매핑 탭에 없는 팀 표기 (팀 표기가 없으면 요청자 원문)
  count: number;
}

// 시트 "요청팀 매핑" 탭(lib/teamMapping.ts)이 있으면 요청자 예외 → 팀 표기 순으로 먼저 찾고,
// 탭에 없는 표기만 코드 규칙으로 정한다. 탭에 없던 표기는 unmapped 로 돌려 화면에 알린다.
export function resolveTeams(
  items: { raw: string; name: string; label: string | null; team: string | null }[],
  mapping: TeamMapping | null
): { teams: TeamInfo[]; unmapped: UnmappedLabel[] } {
  const byRules = resolveByRules(items.map((it) => ({ name: it.name, label: it.team })));
  if (!mapping) return { teams: byRules, unmapped: [] };

  const unmapped = new Map<string, number>();
  const teams = items.map((it, i) => {
    const exact = mapping.byRequester.get(requesterKey(it.raw));
    if (exact) return teamInfo(exact.team, exact.part);
    const byLabel = it.label != null ? mapping.byLabel.get(it.label) : undefined;
    // 팀 표기가 없거나 파트가 빠졌으면, 요청자 예외에 있는 같은 사람(같은 팀)의 값으로 채운다
    // (팀·파트가 제대로 적힌 요청은 표기대로 — 예: "@박정민A(OPS_Partner)" 는 OPS)
    const person = mapping.byName.get(it.name);
    if (person && (!byLabel ? it.label == null : !byLabel.part && byLabel.team === person.team)) {
      return teamInfo(person.team, person.part);
    }
    if (byLabel) return teamInfo(byLabel.team, byLabel.part);
    const key = it.label ?? it.raw;
    unmapped.set(key, (unmapped.get(key) ?? 0) + 1);
    return byRules[i];
  });
  return {
    teams,
    unmapped: [...unmapped.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// 상세내용 키워드 사전 — [표시 이름, 패턴]. 한 요청에 여러 키워드가 걸릴 수 있다.
// 새 키워드는 여기에 한 줄 추가하면 대시보드에 바로 반영된다.
export const KEYWORDS: [string, RegExp][] = [
  ["법인폰 인입", /법인폰/],
  ["서류 제출/보완", /서류|보완|첨부/],
  ["계약서/서명", /계약서|서명|모두싸인|청약/],
  ["터미널/단말기", /터미널|단말기|카드기/],
  ["배송/출고", /배송|출고|발송|택배/],
  ["반품/회수", /반품|회수/],
  ["설치/방문", /설치|방문/],
  ["수리/교체/오류", /수리|교체|오류|고장|불량|\bAS\b|A\/S/i],
  ["프린터/영수증", /프린터|영수증|출력/],
  ["포스", /포스/],
  ["키오스크", /키오스크/],
  ["태블릿/테이블오더", /태블릿|테이블오더/],
  ["기기 추가", /기기 ?추가|기기추|추가 ?구매/],
  ["명의/주소 변경", /명의 ?변경|주소|대표자 ?변경|상호 ?변경/],
  ["제신고", /제신고/],
  ["해지/폐업/위약금", /해지|폐업|위약금/],
  ["취소", /취소/],
  ["카드사/결제/입금", /카드사|입금|정산|결제/],
  ["비용/금액", /비용|금액|요금|무상|유상/],
  ["인터넷", /인터넷/],
  ["배달", /배달/],
  ["어드민", /어드민/],
  ["긴급/빠른 처리", /긴급|빠른|빠르게|급하/],
];

export function matchKeywords(detail: string): string[] {
  return KEYWORDS.filter(([, re]) => re.test(detail)).map(([k]) => k);
}
