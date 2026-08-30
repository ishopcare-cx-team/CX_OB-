import type { Ticket } from "@/lib/sheetData";

export function PendingReviewList({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return <p className="text-sm text-gray-400">확인 중인 요청이 없습니다.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100">
      {tickets.map((t, i) => (
        <li
          key={`${t.receivedAt}-${i}`}
          className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="shrink-0 tabular-nums text-gray-500">
              {t.receivedLabel ?? "-"}
            </span>
            <span className="shrink-0 font-medium text-gray-900">{t.type}</span>
            <span className="truncate text-gray-500">{t.requester}</span>
            <span className="shrink-0 text-gray-400">담당 {t.agent}</span>
          </div>
          {t.link ? (
            <a
              href={t.link}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-md bg-violet-50 px-2 py-1 font-medium text-violet-700 hover:bg-violet-100"
            >
              메시지 확인 →
            </a>
          ) : (
            <span className="shrink-0 text-gray-300">링크 없음</span>
          )}
        </li>
      ))}
    </ul>
  );
}
