const BASE = "https://api.channel.io/open/v5";

function headers() {
  return {
    "Content-Type": "application/json",
    "x-access-key": process.env.CHANNELTALK_ACCESS_KEY || "",
    "x-access-secret": process.env.CHANNELTALK_ACCESS_SECRET || "",
  };
}

const BOT_NAME = process.env.CHANNELTALK_BOT_NAME || "AI상담봇";

export interface LinkButton {
  title: string;
  url: string;
}

export async function sendBotMessage(
  userChatId: string,
  text: string,
  buttons?: LinkButton[]
) {
  const post = (payload: Record<string, unknown>) =>
    fetch(
      `${BASE}/user-chats/${userChatId}/messages?botName=${encodeURIComponent(BOT_NAME)}`,
      { method: "POST", headers: headers(), body: JSON.stringify(payload) }
    );

  const body: Record<string, unknown> = {
    blocks: [{ type: "text", value: text }],
  };
  if (buttons && buttons.length > 0) {
    body.buttons = buttons.map((b) => ({
      title: b.title,
      colorVariant: "cobalt",
      url: b.url,
    }));
  }

  let res = await post(body);

  // 버튼 개수 초과 등 채널톡 제약으로 전송이 거부되면, 링크를 본문 텍스트로 합쳐
  // 버튼 없이 재전송한다. (답변 자체가 누락되는 것을 방지 — 링크는 평문으로 보존)
  if (!res.ok && buttons && buttons.length > 0) {
    const errBody = await res.text();
    console.warn(
      `[channeltalk] 버튼 ${buttons.length}개 전송 실패(${res.status}) → 텍스트 폴백. 사유: ${errBody.slice(0, 300)}`
    );
    const linkText = buttons.map((b) => `▸ ${b.title}: ${b.url}`).join("\n");
    res = await post({ blocks: [{ type: "text", value: `${text}\n\n${linkText}` }] });
  }

  if (!res.ok) {
    throw new Error(`채널톡 메시지 전송 실패 (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// 상담원 연결 안내 문구 (이 문구가 현재 세션에 있으면 AI는 침묵)
export const HANDOFF_TEXT = "상담원에게 연결해드릴게요. 잠시만 기다려주세요.";

// 연결 대기 중 고객이 추가 메시지를 보냈을 때 1회만 보내는 쿠션 멘트
export const WAIT_TEXT =
  "지금 상담원 연결을 기다리고 있어요. 순서대로 연결해 드리고 있으니 조금만 기다려 주세요.";

export interface ChatInfo {
  contactMediumType?: string;
  openedAt: number; // 현재 상담 세션 시작 시각 (재오픈 시 갱신됨)
  workflowId?: string; // 유입 워크플로우 ID (source.workflow.id)
}

// 유입 매체 + 현재 세션 시작 시각 조회
export async function getChatInfo(
  userChatId: string
): Promise<ChatInfo | null> {
  const res = await fetch(`${BASE}/user-chats/${userChatId}`, {
    headers: headers(),
  });
  if (!res.ok) {
    console.error(`채널톡 챗 조회 실패 (${res.status}): ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  const c = data.userChat ?? {};
  return {
    contactMediumType: c.contactMediumType,
    openedAt: c.openedAt ?? c.firstOpenedAt ?? 0,
    workflowId: c.source?.workflow?.id,
  };
}

export interface RawMessage {
  personType: string;
  plainText?: string;
  createdAt: number;
  // 고객에게 실제로 노출된 메시지인지 (배정 로그, 비공개 메모 등 제외)
  visibleToUser: boolean;
}

// 최근 원본 메시지 목록 (오래된 순)
export async function fetchRawMessages(
  userChatId: string,
  limit = 25
): Promise<RawMessage[]> {
  const res = await fetch(
    `${BASE}/user-chats/${userChatId}/messages?sortOrder=desc&limit=${limit}`,
    { headers: headers() }
  );
  if (!res.ok) {
    console.error(`채널톡 이력 조회 실패 (${res.status}): ${await res.text()}`);
    return [];
  }
  const data = await res.json();
  return ((data.messages ?? []) as any[])
    .reverse()
    .map((m) => {
      const opts: string[] = m.options ?? [];
      return {
        personType: m.personType,
        plainText: m.plainText,
        createdAt: m.createdAt ?? 0,
        visibleToUser:
          !m.log &&
          !opts.includes("private") &&
          !opts.includes("silentToUser"),
      };
    });
}

export interface OpenChat {
  id: string;
  updatedAt: number;
}

// 열린(opened) 상담 목록 조회 (페이징). updatedAt 포함 — 무응답 후보 선별용
export async function listOpenUserChats(): Promise<OpenChat[]> {
  const out: OpenChat[] = [];
  let since: string | undefined;
  for (let i = 0; i < 40; i++) {
    const url = `${BASE}/user-chats?state=opened&sortOrder=desc&limit=50${
      since ? `&since=${encodeURIComponent(since)}` : ""
    }`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
      console.error(`채널톡 열린 상담 조회 실패 (${res.status})`);
      break;
    }
    const data = await res.json();
    for (const c of (data.userChats ?? []) as any[]) {
      out.push({ id: c.id, updatedAt: c.updatedAt ?? 0 });
    }
    since = data.next;
    if (!since) break;
  }
  return out;
}

// 상담 자동 종료 (PATCH close). 성공 시 true
export async function closeUserChat(userChatId: string): Promise<boolean> {
  const res = await fetch(
    `${BASE}/user-chats/${userChatId}/close?botName=${encodeURIComponent(BOT_NAME)}`,
    { method: "PATCH", headers: headers() }
  );
  if (!res.ok) {
    console.error(`채널톡 상담 종료 실패 (${res.status}): ${await res.text()}`);
    return false;
  }
  return true;
}

// 태그(userChat.tags) API는 URL 버저닝(/open/v5)이 아닌 Channel-Version 헤더 방식만 지원
const CHANNEL_VERSION = "2026-06-01";
function versionedHeaders() {
  return { ...headers(), "Channel-Version": CHANNEL_VERSION };
}

const MAX_CHAT_TAGS = 8;

// 현재 상담에 붙어 있는 태그 목록 조회
async function getUserChatTags(userChatId: string): Promise<string[]> {
  const res = await fetch(`https://api.channel.io/open/user-chats/${userChatId}`, {
    headers: versionedHeaders(),
  });
  if (!res.ok) {
    console.error(`채널톡 태그 조회 실패 (${res.status}): ${await res.text()}`);
    return [];
  }
  const data = await res.json();
  return (data?.userChat?.tags ?? []) as string[];
}

// 상담에 태그 추가 부착 (채널톡 태그 API는 전체 교체 방식이라 기존 태그와 합쳐서 전송).
// 태그는 채널톡 관리자에 미리 등록돼 있어야 하며, 상담당 최대 8개까지만 허용됨.
export async function attachTags(
  userChatId: string,
  newTags: string[]
): Promise<boolean> {
  if (newTags.length === 0) return true;

  const current = await getUserChatTags(userChatId);
  const merged = [...new Set([...current, ...newTags])];

  if (merged.length === current.length) return true; // 추가할 태그가 이미 다 붙어있음

  if (merged.length > MAX_CHAT_TAGS) {
    console.warn(
      `[channeltalk] 태그 ${merged.length}개가 상담당 최대 ${MAX_CHAT_TAGS}개를 초과해 뒤에서부터 잘림 chatId=${userChatId}`
    );
  }
  const final = merged.slice(0, MAX_CHAT_TAGS);

  const res = await fetch(`https://api.channel.io/open/user-chats/${userChatId}`, {
    method: "PATCH",
    headers: versionedHeaders(),
    body: JSON.stringify({ tags: final }),
  });
  if (!res.ok) {
    console.error(`채널톡 태그 부착 실패 (${res.status}): ${await res.text()}`);
    return false;
  }
  return true;
}

