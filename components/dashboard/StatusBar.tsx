import { STATUS_COLORS } from "@/lib/sheetData";
import type { CountBucket } from "@/lib/dashboardStats";

export function StatusBar({ data }: { data: CountBucket[] }) {
  const total = data.reduce((a, b) => a + b.count, 0) || 1;

  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded-md bg-gray-100">
        {data.map((d, i) => {
          const pct = (d.count / total) * 100;
          if (pct <= 0) return null;
          const isLast = i === data.length - 1;
          return (
            <div
              key={d.key}
              style={{
                width: `${pct}%`,
                backgroundColor: STATUS_COLORS[d.key] ?? "#898781",
                borderRight: isLast ? undefined : "2px solid #fcfcfb",
              }}
              title={`${d.key}: ${d.count}건 (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: STATUS_COLORS[d.key] ?? "#898781" }}
            />
            <span>{d.key}</span>
            <span className="font-medium tabular-nums text-gray-900">
              {d.count}
            </span>
            <span className="text-gray-400">
              ({((d.count / total) * 100).toFixed(1)}%)
            </span>
          </li>
        ))}
        {data.length === 0 && <li className="text-gray-400">데이터 없음</li>}
      </ul>
    </div>
  );
}
