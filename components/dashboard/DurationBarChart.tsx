import { formatDurationShort } from "@/lib/sheetData";

export interface DurationBar {
  key: string;
  seconds: number | null;
}

export function DurationBarChart({
  data,
  color = "#2a78d6",
}: {
  data: DurationBar[];
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.seconds ?? 0), 1);

  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div
          key={d.key}
          className="grid grid-cols-[6.5rem_1fr_5rem] items-center gap-2 text-xs sm:grid-cols-[8.5rem_1fr_5rem]"
        >
          <span className="truncate text-gray-600" title={d.key}>
            {d.key}
          </span>
          <div className="h-4 rounded bg-gray-100">
            {d.seconds != null && (
              <div
                className="h-full rounded"
                style={{
                  width: `${(d.seconds / max) * 100}%`,
                  backgroundColor: color,
                }}
              />
            )}
          </div>
          <span className="text-right tabular-nums font-medium text-gray-900">
            {formatDurationShort(d.seconds)}
          </span>
        </div>
      ))}
      {data.length === 0 && <p className="text-gray-400">데이터 없음</p>}
    </div>
  );
}
