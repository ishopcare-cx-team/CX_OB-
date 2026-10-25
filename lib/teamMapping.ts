// 원 시트의 "요청팀 매핑" 탭 — 요청자 표기를 팀·파트로 바꾸는 기준. CX팀이 시트에서 직접 고친다.
//   A~C열: 팀 표기(원문) | 팀 | 파트      ← 요청자 괄호 안 표기 기준
//   G~I열: 요청자(원문) | 팀 | 파트      ← 팀·파트가 빠진 사람 예외 (A~C 보다 먼저 적용)
// (D·E, J·K 열의 건수·비고는 참고용이라 읽지 않는다)
// 탭을 못 읽으면 lib/requester.ts 의 코드 규칙으로만 계산한다.

export const TEAM_MAPPING_CSV_URL =
  process.env.CX_TEAM_MAPPING_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/1VYMl6Bp6ggaiAbk9e-WrQE-Q8SPy9M7xyTK-_e5JUfg/export?format=csv&gid=593532895";

type TeamPart = { team: string; part: string };

export interface TeamMapping {
  byLabel: Map<string, TeamPart>; // 팀 표기 원문 → 팀·파트
  byRequester: Map<string, TeamPart>; // requesterKey(요청자 원문) → 팀·파트
  byName: Map<string, TeamPart>; // 요청자 예외의 이름 → 팀·파트 (같은 사람이 표기를 바꿔 써도 잡히게)
}

// "@강지원   (Inside  Sales)" / "강지원 (Inside Sales)" 처럼 @·띄어쓰기만 다른 표기는 같은 요청자로 본다
export const requesterKey = (raw: string) =>
  raw.trim().replace(/^@/, "").replace(/\s+/g, " ").replace(/\s*\(\s*/, "(");

const nameOf = (raw: string) => requesterKey(raw).replace(/\(.*$/, "").trim();

// rows: 헤더를 포함한 탭 전체 (parseCsv 결과)
export function parseTeamMapping(rows: string[][]): TeamMapping {
  const byLabel = new Map<string, TeamPart>();
  const byRequester = new Map<string, TeamPart>();
  const byName = new Map<string, TeamPart>();
  for (const r of rows.slice(1)) {
    const [label = "", team = "", part = "", , , , requester = "", rTeam = "", rPart = ""] = r;
    // 팀 표기는 이중 공백까지 원문 그대로 맞춘다
    if (label && team.trim()) byLabel.set(label, { team: team.trim(), part: part.trim() });
    if (requester.trim() && rTeam.trim()) {
      const value = { team: rTeam.trim(), part: rPart.trim() };
      byRequester.set(requesterKey(requester), value);
      byName.set(nameOf(requester), value);
    }
  }
  return { byLabel, byRequester, byName };
}
