import { NextRequest, NextResponse } from "next/server";
import { answer, ChatTurn } from "@/lib/ai";

export const maxDuration = 300;

// 로컬 테스트 UI 전용 엔드포인트 (채널톡과 무관하게 답변 품질 확인용)
export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as { messages: ChatTurn[] };

  if (!messages?.length) {
    return NextResponse.json({ error: "messages가 비어 있습니다" }, { status: 400 });
  }

  try {
    const result = await answer(messages);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("답변 생성 실패:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
