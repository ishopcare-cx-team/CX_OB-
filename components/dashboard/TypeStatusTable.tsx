import { STATUS_COLORS, STATUS_ORDER } from "@/lib/sheetData";
import type { TypeStatusCross } from "@/lib/dashboardStats";

export function TypeStatusTable({ data }: { data: TypeStatusCross[] }) {
  const statusesInData = new Set<string>();
  data.forEach((d) => Object.keys(d.counts).forEach((s) => statusesInData.add(s)));
  const columns = [
    ...STATUS_ORDER.filter((s) => statusesInData.has(s)),
    ...[...statusesInData].filter((s) => !STATUS_ORDER.includes(s)),
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-3 font-medium">문의유형</th>
            {columns.map((c) => (
              <th key={c} className="py-2 pr-3 text-right font-medium">
                <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[c] ?? "#898781" }}
                  />
                  {c}
                </span>
              </th>
            ))}
            <th className="py-2 text-right font-medium">합계</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.type} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-3 text-gray-900">{d.type}</td>
              {columns.map((c) => (
                <td
                  key={c}
                  className="py-2 pr-3 text-right tabular-nums text-gray-600"
                >
                  {d.counts[c] ?? 0}
                </td>
              ))}
              <td className="py-2 text-right tabular-nums font-medium text-gray-900">
                {d.total}
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 2}
                className="py-6 text-center text-gray-400"
              >
                데이터 없음
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
