import fs from "fs";
import path from "path";
import { get } from "@vercel/blob";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
export const TEMPLATE_BLOB_PATH = "cx-templates.md";
const CACHE_TTL_MS = 60_000; // 시트 배포 후 최대 1분 내 반영

let cached: { content: string; fetchedAt: number } | null = null;

function loadLocalKnowledge(): string {
  const files = fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  return files
    .map((f) => {
      const body = fs.readFileSync(path.join(KNOWLEDGE_DIR, f), "utf-8");
      return `<document filename="${f}">\n${body}\n</document>`;
    })
    .join("\n\n");
}

// 구글시트 [챗봇 배포] 버튼으로 올라온 최신 템플릿(Blob) 우선,
// 없거나 조회 실패 시 배포본에 포함된 로컬 파일 사용
export async function loadKnowledge(): Promise<string> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.content;
  }

  let content: string | null = null;
  try {
    const result = await get(TEMPLATE_BLOB_PATH, { access: "private" });
    if (result && result.statusCode === 200 && result.stream) {
      const text = await new Response(result.stream).text();
      if (text.trim()) {
        content = `<document filename="cx-templates.md">\n${text}\n</document>`;
      }
    }
  } catch (err) {
    console.error("지식베이스 Blob 조회 실패 — 로컬 파일 사용:", err);
  }

  if (!content) content = loadLocalKnowledge();

  cached = { content, fetchedAt: Date.now() };
  return content;
}
