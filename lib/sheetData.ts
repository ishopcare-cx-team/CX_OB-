// 구글시트 "CX_OB요청_관리_퍼포먼스_트래킹" 연동
// 시트를 파일 > 공유 > 웹에 게시 로 CSV 게시해두고, 그 링크를 폴링해서 대시보드 데이터를 만든다.
// 시트 컬럼(순서 고정): 접수 시각 | 접수시각 보정 | 요청자 | 주문/사업자번호 | 문의유형 | 상세내용
//   | 처리상태 | 특이사항 | 담당자 | 처리 시작 시각 | 처리 시각 보정 | 완료 시각 | 완료 시각 보정
//   | [KPI] 응답 속도 | [KPI] 해결 소요 시간 | 메시지 링크 | 날짜(피봇용)
// "보정" 컬럼은 원본 접수/처리/완료 시각을 KST 기준으로 맞춘 값이라 이것만 신뢰해서 사용한다.

export const SHEET_CSV_URL =
  process.env.CX_TRACKING_SHEET_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_X77nbNpbIpghCyF1a4YbcxdNiW6cIEkpO7tuga_CXlAkNe2bogaYT6n2RebvFU1SVOhAVAMRP4f2/pub?output=csv";

export const CLOSED_STATUSES = ["완료", "자체 해결"];

export const STATUS_ORDER = ["완료", "자체 해결", "확인 중", "대기", "특이사항/이관"];

export const STATUS_COLORS: Record<string, string> = {
  "완료": "#0ca30c",
  "자체 해결": "#2a78d6",
  "확인 중": "#4a3aa7",
  "대기": "#fab219",
  "특이사항/이관": "#d03b3b",
  "기타": "#898781",
};

export interface Ticket {
  receivedAt: string | null; // ISO instant
  receivedLabel: string | null; // "YYYY-MM-DD HH:mm" KST 표기
  dateKey: string | null; // "YYYY-MM-DD" KST 기준
  requester: string;
  orderNo: string;
  type: string;
  detail: string;
  status: string;
  note: string;
  agent: string;
  startedAt: string | null;
  completedAt: string | null;
  responseSec: number | null;
  resolutionSec: number | null;
  link: string;
}

// RFC4180 계열 CSV 파서 (따옴표 내 개행·콤마·이스케이프 따옴표 처리)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // no-op, \n에서 행 종료
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// "2026. 5. 14  21:14:06" (KST 벽시계 시각 문자열) -> 실제 UTC 인스턴트로 변환한 Date
function parseKstWallClock(s: string): Date | null {
  const m = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/.exec(
    s.trim()
  );
  if (!m) return null;
  const [y, mo, d, h, mi, se] = m.slice(1).map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h, mi, se) - 9 * 60 * 60 * 1000;
  return new Date(utcMs);
}

const KST_LABEL_FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const KST_DATEKEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function kstLabel(d: Date): string {
  // sv-SE -> "YYYY-MM-DD HH:mm"
  return KST_LABEL_FMT.format(d).replace(",", "");
}

// 서버·클라이언트 양쪽에서 "오늘"을 동일한 기준(KST 달력일)으로 계산하기 위해 공개.
// new Date().toISOString().slice(0,10) 은 UTC 기준이라 자정~오전9시(KST) 구간에서
// dateKey(=KST 기준)와 하루 어긋나므로 반드시 이 함수를 통해서만 날짜를 구한다.
export function kstDateKey(d: Date): string {
  return KST_DATEKEY_FMT.format(d);
}

// "0시간 3분 55초" / "1일 2시간" 등 -> 총 초
export function parseDurationSeconds(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const dayM = /(\d+)\s*일/.exec(t);
  const hM = /(\d+)\s*시간/.exec(t);
  const mM = /(\d+)\s*분/.exec(t);
  const sM = /(\d+)\s*초/.exec(t);
  if (!dayM && !hM && !mM && !sM) return null;
  const days = dayM ? Number(dayM[1]) : 0;
  const hours = hM ? Number(hM[1]) : 0;
  const mins = mM ? Number(mM[1]) : 0;
  const secs = sM ? Number(sM[1]) : 0;
  return days * 86400 + hours * 3600 + mins * 60 + secs;
}

export function formatDurationShort(totalSec: number | null): string {
  if (totalSec == null) return "-";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function normalizeAgent(raw: string): string {
  const t = raw.trim().replace(/^@/, "");
  return t || "(미배정)";
}

// 이모지 접두어를 떼고 상태 라벨만 남긴다 (예: "✅ 완료" -> "완료")
function normalizeStatus(raw: string): string {
  const cleaned = raw.replace(/[^\p{L}\p{N}/\s]/gu, "").trim();
  return cleaned || "기타";
}

export async function fetchTickets(): Promise<{
  tickets: Ticket[];
  fetchedAt: string;
}> {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`시트를 불러오지 못했습니다 (HTTP ${res.status})`);
  }
  const text = await res.text();
  const rows = parseCsv(text);
  const [, ...dataRows] = rows; // 첫 행은 헤더

  const tickets: Ticket[] = dataRows
    .filter((r) => r.length >= 15 && r[1]?.trim())
    .map((r) => {
      const receivedAt = parseKstWallClock(r[1] ?? "");
      const startedAt = parseKstWallClock(r[10] ?? "");
      const completedAt = parseKstWallClock(r[12] ?? "");
      return {
        receivedAt: receivedAt ? receivedAt.toISOString() : null,
        receivedLabel: receivedAt ? kstLabel(receivedAt) : null,
        dateKey: receivedAt ? kstDateKey(receivedAt) : null,
        requester: (r[2] ?? "").trim(),
        orderNo: (r[3] ?? "").trim(),
        type: (r[4] ?? "").trim() || "미분류",
        detail: (r[5] ?? "").trim(),
        status: normalizeStatus(r[6] ?? ""),
        note: (r[7] ?? "").trim(),
        agent: normalizeAgent(r[8] ?? ""),
        startedAt: startedAt ? startedAt.toISOString() : null,
        completedAt: completedAt ? completedAt.toISOString() : null,
        responseSec: parseDurationSeconds(r[13] ?? ""),
        resolutionSec: parseDurationSeconds(r[14] ?? ""),
        link: (r[15] ?? "").trim(),
      };
    });

  return { tickets, fetchedAt: new Date().toISOString() };
}
