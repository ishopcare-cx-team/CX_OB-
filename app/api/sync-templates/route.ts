import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { TEMPLATE_BLOB_PATH } from "@/lib/knowledge";

interface IncomingTemplate {
  no: string;
  name: string;
  body: string;
  rule?: string; // G열 [개별 적용 규칙] — 이 템플릿을 언제/어떻게 쓰는지 (내부 판단용)
  tag?: string; // K열 [태그] — 이 템플릿으로 답변 시 상담에 부착할 채널톡 상담 태그(쉼표로 복수 가능)
}

// 구글시트 [챗봇 배포] 버튼(Apps Script)이 호출하는 템플릿 동기화 엔드포인트
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!process.env.SYNC_TOKEN || token !== process.env.SYNC_TOKEN) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const templates: IncomingTemplate[] = body?.templates;
  const commonRule: string | undefined = body?.commonRule; // 시트 H열 [최우선 공통 규칙]
  if (!Array.isArray(templates) || templates.length === 0) {
    return NextResponse.json(
      { error: "templates 배열이 비어 있습니다" },
      { status: 400 }
    );
  }
  for (const t of templates) {
    if (!t?.name?.trim() || !t?.body?.trim()) {
      return NextResponse.json(
        { error: `이름/내용이 빈 템플릿이 있습니다: ${JSON.stringify(t).slice(0, 100)}` },
        { status: 400 }
      );
    }
  }

  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const md = [
    // 시트 H열 [최우선 공통 규칙]을 KB 최상단에 배치 (다른 모든 규칙보다 우선)
    ...(commonRule?.trim()
      ? ["[최우선 공통 규칙] — 아래 모든 템플릿/규칙보다 먼저 적용합니다.", "", commonRule.trim(), "", "---", ""]
      : []),
    `# CX 문자 템플릿 (구글시트 [챗봇 배포] 버튼으로 동기화, ${templates.length}건, ${now} UTC)`,
    "",
    "아래는 고객 응대 표준 템플릿입니다. 고객 문의가 템플릿 주제와 일치하면 해당 템플릿 내용을 기반으로 답변하세요.",
    "- 템플릿 본문을 최대한 그대로 사용하되, 채팅 대화 흐름에 맞게 첫 인사말 중복 등은 자연스럽게 다듬어도 됩니다.",
    "- 템플릿에 포함된 URL, 전화번호, 절차는 절대 바꾸지 마세요.",
    "- 각 템플릿의 '적용 규칙'은 그 템플릿을 언제 쓰고 어떻게 처리할지에 대한 내부 지침입니다. 따르되, 규칙 문구 자체는 고객 답변에 절대 출력하지 마세요.",
    "- 각 템플릿의 '태그(내부용)'은 그 템플릿으로 답변했을 때 상담에 붙여야 할 상담 태그입니다. 시스템 프롬프트 규칙에 따라 [[태그:...]] 마커로 출력하세요.",
    "",
    ...templates.flatMap((t) => {
      const out = [`## [${t.no}] ${t.name.trim()}`, "", t.body.trim(), ""];
      if (t.rule?.trim()) out.push(`적용 규칙(내부용): ${t.rule.trim()}`, "");
      if (t.tag?.trim()) out.push(`태그(내부용): ${t.tag.trim()}`, "");
      return out;
    }),
  ].join("\n");

  await put(TEMPLATE_BLOB_PATH, md, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "text/markdown",
  });

  console.log(`[sync] 템플릿 ${templates.length}건 동기화 완료`);
  return NextResponse.json({ ok: true, count: templates.length });
}
