"use client";

import { useState, useRef, useEffect } from "react";

interface Turn {
  role: "user" | "assistant";
  content: string;
  handoff?: boolean;
}

export default function TestChat() {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next: Turn[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `오류 (${res.status})`);
      setMessages([
        ...next,
        { role: "assistant", content: data.text, handoff: data.needsHandoff },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col bg-white text-gray-900">
      <header className="border-b border-gray-200 px-5 py-4">
        <h1 className="text-lg font-bold">AI 상담봇 테스트</h1>
        <p className="text-sm text-gray-500">
          knowledge/ 폴더의 문서를 기반으로 답변합니다. 채널톡 연동 전 품질 확인용
          화면입니다.
        </p>
      </header>

      <main className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-gray-400">
            예시: &quot;매장 사진이 반려됐어요&quot;, &quot;정산 언제 들어와요?&quot;
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm " +
                (m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900")
              }
            >
              {m.content}
              {m.handoff && (
                <div className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-800">
                  ⚠ 상담원 연결 필요로 판단됨 (채널톡에서는 상담원 큐로 전환됩니다)
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-gray-100 px-4 py-2 text-sm text-gray-400">
              답변 작성 중…
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <footer className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500"
            placeholder="고객 입장에서 질문을 입력해 보세요"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
            }}
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            전송
          </button>
        </div>
      </footer>
    </div>
  );
}
