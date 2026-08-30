import Anthropic from "@anthropic-ai/sdk";
import { loadKnowledge } from "./knowledge";
import { serviceStatus, kstLabel } from "./businessHours";

const client = new Anthropic();

const MODEL = process.env.AI_MODEL || "claude-opus-4-8";

const HANDOFF_MARKER = "[[상담원연결]]";
const SILENT_MARKER = "[[무응답]]";
// 답변에 사용한 템플릿의 태그(내부용)를 채널톡 상담에 부착하기 위한 마커. 쉼표로 여러 개 가능.
const TAG_MARKER_RE = /\[\[태그:\s*([^\]]+?)\s*\]\]/g;

// 현재 KST 시각·운영 상태를 알리는 동적 지시 (KB 캐시 블록과 분리해 캐시 유지)
function timeDirective(): string {
  const status = serviceStatus();
  if (status === "closed") {
    return `[운영 상태] 현재 ${kstLabel()} — 상담 운영시간 외입니다. 지식베이스 최상단 [최우선 공통 규칙]에 따라, 고객 문의 내용과 무관하게 운영시간 외 안내 문구만 출력하세요. 상담원 연결·대기·순차 연결·기다려달라는 표현을 절대 쓰지 말고 ${HANDOFF_MARKER} 도 출력하지 마세요.`;
  }
  if (status === "saturdayLunch") {
    return `[운영 상태] 현재 ${kstLabel()} — 토요일 점심시간(12시~13시)으로 상담원 교대 중이라 잠시 대응이 어렵습니다. 고객 문의 내용과 무관하게 아래 안내만 출력하세요(다른 답변·템플릿·상담원 연결 표현·${HANDOFF_MARKER} 금지):\n"현재 토요일 점심시간(낮 12시~오후 1시)으로 잠시 상담원 대응이 어렵습니다. 문의 내용을 남겨주시면 오후 1시 이후 순차적으로 확인해 안내드리겠습니다."`;
  }
  return `[운영 상태] 현재 ${kstLabel()} — 상담 운영시간 내입니다. 평소 규칙대로 답변하세요. 이전 대화에 운영시간 외 안내가 있더라도 무시하고, 지금은 운영시간이므로 고객 문의에 정상적으로 답변하세요.`;
}

async function buildSystem(): Promise<Anthropic.TextBlockParam[]> {
  return [
    {
      type: "text",
      text: `당신은 아이샵케어의 고객 상담 AI입니다. 사장님(가맹점주)의 문의에 친절하고 정확하게 답변합니다.

규칙:
- (최우선) 지식베이스 최상단에 [최우선 공통 규칙]이 있으면, 다른 어떤 규칙보다 먼저 그것을 적용합니다. 특히 운영시간 관련 지시를 가장 우선합니다.
- 아래 <knowledge_base>에 있는 내용만 근거로 답변합니다. 지식베이스에 없는 내용은 추측하지 말고 상담원 연결을 안내하세요.
- [절대 금지] 전화번호·고객센터 번호·URL·계좌번호·금액·수수료·소요기간 등 구체적인 수치와 연락처는 지식베이스에 정확히 적힌 것만 글자 그대로 사용하세요. 지식베이스에 없는 번호·링크·금액을 당신의 기억이나 일반 상식으로 절대 만들어내지 마세요. 해당 정보가 지식베이스에 없으면 그 정보를 답변에 쓰지 말고, "정확한 확인이 필요하다"며 상담원 연결로 안내하세요. (예: 지식베이스에 없는 고객센터 번호를 임의로 적는 것은 심각한 오안내입니다.)
- 고객이 쓴 표현이 템플릿 제목과 글자가 달라도 의도가 같으면 그 템플릿으로 답하세요. 글자 그대로 일치하지 않는다고 핸드오프하지 마세요. (예: "AS가 필요해요" / "단말기 고장났어요" / "기계가 안 돼요" → 모두 'AS 접수 안내' 템플릿으로 답변)
- 정보를 받아 처리하는 문의(AS·접수·신청·변경 등)는 글자가 안 맞는다고 곧바로 상담원 연결로 넘기지 말고, 먼저 해당 템플릿에 따라 필요한 정보(상호명, 사업자번호, 연락처 등)를 안내·요청하세요.
- 각 템플릿에 붙은 '적용 규칙(내부용)'은 그 템플릿을 언제 쓰고 어떻게 처리할지에 대한 내부 지침입니다. 반드시 따르되, 규칙 문구 자체는 고객 답변에 절대 출력하지 마세요.
- 각 템플릿에 붙은 '태그(내부용)'은 그 템플릿으로 답변했을 때 상담에 붙여야 할 상담 태그입니다. 그 템플릿 내용을 근거로 답변한 경우, 답변 마지막 줄(고객에게 보이는 문장 뒤)에 ${HANDOFF_MARKER}/${SILENT_MARKER}와 마찬가지로 [[태그:태그명]] 형식으로 정확히 출력하세요. 태그가 여러 개면 쉼표로 구분해 [[태그:태그명1,태그명2]]처럼 한 번만 출력합니다. 태그(내부용)가 없는 템플릿이거나 템플릿 없이 답변한 경우엔 출력하지 마세요.
- 다음 주제는 템플릿 안내를 마친 뒤 상담원 연결이 필요합니다: AS 접수, 복수 가맹점 문의, 대형가맹점 문의, 문화비 소득공제(1차 안내 후). 단 한 번의 답변에 고객 안내와 ${HANDOFF_MARKER} 를 함께 넣으면 안내가 전달되지 않으니, 안내·정보요청이 끝나고 연결만 남은 시점에 ${HANDOFF_MARKER} 만 출력하세요.
- 답변은 한국어 존댓말로, 핵심만 간결하게 작성합니다. 모바일 채팅 환경이므로 3~5문장 이내를 권장합니다.
- 문의가 여러 템플릿에 해당하거나 정보가 부족해 어떤 안내가 맞는지 확정할 수 없으면, 추측해서 답하지 말고 선택지를 들어 한 번만 되물어보세요. (예: "프린터기는 유선/블루투스/Wi-Fi 세 종류가 있어요. 어떤 걸 찾으세요?")
- 고객 메시지가 이모지로 시작하는 메뉴명(예: "🍱 메뉴 추가/수정")이거나 정확히 "상담사 연결" 같은 버튼 텍스트일 때만 기존 상담 봇이 처리하므로 ${SILENT_MARKER} 만 출력하세요. 짧더라도 제품명/주제어(예: "토스포스", "프린터기")는 정상 질문이므로 답변하거나 되물어보세요.
- 고객이 상담원 연결을 원하거나, 지식베이스로 답할 수 없거나, 환불/분쟁/계정 정지 등 민감한 사안이면 답변 마지막 줄에 정확히 ${HANDOFF_MARKER} 를 출력하세요.
- 지식베이스 안에 [버튼:제목|URL] 표기가 있고 그 내용이 답변과 직접 관련되면, 답변 마지막에 해당 표기를 한 줄에 하나씩 그대로 출력하세요. 관련 없는 버튼은 출력하지 마세요. URL을 임의로 만들어내지 마세요.
- 마크다운 서식(굵게, 제목 등)은 사용하지 마세요. 채팅 메시지이므로 일반 텍스트와 줄바꿈만 사용합니다.

<knowledge_base>
${await loadKnowledge()}
</knowledge_base>`,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: timeDirective(),
    },
  ];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiAnswer {
  text: string;
  needsHandoff: boolean;
  silent: boolean;
  buttons: { title: string; url: string }[];
  tags: string[];
}

// 모델이 규칙을 어기고 임의로 넣는 마크다운 강조(**굵게**, __굵게__, # 제목)를 제거.
// 채팅 환경에서 강조 기호가 그대로 노출되지 않도록 텍스트만 남긴다.
function stripEmphasis(s: string): string {
  return s
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1") // ***굵은 기울임***
    .replace(/\*\*(.+?)\*\*/g, "$1") // **굵게**
    .replace(/__(.+?)__/g, "$1") // __굵게__
    .replace(/\*\*/g, "") // 짝 안 맞는 잔여 **
    .replace(/^\s{0,3}#{1,6}\s+/gm, ""); // # 제목
}

export async function answer(history: ChatTurn[]): Promise<AiAnswer> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: await buildSystem(),
    messages: history,
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const needsHandoff = raw.includes(HANDOFF_MARKER);
  const silent = raw.includes(SILENT_MARKER);

  // [[태그:태그명1,태그명2]] 마커 추출 (여러 번 출력돼도 전부 합침)
  const tags: string[] = [];
  const withoutTags = raw.replace(TAG_MARKER_RE, (_, names: string) => {
    tags.push(...names.split(",").map((t) => t.trim()).filter(Boolean));
    return "";
  });

  // 모델이 [버튼:제목|URL] 을 [제목|URL] 로 변형 출력하는 경우가 있어 "버튼:" 접두어는 선택적으로 매칭
  const buttons: { title: string; url: string }[] = [];
  const withoutButtons = withoutTags.replace(
    /\[(?:버튼:)?\s*([^|\]]+?)\s*\|\s*(https?:\/\/[^\]\s]+)\s*\]/g,
    (_, title, url) => {
      buttons.push({ title: title.trim(), url: url.trim() });
      return "";
    }
  );

  const text = stripEmphasis(
    withoutButtons.replace(HANDOFF_MARKER, "").replace(SILENT_MARKER, "")
  ).trim();

  // 안전망: 지식베이스에 없는 전화번호가 답변에 있으면 오안내 위험 → 답변 폐기하고 상담원 연결로 전환
  const knowledge = await loadKnowledge();
  const phoneRe = /(1\d{3}-\d{4}|0\d{1,2}-\d{3,4}-\d{4})/g;
  const kbPhones = new Set(
    (knowledge.match(phoneRe) || []).map((p) => p.replace(/-/g, ""))
  );
  const badPhones = [
    ...new Set((text.match(phoneRe) || []).map((p) => p.replace(/-/g, ""))),
  ].filter((p) => !kbPhones.has(p));
  if (badPhones.length > 0) {
    console.warn(
      `[ai] 지식베이스에 없는 전화번호 감지(${badPhones.join(", ")}) → 답변 폐기, 상담원 연결 전환`
    );
    return { text: "", needsHandoff: true, silent, buttons: [], tags: [] };
  }

  return { text, needsHandoff, silent, buttons, tags };
}
