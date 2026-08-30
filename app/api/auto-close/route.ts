import { NextRequest, NextResponse } from "next/server";
import {
  listOpenUserChats,
  fetchRawMessages,
  closeUserChat,
  HANDOFF_TEXT,
  WAIT_TEXT,
} from "@/lib/channeltalk";

export const maxDuration = 300;

// 봇 답변 후 이 시간만큼 고객 무응답이면 상담 자동 종료
const IDLE_MS = 10 * 60 * 1000; // 10분

// Vercel Cron이 주기 호출. 열린 상담 중 "봇이 마지막으로 답했고 10분 무응답"인 것을 종료.
// 단 핸드오프(상담원 연결)·상담원 응대 중인 상담은 제외.
export async function GET(req: NextRequest) {
  // Vercel Cron은 CRON_SECRET 설정 시 Authorization: Bearer <CRON_SECRET> 를 자동 첨부
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1"; // 실제 종료 없이 대상만 반환
  const now = Date.now();
  // updatedAt이 IDLE 이상 지난 열린 상담만 검사 대상 (메시지 조회 횟수 절감)
  const candidates = (await listOpenUserChats()).filter(
    (c) => now - c.updatedAt >= IDLE_MS
  );

  let closed = 0;
  const results: string[] = [];
  for (const c of candidates) {
    const msgs = await fetchRawMessages(c.id, 15);
    if (!msgs.length) continue;

    // 상담원이 응대 중이면 제외
    if (msgs.some((m) => m.personType === "manager" && m.visibleToUser && m.plainText)) continue;

    const last = msgs[msgs.length - 1];
    if (last.personType !== "bot" || !last.plainText) continue; // 봇 답변이 마지막이 아니면 제외
    if (last.plainText.includes(HANDOFF_TEXT) || last.plainText.includes(WAIT_TEXT)) continue; // 핸드오프/대기 제외
    if (now - last.createdAt < IDLE_MS) continue; // 아직 10분 안 지남

    if (dryRun) {
      results.push(c.id);
      continue;
    }
    if (await closeUserChat(c.id)) {
      closed++;
      results.push(c.id);
    }
  }

  console.log(`[auto-close]${dryRun ? "(dryRun)" : ""} 검사 ${candidates.length}건 → 종료대상 ${results.length}건`);
  return NextResponse.json({ ok: true, dryRun, candidates: candidates.length, closed, results });
}
