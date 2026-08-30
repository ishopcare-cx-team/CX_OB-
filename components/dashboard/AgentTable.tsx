import type { AgentStat } from "@/lib/dashboardStats";
import { formatDurationShort } from "@/lib/sheetData";

export function AgentTable({ data }: { data: AgentStat[] }) {
  const total = data.reduce((a, b) => a + b.count, 0) || 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-3 font-medium">담당자</th>
            <th className="py-2 pr-3 text-right font-medium">처리 건수</th>
            <th className="py-2 pr-3 text-right font-medium">비율</th>
            <th className="py-2 pr-3 text-right font-medium">평균 응답속도</th>
            <th className="py-2 pr-3 text-right font-medium">평균 해결시간</th>
            <th className="py-2 text-right font-medium">완료율</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.agent} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-3 text-gray-900">{a.agent}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-gray-900">
                {a.count}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-gray-500">
                {((a.count / total) * 100).toFixed(1)}%
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-gray-600">
                {formatDurationShort(a.avgResponseSec)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-gray-600">
                {formatDurationShort(a.avgResolutionSec)}
              </td>
              <td className="py-2 text-right tabular-nums text-gray-600">
                {a.completionRate != null
                  ? `${(a.completionRate * 100).toFixed(0)}%`
                  : "-"}
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-gray-400">
                데이터 없음
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
