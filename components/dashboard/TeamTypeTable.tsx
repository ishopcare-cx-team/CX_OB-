import type { TeamStat } from "@/lib/dashboardStats";

// 요청팀 × 문의유형 비율표 — 칸이 진할수록 그 팀 요청 중 해당 유형 비중이 크다
export function TeamTypeTable({
  data,
  total,
  types,
  selected,
  onSelect,
}: {
  data: TeamStat[];
  total: number; // 비율 분모 (필터된 전체 요청 수)
  types: string[];
  selected?: string;
  onSelect?: (team: string) => void;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-3 font-medium">요청팀</th>
            <th className="w-[13rem] py-2 pr-3 font-medium">건수 (전체 대비)</th>
            <th className="py-2 pr-3 text-right font-medium whitespace-nowrap">요청자</th>
            {types.map((t) => (
              <th key={t} className="w-[4.5rem] py-2 pr-2 text-right font-medium leading-tight">
                {t}
              </th>
            ))}
            <th className="py-2 pl-2 font-medium">주요 키워드</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.team}
              onClick={onSelect ? () => onSelect(row.team) : undefined}
              className={`border-b border-gray-100 last:border-0 ${
                onSelect ? "cursor-pointer hover:bg-gray-50" : ""
              } ${selected === row.team ? "bg-amber-50" : ""}`}
            >
              <td className="py-2 pr-3 text-gray-900">{row.team}</td>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 flex-1 rounded bg-gray-100">
                    <div
                      className="h-full rounded bg-[#2a78d6]"
                      style={{ width: `${(row.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-[5.5rem] text-right tabular-nums text-gray-900">
                    <span className="font-medium">{row.count}</span>{" "}
                    <span className="text-gray-400">
                      ({((row.count / (total || 1)) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap text-gray-500">
                {row.requesterCount}명
              </td>
              {types.map((t) => {
                const n = row.types[t] ?? 0;
                const share = n / row.count;
                return (
                  <td key={t} className="py-1 pr-2 text-right">
                    <span
                      title={`${row.team} · ${t}: ${n}건 (${(share * 100).toFixed(1)}%)`}
                      className={`inline-block w-full rounded px-1.5 py-1 tabular-nums ${
                        share >= 0.5 ? "text-white" : "text-gray-700"
                      }`}
                      style={{ backgroundColor: `rgba(42, 120, 214, ${n ? 0.06 + share * 0.9 : 0})` }}
                    >
                      {n ? `${Math.round(share * 100)}%` : "-"}
                    </span>
                  </td>
                );
              })}
              <td className="py-2 pl-2 text-gray-600">
                {row.topKeywords
                  .slice(0, 3)
                  .map((k) => `${k.key} ${Math.round((k.count / row.count) * 100)}%`)
                  .join(" · ") || "-"}
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={types.length + 4} className="py-6 text-center text-gray-400">
                데이터 없음
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
