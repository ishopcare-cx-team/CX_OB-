import { NextRequest, NextResponse, after } from "next/server";
import { answer, ChatTurn } from "@/lib/ai";
import { isOffHours } from "@/lib/businessHours";
import {
  sendBotMessage,
  getChatInfo,
  fetchRawMessages,
  attachTags,
  HANDOFF_TEXT,
  WAIT_TEXT,
} from "@/lib/channeltalk";

// 이 워크플로우로 유입된 채팅은 AI가 응답하지 않음 (예: 815780 = 서류보완)
const BLOCKED_WORKFLOW_IDS = ["815780"];

// 채널톡 웹훅 재시도로 인한 중복 응답 방지 (메시지 ID 기준)
const processed = new Set<string>();

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== process.env.CHANNELTALK_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const entity = body?.entity;
  const userName = body?.refers?.user?.name ?? "";

  console.log(
    `[webhook] type=${body?.type} chatType=${entity?.chatType} personType=${entity?.personType} user=${userName} text=${entity?.plainText?.slice(0, 50) ?? ""}`
  );

  // 고객(user)이 보낸 유저챗 텍스트 메시지만 처리
  if (
    entity?.chatType !== "userChat" ||
    entity?.personType !== "user" ||
    !entity?.plainText ||
    !entity?.chatId
  ) {
    return NextResponse.json({ ok: true, skipped: "not a user chat message" });
  }

  // 테스트 가드 (TEST_USER_NAME 설정 시에만 동작)
  const testUser = process.env.TEST_USER_NAME;
  if (testUser && userName !== testUser) {
    console.log(`[webhook] 테스트 유저(${testUser})가 아니므로 무시: ${userName}`);
    return NextResponse.json({ ok: true, skipped: "not test user" });
  }

  // 유입 경로 가드: 카카오 상담톡(appKakao) 유입은 제외, 채널톡 위젯 유입에만 응답
  let chatInfo =
    body?.refers?.userChat?.contactMediumType !== undefined
      ? {
          contactMediumType: body.refers.userChat.contactMediumType,
          openedAt:
            body.refers.userChat.openedAt ??
            body.refers.userChat.firstOpenedAt ??
            0,
          workflowId: body.refers.userChat.source?.workflow?.id as
            | string
            | undefined,
        }
      : await getChatInfo(entity.chatId);

  if (!chatInfo) {
    return NextResponse.json({ ok: true, skipped: "chat info unavailable" });
  }

  // payload 단축 경로에 워크플로우 정보가 없으면 보충 조회 (차단 판정 정확도 확보)
  // (else 경로는 이미 getChatInfo로 workflowId를 확보했으므로 중복 조회하지 않음)
  if (
    chatInfo.workflowId === undefined &&
    body?.refers?.userChat?.contactMediumType !== undefined &&
    body?.refers?.userChat?.source === undefined
  ) {
    const full = await getChatInfo(entity.chatId);
    if (full) chatInfo = { ...chatInfo, workflowId: full.workflowId };
  }

  // 지정된 워크플로우(서류보완 등) 유입 채팅은 AI가 응답하지 않음
  if (chatInfo.workflowId && BLOCKED_WORKFLOW_IDS.includes(chatInfo.workflowId)) {
    console.log(
      `[webhook] 차단 워크플로우(${chatInfo.workflowId}) 유입 → 무응답 chatId=${entity.chatId}`
    );
    return NextResponse.json({ ok: true, skipped: "blocked workflow" });
  }
  // 카카오 상담톡 유입도 위젯과 동일하게 AI 응답 (전체 오픈).
  // 긴급 차단이 필요하면 채널톡 웹훅(id 10432)을 삭제하거나 이 분기에서 early return 복구.
  if (chatInfo.contactMediumType === "appKakao") {
    console.log(`[webhook] 카카오 유입 처리: user=${userName}`);
  }

  if (entity.id && processed.has(entity.id)) {
    return NextResponse.json({ ok: true, skipped: "duplicate" });
  }
  if (entity.id) processed.add(entity.id);

  // 웹훅 타임아웃 재시도를 막기 위해 즉시 200 응답, 처리는 응답 후 실행
  after(() => handleMessage(entity.chatId, entity.plainText, chatInfo.openedAt));

  return NextResponse.json({ ok: true });
}

async function handleMessage(
  chatId: string,
  latestText: string,
  openedAt: number
) {
  try {
    const raw = await fetchRawMessages(chatId);

    // 현재 상담 세션(마지막 재오픈 이후) 메시지만 검사
    const session = raw.filter((m) => m.createdAt >= openedAt);

    // 상담원이 이미 응대 중이면 AI는 침묵 (상담 종료 후 재문의 시 세션이 리셋되어 자동 재개)
    // 단, 배정 로그/비공개 메모가 아닌 고객에게 노출된 실제 답변만 응대로 인정
    if (
      session.some(
        (m) => m.personType === "manager" && m.visibleToUser && m.plainText
      )
    ) {
      console.log(`[webhook] 상담원 응대 중이므로 침묵 chatId=${chatId}`);
      return;
    }
    // 이번 세션에서 이미 상담원 연결을 안내했으면 상담원 대기 중
    // → 고객이 추가로 말을 걸면 쿠션 멘트를 1회만 보내고, 이후엔 침묵
    if (
      session.some(
        (m) => m.personType === "bot" && m.plainText?.includes(HANDOFF_TEXT)
      )
    ) {
      const waitSent = session.some(
        (m) => m.personType === "bot" && m.plainText?.includes(WAIT_TEXT)
      );
      if (!waitSent) {
        await sendBotMessage(chatId, WAIT_TEXT);
        console.log(`[webhook] 연결 대기 쿠션 멘트 전송 chatId=${chatId}`);
      } else {
        console.log(`[webhook] 상담원 연결 대기 중이므로 침묵 chatId=${chatId}`);
      }
      return;
    }

    // 봇의 운영시간 외/점심 안내는 이력에서 제외한다.
    // (운영시간이 됐을 때 이전 운영시간 외 답변을 모델이 답습하는 것을 방지)
    const OFFHOURS_HINTS = ["운영시간이 아닙니다", "상담원 대응이 어렵습니다"];
    let history: ChatTurn[] = raw
      .filter((m) => m.plainText)
      .filter(
        (m) =>
          m.personType === "user" ||
          !OFFHOURS_HINTS.some((h) => (m.plainText as string).includes(h))
      )
      .map((m) => ({
        role: m.personType === "user" ? ("user" as const) : ("assistant" as const),
        content: m.plainText as string,
      }));
    if (history.length === 0 || history[history.length - 1].content !== latestText) {
      history.push({ role: "user", content: latestText });
    }
    // API 규칙: 첫 메시지는 user여야 함
    const firstUser = history.findIndex((t) => t.role === "user");
    history = firstUser >= 0 ? history.slice(firstUser) : [{ role: "user", content: latestText }];

    const result = await answer(history);
    const { text, silent, buttons, tags } = result;
    // 운영시간 외에는 상담원 연결을 하지 않는다 ([최우선 공통 규칙] 3번 — 코드 안전망)
    const needsHandoff = result.needsHandoff && !isOffHours();

    if (silent) {
      console.log(`[webhook] 버튼/메뉴 선택으로 판단되어 무응답 chatId=${chatId}`);
      return;
    }

    // 답변에 사용한 템플릿의 태그를 상담에 부착 (실패해도 고객 응답 흐름은 막지 않음)
    // after() 콜백 종료 시 함수 실행이 끝나므로 await로 완료를 보장한다 (fire-and-forget 시 유실 위험).
    if (tags.length > 0) {
      try {
        await attachTags(chatId, tags);
        console.log(`[webhook] 태그 부착 완료 chatId=${chatId} tags=${tags.join(",")}`);
      } catch (err) {
        console.error(`[webhook] 태그 부착 실패 chatId=${chatId}:`, err);
      }
    }

    if (needsHandoff) {
      // 안내만 전송 — 채팅은 고객 메시지로 이미 미답변 큐에 있어 상담원이 받는다.
      // 이후 이번 세션 동안 AI는 침묵 (위 HANDOFF_TEXT 감지 로직)
      await sendBotMessage(chatId, HANDOFF_TEXT);
      console.log(`[webhook] 상담원 연결 전환 chatId=${chatId}`);
      return;
    }
    if (text) await sendBotMessage(chatId, text, buttons);
    console.log(`[webhook] 응답 완료 chatId=${chatId}`);
  } catch (err) {
    console.error(`[webhook] 처리 실패 chatId=${chatId}:`, err);
  }
}
