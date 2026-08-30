import type { CountBucket } from "@/lib/dashboardStats";

export function BarChart({ data }: { data: CountBucket[] }) {
  const total = data.reduce((a, b) => a + b.count, 0) || 1;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div
          key={d.key}
          className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-2 text-xs sm:grid-cols-[8.5rem_1fr_5.5rem]"
        >
          <span className="truncate text-gray-600" title={d.key}>
            {d.key}
          </span>
          <div className="h-4 rounded bg-gray-100">
            <div
              className="h-full rounded bg-[#2a78d6]"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="text-right tabular-nums text-gray-900">
            <span className="font-medium">{d.count}건</span>{" "}
            <span className="text-gray-400">
              ({((d.count / total) * 100).toFixed(1)}%)
            </span>
          </span>
        </div>
      ))}
      {data.length === 0 && <p className="text-gray-400">데이터 없음</p>}
    </div>
  );
}
