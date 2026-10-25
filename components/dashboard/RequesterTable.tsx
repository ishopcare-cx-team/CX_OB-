import type { RequesterStat } from "@/lib/dashboardStats";

// compact: 좁은 칸용 — 주요 키워드·최근 요청일을 뺀다
export function RequesterTable({
  data,
  total,
  compact = false,
}: {
  data: RequesterStat[];
  total: number;
  compact?: boolean;
}) {
  const denom = total || 1;

  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${compact ? "min-w-[480px]" : "min-w-[720px]"} text-left text-xs`}>
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-3 text-right font-medium">#</th>
            <th className="py-2 pr-3 font-medium">요청자</th>
            <th className="py-2 pr-3 font-medium">요청팀</th>
            <th className="py-2 pr-3 text-right font-medium">건수</th>
            <th className="py-2 pr-3 text-right font-medium">비율</th>
            <th className="py-2 pr-3 font-medium">주요 문의유형</th>
            {!compact && <th className="py-2 pr-3 font-medium">주요 키워드</th>}
            {!compact && <th className="py-2 text-right font-medium">최근 요청일</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={`${r.name}|${r.team}`} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-3 text-right tabular-nums text-gray-400">{i + 1}</td>
              <td className="py-2 pr-3 font-medium text-gray-900">{r.name}</td>
              <td className="py-2 pr-3 text-gray-600">{r.team}</td>
              <td className="py-2 pr-3 text-right font-medium tabular-nums text-gray-900">
                {r.count}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-gray-500">
                {((r.count / denom) * 100).toFixed(1)}%
              </td>
              <td className="py-2 pr-3 text-gray-600">{r.topType ?? "-"}</td>
              {!compact && (
                <td className="py-2 pr-3 text-gray-600">
                  {r.topKeywords
                    .slice(0, 3)
                    .map((k) => k.key)
                    .join(" · ") || "-"}
                </td>
              )}
              {!compact && (
                <td className="py-2 text-right tabular-nums text-gray-500">{r.lastDate ?? "-"}</td>
              )}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={compact ? 6 : 8} className="py-6 text-center text-gray-400">
                데이터 없음
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
