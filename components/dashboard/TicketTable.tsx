import { STATUS_COLORS, formatDurationShort, type Ticket } from "@/lib/sheetData";

export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-3 font-medium">접수 시각</th>
            <th className="py-2 pr-3 font-medium">문의유형</th>
            <th className="py-2 pr-3 font-medium">상태</th>
            <th className="py-2 pr-3 font-medium">담당자</th>
            <th className="py-2 pr-3 text-right font-medium">응답속도</th>
            <th className="py-2 pr-3 text-right font-medium">해결시간</th>
            <th className="py-2 font-medium">링크</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t, i) => (
            <tr
              key={`${t.receivedAt}-${i}`}
              className="border-b border-gray-100 last:border-0"
            >
              <td className="py-2 pr-3 tabular-nums whitespace-nowrap text-gray-600">
                {t.receivedLabel ?? "-"}
              </td>
              <td className="py-2 pr-3 text-gray-900">{t.type}</td>
              <td className="py-2 pr-3">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[t.status] ?? "#898781" }}
                  />
                  {t.status}
                </span>
              </td>
              <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                {t.agent}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap text-gray-600">
                {formatDurationShort(t.responseSec)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap text-gray-600">
                {formatDurationShort(t.resolutionSec)}
              </td>
              <td className="py-2">
                {t.link ? (
                  <a
                    href={t.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Slack
                  </a>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
          {tickets.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-gray-400">
                조건에 맞는 요청이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
