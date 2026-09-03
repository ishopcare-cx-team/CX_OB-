// 슬랙 워크플로우로 적재되는 "체크 요청" 시트 연동 (불필요 OB 요청 필터링용)
// 같은 스프레드시트의 다른 탭(gid=376314734)이라 gid만 다르게 붙여서 CSV로 읽는다.
// 시트 컬럼(고정): A(미사용) | B 확인 요청 일시 | C 확인 요청자 | D 요청 유형 | E 세부 사유
//   | F 원문 요청자 | G 주문/사업자 번호 | H 문의유형(원문) | I 상세 내용(원문) | J 원문 링크
// G/H/I는 화면에 쓰지 않아 애초에 파싱하지 않는다(불필요한 개인정보·중복 데이터 확대 노출 방지).

import { kstLabel, parseCsv, parseKstWallClock } from "@/lib/sheetData";

export const CHECK_SHEET_CSV_URL =
  process.env.CX_CHECK_REQUESTS_SHEET_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_X77nbNpbIpghCyF1a4YbcxdNiW6cIEkpO7tuga_CXlAkNe2bogaYT6n2RebvFU1SVOhAVAMRP4f2/pub?output=csv&gid=376314734";

export interface CheckRequest {
  requestedAt: string | null; // ISO instant (파싱 성공 시)
  requestedLabel: string | null; // "YYYY-MM-DD HH:mm" 또는 원본 문자열 그대로
  confirmRequester: string; // 확인 요청자
  originalRequester: string; // 원문 요청자
  requestType: string; // 요청 유형
  reason: string; // 세부 사유
  link: string; // 원문 링크
}

export async function fetchCheckRequests(): Promise<{
  items: CheckRequest[];
  fetchedAt: string;
}> {
  const res = await fetch(CHECK_SHEET_CSV_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`체크 요청 시트를 불러오지 못했습니다 (HTTP ${res.status})`);
  }
  const text = await res.text();
  const rows = parseCsv(text);
  const [, ...dataRows] = rows; // 첫 행은 헤더

  const items: CheckRequest[] = dataRows
    .filter((r) => r.length >= 10 && (r[2]?.trim() || r[4]?.trim()))
    .map((r) => {
      const rawDate = (r[1] ?? "").trim();
      const requestedAt = parseKstWallClock(rawDate);
      return {
        requestedAt: requestedAt ? requestedAt.toISOString() : null,
        requestedLabel: requestedAt ? kstLabel(requestedAt) : rawDate || null,
        confirmRequester: (r[2] ?? "").trim(),
        requestType: (r[3] ?? "").trim() || "미분류",
        reason: (r[4] ?? "").trim(),
        originalRequester: (r[5] ?? "").trim(),
        link: (r[9] ?? "").trim(),
      };
    });

  return { items, fetchedAt: new Date().toISOString() };
}
