// 아이샵케어 상담 운영시간 판정 (시트 H열 [최우선 공통 규칙] 기준)
// 운영시간: 월~토 09:00~24:00(자정까지), 일요일 휴무. 공휴일도 월~토면 평소처럼 운영(별도 공휴일 판정 안 함).
// 단, 토요일 점심 12:00~13:00은 상담원 교대 불가로 운영시간 외처럼 처리. 모두 KST(UTC+9) 기준.
// ⚠️ 시트 H열의 운영시간을 바꾸면 이 로직도 함께 맞춰야 함.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toKst(now: Date): Date {
  return new Date(now.getTime() + KST_OFFSET_MS);
}

// 운영 상태 3분류: open=운영중 / closed=운영시간 외(휴무·새벽) / saturdayLunch=토요일 점심
export type ServiceStatus = "open" | "closed" | "saturdayLunch";

export function serviceStatus(now: Date = new Date()): ServiceStatus {
  const kst = toKst(now);
  const day = kst.getUTCDay(); // 0=일요일, 6=토요일
  const hour = kst.getUTCHours();
  if (day === 6 && hour === 12) return "saturdayLunch"; // 토요일 점심 12:00~12:59 (교대 불가)
  if (day === 0) return "closed"; // 일요일 휴무
  if (hour < 9) return "closed"; // 09:00 이전 (24:00까지 운영이라 상한은 없음)
  return "open";
}

// 운영시간 외(휴무·새벽·토요일점심) — 핸드오프 차단 등 공통 게이트용
export function isOffHours(now: Date = new Date()): boolean {
  return serviceStatus(now) !== "open";
}

// 프롬프트 주입용 KST 시각 문자열 (예: "2026-06-20 03:15 (토) KST")
export function kstLabel(now: Date = new Date()): string {
  const kst = toKst(now);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const iso = kst.toISOString().slice(0, 16).replace("T", " ");
  return `${iso} (${days[kst.getUTCDay()]}) KST`;
}
